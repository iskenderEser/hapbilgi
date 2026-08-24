/**
 * Net puanı eşit satırlara aynı sıra verir. Görsel kararlılık için eşit puanlar
 * Türkçe ada göre sıralanır; sıra yalnız farklı bir puana geçildiğinde artar.
 */
export function esitPuanEsitSira<T extends { net: number; ad: string }>(
  satirlar: T[],
): Array<T & { sira: number }> {
  const sirali = [...satirlar].sort((a, b) => b.net - a.net || a.ad.localeCompare(b.ad, "tr"));
  let sira = 0;
  let sonPuan: number | null = null;

  return sirali.map((satir) => {
    if (sonPuan === null || satir.net !== sonPuan) {
      sira += 1;
      sonPuan = satir.net;
    }
    return { ...satir, sira };
  });
}
