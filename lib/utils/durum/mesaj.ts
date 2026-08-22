// lib/utils/durum/mesaj.ts
//
// ÜRETİCİ ROLÜNÜN DURUM SÖZLÜĞÜ — tek doğruluk kaynağı (İskender kararı 25.07).
//
// Neden: aynı üretim durumu altı ayrı yüzeyde dört ayrı dille yazılıyordu. Ana
// sayfa türetilmiş cümleler ("Devam Ediyor"), üretim hattı sayfaları HAM DB
// değeri ("inceleme bekleniyor", "onaylandi"), durum anahtarı kısaltmalar
// ("İnceleme"), yayın yönetimi kendi üçlüsü. Aynı işin durumu ekrandan ekrana
// değişiyordu ve hiçbiri "top kimde" bilgisini vermiyordu.
//
// Kural: mesaj tek başına iki şeyi söyler — NE OLDU + KİMDEN AKSİYON BEKLENİYOR.
// Aşama adı (Senaryo/Video/Soru Seti) mesajda tekrar edilmez; onu taşıyan kolon
// zaten yanındadır.
//
// Dil: siz formu (uygulamanın geri kalanıyla uyumlu). Kısaltma yok — üreticinin
// aksiyonu "Sizden ... Bekleniyor" kalıbıyla, İçerik Üreticisi'nin işi rolün tam
// adıyla yazılır. Filtre butonları da aynı metni taşır (İskender: "uzayacaksa
// uzasın") — hiçbir yüzeyde ikinci bir sözlük yoktur.
//
// İÇERİK ÜRETİCİSİ TARAFI aşağıdaki ikinci tabloda — aynı kodlar, İÜ'nün dili.

export type DurumTopu = "uretici" | "icerik_ureticisi" | "sistem" | "kapali";

export interface DurumRenk {
  bg: string;
  text: string;
  border: string;
}

export interface DurumMesaji {
  metin: string;
  top: DurumTopu;
  renk: DurumRenk;
}

/** Üretim hattında bir işin bulunabileceği tüm durumlar. Ekrandaki her rozet bunlardan biridir. */
export type DurumKodu =
  | "iu_iletildi"        // iş İÜ tarafına geçti, henüz kimse üstlenmedi (iu_id NULL)
  | "iu_hazirliyor"      // bir İÜ üzerinde çalışıyor (iu_id dolu, teslim yok)
  | "iu_duzeltiyor"      // revizyon istendi, İÜ düzeltiyor
  | "onay_bekleniyor"    // İÜ teslim etti, karar üreticide
  | "video_bekleniyor"   // hazır video talebi, yükleme üreticide
  | "yayin_bekleniyor"   // soru seti onaylı, yayına alma üreticide
  | "onaylandi"          // bu aşama onaylandı, iş ilerledi
  | "planlandi"          // ileri tarihli yayın, sistem açacak
  | "yayinda"            // canlı
  | "yayin_durduruldu"   // yayın durduruldu
  | "yayin_siliniyor"    // yayın öncesi kalıcı silme devam ediyor
  | "yayin_silme_hatasi" // dış depolama/DB telafisi yeniden denenecek
  | "yayin_oncesi_silindi" // yayın öncesi silindi; İÜ işi salt-okur arşivdir
  | "iptal"              // iş iptal edildi
  | "sistem_hatasi";     // zincir kurulamadı ya da tanınmayan durum — insan müdahalesi

