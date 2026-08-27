import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { bunnyNesneBilgisi } from "@/lib/ogrenmeAraci/bunnyStorage";
import { dosyaImzasiDogrula, yeniOgrenmeAraciTuruMu } from "@/lib/ogrenmeAraci/sozlesme";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";

interface YuklemeBeyani {
  dosya_adi?: string;
  mime_type?: string;
  dosya_boyutu?: number;
  checksum_sha256?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const { arac_id } = await request.json();
    if (typeof arac_id !== "string" || !arac_id) return validasyonHatasi("arac_id zorunludur.", ["arac_id"]);

    const db = createAdminClient();
    const { data: arac, error: aracError } = await db
      .from("ogrenme_araclari")
      .select("arac_id, talep_id, arac_turu, dosya_yolu, metadata, metadata_dogrulandi, mime_type, dosya_boyutu, checksum_sha256")
      .eq("arac_id", arac_id)
      .maybeSingle();
    if (aracError || !arac) return NextResponse.json({ hata: "Öğrenme aracı bulunamadı." }, { status: 404 });
    if (!yeniOgrenmeAraciTuruMu(arac.arac_turu) || !arac.dosya_yolu) {
      return NextResponse.json({ hata: "Bu kayıt ortak Storage yükleme akışına ait değil." }, { status: 422 });
    }

    const rol = await rolCozucu(db, user.id);
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const { data: sonDurum, error: durumError } = await db
      .from("ogrenme_araci_durumu")
      .select("arac_durum_id, durum")
      .eq("arac_id", arac_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (durumError || !sonDurum) return NextResponse.json({ hata: "Öğrenme aracı durumu bulunamadı." }, { status: 404 });
    if (sonDurum.durum === "dogrulama_bekliyor") {
      return NextResponse.json({ arac_id, durum: sonDurum.durum, tekrar_istek: true }, { status: 200 });
    }
    if (sonDurum.durum !== "yukleme_bekliyor") {
      return NextResponse.json({ hata: "Bu öğrenme aracının yüklemesi artık tamamlanamaz." }, { status: 409 });
    }

    const beyan = ((arac.metadata as { yukleme_beyani?: YuklemeBeyani } | null)?.yukleme_beyani ?? {});
    const nesne = await bunnyNesneBilgisi(arac.dosya_yolu);
    if (!nesne) return NextResponse.json({ hata: "Bunny Storage dosyası bulunamadı." }, { status: 422 });
    if (nesne.dosyaBoyutu !== beyan.dosya_boyutu) {
      return NextResponse.json({ hata: "Storage dosya boyutu yükleme beyanıyla eşleşmiyor." }, { status: 422 });
    }
    if (!dosyaImzasiDogrula(arac.arac_turu, nesne.ilkBaytlar)) {
      return NextResponse.json({ hata: "Dosyanın gerçek türü seçilen öğrenme aracıyla eşleşmiyor." }, { status: 422 });
    }
    const beyanChecksum = beyan.checksum_sha256?.toLowerCase() ?? "";
    if (!/^[0-9a-f]{64}$/.test(beyanChecksum)) return NextResponse.json({ hata: "Yükleme dosya özeti geçersiz." }, { status: 422 });
    if (nesne.checksumSha256 && nesne.checksumSha256 !== beyanChecksum) {
      return NextResponse.json({ hata: "Storage dosya özeti yükleme beyanıyla eşleşmiyor." }, { status: 422 });
    }

    const dogrulamaMetadata = {
      ...(arac.metadata as Record<string, unknown>),
      depolama_dogrulamasi: {
        imza_dogrulandi: true,
        boyut_dogrulandi: true,
        checksum_bunny_tarafindan_dogrulandi: true,
        tamamlanma_tarihi: new Date().toISOString(),
      },
    };
    const { error: updateError } = await db
      .from("ogrenme_araclari")
      .update({
        mime_type: beyan.mime_type,
        dosya_boyutu: nesne.dosyaBoyutu,
        checksum_sha256: beyanChecksum,
        metadata: dogrulamaMetadata,
        metadata_dogrulandi: false,
      })
      .eq("arac_id", arac_id)
      .eq("metadata_dogrulandi", false);
    if (updateError) return NextResponse.json({ hata: "Dosya doğrulaması kaydedilemedi." }, { status: 500 });

    const { error: durumEkleError } = await db.from("ogrenme_araci_durumu").insert({
      arac_id,
      durum: "dogrulama_bekliyor",
      degistiren_id: user.id,
      notlar: "Storage boyutu, SHA-256 özeti ve dosya imzası doğrulandı; araca özel metadata doğrulaması bekleniyor.",
    });
    if (durumEkleError) return NextResponse.json({ hata: "Dosya doğrulandı ancak araç durumu güncellenemedi." }, { status: 500 });

    return NextResponse.json({ arac_id, durum: "dogrulama_bekliyor" }, { status: 200 });
  } catch (error) {
    return sunucuHatasi(error, "POST /api/ogrenme-araclari/yukleme-tamamla");
  }
}
