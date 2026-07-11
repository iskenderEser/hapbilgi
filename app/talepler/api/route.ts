// app/talepler/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { cokluBildirimOlustur } from "@/lib/utils/bildirimOlustur";
import {
  ureticiYetenegi,
  TALEP_TURU_KURALLARI,
  type TalepTuru,
} from "@/lib/uretici/yetenekler";
import type { HedefRol } from "@/app/talepler/_types";
import { ECZANEM_TALEP_ACAN_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";

// TalepTuru tipinin tüm geçerli değerlerinin runtime listesi —
// TALEP_TURU_KURALLARI'nın anahtarlarından türetilir, hardcoded liste yok.
const GECERLI_TALEP_TURLERI = Object.keys(TALEP_TURU_KURALLARI) as TalepTuru[];

// Bu formdan açılabilecek hedef rollerin bilinçli alt kümesi (DB CHECK'i daha
// geniştir): eczaci/eczane_teknisyeni üretimi ayrı akışta. 'eczanem' U4 ile
// açıldı — ek şart: yalnız ürün müdürü ailesi açabilir (İP-§4.1, aşağıda).
const GECERLI_HEDEF_ROLLER: HedefRol[] = ["utt", "bm", "eczanem"];

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const rol = await rolCozucu(adminSupabase, user.id);
    const isIU = rol === "iu";
    const yetenek = ureticiYetenegi(rol);

    if (!yetenek && !isIU) {
      return rolHatasi("Sadece üretici roller ve IU taleplerine erişebilir.");
    }

    let query = adminSupabase
      .from("talepler")
      .select(`
        talep_id, uretici_id, takim_id, firma_id, aciklama, hazir_video, hazir_video_url, dosya_urls, created_at,
        urun_id, teknik_id, egitim_turu, hedef_rol, icerik_turu,
        hazir_soru_seti,
        soru_seti_buyuklugu, video_basi_soru_sayisi,
        urunler(urun_adi),
        teknikler(teknik_adi)
      `)
      .order("created_at", { ascending: false });

    // Talep görünürlük kuralı: üretici sadece kendi açtığı talepleri görür.
    // IU tüm talepleri görür (talebe cevap vermek için tüm taleplere erişimi gerekir).
    if (yetenek) {
      query = query.eq("uretici_id", user.id);
    }

    const { data: talepler, error } = await query;
    if (error) return hataYaniti("Talepler çekilemedi.", "talepler tablosu SELECT", error);

    const sonuc = (talepler ?? []).map((t: any) => ({
      talep_id: t.talep_id,
      uretici_id: t.uretici_id,
      takim_id: t.takim_id,
      firma_id: t.firma_id,
      urun_id: t.urun_id,
      teknik_id: t.teknik_id,
      egitim_turu: t.egitim_turu ?? "urun_egitimi",
      hedef_rol: t.hedef_rol ?? "utt",
      icerik_turu: t.icerik_turu ?? null,
      urun_adi: t.urunler?.urun_adi ?? t.urun_adi ?? "-",
      teknik_adi: t.teknikler?.teknik_adi ?? t.teknik_adi ?? "-",
      aciklama: t.aciklama,
      hazir_video: t.hazir_video,
      hazir_video_url: t.hazir_video_url,
      hazir_soru_seti: t.hazir_soru_seti ?? false,
      soru_seti_buyuklugu: t.soru_seti_buyuklugu ?? 25,
      video_basi_soru_sayisi: t.video_basi_soru_sayisi ?? 2,
      dosya_urls: t.dosya_urls,
      created_at: t.created_at,
    }));

    return NextResponse.json({ talepler: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /talepler/api");
  }
}

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

    // İçerik türü, üreticinin yetenek profilinden gelir ve talebe yazılıp DONAR
    // (rol sonradan değişse bile içeriğin türü değişmez).
    const icerikTuru = yetenek.icerikTuru;

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
      hedef_rol,
      urun_id, teknik_id, aciklama,
      hazir_video, hazir_soru_seti, hazir_soru_seti_verisi,
      soru_seti_buyuklugu, video_basi_soru_sayisi,
    } = body;

    // egitim_turu validasyonu — tip kontrolü
    const egitimTuru = egitim_turu as TalepTuru;
    if (!GECERLI_TALEP_TURLERI.includes(egitimTuru)) {
      return validasyonHatasi("Eğitim türü geçersiz.", ["egitim_turu"]);
    }

    // hedef_rol validasyonu — geçerli alt küme kontrolü.
    const hedefRol = hedef_rol as HedefRol;
    if (!hedefRol || !GECERLI_HEDEF_ROLLER.includes(hedefRol)) {
      return validasyonHatasi("Hedef rol seçimi zorunludur.", ["hedef_rol"]);
    }

    // Eczanem hedefli talebi yalnızca ürün müdürü ailesi açabilir (İP-§4.1) —
    // form seçeneği zaten gizlidir, bu sunucu tarafı doğrulamasıdır.
    if (hedefRol === "eczanem" && !ECZANEM_TALEP_ACAN_ROLLER.includes(rol)) {
      return rolHatasi("Eczanem hedefli talebi yalnızca Ürün Müdürü açabilir.");
    }

    // Yetenek-bilinçli talep türü validasyonu — rol bu türde talep açabiliyor mu?
    if (!yetenek.acabilecegiTalepTurleri.includes(egitimTuru)) {
      return validasyonHatasi(
        `${rol} rolü "${egitimTuru}" türünde talep açamaz.`,
        ["egitim_turu"],
      );
    }

    // Ürün ve teknik zorunluluğu — TALEP_TURU_KURALLARI'ndan okunur.
    const turKurali = TALEP_TURU_KURALLARI[egitimTuru];
    const eczanemHedefi = hedefRol === "eczanem";

    if (turKurali.urun === "zorunlu" && !urun_id) {
      return validasyonHatasi("Ürün seçimi zorunludur.", ["urun_id"]);
    }
    // Eczanem'de puan/indirim ürüne kilitlidir (dörtlü kilit) — ürün tür
    // kuralından bağımsız olarak şarttır (İP-§4.3).
    if (eczanemHedefi && !urun_id) {
      return validasyonHatasi("Eczanem hedefli talepte ürün seçimi zorunludur.", ["urun_id"]);
    }
    // Teknik, teknik-siz hedeflerde (Eczanem — E-Club deseni) zorunlu değildir:
    // son tüketiciye satış tekniği anlatılmaz, alan formda gizlidir.
    if (!eczanemHedefi && turKurali.teknik === "zorunlu" && !teknik_id) {
      return validasyonHatasi("Teknik seçimi zorunludur.", ["teknik_id"]);
    }

    // INSERT'e yazılacak urun_id/teknik_id — kural "yok" ise NULL'a zorla;
    // Eczanem'de teknik her hâlükârda NULL'dur.
    const insertUrunId = turKurali.urun === "yok" && !eczanemHedefi ? null : (urun_id ?? null);
    const insertTeknikId = turKurali.teknik === "yok" || eczanemHedefi ? null : (teknik_id ?? null);

    if (hazir_soru_seti && !hazir_soru_seti_verisi) {
      return validasyonHatasi("Hazır soru seti verisi zorunludur.", ["hazir_soru_seti_verisi"]);
    }

    const soruSetiBuyuklugu = soru_seti_buyuklugu ?? 25;
    const videoBasisSoruSayisi = video_basi_soru_sayisi ?? 2;

    if (![10, 15, 20, 25].includes(soruSetiBuyuklugu)) return validasyonHatasi("Soru seti büyüklüğü 10, 15, 20 veya 25 olmalıdır.", ["soru_seti_buyuklugu"]);
    if (videoBasisSoruSayisi < 1 || videoBasisSoruSayisi > soruSetiBuyuklugu) return validasyonHatasi(`Video başı soru sayısı 1 ile ${soruSetiBuyuklugu} arasında olmalıdır.`, ["video_basi_soru_sayisi"]);

    const { data: yeniTalep, error } = await adminSupabase
      .from("talepler")
      .insert({
        uretici_id: user.id,
        firma_id: kullaniciKaydi.firma_id,
        takim_id: kullaniciKaydi.takim_id ?? null,
        egitim_turu: egitimTuru,
        hedef_rol: hedefRol,
        icerik_turu: icerikTuru,
        urun_id: insertUrunId,
        teknik_id: insertTeknikId,
        aciklama: aciklama?.trim() ?? null,
        hazir_video: hazir_video ?? false,
        hazir_soru_seti: hazir_soru_seti ?? false,
        hazir_soru_seti_verisi: hazir_soru_seti_verisi ?? null,
        soru_seti_buyuklugu: soruSetiBuyuklugu,
        video_basi_soru_sayisi: videoBasisSoruSayisi,
      })
      .select(`
        talep_id, takim_id, firma_id, hazir_video, created_at,
        urun_id, teknik_id, egitim_turu, hedef_rol, icerik_turu,
        hazir_soru_seti, hazir_soru_seti_verisi,
        soru_seti_buyuklugu, video_basi_soru_sayisi,
        urunler(urun_adi),
        teknikler(teknik_adi)
      `)
      .single();

    if (error) return hataYaniti("Talep oluşturulamadı.", "talepler tablosu INSERT", error);

    // Bildirim mesajı — ürünlü talepte ürün adı, ürünsüzde tür adı.
    const turAdi = TALEP_TURU_KURALLARI[egitimTuru].ad;
    const bildirimBasligi = (yeniTalep as any).urunler?.urun_adi ?? turAdi;

    // Tüm IU kullanıcılarına bildirim gönder
    const { data: iuKullanicilar } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id")
      .eq("rol", "iu")
      .eq("aktif_mi", true);

    const iuIdler = (iuKullanicilar ?? []).map((k: any) => k.kullanici_id);

    await cokluBildirimOlustur({
      adminSupabase,
      alici_idler: iuIdler,
      gonderen_id: user.id,
      kayit_turu: "talep",
      kayit_id: (yeniTalep as any).talep_id,
      mesaj: `Yeni talep: ${bildirimBasligi}`,
    });

    return NextResponse.json({
      mesaj: "Talep oluşturuldu.",
      talep: {
        ...yeniTalep,
        egitim_turu: egitimTuru,
        hedef_rol: hedefRol,
        urun_adi: (yeniTalep as any).urunler?.urun_adi ?? "-",
        teknik_adi: (yeniTalep as any).teknikler?.teknik_adi ?? "-",
      }
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api");
  }
}