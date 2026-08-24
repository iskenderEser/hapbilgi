// lib/cc/bildirimMesajlari.ts
// Challenge Club bildirim mesajları (3 olay).
//
// Mesajlar bildirimler tablosuna 'mesaj' alanı olarak yazılır.
// Tek noktada tutulması ileride dil/ton değişimi için kolaylık sağlar.
//
// İlgili dokümantasyon: Karar Belgesi 5 (lib katmanı).

/**
 * BM-A'nın BM-B'ye challenge gönderdiği bildirim.
 * Alıcı (BM-B) görür.
 */
export function challengeGeldiMesaji(
  gonderenAdi: string,
  videoAdi: string
): string {
  return `${gonderenAdi} sana bir challenge gönderdi: ${videoAdi}`;
}

/**
 * Alıcı BM'in gönderilen challenge'ı izlediği bildirim.
 * Gönderen (BM-A) görür.
 */
export function challengeIzlendiMesaji(
  alanAdi: string,
  referralPuani: number
): string {
  return `${alanAdi} sana gönderdiğin challenge'ı izledi. +${referralPuani} referral puanı kazandın.`;
}

/**
 * 5 iş günü dolmasına rağmen izlenmemiş challenge için kayıp bildirimi.
 * Alıcı (BM-B) görür.
 */
export function challengeSuresiDolduMesaji(
  videoAdi: string,
  kayipPuan: number
): string {
  return `${videoAdi} challenge'ını süresi içinde izlemedin. ${kayipPuan} puan kaybettin.`;
}