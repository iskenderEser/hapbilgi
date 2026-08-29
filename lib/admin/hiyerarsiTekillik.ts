/** Organizasyon adlarında baştaki/sondaki ve yinelenen boşlukları tek biçime getirir. */
export function hiyerarsiAdiBicimle(ham: string): string {
  return ham.trim().split(/\s+/).filter(Boolean).join(" ");
}

/** PostgreSQL benzersizlik ihlalini güvenli biçimde ayırt eder. */
export function tekillikIhlaliMi(hata: unknown): boolean {
  return typeof hata === "object"
    && hata !== null
    && "code" in hata
    && String((hata as { code?: unknown }).code) === "23505";
}
