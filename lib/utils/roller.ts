// lib/utils/roller.ts

// URETICI_ROLLER: Talep oluşturma, senaryo/video/soru seti onaylama ve yayına alma yetkisine sahip roller.
// Yeni bir role bu yetkiler verilmek istendiğinde buraya eklenmesi yeterlidir — tüm route'lara otomatik yansır.
export const URETICI_ROLLER = [
  "pm", "jr_pm", "kd_pm",
  "med_md",
  "egt_md", "egt_yrd_md", "egt_yon", "egt_uz",
  "ik_drk", "ik_md", "ik_yrd_md", "ik_uz", "ik_per",
];

// YONETICI_ROLLER: Yönetici raporuna erişim yetkisine sahip roller.
export const YONETICI_ROLLER = [
  "gm", "gm_yrd", "drk", "paz_md", "blm_md", "grp_pm", "sm",
];

// ADMIN_ROLLER: Tüm firmalara erişim, /admin paneli ve yönetici raporları yetkisine sahip roller.
// İleride firma bazlı admin eklenebilir: "firma_admin"
export const ADMIN_ROLLER = ["admin"];

// YONLENDIRICI_ROLLER: TM ve BM — UTT performansını hiyerarşik olarak izleyen roller.
// Öneri gönderme yetkisi bu gruptan türetilmez; yalnız BM'ye aittir.
export const YONLENDIRICI_ROLLER = ["tm", "bm"];

// TUKETICI_ROLLER: UTT ve KD_UTT — sahada video tüketen, soruları cevaplayan roller.
export const TUKETICI_ROLLER = ["utt", "kd_utt"];

// IU_ROLU: İçerik Üreticisi — talebe cevap veren, üretim hattının operasyonel hizmetkârı.
// (25.07: ekranlarda görünen ad "İçerik Uzmanı" değil "İçerik Üreticisi"dir —
//  İskender: eski ad hiç kullanılmadı, yanlışlıkla yerleşmiş.)
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
// Üretici roller (13 rol) ve İçerik Üreticisi dahildir.
// PM tarafı talep oluşturur, senaryo/video/soru seti incelemesi yapar;
// İU tarafı senaryo/video/soru seti üretir.
export const URETIM_HATTI_GORENLER = [
  ...URETICI_ROLLER,  // pm, jr_pm, kd_pm, med_md, egt_*, ik_*
  IU_ROLU,            // iu
];

// YAYINDAKI_VIDEO_GORENLER: "Yayındaki Videolar" pill'ini + sayfasını görebilen
// roller. Yalnız-izleme (puan/soru yok). Üretici (İK dahil) + yönetici + tm/bm.
// İçerik Üreticisi (iu) ve tüketici roller (utt/kd_utt/eczaci/eczane_teknisyeni/
// musteri) HARİÇ — otomatik dışarıda, hiçbir alt listede yoklar.
export const YAYINDAKI_VIDEO_GORENLER = [
  ...URETICI_ROLLER,       // pm, jr_pm, kd_pm, med_md, egt_*, ik_*
  ...YONETICI_ROLLER,      // gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm
  ...YONLENDIRICI_ROLLER,  // tm, bm
];

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

// ───────────────────────────────────────────────────────────────────────────
// E-Club rol kategorileri (Faz 2)
// ───────────────────────────────────────────────────────────────────────────

// ECLUB_GOREN_ROLLER: E-Club liste yönetim sayfasını (/eclub/listem) Navbar'da
// görüp erişebilen roller — eczane/kişi listesini yöneten saha rolleri.
// ŞİMDİLİK sadece UTT/KD_UTT. Cascade süreci ile birlikte (teknik borç) BM/TM/firma
// yöneticileri ve E-Club'ın kendi tüketici rolleri (eczaci/eczane_teknisyeni)
// kendi arayüzlerinden erişecek şekilde genişletilecektir.
export const ECLUB_GOREN_ROLLER = [
  ...TUKETICI_ROLLER,  // utt, kd_utt
];

// ECLUB_YONETIM_ROLLERI: E-Club rapor, lig ve sipariş görünümünü izleyen iç roller.
// UTT kendi dış müşteri ekibini; BM kendi UTT'lerini; TM kendi BM→UTT hattını;
// üretici/yönetici roller ise yetkili takım/firma hiyerarşisini görür.
export const ECLUB_YONETIM_ROLLERI = [
  ...TUKETICI_ROLLER,
  ...YONLENDIRICI_ROLLER,
  ...URETICI_ROLLER,
  ...YONETICI_ROLLER,
];

