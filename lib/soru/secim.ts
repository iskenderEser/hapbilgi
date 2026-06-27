// lib/soru/secim.ts

/**
 * Soru seçim mantığı.
 *
 * Kullanım yerleri:
 * - app/izle/api/sorular/route.ts (izleme sonrası gösterilecek soruları seçer)
 *
 * Algoritma: Fisher-Yates shuffle.
 * Math.random tabanlı sort() uniform dağılım vermez, bilinen bir antipattern'dir.
 * Fisher-Yates ise her permütasyona eşit ihtimal verir.
 */

/**
 * Verilen soru dizisinden rastgele 'adet' tane soru seçer.
 * Her sorunun orijinal index'i korunur (cevap doğrulaması için).
 *
 * @param sorular Soru seti (her eleman bir soru objesi)
 * @param adet Seçilecek soru sayısı
 * @returns Seçilen sorular; her birine 'orijinalIndex' alanı eklenir
 */
export function rastgeleSoruSec<T>(
  sorular: T[],
  adet: number
): (T & { orijinalIndex: number })[] {
  if (adet <= 0 || sorular.length === 0) return [];

  // Orijinal index'i koru
  const indeksli = sorular.map((s, i) => ({ ...s, orijinalIndex: i }));

  // İstenen adet, mevcut sorudan fazlaysa tüm soruları döndür (yine de karıştırılmış)
  const secilecekAdet = Math.min(adet, indeksli.length);

  // Fisher-Yates shuffle (in-place, kopyada)
  const karisik = [...indeksli];
  for (let i = karisik.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [karisik[i], karisik[j]] = [karisik[j], karisik[i]];
  }

  return karisik.slice(0, secilecekAdet);
}