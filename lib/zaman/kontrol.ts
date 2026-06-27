// lib/zaman/kontrol.ts

/**
 * Puan kazanma zaman kuralları.
 *
 * Puansız zamanlar:
 * - Cumartesi ve Pazar (tüm gün)
 * - Pazartesi-Cuma 20:30-06:59 arası
 *
 * Puansız zamanlarda:
 * - Video seyredilir
 * - Hiçbir puan kazanılmaz (video, extra, öneri)
 * - Soru gösterilmez
 * - İleri sarma kaybı kaydedilmez
 * - Extra izleme olarak sayılmaz
 *
 * Puanlı saatler: Pazartesi-Cuma 07:00-20:29 arası.
 */

/**
 * Verilen tarihin puan kazanılabilir bir zamanda olup olmadığını kontrol eder.
 *
 * @param tarih Kontrol edilecek tarih (Date objesi)
 * @returns true: puan kazanılabilir, false: puansız zaman
 */
export function puanKazanilabilirMi(tarih: Date): boolean {
  const gun = tarih.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi

  // Cumartesi ve Pazar puansızdır
  if (gun < 1 || gun > 5) return false;

  // Pazartesi-Cuma 07:00-20:29 arası puanlıdır
  // 07:00 = 420 dakika, 20:29 = 1229 dakika
  const dakikaCinsinden = tarih.getHours() * 60 + tarih.getMinutes();
  return dakikaCinsinden >= 420 && dakikaCinsinden <= 1229;
}

/**
 * Verilen tarihin ait olduğu haftanın Pazartesi 00:00'ını döndürür.
 *
 * Hafta tanımı: Pazartesi 00:00:00 → Pazar 23:59:59.
 *
 * @param tarih Herhangi bir tarih
 * @returns O haftanın Pazartesi günü 00:00:00'ı
 */
export function haftaBaslangici(tarih: Date): Date {
  const sonuc = new Date(tarih);
  const gun = sonuc.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const pazartesiyeFark = gun === 0 ? -6 : 1 - gun;
  sonuc.setDate(sonuc.getDate() + pazartesiyeFark);
  sonuc.setHours(0, 0, 0, 0);
  return sonuc;
}

/**
 * İki tarihin aynı haftada olup olmadığını kontrol eder.
 *
 * @param tarih1 İlk tarih
 * @param tarih2 İkinci tarih
 * @returns true: aynı haftada, false: farklı haftalarda
 */
export function ayniHaftaMi(tarih1: Date, tarih2: Date): boolean {
  const h1 = haftaBaslangici(tarih1);
  const h2 = haftaBaslangici(tarih2);
  return h1.getTime() === h2.getTime();
}

/**
 * Verilen tarihin ait olduğu takvim ayının 1. günü 00:00'ını döndürür.
 *
 * @param tarih Herhangi bir tarih (default: now)
 * @returns O ayın 1. günü 00:00:00'ı
 */
export function ayBaslangici(tarih: Date = new Date()): Date {
  return new Date(tarih.getFullYear(), tarih.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Verilen tarihin ait olduğu takvim yılının 1 Ocak 00:00'ını döndürür.
 *
 * @param tarih Herhangi bir tarih (default: now)
 * @returns O yılın 1 Ocak günü 00:00:00'ı
 */
export function yilBaslangici(tarih: Date = new Date()): Date {
  return new Date(tarih.getFullYear(), 0, 1, 0, 0, 0, 0);
}

/**
 * Verilen tarihe N iş günü ekler. Hafta sonları (Cumartesi, Pazar) atlanır.
 *
 * Saat bileşeni korunur — Pazartesi 09:30'a +5 iş günü eklenirse sonuç bir
 * sonraki haftanın Pazartesi 09:30'u olur.
 *
 * Challenge Club: alıcı BM'in challenge'ı izlemesi için verilen son_tarih
 * hesabında kullanılır.
 *
 * @param tarih Başlangıç tarihi
 * @param gun Eklenecek iş günü sayısı (pozitif tam sayı)
 * @returns Hafta sonları atlanmış, N iş günü ileri tarih
 */
export function isGunuEkle(tarih: Date, gun: number): Date {
  const sonuc = new Date(tarih);
  let eklenen = 0;

  while (eklenen < gun) {
    sonuc.setDate(sonuc.getDate() + 1);
    const haftaGunu = sonuc.getDay();
    if (haftaGunu !== 0 && haftaGunu !== 6) {
      eklenen++;
    }
  }

  return sonuc;
}