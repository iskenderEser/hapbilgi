import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import { bunnyAracDestekYoluOlustur, bunnyUploadBilgisi, yuklemeYetkisiOlustur } from "@/lib/ogrenmeAraci/bunnyStorage";
import { podcastDestekDosyasiDogrula, type PodcastDestekDosyasiRolu } from "@/lib/ogrenmeAraci/sozlesme";
import { iuOgrenmeAraciGorevYetkisiniDogrula, uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi } from "@/lib/uretim/rpc";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (![IU_ROLU, ...URETICI_ROLLER].includes(rol)) return rolHatasi("Bu işlem üretim hattı rollerine açıktır.");

    const { arac_id } = await params;
    const body = await request.json();
    const rolDosya = body.dosya_rolu as PodcastDestekDosyasiRolu;
    if (!arac_id || !["kapak", "transkript"].includes(rolDosya)) return validasyonHatasi("Destek dosyası rolü geçersiz.", ["dosya_rolu"]);
    if (typeof body.dosya_adi !== "string" || typeof body.mime_type !== "string" || typeof body.dosya_boyutu !== "number") {
      return validasyonHatasi("Destek dosyası beyanı eksik.", ["dosya_adi", "mime_type", "dosya_boyutu"]);
    }

    const karar = podcastDestekDosyasiDogrula({ rol: rolDosya, dosyaAdi: body.dosya_adi, mimeType: body.mime_type, dosyaBoyutu: body.dosya_boyutu });
    if (!karar.ok || typeof body.checksum_sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(body.checksum_sha256)) {
      return validasyonHatasi(karar.ok ? "SHA-256 dosya özeti zorunludur." : karar.hata, ["dosya_adi", "mime_type", "dosya_boyutu", "checksum_sha256"]);
    }

    const { data: arac } = await db.from("ogrenme_araclari").select("arac_id, talep_id, arac_turu, kaynak, metadata").eq("arac_id", arac_id).maybeSingle();
    const destekRoluGecerli = arac && (arac.arac_turu === "podcast" || (arac.arac_turu === "flip_pdf" && rolDosya === "kapak"));
    if (!destekRoluGecerli) return NextResponse.json({ hata: "Öğrenme aracı veya destek dosyası rolü geçersiz." }, { status: 404 });
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });
    if (arac.kaynak === "iu") {
      if (!uuidGecerliMi(body.gorev_id)) return validasyonHatasi("Geçerli görev kimliği zorunludur.", ["gorev_id"]);
      const gorevYetkisi = await iuOgrenmeAraciGorevYetkisiniDogrula({
        db, gorevId: body.gorev_id, talepId: arac.talep_id, kullaniciId: user.id, aracId: arac_id,
      });
      if (!gorevYetkisi.ok) return NextResponse.json({ hata: gorevYetkisi.hata }, { status: gorevYetkisi.status });
    }

    const yuklemeGirisimiId = rolDosya === "kapak" ? randomUUID() : null;
    const dosyaYolu = bunnyAracDestekYoluOlustur({
      firmaId: yetki.firmaId,
      talepId: arac.talep_id,
      aracId: arac_id,
      aracTuru: arac.arac_turu as "podcast" | "flip_pdf",
      rol: rolDosya,
      uzanti: karar.uzanti,
      girisimId: yuklemeGirisimiId ?? undefined,
    });
    const upload = bunnyUploadBilgisi();
    const yuklemeYetkisi = yuklemeYetkisiOlustur({
      aracId: arac_id,
      kullaniciId: user.id,
      dosyaYolu,
      dosyaBoyutu: body.dosya_boyutu,
      mimeType: body.mime_type.toLowerCase(),
      checksumSha256: body.checksum_sha256.toLowerCase(),
    });
    if (!upload || !yuklemeYetkisi) return NextResponse.json({ hata: "Öğrenme aracı yükleme hizmeti yapılandırılmamış." }, { status: 503 });

    // İstek Bunny'ye ulaşıp tamamlama isteği geri dönemese bile iptalde nesne
    // yolunun bulunabilmesi için destek yolu aktarım başlamadan kalıcılaştırılır.
    let yolHatasi: { code?: string; message?: string } | null = null;
    if (rolDosya === "kapak" && yuklemeGirisimiId) {
      const sonuc = await db.rpc("ogrenme_araci_kapak_yukleme_baslat_atomik", {
        p_arac_id: arac_id,
        p_kullanici_id: user.id,
        p_girisim_id: yuklemeGirisimiId,
        p_dosya_yolu: dosyaYolu,
      });
      yolHatasi = sonuc.error;
    } else {
      const metadata = (arac.metadata as Record<string, unknown> | null) ?? {};
      const bekleyenYollar = (metadata.bekleyen_destek_yollari as Record<string, unknown> | null) ?? {};
      const sonuc = await db.from("ogrenme_araclari").update({
        metadata: {
          ...metadata,
          bekleyen_destek_yollari: { ...bekleyenYollar, [rolDosya]: dosyaYolu },
        },
      }).eq("arac_id", arac_id);
      yolHatasi = sonuc.error;
    }
    if (yolHatasi) return NextResponse.json({ hata: "Destek yükleme yolu kaydedilemedi." }, { status: 500 });

    return NextResponse.json({
      arac_id,
      dosya_yolu: dosyaYolu,
      yukleme_girisimi_id: yuklemeGirisimiId,
      yukleme_token: yuklemeYetkisi.token,
      yukleme: {
        endpoint: upload.endpoint,
        headers: {
          "Content-Type": body.mime_type.toLowerCase(),
          "x-arac-id": arac_id,
          "x-kullanici-id": user.id,
          "x-dosya-yolu": dosyaYolu,
          "x-dosya-boyutu": String(body.dosya_boyutu),
          "x-checksum-sha256": body.checksum_sha256.toLowerCase(),
          "x-yukleme-token": yuklemeYetkisi.token,
        },
      },
    }, { status: 201 });
  } catch (error) {
    return sunucuHatasi(error, "POST öğrenme aracı destek yükleme başlat");
  }
}
