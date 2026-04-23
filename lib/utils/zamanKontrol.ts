// lib/utils/zamanKontrol.ts

/**
 * Verilen tarihin puan kazanma saatleri içinde olup olmadığını kontrol eder.
 * Kural: Pazartesi-Cuma, 07:00-20:29 arası (başlangıç zamanına göre)
 * 20:29'da başlayan video 20:30 sonrası bitse de puan alır.
 */
export function puanKazanilabilirMi(tarih: Date): boolean {
  const gun = tarih.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const saat = tarih.getHours();
  const dakika = tarih.getMinutes();
  const dakikaCinsinden = saat * 60 + dakika;

  // Pazartesi-Cuma kontrolü
  if (gun < 1 || gun > 5) return false;

  // 07:00 = 420 dakika, 20:29 = 1229 dakika
  return dakikaCinsinden >= 420 && dakikaCinsinden <= 1229;
}

/**
 * Verilen tarihin hangi haftanın başlangıcına (Pazartesi 00:00) denk geldiğini döner.
 */
export function haftaBaslangici(tarih: Date): Date {
  const d = new Date(tarih);
  const gun = d.getDay();
  const fark = gun === 0 ? -6 : 1 - gun; // Pazarsa -6, diğerleri 1-gun
  d.setDate(d.getDate() + fark);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * İki tarih aynı haftada mı kontrol eder.
 */
export function ayniHaftaMi(tarih1: Date, tarih2: Date): boolean {
  const h1 = haftaBaslangici(tarih1);
  const h2 = haftaBaslangici(tarih2);
  return h1.getTime() === h2.getTime();
}