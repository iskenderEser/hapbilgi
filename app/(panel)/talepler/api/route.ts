// app/talepler/api/route.ts
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
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";
import { hazirParametreKontrol } from "@/lib/uretim/parametreKontrol";

// Talep formu ve raporlarla ortak kanonik eğitim türü sırası.
const GECERLI_TALEP_TURLERI = TALEP_TURU_SIRA;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);

    // Yetenek profili — talep oluşturma yetkisinin ve davranış kurallarının kaynağı.
    const yetenek = ureticiYetenegi(rol);
    if (!yetenek) return rolHatasi("Sadece üretici roller talep oluşturabilir.");

    const { data: kullaniciKaydi, error: kullaniciError } = await adminSupabase
      .from("kullanicilar")
      .select("takim_id, firma_id")
      .eq("kullanici_id", user.id)
      .single();

    const kullaniciKontrol = veriKontrol(kullaniciKaydi, "kullanicilar tablosu SELECT — üretici takim_id/firma_id", "Kullanıcı kaydı bulunamadı.");
    if (!kullaniciKontrol.gecerli) return kullaniciKontrol.yanit;
    if (kullaniciError) return hataYaniti("Kullanıcı bilgisi sorgulanırken hata oluştu.", "kullanicilar tablosu SELECT", kullaniciError);

    // firma_id her üretici için zorunlu (talepler.firma_id NOT NULL FK).
    if (!kullaniciKaydi.firma_id) {
      return validasyonHatasi("Firma kaydı eksik. Lütfen admin ile iletişime geçin.", ["firma_id"]);
    }

    // takim_id zorunluluğu yetenek profilinden okunur.
    if (yetenek.takimZorunlu && !kullaniciKaydi.takim_id) {
      return validasyonHatasi("Takım kaydı eksik. Lütfen admin ile iletişime geçin.", ["takim_id"]);
    }

    const body = await request.json();
    const {
      egitim_turu,
      hedef_roller,
      urun_id, teknik_id, urun_adi, aciklama,
      hazir_video, hazir_soru_seti, hazir_soru_seti_verisi,
      soru_seti_buyuklugu, secenek_sayisi, video_basi_soru_sayisi,
    } = body;

    // egitim_turu validasyonu — tip kontrolü
    const egitimTuru = egitim_turu as TalepTuru;
    if (!GECERLI_TALEP_TURLERI.includes(egitimTuru)) {
      return validasyonHatasi("Eğitim türü geçersiz.", ["egitim_turu"]);
    }

    const hedefRoller = hedefRolleriDogrula(hedef_roller);
    if (!hedefRoller) {
      return validasyonHatasi("Hedef kitle seçimi geçersizdir.", ["hedef_roller"]);
    }

    if (hedefRoller.some((hedef) => !hedefRolIkUreticisineAcikMi(rol, hedef))) {
      return rolHatasi("İK rolleri Eczacı veya Eczane Teknisyeni hedefli talep oluşturamaz.");
    }

    // Eczanem hedefli talebi yalnızca ürün müdürü ailesi açabilir (İP-§4.1) —
    // form seçeneği zaten gizlidir, bu sunucu tarafı doğrulamasıdır.
    if (hedefRoller.includes("eczanem") && !ECZANEM_TALEP_ACAN_ROLLER.includes(rol)) {
      return rolHatasi("Eczanem hedefli talebi yalnızca Ürün Müdürü açabilir.");
    }

    // Yetenek-bilinçli talep türü validasyonu — rol bu türde talep açabiliyor mu?
    if (!yetenek.acabilecegiTalepTurleri.includes(egitimTuru)) {
      return validasyonHatasi(
        `${rol} rolü "${egitimTuru}" türünde talep açamaz.`,
        ["egitim_turu"],
      );
    }

    // İçerik türü TALEP TÜRÜNDEN gelir (rolün tek icerikTuru'sundan değil) ve
    // talebe yazılıp DONAR — rol sonradan değişse bile içeriğin türü değişmez.
    // Bir rol birden çok talep türü açabildiğinden (ör. med_md: medikal_egitim
    // ile urun_medikal_egitim) içerik türü talebe göre ayrışır.
    const icerikTuru = TALEP_TURU_KURALLARI[egitimTuru].icerikTuru;

    // Ürün ve teknik zorunluluğu — TALEP_TURU_KURALLARI'ndan okunur.
    const turKurali = TALEP_TURU_KURALLARI[egitimTuru];
    const eczanemHedefi = hedefRoller.includes("eczanem");

    if (turKurali.urun === "zorunlu" && !urun_id) {
      return validasyonHatasi("Ürün seçimi zorunludur.", ["urun_id"]);
    }
    // Eczanem'de puan/indirim ürüne kilitlidir (dörtlü kilit) — ürün tür
    // kuralından bağımsız olarak şarttır (İP-§4.3).
    if (eczanemHedefi && !urun_id) {
      return validasyonHatasi("Eczanem hedefli talepte ürün seçimi zorunludur.", ["urun_id"]);
    }
    // Teknik, teknik-siz hedeflerde (Eczanem + E-Club: eczaci/eczane_teknisyeni)
    // zorunlu değildir: son tüketiciye/eczacıya satış tekniği anlatılmaz, alan
    // formda gizlidir (useTalepFormu teknikGosterilsin ile simetri — B-05).
    const tekniksizHedef = eczanemHedefi || hedefRoller.some((hedef) => ECLUB_HEDEF_ROLLER.includes(hedef));
    if (!tekniksizHedef && turKurali.teknik === "zorunlu" && !teknik_id) {
      return validasyonHatasi("Teknik seçimi zorunludur.", ["teknik_id"]);
    }

    // INSERT'e yazılacak urun_id/teknik_id — kural "yok" ise NULL'a zorla;
    // teknik-siz hedeflerde teknik her hâlükârda NULL'dur.
    const insertUrunId = turKurali.urun === "yok" && !eczanemHedefi ? null : (urun_id ?? null);
    const insertTeknikId = turKurali.teknik === "yok" || tekniksizHedef ? null : (teknik_id ?? null);

    // Ürün de teknik de olmayan türlerde (medikal_egitim, ik_egitimi) izleyiciye
    // görünecek ad talepler.urun_adi'na yazılır (İskender 24.07). Diğer türlerde
    // ad urun_id join'inden geldiğinden urun_adi NULL kalır.
    const serbestTuru = turKurali.urun === "yok" && turKurali.teknik === "yok" && !eczanemHedefi;
    if (serbestTuru && !(typeof urun_adi === "string" && urun_adi.trim())) {
      return validasyonHatasi("Eğitim/İçerik adı zorunludur.", ["urun_adi"]);
    }
    const insertUrunAdi = serbestTuru ? (urun_adi as string).trim() : null;

    if (hazir_soru_seti && !hazir_soru_seti_verisi) {
      return validasyonHatasi("Hazır soru seti verisi zorunludur.", ["hazir_soru_seti_verisi"]);
    }

    const soruSetiBuyuklugu = soru_seti_buyuklugu ?? 25;
    const videoBasisSoruSayisi = video_basi_soru_sayisi ?? 2;
    const secenekSayisi = secenek_sayisi ?? 4;

    if (![10, 15, 20, 25].includes(soruSetiBuyuklugu)) return validasyonHatasi("Soru seti büyüklüğü 10, 15, 20 veya 25 olmalıdır.", ["soru_seti_buyuklugu"]);
    if (![2, 3, 4].includes(secenekSayisi)) return validasyonHatasi("Seçenek sayısı 2, 3 veya 4 olmalıdır.", ["secenek_sayisi"]);
    if (videoBasisSoruSayisi < 1 || videoBasisSoruSayisi > soruSetiBuyuklugu) return validasyonHatasi(`Video başı soru sayısı 1 ile ${soruSetiBuyuklugu} arasında olmalıdır.`, ["video_basi_soru_sayisi"]);

    // Hazır set parametre kilidi TALEP ANINDA (25.07 — hatalı üretim süreçleri planı §3.1):
    // uyumsuz set eskiden DB'ye girer, saatler sonra video yüklemesinde patlar ve zinciri
    // yarım bırakırdı. Kural artık girdide uygulanır; kural tek yerde (parametreKontrol).
    if (hazir_soru_seti) {
      const parametreHatasi = hazirParametreKontrol(
        soruSetiBuyuklugu,
        videoBasisSoruSayisi,
        Array.isArray(hazir_soru_seti_verisi) ? hazir_soru_seti_verisi.length : null,
      );
      if (parametreHatasi) return validasyonHatasi(parametreHatasi, ["hazir_soru_seti_verisi"]);
    }

    const { data: yeniTalep, error } = await adminSupabase
      .from("talepler")
      .insert({
        uretici_id: user.id,
        firma_id: kullaniciKaydi.firma_id,
        takim_id: kullaniciKaydi.takim_id ?? null,
        egitim_turu: egitimTuru,
        hedef_roller: hedefRoller,
        icerik_turu: icerikTuru,
        urun_id: insertUrunId,
        teknik_id: insertTeknikId,
        urun_adi: insertUrunAdi,
        aciklama: aciklama?.trim() ?? null,
        hazir_video: hazir_video ?? false,
        hazir_soru_seti: hazir_soru_seti ?? false,
        hazir_soru_seti_verisi: hazir_soru_seti_verisi ?? null,
        soru_seti_buyuklugu: soruSetiBuyuklugu,
        secenek_sayisi: secenekSayisi,
        video_basi_soru_sayisi: videoBasisSoruSayisi,
      })
      // Künye alanları ortak listeden; kalanlar bu yanıta özel.
      .select(`
        ${TALEP_ALANLARI},
        takim_id, firma_id, urun_id, teknik_id, hazir_soru_seti_verisi
      `)
      .single();

    if (error) return hataYaniti("Talep oluşturulamadı.", "talepler tablosu INSERT", error);

    const yeniKunye = haritalaTalep(yeniTalep);

    const { error: gorevError } = await adminSupabase.rpc("uretim_talep_ilk_gorevini_ac", {
      p_talep_id: yeniKunye.talep_id,
      p_uretici_id: user.id,
      p_islem_anahtari: crypto.randomUUID(),
    });
    if (gorevError) {
      const { error: geriAlmaError } = await adminSupabase.from("talepler").delete().eq("talep_id", yeniKunye.talep_id);
      return hataYaniti(
        geriAlmaError ? "Talep oluşturuldu ancak üretim görevi açılamadı; kayıt otomatik geri alınamadı." : "Üretim görevi açılamadığı için talep oluşturma geri alındı.",
        "uretim_talep_ilk_gorevini_ac RPC",
        gorevError,
      );
    }

    const ozelAlanlar = yeniTalep as unknown as {
      takim_id: string | null;
      firma_id: string;
      urun_id: string | null;
      teknik_id: string | null;
      hazir_soru_seti_verisi: unknown;
    };

    return NextResponse.json({
      mesaj: "Talep oluşturuldu.",
      talep: {
        ...yeniKunye,
        takim_id: ozelAlanlar.takim_id,
        firma_id: ozelAlanlar.firma_id,
        urun_id: ozelAlanlar.urun_id,
        teknik_id: ozelAlanlar.teknik_id,
        hazir_soru_seti_verisi: ozelAlanlar.hazir_soru_seti_verisi ?? null,
      }
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api");
  }
}
