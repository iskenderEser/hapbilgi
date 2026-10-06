export interface ZamanliOneri {
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi?: boolean | null;
}

export const ONERI_ZAMANI_DEGISTI = "hapbilgi:oneri-zamani-degisti";

export function oneriIzlenebilirMi(oneri: ZamanliOneri, simdi: number): boolean {
  const baslangic = Date.parse(oneri.oneri_baslangic);
  const bitis = Date.parse(oneri.oneri_bitis);
  return !oneri.izlendi_mi && Number.isFinite(baslangic) && Number.isFinite(bitis)
    && baslangic <= simdi && simdi <= bitis;
}

export function sonrakiOneriZamanSiniri(oneriler: readonly ZamanliOneri[], simdi: number): number | null {
  let sonraki: number | null = null;
  for (const oneri of oneriler) {
    if (oneri.izlendi_mi) continue;
    const baslangic = Date.parse(oneri.oneri_baslangic);
    const bitis = Date.parse(oneri.oneri_bitis);
    if (!Number.isFinite(baslangic) || !Number.isFinite(bitis)) continue;
    const aday = baslangic > simdi ? baslangic : bitis >= simdi ? bitis + 1 : null;
    if (aday !== null && (sonraki === null || aday < sonraki)) sonraki = aday;
  }
  return sonraki;
}
