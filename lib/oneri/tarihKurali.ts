// lib/oneri/tarihKurali.ts
//
// Öneri tarih kuralları: format doğrulama, "yarından itibaren" kuralı,
// ve gün → timestamp dönüşümü.
//
// Sistem geneli saat sabitleri (Türkiye saati):
// - Öneri penceresi başlangıcı: 07:00 (puan kazanma saatleri başlangıcı)
// - Öneri penceresi bitişi:   20:30 (puan kazanma saatleri bitişinin hemen sonrası)
//
// Bu sabitler lib/zaman/kontrol.ts'teki puansız zaman kuralı ile uyumludur.

/** Öneri başlangıç günü için saat suffix'i (Türkiye saati 07:00) */
export const ONERI_BASLANGIC_SAAT = "T07:00:00+03:00";

/** Öneri bitiş günü için saat suffix'i (Türkiye saati 20:30) */
export const ONERI_BITIS_SAAT = "T20:30:00+03:00";

/** YYYY-MM-DD format regex'i */
const TARIH_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export type TarihKuraliSonuc =
  | { gecerli: true; baslangic_timestamp: string; bitis_timestamp: string }
  | { gecerli: false; sebep: "format_hatali" | "gecmis_tarih" | "yanlis_sira" };

/**
 * Bir öneri için tarih kurallarını doğrular ve geçerliyse timestamp'leri üretir.
 *
 * Kurallar:
 * 1. Tarihler YYYY-MM-DD formatında olmalı
 * 2. Başlangıç en erken yarın olmalı (bugün veya geçmiş kabul edilmez)
 * 3. Bitiş başlangıçtan en az 1 gün sonra olmalı
 *
 * @param oneri_baslangic YYYY-MM-DD format gün string'i
 * @param oneri_bitis YYYY-MM-DD format gün string'i
 * @param bugun Karşılaştırma yapılacak bugün (default: today's UTC YYYY-MM-DD)
 */
export function oneriTarihKurali(
  oneri_baslangic: string,
  oneri_bitis: string,
  bugun: string = new Date().toISOString().slice(0, 10)
): TarihKuraliSonuc {
  if (!TARIH_FORMAT.test(oneri_baslangic) || !TARIH_FORMAT.test(oneri_bitis)) {
    return { gecerli: false, sebep: "format_hatali" };
  }
  if (oneri_baslangic <= bugun) {
    return { gecerli: false, sebep: "gecmis_tarih" };
  }
  if (oneri_baslangic >= oneri_bitis) {
    return { gecerli: false, sebep: "yanlis_sira" };
  }

  return {
    gecerli: true,
    baslangic_timestamp: `${oneri_baslangic}${ONERI_BASLANGIC_SAAT}`,
    bitis_timestamp: `${oneri_bitis}${ONERI_BITIS_SAAT}`,
  };
}