/** Firma adındaki her kelimeyi Türkçe yazım kurallarıyla büyük harfle başlatır. */
export function firmaAdiBicimle(ham: string): string {
  return ham
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((kelime) =>
      kelime.charAt(0).toLocaleUpperCase("tr-TR") + kelime.slice(1).toLocaleLowerCase("tr-TR")
    )
    .join(" ");
}
