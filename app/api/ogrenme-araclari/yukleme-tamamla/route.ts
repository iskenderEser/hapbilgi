import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { bunnyNesneBilgisi, yuklemeMakbuzuDogrula } from "@/lib/ogrenmeAraci/bunnyStorage";
import { dosyaImzasiDogrula, yeniOgrenmeAraciTuruMu } from "@/lib/ogrenmeAraci/sozlesme";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";

interface YuklemeBeyani {
  dosya_adi?: string;
  mime_type?: string;
  dosya_boyutu?: number;
  checksum_sha256?: string;
}

async function temizlemeKaydiOlustur(
  db: SupabaseClient,
  aracId: string,
  metadata: Record<string, unknown>,
  dosyaYolu: string,
  sebep: string,
): Promise<void> {
  const { error: kuyrukHatasi } = await db
    .from("ogrenme_araci_depolama_temizleme_kuyrugu")
    .insert({
      arac_id: aracId,
      dosya_yolu: dosyaYolu,
      sebep,
      durum: "bekliyor",
    });
  if (kuyrukHatasi && kuyrukHatasi.code !== "23505") {
    console.error("[ÖĞRENME ARACI] Depolama temizleme kuyruğu yazılamadı:", kuyrukHatasi);
  }
  const { error: metadataHatasi } = await db
    .from("ogrenme_araclari")
    .update({
      metadata: {
        ...metadata,
        depolama_temizleme: {
          durum: "bekliyor",
          dosya_yolu: dosyaYolu,
          sebep,
          kayit_tarihi: new Date().toISOString(),
        },
      },
    })
    .eq("arac_id", aracId)
    .eq("metadata_dogrulandi", false);
  if (metadataHatasi) {
    console.error("[ÖĞRENME ARACI] Depolama temizleme metadata kaydı yazılamadı:", metadataHatasi);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const { arac_id, yukleme_makbuzu } = await request.json();
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
    const metadata = (arac.metadata as Record<string, unknown> | null) ?? {};
    const beyanChecksum = beyan.checksum_sha256?.toLowerCase() ?? "";
    if (
      typeof beyan.mime_type !== "string"
      || typeof beyan.dosya_boyutu !== "number"
      || !/^[0-9a-f]{64}$/.test(beyanChecksum)
    ) {
      return NextResponse.json({ hata: "Yükleme dosya beyanı geçersiz." }, { status: 422 });
    }
    if (
      typeof yukleme_makbuzu !== "string"
      || !yuklemeMakbuzuDogrula({
        makbuz: yukleme_makbuzu,
        aracId: arac_id,
        kullaniciId: user.id,
        dosyaYolu: arac.dosya_yolu,
        dosyaBoyutu: beyan.dosya_boyutu,
        mimeType: beyan.mime_type,
        checksumSha256: beyanChecksum,
      })
    ) {
      return NextResponse.json({ hata: "Yükleme tamamlama makbuzu geçersiz." }, { status: 401 });
    }

    const nesne = await bunnyNesneBilgisi(arac.dosya_yolu);
    if (!nesne) return NextResponse.json({ hata: "Bunny Storage dosyası bulunamadı." }, { status: 422 });
    if (nesne.dosyaBoyutu !== beyan.dosya_boyutu) {
      await temizlemeKaydiOlustur(db, arac_id, metadata, arac.dosya_yolu, "dosya_boyutu_eslesmedi");
      return NextResponse.json({ hata: "Storage dosya boyutu yükleme beyanıyla eşleşmiyor." }, { status: 422 });
    }
    if (!dosyaImzasiDogrula(arac.arac_turu, nesne.ilkBaytlar)) {
      await temizlemeKaydiOlustur(db, arac_id, metadata, arac.dosya_yolu, "dosya_imzasi_eslesmedi");
      return NextResponse.json({ hata: "Dosyanın gerçek türü seçilen öğrenme aracıyla eşleşmiyor." }, { status: 422 });
    }
    if (nesne.checksumSha256 && nesne.checksumSha256 !== beyanChecksum) {
      await temizlemeKaydiOlustur(db, arac_id, metadata, arac.dosya_yolu, "checksum_eslesmedi");
      return NextResponse.json({ hata: "Storage dosya özeti yükleme beyanıyla eşleşmiyor." }, { status: 422 });
    }

    const dogrulamaMetadata = {
      ...metadata,
      depolama_dogrulamasi: {
        dosya_imzasi: { dogrulandi: true, kaynak: "storage_range" },
        dosya_boyutu: { dogrulandi: true, kaynak: "storage_content_range" },
        mime_turu: { dogrulandi: true, beyan: beyan.mime_type },
        checksum: {
          dogrulandi: true,
          deger: beyanChecksum,
          edge_makbuzu_dogrulandi: true,
          bunny_basligi_mevcut: nesne.checksumSha256 !== null,
          checksum_bunny_tarafindan_dogrulandi: nesne.checksumSha256 === beyanChecksum,
        },
        tamamlanma_tarihi: new Date().toISOString(),
      },
    };
    const { data: sonuc, error: kayitHatasi } = await db.rpc(
      "ogrenme_araci_yukleme_dogrulama_kaydet",
      {
        p_arac_id: arac_id,
        p_degistiren_id: user.id,
        p_mime_type: beyan.mime_type,
        p_dosya_boyutu: nesne.dosyaBoyutu,
        p_checksum_sha256: beyanChecksum,
        p_metadata: dogrulamaMetadata,
      },
    );
    if (kayitHatasi) {
      return NextResponse.json({ hata: "Dosya doğrulaması atomik olarak kaydedilemedi." }, { status: 500 });
    }
    return NextResponse.json({
      arac_id,
      durum: "dogrulama_bekliyor",
      tekrar_istek: Boolean((sonuc as { tekrar_istek?: boolean } | null)?.tekrar_istek),
    });
  } catch (error) {
    return sunucuHatasi(error, "POST /api/ogrenme-araclari/yukleme-tamamla");
  }
}
