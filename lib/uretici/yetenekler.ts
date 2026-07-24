/**
 * Üretici Rollerin Yetenek Profilleri
 * ===================================
 *
 * Bu dosya, HapBilgi sisteminde "üretici" olarak tanımlanan rollerin
 * (talep açan, içerik ürettiren roller) yetenek profillerini kodlar.
 *
 * MİMARİ KARAR — NEDEN BURADA, NEDEN DB'DE DEĞİL?
 *
 * Bu profiller Türkiye ilaç sektörünün rol tanımlarını ve HapBilgi
 * platformunun üretim hattı tasarımını yansıtır. Firma bazında
 * (A firması, B firması) değişmez — çünkü tabandaki rol hiyerarşisi
 * sektörün kendi yapısıdır, HapBilgi'nin keşfettiği bir şey değildir.
 *
 * Bu profillerin değişmesi gerekiyorsa, bu değişiklik HapBilgi'nin
 * temel tasarımının bir parçasıdır ve kod değişikliği gerektirir
 * (talep formu, rapor sayfası, RPC parametreleri vs. aynı anda
 * etkilenir). Konfigürasyon değişikliği DEĞİLDİR.
 *
 * Bir firma için yetenek profili özelleştirmesi talep edilirse,
 * bu HapBilgi platformunun temel tasarımının dışına çıkmak demektir —
 * yeni bir ürün (HapBilgi Lite, HapBilgi Kurumsal vb.) olarak
 * değerlendirilmelidir, bu dosyaya firma-bazlı dallanma EKLENMEMELİDİR.
 *
 * KATMAN AYRIMI:
 *   1. Sektör katmanı (sabit)    → Bu dosya
 *   2. HapBilgi katmanı (sabit)  → Bu dosya
 *   3. Firma katmanı (değişken)  → DB (firmalar, takimlar, urunler, ...)
 *
 * TEK DOĞRULUK KAYNAĞI:
 *
 * Bu dosya, üretici rollerin tüm yetenek özelliklerinin tek kaynağıdır.
 * lib/video/icerikTuru.ts ve lib/video/gorunurluk.ts dosyaları buradan
 * türetilir; orada hardcoded rol listeleri YOKTUR.
 *
 * TALEP GÖRÜNÜRLÜK KURALI:
 *
 * Talepleri sadece üreten görür. Her üretici sadece kendi açtığı
 * talepleri görür — başkasının açtığı talepleri görmez (firma/takım
 * kapsamı YOK). Bu basit kural sistem genelinde uygulanır.
 */

/**
 * İçerik türü — üretici rolün ürettiği içeriğin kategorik türü.
 * Bir rolün hangi türde içerik ürettiğini belirler.
 *
 * Talep oluşturulurken bu değer talepler.icerik_turu kolonuna yazılır
 * ve DONAR — kullanıcının rolü sonradan değişse bile içeriğin türü
 * değişmez (tarihsel kayıt korunur).
 */
export type IcerikTuru = "ik" | "medikal" | "egitim" | "urun";

/**
 * Talep türü — bir talebin sınıfı.
 * Bir rolün hangi türde talep açabileceğini belirler.
 *
 * Her tür için ürün/teknik zorunluluk kuralları TALEP_TURU_KURALLARI
 * objesinde tanımlıdır (aşağıda).
 */
export type TalepTuru =
  | "urun_egitimi"
  | "satis_teknikleri"
  | "medikal_egitim"
  | "urun_medikal_egitim"
  | "ik_egitimi";

/**
 * Talep türünün ürün ve teknik zorunluluk profili.
 *
 * - urun: "zorunlu" → urun_id NOT NULL, "tercihli" → kullanıcı seçebilir, "yok" → urun_id NULL
 * - teknik: "zorunlu" → teknik_id NOT NULL, "tercihli" → kullanıcı seçebilir, "yok" → teknik_id NULL
 */
export interface TalepTuruKurali {
  urun: "zorunlu" | "tercihli" | "yok";
  teknik: "zorunlu" | "tercihli" | "yok";
  ad: string; // UI'da kullanılan Türkçe ad
}

/**
 * Her talep türünün ürün/teknik zorunluluk kuralı + UI adı.
 * POST endpoint'i ve form bu objeden okur — kural çoğaltılmaz.
 */
