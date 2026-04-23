// lib/utils/randomSoruSec.ts

/**
 * Verilen soru dizisinden randomize olarak n adet soru seçer.
 * Varsayılan: 2 soru
 */
export function randomSoruSec<T>(sorular: T[], adet: number = 2): T[] {
  if (sorular.length <= adet) return [...sorular];
  const karisik = [...sorular].sort(() => Math.random() - 0.5);
  return karisik.slice(0, adet);
}

/**
 * 0 ile max-1 arasında benzersiz n adet random index üretir.
 */
export function randomIndexler(toplamSoru: number, adet: number = 2): number[] {
  if (toplamSoru <= adet) return Array.from({ length: toplamSoru }, (_, i) => i);
  const indexler = new Set<number>();
  while (indexler.size < adet) {
    indexler.add(Math.floor(Math.random() * toplamSoru));
  }
  return Array.from(indexler);
}