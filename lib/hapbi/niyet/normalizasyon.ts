const YAYGIN_YAZIM_DUZELTMELERI: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bceyrek\b/gu, "çeyrek"],
  [/\bdonem\b/gu, "dönem"],
  [/\bucuncu\b/gu, "üçüncü"],
  [/\bdagilim\b/gu, "dağılım"],
  [/\bkirilim\b/gu, "kırılım"],
  [/\bkatki\b/gu, "katkı"],
  [/\bkarsilastir\b/gu, "karşılaştır"],
  [/\byuksek\b/gu, "yüksek"],
  [/\bdusuk\b/gu, "düşük"],
  [/\btakim\b/gu, "takım"],
  [/\burun\b/gu, "ürün"],
];

export function hapbiSorusunuNormallestir(soru: string): string {
  let sonuc = soru
    .normalize("NFC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[’'`´]/gu, "")
    .replace(/[–—]/gu, "-")
    .replace(/[,:;!?()[\]{}"]+/gu, " ")
    .replace(/\bq\s+([1-4])(?=(?:te|ta|de|da)?\b)/gu, "q$1")
    .replace(/\b([1-4])\s+q\b/gu, "$1q");

  for (const [aranan, karsilik] of YAYGIN_YAZIM_DUZELTMELERI) {
    sonuc = sonuc.replace(aranan, karsilik);
  }

  return sonuc.replace(/\s+/gu, " ").trim();
}
