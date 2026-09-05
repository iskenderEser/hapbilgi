export type HapbiDonem =
  | { tur: "hafta"; yil: number; hafta: number }
  | { tur: "ay"; yil: number; ay: number }
  | { tur: "ceyrek"; yil: number; ceyrek: number }
  | { tur: "yil"; yil: number }
  | { tur: "ozel"; baslangic: string; bitis: string };

function gecerliYilMi(yil: number): boolean {
  return Number.isInteger(yil) && yil >= 2000 && yil <= 2100;
}

export function hapbiDonemiDogrula(donem: HapbiDonem): HapbiDonem {
  if (donem.tur === "ozel") {
    const baslangic = Date.parse(donem.baslangic);
    const bitis = Date.parse(donem.bitis);
    if (!Number.isFinite(baslangic) || !Number.isFinite(bitis) || baslangic > bitis) {
      throw new Error("Geçersiz dönem.");
    }
    return donem;
  }

  if (!gecerliYilMi(donem.yil)) throw new Error("Geçersiz dönem.");
  if (donem.tur === "hafta" && (!Number.isInteger(donem.hafta) || donem.hafta < 1 || donem.hafta > 53)) {
    throw new Error("Geçersiz dönem.");
  }
  if (donem.tur === "ay" && (!Number.isInteger(donem.ay) || donem.ay < 1 || donem.ay > 12)) {
    throw new Error("Geçersiz dönem.");
  }
  if (donem.tur === "ceyrek" && (!Number.isInteger(donem.ceyrek) || donem.ceyrek < 1 || donem.ceyrek > 4)) {
    throw new Error("Geçersiz dönem.");
  }
  return donem;
}
