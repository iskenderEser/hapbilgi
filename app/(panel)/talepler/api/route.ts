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
import type { HedefRol } from "@/app/(panel)/talepler/_types";
import { ECZANEM_TALEP_ACAN_ROLLER, ECLUB_HEDEF_ROLLER, TUM_HEDEF_ROLLER } from "@/lib/utils/roller";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TALEP_ALANLARI, haritalaTalep } from "@/lib/utils/talepZinciri";
import { zincirHaritasi, asamaCoz, uretimBittiMi, iptalEdildiMi } from "@/lib/utils/uretimZinciri";
import { hazirParametreKontrol } from "@/lib/uretim/parametreKontrol";

// TalepTuru tipinin tüm geçerli değerlerinin runtime listesi —
// TALEP_TURU_KURALLARI'nın anahtarlarından türetilir, hardcoded liste yok.
const GECERLI_TALEP_TURLERI = Object.keys(TALEP_TURU_KURALLARI) as TalepTuru[];

// Formun sunduğu beş hedefin tamamı kabul edilir (B-05: eczaci/eczane_teknisyeni
// daha önce listede yoktu, form-API tutarsızlığı üretiyordu). Tek kaynak roller.ts;
// 'eczanem' için ek şart: yalnız ürün müdürü ailesi açabilir (İP-§4.1, aşağıda).
const GECERLI_HEDEF_ROLLER: HedefRol[] = TUM_HEDEF_ROLLER;

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

    let query = supabase
      .from("talepler")
      // Künye alanları ortak listeden; kalanlar bu listeye özel.
      .select(`
        ${TALEP_ALANLARI},
        takim_id, firma_id, urun_id, teknik_id, hazir_video_url
      `)
      .order("created_at", { ascending: false });

    // Görünürlük RLS'te (Adım 4): üretici yalnız kendi talebini, İU hepsini —
    // bu yüzden okuma OTURUMLA yapılır, elle uretici_id süzgeci kalktı (Adım 5).
    // İU istisnası (V1-5, İskender 21.07) İŞ KURALI olarak KALIR: hazır video
    // talepleri İU'nun Talepler listesinde görünmez (İU için tek görünüm Soru
    // Setleri kaydıdır). Bu bir görünürlük/sahiplik kuralı değil, liste kuralıdır;
    // RLS'e girmez, burada durur.
    if (isIU) {
      query = query.eq("hazir_video", false);
    }

    const { data: talepler, error } = await query;
    if (error) return hataYaniti("Talepler çekilemedi.", "talepler tablosu SELECT", error);

    // Künye ortak çeviriciden (25.07, Aşama 3): ad kuralı ve varsayılanlar tek
    // yerde. Bu listeye özel alanlar (takım, firma/ürün/teknik kimlikleri, hazır
    // video adresi) künyenin üstüne eklenir — künyeye girmezler, yalnız burada
    // ve talep formunda kullanılırlar.
    const kunyeler = (talepler ?? []).map((t: any) => ({
      ...haritalaTalep(t),
      takim_id: t.takim_id,
      firma_id: t.firma_id,
      urun_id: t.urun_id,
      teknik_id: t.teknik_id,
      hazir_video_url: t.hazir_video_url,
    }));

    // Zincir durumu (27.07): sayfa artık talepleri "devam eden" ve "iptal edilen"
    // diye ayırıyor, bitmiş olanları hiç göstermiyor (onlar Yayın Listesi'nde).
    // Bu ayrım ancak talebin üretim zincirinin nerede olduğu bilinirse yapılabilir.
    // Kaskad ortak dosyada — ana sayfayla aynı cevabı vermesi böyle garanti edilir.
    // View service_role yetkilidir; oturum istemcisiyle değil adminSupabase ile okunur.
    const zincirler = await zincirHaritasi(adminSupabase, {
      talepIdler: kunyeler.map((t) => t.talep_id),
    });

    const durumlar = new Map<string, ReturnType<typeof asamaCoz>>();
    for (const t of kunyeler) {
      const z = zincirler.get(t.talep_id);
      if (z) durumlar.set(t.talep_id, asamaCoz(t, z));
    }

    // İÇERİK ÜRETİCİSİ ADI: iptal tablosunda "iş kimdeydi" görünsün. Tek toplu
    // sorgu — talep başına ad çözmek N+1 olurdu (üretici ana sayfasının dersi).
    const iuIdler = [...new Set(
      [...durumlar.values()].map((d) => d.iu_id).filter((id): id is string => !!id),
    )];
    const iuAdlari = new Map<string, string>();
    if (iuIdler.length > 0) {
      const { data: iular } = await adminSupabase
        .from("kullanicilar")
        .select("kullanici_id, ad, soyad")
        .in("kullanici_id", iuIdler);
      for (const k of iular ?? []) iuAdlari.set(k.kullanici_id, `${k.ad ?? ""} ${k.soyad ?? ""}`.trim());
    }

    const sonuc = kunyeler.map((t) => {
      // Zincir satırı yoksa talep henüz hiçbir aşamaya girmemiş sayılır; sessizce
      // düşürmek yerine "devam eden" kabul edilir — liste kayıt kaybetmemeli.
      const durum = durumlar.get(t.talep_id);
      return {
        ...t,
        asama: durum?.asama ?? "Senaryo",
        durum_kodu: durum?.durum_kodu ?? "iu_iletildi",
        uretim_bitti: durum ? uretimBittiMi(durum) : false,
        iptal_edildi: durum ? iptalEdildiMi(durum) : false,
        iu_ad_soyad: durum?.iu_id ? (iuAdlari.get(durum.iu_id) ?? null) : null,
      };
    });

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
      urun_id, teknik_id, urun_adi, aciklama,
      hazir_video, hazir_soru_seti, hazir_soru_seti_verisi,
      soru_seti_buyuklugu, secenek_sayisi, video_basi_soru_sayisi,
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

    // İçerik türü TALEP TÜRÜNDEN gelir (rolün tek icerikTuru'sundan değil) ve
    // talebe yazılıp DONAR — rol sonradan değişse bile içeriğin türü değişmez.
    // Bir rol birden çok talep türü açabildiğinden (ör. med_md: medikal_egitim
    // ile urun_medikal_egitim) içerik türü talebe göre ayrışır.
    const icerikTuru = TALEP_TURU_KURALLARI[egitimTuru].icerikTuru;

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
    // Teknik, teknik-siz hedeflerde (Eczanem + E-Club: eczaci/eczane_teknisyeni)
    // zorunlu değildir: son tüketiciye/eczacıya satış tekniği anlatılmaz, alan
    // formda gizlidir (useTalepFormu teknikGosterilsin ile simetri — B-05).
    const tekniksizHedef = eczanemHedefi || ECLUB_HEDEF_ROLLER.includes(hedefRol);
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
        hedef_rol: hedefRol,
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

    // Bildirim mesajı — künyedeki ad kuralı ürünlü/ürünsüz ayrımını zaten çözer;
    // hiçbiri yoksa tür adına düşer.
    const turAdi = TALEP_TURU_KURALLARI[egitimTuru].ad;
    const yeniKunye = haritalaTalep(yeniTalep);
    const bildirimBasligi = yeniKunye.urun_adi !== "-" ? yeniKunye.urun_adi : turAdi;

    // G-3 (İskender kararı 19.07): hazır video taleplerinde açılış bildirimi gitmez —
    // IU'nun işi ya hiç yoktur (video+set hazır) ya da video yüklemesi tamamlanınca
    // doğar (yalnız video hazır; bildirim o anda gider — hazır zincir modülü, G-2;
    // V1-5/V1-6 ile onay ara adımı kalktı, tetik yükleme anıdır).
    if (!hazir_video) {
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
    }

    return NextResponse.json({
      mesaj: "Talep oluşturuldu.",
      talep: {
        ...yeniKunye,
        takim_id: (yeniTalep as any).takim_id,
        firma_id: (yeniTalep as any).firma_id,
        urun_id: (yeniTalep as any).urun_id,
        teknik_id: (yeniTalep as any).teknik_id,
        hazir_soru_seti_verisi: (yeniTalep as any).hazir_soru_seti_verisi ?? null,
      }
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /talepler/api");
  }
}