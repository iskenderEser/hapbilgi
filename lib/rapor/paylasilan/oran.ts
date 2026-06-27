// lib/rapor/paylasilan/oran.ts
//
// Raporlar için yüzde formülleri.
// Sıfıra bölme korumalı, tutarlı yuvarlama.

/**
 * Katkı yüzdesi: bir parçanın bir bütüne oranı (sıfıra bölme korumalı).
 * Çıktı: 1 ondalık hassasiyette (örn. 23.4).
 *
 * Kullanım:
 *   - BM bölge puanı / takım toplam puan
 *   - TM takım puanı / şirket toplam puan
 *   - Üretici scope puanı / şirket toplam puan
 *
 * @param parca Pay (örn. bölge toplam puan)
 * @param butun Payda (örn. takım toplam puan)
 * @returns 1 ondalık yüzde değeri, butun 0 ise 0
 */
export function katkiYuzdesi(parca: number, butun: number): number {
  if (butun <= 0) return 0;
  return parseFloat(((parca / butun) * 100).toFixed(1));
}

/**
 * İzlenme oranı: gerçekleşen izlenme / potansiyel izlenme (yayın × UTT) (sıfıra bölme korumalı).
 * Çıktı: tam sayı yüzde (örn. 73).
 *
 * Kullanım: BM/TM/üretici raporlarında "bölgenin/takımın yayınları izleme oranı"
 *
 * @param izlenme Gerçekleşen tamamlanmış izleme sayısı
 * @param yayinSayisi Scope içindeki toplam yayın sayısı
 * @param uttSayisi Scope içindeki UTT sayısı
 * @returns Tam sayı yüzde, potansiyel 0 ise 0
 */
export function izlenmeOrani(izlenme: number, yayinSayisi: number, uttSayisi: number): number {
  const potansiyel = yayinSayisi * uttSayisi;
  if (potansiyel <= 0) return 0;
  return Math.round((izlenme / potansiyel) * 100);
}

/**
 * Tamamlanma oranı: tamamlanan / gönderilen (sıfıra bölme korumalı).
 * Çıktı: tam sayı yüzde.
 *
 * Kullanım: BM/TM/üretici raporlarında öneri tamamlanma yüzdesi
 *
 * @param tamamlanan Tamamlanan adet
 * @param gonderilen Gönderilen adet
 * @returns Tam sayı yüzde, gonderilen 0 ise 0
 */
export function tamamlanmaOrani(tamamlanan: number, gonderilen: number): number {
  if (gonderilen <= 0) return 0;
  return Math.round((tamamlanan / gonderilen) * 100);
}