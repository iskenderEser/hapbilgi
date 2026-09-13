// app/(panel)/talepler/api/taslak/route.ts
//
// Üretici V2/V4 Hazır Podcast Kalıcı Taslak Oluşturma Ucu
//
// Kullanıcı "AI ile Transkript Oluştur" butonuna bastığında nihai "Gönderiniz"
// öncesinde tekrar güvenli (idempotent) biçimde kalıcı talep_id ve arac_id üretir.
// Taslak talep aktif operasyonlara girmez, görev veya yayın zinciri başlatmaz.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import {
  ureticiYetenegi,
  TALEP_TURU_KURALLARI,
  TALEP_TURU_SIRA,
  type TalepTuru,
} from "@/lib/uretici/yetenekler";
import { ECZANEM_TALEP_ACAN_ROLLER, ECLUB_HEDEF_ROLLER, hedefRolIkUreticisineAcikMi, hedefRolleriDogrula } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { teknikFirmayaAitMi, urunFirmayaAitMi } from "@/lib/uretici/talepKaynakSahipligi";
import { ogrenmeAraciAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { uretimRpcHataYaniti, uuidGecerliMi } from "@/lib/uretim/rpc";

const GECERLI_TALEP_TURLERI = TALEP_TURU_SIRA;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    const yetenek = ureticiYetenegi(rol);
    if (!yetenek) return rolHatasi("Sadece üretici roller podcast taslağını sorgulayabilir.");

    const { data: kullaniciKaydi, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    const kullaniciKontrol = veriKontrol(kullaniciKaydi, "kullanicilar tablosu SELECT — üretici firma_id", "Kullanıcı kaydı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError || !kullaniciKaydi?.firma_id) {
      return validasyonHatasi("Firma kaydı eksik. Lütfen admin ile iletişime geçin.", ["firma_id"]);
    }

    const { searchParams } = new URL(request.url);
    const talepId = searchParams.get("talep_id");
    const oturumAnahtari = searchParams.get("oturum_anahtari");

    let query = adminSupabase
      .from("talepler")
      .select(`
        talep_id,
        uretici_id,
        firma_id,
        takim_id,
        durum,
        taslak_mi,
        egitim_turu,
        hedef_roller,
        icerik_turu,
        ogrenme_araci_turu,
        ogrenme_araci_tercihleri,
        urun_id,
        teknik_id,
        urun_adi,
        aciklama,
        hazir_video,
        hazir_soru_seti,
        hazir_soru_seti_verisi,
        soru_seti_buyuklugu,
        secenek_sayisi,
        video_basi_soru_sayisi,
        taslak_oturum_anahtari,
        created_at,
        updated_at
      `)
      .eq("uretici_id", user.id)
      .eq("firma_id", kullaniciKaydi.firma_id)
      .eq("taslak_mi", true)
      .eq("ogrenme_araci_turu", "podcast")
      .eq("hazir_video", true);

    if (talepId && uuidGecerliMi(talepId)) {
      query = query.eq("talep_id", talepId);
    } else if (oturumAnahtari && uuidGecerliMi(oturumAnahtari)) {
      query = query.eq("taslak_oturum_anahtari", oturumAnahtari);
    } else {
      query = query.order("updated_at", { ascending: false }).limit(1);
    }

    const { data: talep, error: talepHata } = await query.maybeSingle();

    if (talepHata) {
      return uretimRpcHataYaniti("Taslak sorgulanamadı.", "talepler tablosu SELECT", talepHata);
    }

    if (!talep) {
      return NextResponse.json({ ok: true, taslak: null });
    }

    const { data: arac } = await adminSupabase
      .from("ogrenme_araclari")
      .select("arac_id, talep_id, arac_turu, dosya_yolu, kapak_yolu, transkript_yolu, metadata")
      .eq("talep_id", talep.talep_id)
      .eq("arac_turu", "podcast")
      .maybeSingle();

    const metadata = (arac?.metadata as Record<string, unknown> | null) ?? {};
    const transkript = (metadata.transkript as Record<string, unknown> | null) ?? null;

    const sesYuklendi = Boolean(arac?.dosya_yolu);
    const sesDosyaAdi =
      (typeof metadata.dosya_adi === "string" && metadata.dosya_adi) ||
      (typeof metadata.orijinal_dosya_adi === "string" && metadata.orijinal_dosya_adi) ||
      (sesYuklendi ? "podcast.mp3" : null);

    const kapakYuklendi = Boolean(arac?.kapak_yolu);
    const kapakDosyaAdi =
      (typeof metadata.kapak_dosya_adi === "string" && metadata.kapak_dosya_adi) ||
      (kapakYuklendi ? "kapak.jpg" : null);

    const transkriptDurumu = (transkript?.durum as string | undefined) ?? "yok";
    const taslakMetin =
      (transkriptDurumu === "ai_bekliyor" || transkriptDurumu === "ai_isleniyor")
        ? null
        : ((transkript?.taslak_metin as string | undefined) ??
          (typeof metadata.transkript_metni === "string" ? metadata.transkript_metni : ""));
    const onaylananMetin = (transkript?.onaylanan_metin as string | undefined) ?? null;
    const onaylandi = Boolean(onaylananMetin || metadata.transkript_onaylandi);

    return NextResponse.json({
      ok: true,
      taslak: {
        talep_id: talep.talep_id,
        arac_id: arac?.arac_id ?? null,
        oturum_anahtari: talep.taslak_oturum_anahtari,
        egitim_turu: talep.egitim_turu,
        hedef_roller: talep.hedef_roller ?? [],
        urun_id: talep.urun_id ?? null,
        teknik_id: talep.teknik_id ?? null,
        urun_adi: talep.urun_adi ?? null,
        aciklama: talep.aciklama ?? "",
        ogrenme_araci_turu: talep.ogrenme_araci_turu,
        hazir_video: talep.hazir_video,
        hazir_soru_seti: Boolean(talep.hazir_soru_seti),
        hazir_soru_seti_verisi: talep.hazir_soru_seti_verisi ?? null,
        soru_seti_buyuklugu: talep.soru_seti_buyuklugu ?? 25,
        secenek_sayisi: talep.secenek_sayisi ?? 4,
        video_basi_soru_sayisi: talep.video_basi_soru_sayisi ?? 2,
        ses_yuklendi: sesYuklendi,
        ses_dosya_adi: sesDosyaAdi,
        kapak_yuklendi: kapakYuklendi,
        kapak_dosya_adi: kapakDosyaAdi,
        transkript: {
          durum: transkriptDurumu,
          taslak_metin: taslakMetin,
          onaylanan_metin: onaylananMetin,
          onaylandi,
          ai_girisim_id: (transkript?.ai_girisim_id as string | undefined) ?? null,
        },
      },
    });
  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api/taslak");
  }
}


