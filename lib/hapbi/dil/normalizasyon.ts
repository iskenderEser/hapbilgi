const YAZIM_DUZELTMELERI = [
  ["ençok", "en cok"],
  ["enaz", "en az"],
  ["nekadar", "ne kadar"],
  ["kaçtane", "kac tane"],
  ["siralamasi", "siralama"],
  ["kiyaslama", "karsilastirma"],
  ["kuarter", "kuartir"],
] as const;

function turkceKarakterleriSadelestir(metin: string): string {
  return metin
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ş", "s")
    .replaceAll("ü", "u");
}

function yazimFarklariniDuzelt(metin: string): string {
  return YAZIM_DUZELTMELERI.reduce(
    (sonuc, [yanlis, ortak]) => sonuc.replace(new RegExp(`\\b${yanlis}\\b`, "gu"), ortak),
    metin,
  );
}

export function hapbiMetniniNormalizeEt(metin: string): string {
  const kucukHarfli = metin.toLocaleLowerCase("tr-TR");
  const sadelestirilmis = turkceKarakterleriSadelestir(kucukHarfli);
  const noktalamasiTemiz = sadelestirilmis.replace(/[^a-z0-9\s]/gu, " ");
  const bosluklariTemiz = noktalamasiTemiz.replace(/\s+/gu, " ").trim();
  return yazimFarklariniDuzelt(bosluklariTemiz);
}
