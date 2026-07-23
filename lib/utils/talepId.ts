// lib/utils/talepId.ts
// Talebin görünen kimliği — TEK KAYNAK. Biçim: "FirmaAdı_talep_no" (ör. hepifarma_30008).
// talep_no firma-önekli üretilir (firma_no*10000 + firma-içi sıra; İskender 23.07 kararı),
// böylece numaranın kendisi hangi firma olduğunu da kodlar. Tüm takip ekranları bu
// yardımcıyı kullanır — çoğaltma yok.

export function talepIdGoster(
  firmaAdi: string | null | undefined,
  talepNo: number | null | undefined,
): string {
  if (!firmaAdi || talepNo == null) return "-";
  return `${firmaAdi}_${talepNo}`;
}