export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);

    // 1. Üretici rol doğrulaması
    const yetenek = ureticiYetenegi(rol);
    if (!yetenek) return rolHatasi("Sadece üretici roller podcast taslağı oluşturabilir.");

    // 2. Firma sahipliği doğrulaması
    const { data: kullaniciKaydi, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    const kullaniciKontrol = veriKontrol(kullaniciKaydi, "kullanicilar tablosu SELECT — üretici firma_id", "Kullanıcı kaydı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError || !kullaniciKaydi?.firma_id) {
      return validasyonHatasi("Firma kaydı eksik. Lütfen admin ile iletişime geçin.", ["firma_id"]);
    }

    const body = await request.json();
    const {
      oturum_anahtari,
      egitim_turu,
      hedef_roller,
      urun_id,
      teknik_id,
      urun_adi,
      aciklama,
      ogrenme_araci_turu,
      ogrenme_araci_tercihleri,
      hazir_video,
      hazir_soru_seti,
      hazir_soru_seti_verisi,
      soru_seti_buyuklugu,
      secenek_sayisi,
      video_basi_soru_sayisi,
    } = body;

    // Tekrar güvenliği: form oturum anahtarı (UUID) zorunludur
    if (!uuidGecerliMi(oturum_anahtari)) {
      return validasyonHatasi("Form oturum anahtarı (UUID) zorunludur.", ["oturum_anahtari"]);
    }

    // 3. Podcast türü doğrulaması
    if (ogrenme_araci_turu !== "podcast") {
      return validasyonHatasi("Taslak API'si yalnızca podcast türü için kullanılabilir.", ["ogrenme_araci_turu"]);
    }
    if (!ogrenmeAraciAcikMi("podcast")) {
      return NextResponse.json({ hata: "Podcast öğrenme aracı henüz kullanıma açık değil." }, { status: 423 });
    }

    // 4. Hazır V2/V4 kapsam doğrulaması — V1/V3 bu API'yi kullanamaz
    if (hazir_video !== true) {
      return validasyonHatasi(
        "Taslak API'si yalnızca hazır podcast (V2/V4) akışı için geçerlidir. V1 ve V3 bu API'yi kullanamaz.",
        ["hazir_video"]
      );
    }

    // 5. Temel form alanları doğrulaması
    const egitimTuru = egitim_turu as TalepTuru;
    if (!GECERLI_TALEP_TURLERI.includes(egitimTuru)) {
      return validasyonHatasi("Eğitim türü geçersiz.", ["egitim_turu"]);
    }

    if (!yetenek.acabilecegiTalepTurleri.includes(egitimTuru)) {
      return validasyonHatasi(`${rol} rolü "${egitimTuru}" türünde talep taslağı açamaz.`, ["egitim_turu"]);
    }

    const hedefRoller = hedefRolleriDogrula(hedef_roller);
    if (!hedefRoller) {
      return validasyonHatasi("Hedef kitle seçimi geçersizdir.", ["hedef_roller"]);
    }

    if (hedefRoller.some((hedef) => !hedefRolIkUreticisineAcikMi(rol, hedef))) {
      return rolHatasi("İK rolleri Eczacı veya Eczane Teknisyeni hedefli talep oluşturamaz.");
    }

    if (hedefRoller.includes("eczanem") && !ECZANEM_TALEP_ACAN_ROLLER.includes(rol)) {
      return rolHatasi("Eczanem hedefli talebi yalnızca Ürün Müdürü açabilir.");
    }

    const icerikTuru = TALEP_TURU_KURALLARI[egitimTuru].icerikTuru;
    const turKurali = TALEP_TURU_KURALLARI[egitimTuru];
    const eczanemHedefi = hedefRoller.includes("eczanem");

    if (turKurali.urun === "zorunlu" && !urun_id) {
      return validasyonHatasi("Ürün seçimi zorunludur.", ["urun_id"]);
    }
    if (eczanemHedefi && !urun_id) {
      return validasyonHatasi("Eczanem hedefli talepte ürün seçimi zorunludur.", ["urun_id"]);
    }

    const tekniksizHedef = eczanemHedefi || hedefRoller.some((hedef) => ECLUB_HEDEF_ROLLER.includes(hedef));
    if (!tekniksizHedef && turKurali.teknik === "zorunlu" && !teknik_id) {
      return validasyonHatasi("Teknik seçimi zorunludur.", ["teknik_id"]);
    }

    const insertUrunId = turKurali.urun === "yok" && !eczanemHedefi ? null : (urun_id ?? null);
    const insertTeknikId = turKurali.teknik === "yok" || tekniksizHedef ? null : (teknik_id ?? null);

    // Enjeksiyon savunması: Seçilen ürün veya teknik üreticinin firmasına ait olmalı
    if (insertTeknikId && !(await teknikFirmayaAitMi(adminSupabase, insertTeknikId, kullaniciKaydi.firma_id))) {
      return validasyonHatasi("Seçilen teknik firmanıza ait değil.", ["teknik_id"]);
    }
    if (insertUrunId && !(await urunFirmayaAitMi(adminSupabase, insertUrunId, kullaniciKaydi.firma_id))) {
      return validasyonHatasi("Seçilen ürün firmanıza ait değil.", ["urun_id"]);
    }

    const serbestTuru = turKurali.urun === "yok" && turKurali.teknik === "yok" && !eczanemHedefi;
    if (serbestTuru && !(typeof urun_adi === "string" && urun_adi.trim())) {
      return validasyonHatasi("Eğitim/İçerik adı zorunludur.", ["urun_adi"]);
    }
    const insertUrunAdi = serbestTuru ? (urun_adi as string).trim() : null;

    const atomikTalepVerisi = {
      uretici_id: user.id,
      firma_id: kullaniciKaydi.firma_id,
      takim_id: kullaniciKaydi.takim_id ?? null,
      egitim_turu: egitimTuru,
      hedef_roller: hedefRoller,
      icerik_turu: icerikTuru,
      ogrenme_araci_turu: "podcast",
      ogrenme_araci_tercihleri: ogrenme_araci_tercihleri ?? {},
      urun_id: insertUrunId,
      teknik_id: insertTeknikId,
      urun_adi: insertUrunAdi,
      aciklama: aciklama?.trim() ?? null,
      hazir_video: true,
      hazir_soru_seti: Boolean(hazir_soru_seti),
      hazir_soru_seti_verisi: hazir_soru_seti_verisi ?? null,
      soru_seti_buyuklugu: soru_seti_buyuklugu ?? 25,
      secenek_sayisi: secenek_sayisi ?? 4,
      video_basi_soru_sayisi: video_basi_soru_sayisi ?? 2,
    };

    const { data: atomikSonuc, error: atomikHata } = await adminSupabase.rpc("podcast_taslak_atomik_olustur", {
      p_uretici_id: user.id,
      p_oturum_anahtari: oturum_anahtari,
      p_talep: atomikTalepVerisi,
    });

    if (atomikHata) {
      return uretimRpcHataYaniti("Podcast taslağı oluşturulamadı.", "podcast_taslak_atomik_olustur RPC", atomikHata);
    }

    const sonuc = atomikSonuc as {
      talep_id?: string;
      arac_id?: string;
      mevcut?: boolean;
      taslak_mi?: boolean;
    } | null;

    if (!uuidGecerliMi(sonuc?.talep_id) || !uuidGecerliMi(sonuc?.arac_id)) {
      return hataYaniti("Podcast taslağı oluşturulamadı.", "podcast_taslak_atomik_olustur RPC sonucu", {
        message: "Geçerli talep_id veya arac_id dönmedi.",
      });
    }

    return NextResponse.json({
      ok: true,
      talep_id: sonuc.talep_id,
      arac_id: sonuc.arac_id,
      mevcut: Boolean(sonuc.mevcut),
      taslak_mi: true,
      mesaj: sonuc.mevcut ? "Mevcut taslak oturumu getirildi." : "Kalıcı podcast taslağı oluşturuldu.",
    }, { status: sonuc.mevcut ? 200 : 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api/taslak");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    const yetenek = ureticiYetenegi(rol);
    if (!yetenek) return rolHatasi("Sadece üretici roller podcast taslağını iptal edebilir.");

    const { searchParams } = new URL(request.url);
    let talepId = searchParams.get("talep_id");
    if (!talepId) {
      try {
        const body = await request.json();
        talepId = body?.talep_id;
      } catch {
        // body yoksa devam et
      }
    }

    if (!uuidGecerliMi(talepId)) {
      return validasyonHatasi("Geçerli bir talep_id zorunludur.", ["talep_id"]);
    }

    const { data: iptalSonucu, error: iptalHatasi } = await adminSupabase.rpc(
      "podcast_taslak_iptal_et_atomik",
      {
        p_talep_id: talepId,
        p_kullanici_id: user.id,
      }
    );

    if (iptalHatasi) {
      return uretimRpcHataYaniti("Taslak iptal edilemedi.", "podcast_taslak_iptal_et_atomik RPC", iptalHatasi);
    }

    return NextResponse.json({
      ok: true,
      talep_id: talepId,
      mesaj: "Podcast taslağı başarıyla iptal edildi ve dosyalar temizleme kuyruğuna alındı.",
    });
  } catch (err) {
    return sunucuHatasi(err, "DELETE /talepler/api/taslak");
  }
}
