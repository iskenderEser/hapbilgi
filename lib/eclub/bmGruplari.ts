interface BmBagliUtt {
  bm_id: string | null;
  bm_adi: string;
  bolge_adi: string;
}

/** BM ataması olmayan UTT'leri de görünür tutar; kapsamı API belirler. */
export function eclubBmGruplari<T extends BmBagliUtt>(uttler: T[]) {
  const gruplar = new Map<string, { id: string; ad: string; bolgeler: string[]; uttler: T[] }>();
  for (const utt of uttler) {
    const id = utt.bm_id ?? "atanmamis";
    const grup = gruplar.get(id) ?? { id, ad: utt.bm_adi, bolgeler: [], uttler: [] };
    grup.uttler.push(utt);
    if (!grup.bolgeler.includes(utt.bolge_adi)) grup.bolgeler.push(utt.bolge_adi);
    gruplar.set(id, grup);
  }
  return [...gruplar.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}
