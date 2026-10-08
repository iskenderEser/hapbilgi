/** Modül görünürlüğü puan ve davranış hesaplarından bağımsızdır. */
export function raporModulDurumunuUygula<T extends object>(veri: T, eclubAcik: boolean): T & { eclub_acik: boolean } {
  return { ...veri, eclub_acik: eclubAcik };
}

export function raporBolumleriniSec<T extends { ad: string }>(bolumler: T[], eclubAcik: boolean): T[] {
  return bolumler.filter(b => b.ad !== 'E-Club' || eclubAcik);
}