export const TALEP_TURU_KURALLARI: Record<TalepTuru, TalepTuruKurali> = {
  urun_egitimi: {
    urun: "zorunlu",
    teknik: "tercihli", // İskender 24.07: pm teknik seçimi artık isteğe bağlı
    ad: "Ürün Eğitimi",
  },
  satis_teknikleri: {
    urun: "tercihli",
    teknik: "zorunlu",
    ad: "Satış Teknikleri",
  },
  medikal_egitim: {
    urun: "yok",
    teknik: "yok",
    ad: "Medikal Eğitim",
  },
  urun_medikal_egitim: {
    urun: "zorunlu",
    teknik: "yok",
    ad: "Ürün-Medikal Eğitim",
  },
  ik_egitimi: {
    urun: "yok",
    teknik: "yok",
    ad: "İK Eğitimi/Bilgilendirme",
  },
};

/**
 * Rapor sayfasında kullanıcının görebileceği kapsam.
 *
 * - takim: Kullanıcının kendi takımındaki bölgeler/UTT'ler
 * - firma: Kullanıcının firmasındaki tüm takımlar/bölgeler/UTT'ler
 */
export type RaporScope = "takim" | "firma";

/**
 * Bir üretici rolün tam yetenek profili.
 *
 * Not: Talep görünürlüğü tüm üreticiler için "sadece kendi açtığı"dır;
 * bu yüzden yoneticilikKapsami alanı YOKTUR. Her üretici sadece kendi
 * uretici_id'si ile eşleşen talepleri görür.
 */
export interface UreticiYetenek {
  /**
   * Kullanıcı eklenirken takım atanması zorunlu mu?
   * true: pm, jr_pm, kd_pm — takıma bağlı üretici
   * false: med_md, egt_*, ik_* — takım opsiyonel veya firma seviyesi
   */
  takimZorunlu: boolean;

  /**
   * Bu rol hangi tür talepleri açabilir? Birden fazla seçenek varsa
   * talep formunda kullanıcıya seçim sunulur, tek seçenek varsa
   * form sabit gelir.
   */
  acabilecegiTalepTurleri: TalepTuru[];

  /**
   * Rapor sayfasında varsayılan veri kapsamı.
   */
  raporScope: RaporScope;

  /**
   * Bu rolün ürettiği içeriğin kategorik türü.
   * talepler.icerik_turu kolonuna talep oluşturma anında yazılır ve donar.
   */
  icerikTuru: IcerikTuru;
}

/**
 * Sistemdeki tüm üretici rollerin yetenek profilleri.
 *
 * Yeni bir üretici rol eklemek için:
 *   1. Bu objeye yeni rol kodu ile bir satır ekle
 *   2. (Eğer rol_adi map'i kullanılıyorsa) lib/utils/roller.ts içindeki
 *      ROL_ADLARI map'ine Türkçe karşılığını ekle
 *   3. Başka hiçbir yere dokunmaya gerek yoktur — talep formu, rapor
 *      sayfası, kullanıcı yönetim validasyonu, içerik türü filtreleri
 *      otomatik olarak yeni rolü destekler.
 */
export const URETICI_YETENEKLERI: Record<string, UreticiYetenek> = {
  // ===== Ürün Müdürleri (takım zorunlu, ürün eğitimi) =====
  // pm/jr_pm/kd_pm üçü de kıdem unvanlarıdır, yetenek olarak özdeştir.
  pm: {
    takimZorunlu: true,
    acabilecegiTalepTurleri: ["urun_egitimi"],
    raporScope: "takim",
    icerikTuru: "urun",
  },
  jr_pm: {
    takimZorunlu: true,
    acabilecegiTalepTurleri: ["urun_egitimi"],
    raporScope: "takim",
    icerikTuru: "urun",
  },
  kd_pm: {
    takimZorunlu: true,
    acabilecegiTalepTurleri: ["urun_egitimi"],
    raporScope: "takim",
    icerikTuru: "urun",
  },

  // ===== Medikal Müdür (firma seviyesi, medikal eğitimler) =====
  med_md: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["medikal_egitim", "urun_medikal_egitim"],
    raporScope: "firma",
    icerikTuru: "medikal",
  },

  // ===== Eğitim Rolleri (firma seviyesi, satış teknikleri) =====
  egt_md: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["satis_teknikleri"],
    raporScope: "firma",
    icerikTuru: "egitim",
  },
  egt_yrd_md: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["satis_teknikleri"],
    raporScope: "firma",
    icerikTuru: "egitim",
  },
  egt_yon: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["satis_teknikleri"],
    raporScope: "firma",
    icerikTuru: "egitim",
  },
  egt_uz: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["satis_teknikleri"],
    raporScope: "firma",
    icerikTuru: "egitim",
  },

  // ===== İK Rolleri (firma seviyesi, İK eğitimi/bilgilendirme) =====
  ik_drk: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["ik_egitimi"],
    raporScope: "firma",
    icerikTuru: "ik",
  },
  ik_md: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["ik_egitimi"],
    raporScope: "firma",
    icerikTuru: "ik",
  },
  ik_yrd_md: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["ik_egitimi"],
    raporScope: "firma",
    icerikTuru: "ik",
  },
  ik_uz: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["ik_egitimi"],
    raporScope: "firma",
    icerikTuru: "ik",
  },
  ik_per: {
    takimZorunlu: false,
    acabilecegiTalepTurleri: ["ik_egitimi"],
    raporScope: "firma",
    icerikTuru: "ik",
  },
};

