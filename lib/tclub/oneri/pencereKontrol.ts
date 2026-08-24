// lib/oneri/pencereKontrol.ts

/**
 * Bir önerinin izleme penceresi içinde olup olmadığını kontrol eder.
 *
 * Öneri penceresi: oneri_baslangic ≤ simdi ≤ oneri_bitis
 *
 * Kullanım yerleri:
 * - app/izle/api/baslat/route.ts (öneri başlatılırken pencere kontrolü)
 * - app/izle/api/bitir/route.ts (öneri puanı verilirken pencere kontrolü)
 */

export type OneriPencereSonuc =
  | { acik: true }
  | { acik: false; sebep: "henuz_baslamadi" | "sona_erdi" };

/**
 * Bir önerinin izleme penceresi açık mı kontrol eder.
 *
 * @param oneri_baslangic Önerinin başlangıç tarihi (ISO string veya Date)
 * @param oneri_bitis Önerinin bitiş tarihi (ISO string veya Date)
 * @param simdi Karşılaştırma yapılacak an (default: new Date())
 * @returns Pencere açıksa { acik: true }, kapalıysa sebep ile { acik: false, sebep }
 */
export function oneriPenceresiAcik(
  oneri_baslangic: string | Date,
  oneri_bitis: string | Date,
  simdi: Date = new Date()
): OneriPencereSonuc {
  const baslangic = oneri_baslangic instanceof Date ? oneri_baslangic : new Date(oneri_baslangic);
  const bitis = oneri_bitis instanceof Date ? oneri_bitis : new Date(oneri_bitis);

  if (simdi < baslangic) return { acik: false, sebep: "henuz_baslamadi" };
  if (simdi > bitis) return { acik: false, sebep: "sona_erdi" };
  return { acik: true };
}