// lib/utils/roller.ts

// URETICI_ROLLER: Talep oluşturma, senaryo/video/soru seti onaylama ve yayına alma yetkisine sahip roller.
// Yeni bir role bu yetkiler verilmek istendiğinde buraya eklenmesi yeterlidir — tüm route'lara otomatik yansır.
export const URETICI_ROLLER = [
  "pm", "jr_pm", "kd_pm",
  "med_md",
  "egt_md", "egt_yrd_md", "egt_yon", "egt_uz",
  "ik_drk", "ik_md", "ik_yrd_md", "ik_uz", "ik_per",
];

// YONETICI_ROLLER: Yönetici raporu ve analiz sayfasına erişim yetkisine sahip roller.
export const YONETICI_ROLLER = [
  "gm", "gm_yrd", "drk", "paz_md", "blm_md", "grp_pm", "sm",
];

// ADMIN_ROLLER: Tüm firmalara erişim, /admin paneli ve yönetici raporları yetkisine sahip roller.
// İleride firma bazlı admin eklenebilir: "firma_admin"
export const ADMIN_ROLLER = ["admin"];

// YONLENDIRICI_ROLLER: TM ve BM — UTT performansını izleyen ve yönlendiren roller.
export const YONLENDIRICI_ROLLER = ["tm", "bm"];

// TUKETICI_ROLLER: UTT ve KD_UTT — sahada video tüketen, soruları cevaplayan roller.
export const TUKETICI_ROLLER = ["utt", "kd_utt"];

// IU_ROLU: İçerik Uzmanı — talebe cevap veren, üretim hattının operasyonel hizmetkârı.
export const IU_ROLU = "iu";

// TUM_ROLLER: Sistemdeki tüm geçerli rollerin birleşik listesi.
// Validasyonlarda "geçerli rol mü?" kontrolü için kullanılır.
// Yeni bir rol eklenirken yukarıdaki uygun gruba eklenmesi yeterlidir — buradan otomatik türetilir.
export const TUM_ROLLER = [
  ...URETICI_ROLLER,
  ...YONETICI_ROLLER,
  ...ADMIN_ROLLER,
  ...YONLENDIRICI_ROLLER,
  ...TUKETICI_ROLLER,
  IU_ROLU,
];

// ───────────────────────────────────────────────────────────────────────────
// Üretim hattı sayfaları rol kategorisi
// ───────────────────────────────────────────────────────────────────────────

// URETIM_HATTI_GORENLER: Üretim hattı sayfalarını (/talepler, /senaryolar,
// /videolar, /soru-setleri) görebilen roller.
// Üretici roller (13 rol) ve İçerik Uzmanı dahildir.
// PM tarafı talep oluşturur, senaryo/video/soru seti incelemesi yapar;
// İU tarafı senaryo/video/soru seti üretir.
export const URETIM_HATTI_GORENLER = [
  ...URETICI_ROLLER,  // pm, jr_pm, kd_pm, med_md, egt_*, ik_*
  IU_ROLU,            // iu
];

// ───────────────────────────────────────────────────────────────────────────
// Analiz sayfasına özel rol kategorileri (Faz 1)
// ───────────────────────────────────────────────────────────────────────────
// Analiz sayfası 3 kategori bileşeni üzerinden çalışır: tüketici / üretici / yönetici.
// Her kategori, ait olan rolleri için kendi pill setini ve kategori adlarını barındırır.
// URETICI_ROLLER ve YONETICI_ROLLER doğrudan kullanılamaz çünkü:
//   - URETICI_ROLLER İK rollerini içerir; analiz sayfası İK için açılmaz.
//   - Analiz yöneticileri, YONETICI_ROLLER'a ek olarak ADMIN_ROLLER'ı da kapsar.

// ANALIZ_TUKETICI_ROLLERI: BM ve TM. UTT/KD_UTT analiz sayfasına dahil değildir;
// kendi puan/performans verilerini UTT raporu üzerinden görürler.
export const ANALIZ_TUKETICI_ROLLERI = ["bm", "tm"];

// ANALIZ_URETICI_ROLLERI: İK hariç tüm üretici roller (ürün/medikal/eğitim).
// İK kullanıcılarının analiz sayfası açılmaz.
export const ANALIZ_URETICI_ROLLERI = URETICI_ROLLER.filter(
  (r) => !["ik_drk", "ik_md", "ik_yrd_md", "ik_uz", "ik_per"].includes(r),
);

// ANALIZ_YONETICI_ROLLERI: Yönetici rolleri + admin. Tüm firma kapsamında analiz görürler.
export const ANALIZ_YONETICI_ROLLERI = [...YONETICI_ROLLER, ...ADMIN_ROLLER];

/**
 * Verilen rolün analiz sayfasındaki kategorisini döndürür.
 * - null: rol analiz sayfasına yetkili değil (utt, kd_utt, iu, İK rolleri, geçersiz rol).
 * - 'tuketici' | 'uretici' | 'yonetici': ilgili kategori bileşenine dispatch edilir.
 */
