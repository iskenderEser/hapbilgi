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
// İÇERİK ÜRETİCİSİ TARAFI AYRI TURDUR: aynı kodlar İÜ'nün diliyle ikinci bir
// tabloya bağlanacak (IU_DURUM). Kod listesi ortak kalsın diye union burada.

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
  iu_iletildi:      { metin: "İçerik Üreticisine İletildi", top: "icerik_ureticisi", renk: BEKLEME },
  iu_hazirliyor:    { metin: "İçerik Üreticisi Hazırlıyor", top: "icerik_ureticisi", renk: BEKLEME },
  iu_duzeltiyor:    { metin: "İçerik Üreticisi Düzeltiyor", top: "icerik_ureticisi", renk: REVIZYON },
  onay_bekleniyor:  { metin: "Sizden Onay Bekleniyor",      top: "uretici",          renk: AKSIYON },
  video_bekleniyor: { metin: "Sizden Video Bekleniyor",     top: "uretici",          renk: AKSIYON },
  yayin_bekleniyor: { metin: "Sizden Yayın Bekleniyor",     top: "uretici",          renk: AKSIYON },
  onaylandi:        { metin: "Onayladınız",                 top: "kapali",           renk: ONAY },
  planlandi:        { metin: "Planlandı",                   top: "sistem",           renk: PLANLI },
  yayinda:          { metin: "Yayında",                     top: "kapali",           renk: CANLI },
  yayin_durduruldu: { metin: "Yayını Durdurdunuz",          top: "uretici",          renk: HATA },
  iptal:            { metin: "İptal Ettiniz",               top: "kapali",           renk: BEKLEME },
  sistem_hatasi:    { metin: "Sistem Hatası",               top: "sistem",           renk: HATA },
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
  const temel = URETICI_DURUM[kod];
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

/** yayin_yonetimi.durum → durum kodu. Kayıt yoksa yayına alma üreticidedir. */
export function yayinDurumKodu(durum: string | null | undefined): DurumKodu {
  if (!durum) return "yayin_bekleniyor";
  if (durum === "yayinda") return "yayinda";
  if (durum === "planlandi") return "planlandi";
  if (durum === "Durduruldu") return "yayin_durduruldu";
  return "sistem_hatasi";
}
