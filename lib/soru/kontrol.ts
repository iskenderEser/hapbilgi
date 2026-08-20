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

export function cevaplarAtananSorularlaEslesiyorMu(
  cevaplar: unknown,
  atananIndeksler: number[]
): cevaplar is Array<{ soru_index: number; verilen_cevap: string }> {
  if (!Array.isArray(cevaplar) || cevaplar.length !== atananIndeksler.length) return false;

  const beklenen = new Set(atananIndeksler);
  const gelen = new Set<number>();
  for (const cevap of cevaplar) {
    if (!cevap || typeof cevap !== "object") return false;
    const { soru_index, verilen_cevap } = cevap as Record<string, unknown>;
    if (
      typeof soru_index !== "number"
      || !Number.isInteger(soru_index)
      || !beklenen.has(soru_index)
      || gelen.has(soru_index)
      || typeof verilen_cevap !== "string"
      || verilen_cevap.trim().length === 0
    ) return false;
    gelen.add(soru_index);
  }
  return gelen.size === beklenen.size;
}
