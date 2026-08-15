export const TEST_GLN_PREFIX = "111";
export const TEST_GLN_UZUNLUK = 13;
export const TEST_GLN_TEK_SEFER_UST_SINIR = 100;
export const TEST_TEMIZLIK_ONAYI = "TEST VERİLERİNİ SİL";

const TEST_GLN_SON_EK_UZUNLUK = TEST_GLN_UZUNLUK - TEST_GLN_PREFIX.length;
const TEST_GLN_SON_DEGER = (10 ** TEST_GLN_SON_EK_UZUNLUK) - 1;

export function testGlnMi(gln: string): boolean {
  return new RegExp(`^${TEST_GLN_PREFIX}\\d{${TEST_GLN_SON_EK_UZUNLUK}}$`).test(gln);
}

export function testGlnlerUret(adet: number, mevcutGlnler: Iterable<string>): string[] {
  if (!Number.isInteger(adet) || adet < 1 || adet > TEST_GLN_TEK_SEFER_UST_SINIR) {
    throw new RangeError(`Adet 1-${TEST_GLN_TEK_SEFER_UST_SINIR} arasında tam sayı olmalıdır.`);
  }

  const kullanilanlar = new Set(mevcutGlnler);
  const uretilenler: string[] = [];

  for (let sira = 1; sira <= TEST_GLN_SON_DEGER && uretilenler.length < adet; sira += 1) {
    const gln = `${TEST_GLN_PREFIX}${String(sira).padStart(TEST_GLN_SON_EK_UZUNLUK, "0")}`;
    if (kullanilanlar.has(gln)) continue;
    kullanilanlar.add(gln);
    uretilenler.push(gln);
  }

  if (uretilenler.length !== adet) throw new Error("Yeni test GLN üretmek için boş numara kalmadı.");
  return uretilenler;
}

export function testEczaneAdi(gln: string): string {
  if (!testGlnMi(gln)) throw new Error("Geçersiz test GLN.");
  const sira = Number(gln.slice(TEST_GLN_PREFIX.length));
  return `Test Eczanesi ${String(sira).padStart(3, "0")}`;
}