// ECLUB_LIGI_GOREN_ROLLER: yönetim görünümüyle aynı rol sözleşmesini kullanır.
export const ECLUB_LIGI_GOREN_ROLLER = [
  ...ECLUB_YONETIM_ROLLERI,
];

// ECLUB_TUKETICI_ROLLERI: E-Club içeriğini tüketen roller — eczacı ve eczane teknisyeni.
// DİKKAT: Bu roller kullanicilar tablosunda DEĞİL, eclub_kisiler tablosunda yaşar.
// Bu yüzden bilinçli olarak TUM_ROLLER'a dahil EDİLMEZ (TUM_ROLLER kullanicilar
// rol validasyonu içindir). E-Club kişileri ayrı bir kimlik/yetki düzleminde tutulur.
export const ECLUB_TUKETICI_ROLLERI = ["eczaci", "eczane_teknisyeni"];

// MUSTERI_ROLU: Eczanem müşterisi — üçüncü kimlik düzlemi (eczanem_musteriler).
// ECLUB_TUKETICI_ROLLERI gibi TUM_ROLLER'a dahil EDİLMEZ; rolCozucu bu değeri
// v_auth_kimlik_admin'in musteri UNION'ından döner.
export const MUSTERI_ROLU = "musteri";

// ============================================================================
// HEDEF ROL — üretim hattının hedef kitle ekseni (talepler.hedef_rol)
// ============================================================================
// DİKKAT: Bunlar kullanıcı rolleri değil, üretilen içeriğin hedef kitle
// değerleridir; bu yüzden TUM_ROLLER'dan ayrı yaşar.
//   'utt' / 'bm'                    → iç müşteri (saha)
//   'eczaci' / 'eczane_teknisyeni'  → dış müşteri (E-Club)
//   'eczanem'                       → eczanenin kendi müşterisi (üçüncü katman)
// DB: talepler.hedef_rol CHECK constraint'i ile birebir.
export type HedefRol = "utt" | "bm" | "eczaci" | "eczane_teknisyeni" | "eczanem";

export const TUM_HEDEF_ROLLER: HedefRol[] = ["utt", "bm", "eczaci", "eczane_teknisyeni", "eczanem"];

// E-Club akışının hedef rolleri — eclub öneri route'larının yayın süzgeci.
// (ECLUB_TUKETICI_ROLLERI ile değerleri aynıdır ama kavram farklıdır:
// o kişilerin rolü, bu içeriğin hedefi. İkisi bilinçli olarak ayrı durur.)
export const ECLUB_HEDEF_ROLLER: HedefRol[] = ["eczaci", "eczane_teknisyeni"];

// PM_AILESI_ROLLER: Ürün Müdürü ailesi (pm/jr_pm/kd_pm). "Yalnızca PM" gerektiren
// kararların tek kaynağı — talep dosyası yükleme/silme, Eczanem talebi açma vb.
export const PM_AILESI_ROLLER = ["pm", "jr_pm", "kd_pm"];

// Eczanem hedefli talebi AÇABİLEN roller (İP-§4.1: "yalnızca PM") — ürün
// müdürü ailesi. Diğer 10 üretici rol Eczanem hedefini göremez/seçemez:
// Karşılık tanımı PM'in ürün maliyet kararıdır, ürün sahipliği PM'dedir.
// Kavram birebir "PM ailesi"dir — tek kaynak PM_AILESI_ROLLER.
export const ECZANEM_TALEP_ACAN_ROLLER = PM_AILESI_ROLLER;

// ROL_ADLARI: Rol kısaltmalarının Türkçe karşılıkları.
// Yalnızca görüntüleme katmanında kullanılır — veritabanında hiçbir şey değişmez.
// Kullanım: ROL_ADLARI[rol] ?? rol
export const ROL_ADLARI: Record<string, string> = {
  pm: "Ürün Müdürü",
  jr_pm: "Ürün Müdürü (Jr.)",
  kd_pm: "Kıdemli Ürün Müdürü",
  iu: "İçerik Üreticisi",
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
  eczaci: "Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
  musteri: "Müşteri",
};
