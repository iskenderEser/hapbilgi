// lib/utils/puanHesapla.ts

/**
 * İzleme türüne ve durumuna göre kazanılacak puanları hesaplar.
 */

export interface PuanSonucu {
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  toplam: number;
}

/**
 * İzleme puanı hesapla.
 * İlk izlemede video puanı verilir, tekrar izlemede verilmez.
 */
export function izlemePuaniHesapla(
  daha_once_izledi: boolean,
  video_puani: number
): number {
  return daha_once_izledi ? 0 : video_puani;
}

/**
 * Extra puan hesapla.
 * Aynı videoya haftada 3. kez izlemede video puanı kadar extra puan verilir.
 */
export function extraPuanHesapla(
  bu_hafta_izleme_sayisi: number,
  video_puani: number
): number {
  return bu_hafta_izleme_sayisi === 3 ? video_puani : 0;
}

/**
 * Cevaplama puanı hesapla.
 * Her doğru cevap için soru_puani verilir.
 */
export function cevaplamaPuaniHesapla(
  dogru_cevap_sayisi: number,
  soru_puani: number
): number {
  return dogru_cevap_sayisi * soru_puani;
}

/**
 * Öneri puanı hesapla.
 * Önerilen zaman aralığında izlenirse soru_puani kadar öneri puanı verilir.
 */
export function oneriPuaniHesapla(
  oneri_zamaninda_izlendi: boolean,
  soru_puani: number
): number {
  return oneri_zamaninda_izlendi ? soru_puani : 0;
}

/**
 * Tüm puanları toplar.
 */
export function toplamPuanHesapla(puanlar: Omit<PuanSonucu, "toplam">): PuanSonucu {
  return {
    ...puanlar,
    toplam: puanlar.izleme_puani + puanlar.cevaplama_puani + puanlar.oneri_puani + puanlar.extra_puani,
  };
}