/**
 * Verilen rol kodunun yetenek profilini döndürür.
 * Rol üretici değilse veya tanımsızsa null döner.
 */
export function ureticiYetenegi(rol: string): UreticiYetenek | null {
  return URETICI_YETENEKLERI[rol] ?? null;
}

/**
 * Verilen rol bir üretici rol müdür?
 *
 * Not: IU bu listede DEĞİLDİR. IU üretim hattının özne tarafında
 * yer almaz — talep açmaz, talebe cevap verir. Firma bağımsız bir
 * HapBilgi çalışanıdır ve ayrı bir kategoridedir.
 */
export function uretciMi(rol: string): boolean {
  return rol in URETICI_YETENEKLERI;
}

/**
 * Verilen rol ürün master verisine yeni kayıt ekleyebilir mi?
 *
 * Mantık ("kullanan ekler" prensibi): Rol bir "ürün kullanan" talep türü
 * açabiliyorsa (TALEP_TURU_KURALLARI'nda urun = "zorunlu" veya "tercihli"),
 * ürün eklemesine de izin verilir.
 *
 * Sonuçlar:
 * - pm/jr_pm/kd_pm → true (urun_egitimi açar, urun=zorunlu)
 * - egt_md/egt_yrd_md/egt_yon/egt_uz → true (satis_teknikleri açar, urun=tercihli)
 * - med_md → true (urun_medikal_egitim açar, urun=zorunlu)
 * - ik_drk/ik_md/ik_yrd_md/ik_uz/ik_per → false (ik_egitimi açar, urun=yok)
 *
 * Üretici olmayan veya tanımsız rol için false döner.
 */
export function urunEkleyebilirMi(rol: string): boolean {
  const yetenek = ureticiYetenegi(rol);
  if (!yetenek) return false;
  return yetenek.acabilecegiTalepTurleri.some(
    (tur) => TALEP_TURU_KURALLARI[tur].urun !== "yok"
  );
}

/**
 * Verilen rol teknik master verisine yeni kayıt ekleyebilir mi?
 *
 * Mantık ("kullanan ekler" prensibi): Rol bir "teknik kullanan" talep türü
 * açabiliyorsa (TALEP_TURU_KURALLARI'nda teknik = "zorunlu"), teknik
 * eklemesine de izin verilir.
 *
 * Sonuçlar:
 * - pm/jr_pm/kd_pm → true (urun_egitimi açar, teknik=zorunlu)
 * - egt_md/egt_yrd_md/egt_yon/egt_uz → true (satis_teknikleri açar, teknik=zorunlu)
 * - med_md → false (sadece teknik=yok olan türleri açar)
 * - ik_drk/ik_md/ik_yrd_md/ik_uz/ik_per → false (ik_egitimi açar, teknik=yok)
 *
 * Üretici olmayan veya tanımsız rol için false döner.
 */
export function teknikEkleyebilirMi(rol: string): boolean {
  const yetenek = ureticiYetenegi(rol);
  if (!yetenek) return false;
  return yetenek.acabilecegiTalepTurleri.some(
    (tur) => TALEP_TURU_KURALLARI[tur].teknik !== "yok"
  );
}