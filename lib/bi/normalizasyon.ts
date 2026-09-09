export function biMetniniNormalize(metin: string): string {
  return metin
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[‐‑‒–—-]/gu, " ")
    .replace(/[?!.,:;]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
