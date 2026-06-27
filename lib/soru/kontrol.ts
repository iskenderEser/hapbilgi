// lib/soru/kontrol.ts

/**
 * Soru cevap kontrol mantığı.
 *
 * Soru veri yapısı:
 * - soru.secenekler: { harf: "A"|"B"|"C"|"D", metin: string, dogru: boolean }[]
 * - Tam olarak bir seçeneğin 'dogru' alanı true'dur.
 *
 * Kullanım yerleri:
 * - app/izle/api/cevap/route.ts (kullanıcının verdiği cevap doğru mu kontrolü)
 */

export interface SoruSecenek {
  harf: string;
  metin: string;
  dogru: boolean;
}

export interface Soru {
  soru_metni: string;
  secenekler: SoruSecenek[];
}

/**
 * Bir cevabın doğru olup olmadığını kontrol eder.
 *
 * @param soru Soru objesi (secenekler içerir)
 * @param verilen_cevap Kullanıcının seçtiği harf (örn. "A", "B", "C", "D")
 * @returns { dogru_mu, dogru_secenek } — dogru_secenek doğru cevabın harfi
 */
export function cevapDogruMu(
  soru: Soru,
  verilen_cevap: string
): { dogru_mu: boolean; dogru_secenek: string | null } {
  const dogruSecenek = soru.secenekler.find((s) => s.dogru);
  const dogru_secenek = dogruSecenek?.harf ?? null;
  const dogru_mu = dogru_secenek === verilen_cevap;
  return { dogru_mu, dogru_secenek };
}