export function analizRolKategorisi(
  rol: string | null | undefined,
): "tuketici" | "uretici" | "yonetici" | null {
  if (!rol) return null;
  if (ANALIZ_TUKETICI_ROLLERI.includes(rol)) return "tuketici";
  if (ANALIZ_URETICI_ROLLERI.includes(rol)) return "uretici";
  if (ANALIZ_YONETICI_ROLLERI.includes(rol)) return "yonetici";
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Challenge Club / CC Ligi rol kategorileri
// ───────────────────────────────────────────────────────────────────────────

// CCLIGI_GORENLERLER: CC Ligi sayfasını (/cc-ligi) görebilen roller.
// BM ana tüketici, TM/üretici/yönetici/admin ise gözlemci olarak lig'i görür.
// UTT, KD_UTT ve İU bu sayfaya erişemez.
export const CCLIGI_GORENLERLER = [
  ...YONLENDIRICI_ROLLER,  // bm, tm
  ...URETICI_ROLLER,        // pm, jr_pm, kd_pm, med_md, egt_*, ik_*
  ...YONETICI_ROLLER,       // gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm
  ...ADMIN_ROLLER,          // admin
];

// ───────────────────────────────────────────────────────────────────────────
// HBStore rol kategorileri
// ───────────────────────────────────────────────────────────────────────────

// STORE_ALABILEN_ROLLER: HBStore'dan satın alma yapabilen roller (puan harcayan).
// Sadece UTT, KD_UTT ve BM puan kazanır ve harcayabilir.
// TM, üretici, yönetici, admin alışveriş yapamaz — sadece görüntüleyebilir.
export const STORE_ALABILEN_ROLLER = [
  ...TUKETICI_ROLLER,  // utt, kd_utt
  "bm",
];

// STORE_GORENLERLER: HBStore sipariş listesi görüntüleme yetkisi olan roller.
// Alabilen kullanıcılar (UTT/KD_UTT/BM) kendi siparişlerini görür.
// TM takımındaki siparişleri, üretici/yönetici/admin firma genelini görür.
// İU bu sayfaya erişemez.
export const STORE_GORENLERLER = [
  ...STORE_ALABILEN_ROLLER, // utt, kd_utt, bm (kendi siparişleri)
  "tm",                      // takım kapsamında
  ...URETICI_ROLLER,         // firma kapsamında
  ...YONETICI_ROLLER,        // firma kapsamında
  ...ADMIN_ROLLER,           // tüm firmalar
];

// STORE_GENEL_GOREN_ROLLER: HBStore /store/siparisler sayfasını (başkalarının
// siparişlerini görüntüleme) görebilen roller.
// UTT/KD_UTT bu sayfayı görmez — sadece kendi siparişlerini /store/siparislerim'de görür.
// BM kendi bölgesindeki UTT'lerin siparişlerini görür.
// TM kendi takımındakileri görür.
// Üretici/yönetici/admin firma genelini görür.
export const STORE_GENEL_GOREN_ROLLER = [
  "bm",
  "tm",
  ...URETICI_ROLLER,
  ...YONETICI_ROLLER,
  ...ADMIN_ROLLER,
];

// ROL_ADLARI: Rol kısaltmalarının Türkçe karşılıkları.
// Yalnızca görüntüleme katmanında kullanılır — veritabanında hiçbir şey değişmez.
// Kullanım: ROL_ADLARI[rol] ?? rol
export const ROL_ADLARI: Record<string, string> = {
  pm: "Ürün Müdürü",
  jr_pm: "Ürün Müdürü (Jr.)",
  kd_pm: "Kıdemli Ürün Müdürü",
  iu: "İçerik Uzmanı",
  tm: "Takım Müdürü",
  bm: "Bölge Müdürü",
  utt: "Ürün Tanıtım Temsilcisi",
  kd_utt: "Kıdemli Ürün Tanıtım Temsilcisi",
  gm: "Genel Müdür",
  gm_yrd: "Genel Müdür Yardımcısı",
  drk: "Direktör",
  paz_md: "Pazarlama Müdürü",
  blm_md: "Bölüm Müdürü",
  med_md: "Medikal Müdür",
  grp_pm: "Grup Ürün Müdürü",
  sm: "Satış Müdürü",
  egt_md: "Eğitim Müdürü",
  egt_yrd_md: "Eğitim Müdür Yardımcısı",
  egt_yon: "Eğitim Yöneticisi",
  egt_uz: "Eğitim Uzmanı",
  ik_drk: "İK Direktörü",
  ik_md: "İK Müdürü",
  ik_yrd_md: "İK Müdür Yardımcısı",
  ik_uz: "İK Uzmanı",
  ik_per: "İK Personeli",
};