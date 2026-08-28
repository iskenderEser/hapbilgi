import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { bunnyPodcastDestekYoluOlustur, bunnyUploadBilgisi, yuklemeYetkisiOlustur } from "@/lib/ogrenmeAraci/bunnyStorage";
import { podcastDestekDosyasiDogrula, type PodcastDestekDosyasiRolu } from "@/lib/ogrenmeAraci/sozlesme";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const { arac_id } = await params;
    const body = await request.json();
    const rolDosya = body.dosya_rolu as PodcastDestekDosyasiRolu;
    if (!arac_id || !["kapak", "transkript"].includes(rolDosya)) return validasyonHatasi("Podcast destek dosyası rolü geçersiz.", ["dosya_rolu"]);
    if (typeof body.dosya_adi !== "string" || typeof body.mime_type !== "string" || typeof body.dosya_boyutu !== "number") {
      return validasyonHatasi("Podcast destek dosyası beyanı eksik.", ["dosya_adi", "mime_type", "dosya_boyutu"]);
    }

    const karar = podcastDestekDosyasiDogrula({ rol: rolDosya, dosyaAdi: body.dosya_adi, mimeType: body.mime_type, dosyaBoyutu: body.dosya_boyutu });
    if (!karar.ok || typeof body.checksum_sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(body.checksum_sha256)) {
      return validasyonHatasi(karar.ok ? "SHA-256 dosya özeti zorunludur." : karar.hata, ["dosya_adi", "mime_type", "dosya_boyutu", "checksum_sha256"]);
    }

    const db = createAdminClient();
    const { data: arac } = await db.from("ogrenme_araclari").select("arac_id, talep_id, arac_turu").eq("arac_id", arac_id).maybeSingle();
    if (!arac || arac.arac_turu !== "podcast") return NextResponse.json({ hata: "Podcast öğrenme aracı bulunamadı." }, { status: 404 });
    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const dosyaYolu = bunnyPodcastDestekYoluOlustur({ firmaId: yetki.firmaId, talepId: arac.talep_id, aracId: arac_id, rol: rolDosya, uzanti: karar.uzanti });
    const upload = bunnyUploadBilgisi();
    const yuklemeYetkisi = yuklemeYetkisiOlustur({
      aracId: arac_id,
      kullaniciId: user.id,
      dosyaYolu,
      dosyaBoyutu: body.dosya_boyutu,
      mimeType: body.mime_type.toLowerCase(),
      checksumSha256: body.checksum_sha256.toLowerCase(),
    });
    if (!upload || !yuklemeYetkisi) return NextResponse.json({ hata: "Bunny öğrenme aracı yükleme servisi yapılandırılmamış." }, { status: 503 });

    return NextResponse.json({
      arac_id,
      dosya_yolu: dosyaYolu,
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
    return sunucuHatasi(error, "POST podcast destek yükleme başlat");
  }
}
