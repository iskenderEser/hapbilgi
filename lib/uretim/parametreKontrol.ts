// lib/uretim/parametreKontrol.ts
//
// Hazır soru setinin parametre kuralları TEK NOKTADA (Adım 3'te
// lib/hazirVideoSoruSeti'nden buraya taşındı). Üretici, toplam soru sayısını
// ve video başı soru sayısını talep aşamasında tanımlar; hazır setin o tanıma
// uyduğunun sunucu tarafı güvencesi budur (form zaten denetler — bu ikinci
// kilittir). Saf fonksiyon.

// Talep şemasındaki varsayılanlarla aynı (talepZinciri.ts fallback'leriyle uyumlu).
const VARSAYILAN_BUYUKLUK = 25;
const VARSAYILAN_VIDEO_BASI = 2;

/**
 * Hata varsa Türkçe gerekçe döner, yoksa null.
 * hazirSetSayisi: hazır soru seti yoksa null (sayı kontrolü atlanır).
 */
export function hazirParametreKontrol(
  soruSetiBuyuklugu: number | null | undefined,
  videoBasiSoruSayisi: number | null | undefined,
  hazirSetSayisi: number | null
): string | null {
  const buyukluk = soruSetiBuyuklugu ?? VARSAYILAN_BUYUKLUK;
  const videoBasi = videoBasiSoruSayisi ?? VARSAYILAN_VIDEO_BASI;
  if (videoBasi > buyukluk) {
    return `Video başı soru sayısı (${videoBasi}) toplam soru sayısını (${buyukluk}) aşamaz.`;
  }
  if (hazirSetSayisi !== null && hazirSetSayisi !== buyukluk) {
    return `Hazır soru seti ${buyukluk} soru olmalıdır. Şu an: ${hazirSetSayisi}.`;
  }
  return null;
}
