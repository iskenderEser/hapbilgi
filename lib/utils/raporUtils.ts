// lib/utils/raporUtils.ts

// Renk sabitleri
export const BORDO = '#bc2d0d';
export const MAVI = '#56aeff';
export const KIRMIZI = '#E24B4A';
export const GRI_METIN = '#737373';
export const KOYU_METIN = '#111827';
export const GRI_ZEMIN = '#f9fafb';

// Puan değerine göre renk kararı
// Ortalamanın üstü → mavi, altı → bordo, sıfır → kırmızı
// UTT, bölge, takım gibi tüm birimler için kullanılabilir
export function puanRengi(puan: number, ortalama: number): string {
  if (puan === 0) return KIRMIZI;
  if (puan >= ortalama) return MAVI;
  return BORDO;
}

// Bar grafik genişlik yüzdesi hesabı
// Bir değerin maksimuma oranını 0-100 arasında döndürür
export function barGenislik(deger: number, max: number): number {
  return max > 0 ? Math.min(100, (deger / max) * 100) : 0;
}

// Türkçe sayı formatı
export function formatPuan(puan: number): string {
  return puan.toLocaleString('tr-TR');
}

export type Periyot = 'bu_gun' | 'bu_hafta' | 'bu_ay' | 'bu_donem' | 'bu_yil';

// Kullanıcıya sunulan periyot listesi — günlük rapor iş ihtiyacına göre kaldırıldı.
export const PERIYOTLAR = [
  { key: 'bu_hafta', label: 'Haftalık' },
  { key: 'bu_ay', label: 'Aylık' },
  { key: 'bu_donem', label: 'Dönemlik' },
  { key: 'bu_yil', label: 'Yıllık' },
] as const satisfies readonly { key: Periyot; label: string }[];