// Palet mevcut ekranlardan devralındı; renk artık tek yerde tanımlıdır.
const AKSIYON: DurumRenk = { bg: "#fff1f0", text: "#bc2d0d", border: "#fecaca" }; // top üreticide
const BEKLEME: DurumRenk = { bg: "#f9fafb", text: "#737373", border: "#e5e7eb" }; // top İÜ'de / arşiv
const REVIZYON: DurumRenk = { bg: "#fefce8", text: "#854d0e", border: "#fde68a" };
const ONAY: DurumRenk = { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
const CANLI: DurumRenk = { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
const PLANLI: DurumRenk = { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" };
const HATA: DurumRenk = { bg: "#fef2f2", text: "#bc2d0d", border: "#fecaca" };

const URETICI_DURUM: Record<DurumKodu, DurumMesaji> = {
  // 27.07 — metinler kısaldı ve tek dile oturdu (İskender kararı): en fazla iki
  // kelime, gizli özne ikinci çoğul şahıs ("siz"), ve AŞAMA sütunuyla aynı kelimeyi
  // basmamak. Eskiden aşama "Yayın", durum "Yayında" yazıyordu — yan yana iki
  // sütunda aynı kelime tekrarlanıyordu. Aşama artık "Tamamlandı".
  // "İçerik Üreticisi" → "Üreticiniz": üreticinin gözünden İÜ onun üreticisidir.
  iu_iletildi:      { metin: "Üreticinize İletildi",   top: "icerik_ureticisi", renk: BEKLEME },
  iu_hazirliyor:    { metin: "Üreticiniz Hazırlıyor",  top: "icerik_ureticisi", renk: BEKLEME },
  iu_duzeltiyor:    { metin: "Üreticiniz Düzenliyor",  top: "icerik_ureticisi", renk: REVIZYON },
  onay_bekleniyor:  { metin: "Onayınız Bekleniyor",    top: "uretici",          renk: AKSIYON },
  video_bekleniyor: { metin: "Videonuzu İletiniz",     top: "uretici",          renk: AKSIYON },
  yayin_bekleniyor: { metin: "Yayına Alınız",          top: "uretici",          renk: AKSIYON },
  onaylandi:        { metin: "Onayladınız",            top: "kapali",           renk: ONAY },
  planlandi:        { metin: "Yayınını Planladınız",   top: "sistem",           renk: PLANLI },
  yayinda:          { metin: "Yayına Aldınız",         top: "kapali",           renk: CANLI },
  yayin_durduruldu: { metin: "Yayını Durdurdunuz",          top: "uretici",          renk: HATA },
  yayin_siliniyor:  { metin: "Yayın Siliniyor",             top: "sistem",           renk: BEKLEME },
  yayin_silme_hatasi: { metin: "Silme Tamamlanamadı",       top: "uretici",          renk: HATA },
  yayin_oncesi_silindi: { metin: "Yayın Öncesi Silindi",    top: "kapali",           renk: BEKLEME },
  iptal:            { metin: "İptal Ettiniz",               top: "kapali",           renk: BEKLEME },
  sistem_hatasi:    { metin: "Sistem Hatası",               top: "sistem",           renk: HATA },
};

// İÇERİK ÜRETİCİSİ TABLOSU (İskender kararı 25.07).
// İki fark üretici tablosundan ayırır:
//   1) İÜ'nün yaptığı iş aşamaya göre değişir (senaryo yazmak / video yüklemek /
//      soru seti yazmak) — mesaj "neyin" beklendiğini söyler, aşama adını yutmaz.
//   2) Karşı taraf "üretici" diye anılmaz (o kod dilidir); talebi açan kişinin
//      gerçek unvanı yazılır: "Ürün Müdürü İnceliyor", "Medikal Müdür İptal Etti".
// Havuz/üstlenme kavramı YOKTUR: sistemde tek İÜ vardır, çoğalırsa iş atamayla
// dağıtılacaktır. Bu yüzden "kimse üstlenmedi" ile "üzerinde çalışılıyor" İÜ
// tarafında tek mesaja iner — ikisi de "senin işin".

// Bu tipin ikizi lib/uretim/toastMesaj.ts'te `ToastAsama` adıyla durur (kod
// biçiminde: "senaryo"|"video"|"soru_seti"). Birleştirilmedi: burada anahtar
// aynı zamanda ekrana çıkan etikettir, orada cümle parçası üretmek için kullanılan
// bir koddur. Gerekçe orada da yazılı. İki sözlük iki yüzeye bakar — rozet (bir
// işin HALİ) ve toast (bir aksiyonun SONUCU).
export type Asama = "Senaryo" | "Video" | "Soru Seti";

/** Talebi açan kişinin unvanı bilinmiyorsa kullanılacak nötr ad (kod dili değil). */
const TALEP_SAHIBI = "Talep Sahibi";

const IU_ISTENEN: Record<Asama, string> = {
  "Senaryo": "Senaryo Yazmanız Bekleniyor",
  "Video": "Video Yüklemeniz Bekleniyor",
  "Soru Seti": "Soru Seti Yazmanız Bekleniyor",
};

const IU_REVIZYON: Record<Asama, string> = {
  "Senaryo": "Senaryo Revizyonu Bekleniyor",
  "Video": "Video Revizyonu Bekleniyor",
  "Soru Seti": "Soru Seti Revizyonu Bekleniyor",
};

export interface IuMesajGirdi {
  asama?: Asama;
  /** Talebi açan üreticinin unvanı — ROL_ADLARI[rol]. */
  rolAdi?: string | null;
  tarih?: string | null;
}

function iuMetin(kod: DurumKodu, g: IuMesajGirdi): string {
  const asama = g.asama ?? "Senaryo";
  const rol = g.rolAdi?.trim() || TALEP_SAHIBI;
  switch (kod) {
    case "iu_iletildi":
    case "iu_hazirliyor":    return IU_ISTENEN[asama];
    case "iu_duzeltiyor":    return IU_REVIZYON[asama];
    case "onay_bekleniyor":  return `${rol} İnceliyor`;
    case "onaylandi":        return `${rol} Onayladı`;
    case "iptal":            return `${rol} İptal Etti`;
    case "video_bekleniyor": return `${rol} Videoyu Yüklüyor`;
    case "yayin_bekleniyor": return `${rol} Yayına Alacak`;
    case "planlandi":        return "Yayın Planlandı";
    case "yayinda":          return "Yayında";
    case "yayin_durduruldu": return "Yayın Durduruldu";
    case "yayin_siliniyor": return "Yayın Siliniyor";
    case "yayin_silme_hatasi": return "Silme Tamamlanamadı";
    case "yayin_oncesi_silindi": return "Yayın Öncesi Silindi";
    case "sistem_hatasi":    return "Sistem Hatası";
  }
}

// Renk ve "top kimde" bilgisi kodla sabittir; yalnız metin role/aşamaya göre değişir.
const IU_RENK: Record<DurumKodu, { top: DurumTopu; renk: DurumRenk }> = {
  iu_iletildi:      { top: "icerik_ureticisi", renk: AKSIYON },
  iu_hazirliyor:    { top: "icerik_ureticisi", renk: AKSIYON },
  iu_duzeltiyor:    { top: "icerik_ureticisi", renk: REVIZYON },
  onay_bekleniyor:  { top: "uretici",          renk: BEKLEME },
  video_bekleniyor: { top: "uretici",          renk: BEKLEME },
  yayin_bekleniyor: { top: "uretici",          renk: BEKLEME },
  onaylandi:        { top: "kapali",           renk: ONAY },
  planlandi:        { top: "sistem",           renk: PLANLI },
  yayinda:          { top: "kapali",           renk: CANLI },
  yayin_durduruldu: { top: "uretici",          renk: HATA },
  yayin_siliniyor:  { top: "sistem",           renk: BEKLEME },
  yayin_silme_hatasi: { top: "uretici",        renk: HATA },
  yayin_oncesi_silindi: { top: "kapali",       renk: BEKLEME },
  iptal:            { top: "kapali",           renk: BEKLEME },
  sistem_hatasi:    { top: "sistem",           renk: HATA },
};

/** "2026-07-28T..." → "28 Tem" (planlı yayının açılacağı gün). */
export function kisaTarih(tarih: string): string {
  return new Date(tarih).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/**
 * Üretici rolünün göreceği mesaj. Planlı yayında tarih metne eklenir
 * ("Planlandı · 28 Tem") — üreticinin bilmesi gereken tek ek bilgi odur.
 */
export function ureticiDurumMesaji(kod: DurumKodu, tarih?: string | null): DurumMesaji {
  return tarihEkle(URETICI_DURUM[kod], kod, tarih);
}

/** İçerik Üreticisi rolünün göreceği mesaj — aşamaya ve talep sahibinin unvanına duyarlı. */
export function iuDurumMesaji(kod: DurumKodu, g: IuMesajGirdi = {}): DurumMesaji {
  const { top, renk } = IU_RENK[kod];
  return tarihEkle({ metin: iuMetin(kod, g), top, renk }, kod, g.tarih);
}

/**
 * Rolüne göre mesaj. Üretim hattı sayfaları (Senaryolar/Videolar/Soru Setleri)
 * iki rol tarafından da görüldüğü için bu kapıdan geçer.
 */
export function durumMesaji(kod: DurumKodu, rol: string | null | undefined, g: IuMesajGirdi = {}): DurumMesaji {
  return rol === "iu" ? iuDurumMesaji(kod, g) : ureticiDurumMesaji(kod, g.tarih);
}

function tarihEkle(temel: DurumMesaji, kod: DurumKodu, tarih?: string | null): DurumMesaji {
  if (kod === "planlandi" && tarih) {
    return { ...temel, metin: `${temel.metin} · ${kisaTarih(tarih)}` };
  }
  return temel;
}

/**
 * Bir üretim kaydının (senaryo / video / soru seti) ham son durumu → durum kodu.
 * `iuIdVarMi`: kayıtta iu_id dolu mu — "henüz kimse üstlenmedi" ile "üzerinde
 * çalışılıyor" ayrımı buradan gelir; başka sinyal yoktur.
 *
 * Tanınmayan değer bilerek "sistem_hatasi"na düşer: eski kapsayıcı "Devam Ediyor"
 * yerine sessizce yanlış bilgi vermek yerine gürültü çıkarır.
 */
export function kayitDurumKodu(sonDurum: string | null | undefined, iuIdVarMi: boolean): DurumKodu {
  if (!sonDurum) return iuIdVarMi ? "iu_hazirliyor" : "iu_iletildi";
  if (sonDurum === "inceleme bekleniyor") return "onay_bekleniyor";
  if (sonDurum === "revizyon bekleniyor") return "iu_duzeltiyor";
  if (sonDurum === "onaylandi") return "onaylandi";
  if (sonDurum === "Iptal Edildi") return "iptal";
  return "sistem_hatasi";
}

/** Yeni görev kaydının durumu → mevcut ortak ekran sözlüğü. */
export function gorevDurumKodu(durum: string): DurumKodu {
  if (durum === "atama_bekliyor") return "iu_iletildi";
  if (durum === "hazirlaniyor") return "iu_hazirliyor";
  if (durum === "inceleme_bekliyor") return "onay_bekleniyor";
  if (durum === "revizyon_bekliyor") return "iu_duzeltiyor";
  if (durum === "tamamlandi") return "onaylandi";
  if (durum === "iptal") return "iptal";
  return "sistem_hatasi";
}

/** yayin_yonetimi.durum → durum kodu. Kayıt yoksa yayına alma üreticidedir. */
export function yayinDurumKodu(durum: string | null | undefined): DurumKodu {
  if (!durum) return "yayin_bekleniyor";
  if (durum === "yayinda") return "yayinda";
  if (durum === "planlandi") return "planlandi";
  if (durum === "Durduruldu") return "yayin_durduruldu";
  return "sistem_hatasi";
}
