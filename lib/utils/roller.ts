// lib/utils/roller.ts

// URETICI_ROLLER: Talep oluşturma, senaryo/video/soru seti onaylama ve yayına alma yetkisine sahip roller.
// Yeni bir role bu yetkiler verilmek istendiğinde buraya eklenmesi yeterlidir — tüm route'lara otomatik yansır.
export const URETICI_ROLLER = [
  "pm", "jr_pm", "kd_pm",
  "med_md",
  "egt_md", "egt_yrd_md", "egt_yon", "egt_uz",
  "ik_drk", "ik_md", "ik_yrd_md", "ik_uz", "ik_per",
];

// Geriye dönük uyumluluk için — eski import'ların kırılmaması adına
export const PM_ROLLERI = URETICI_ROLLER;

// YONETICI_ROLLER: Yönetici raporu ve analiz sayfasına erişim yetkisine sahip roller.
export const YONETICI_ROLLER = [
  "gm", "gm_yrd", "drk", "paz_md", "blm_md", "grp_pm", "sm",
];

// ADMIN_ROLLER: Tüm firmalara erişim, /admin paneli ve yönetici raporları yetkisine sahip roller.
// İleride firma bazlı admin eklenebilir: "firma_admin"
export const ADMIN_ROLLER = ["admin"];

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