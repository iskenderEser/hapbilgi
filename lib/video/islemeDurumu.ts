// lib/video/islemeDurumu.ts
//
// "İşleniyor" rozetinin SINIRLI SÜRELİ tekrar-sorgu kararını veren saf çekirdek
// (video modernizasyonu — fiziksel test bulgusu, 20.07.2026: tek seferlik kontrol
// sayfa yenilenmeden hiç güncellenmiyordu, IU ve PM ekranlarında aynı etki).
// Yan etkiler (fetch/timer) hooks/useBunnyIslemeDurumu.ts'te; karar burada —
// smoke testi bu dosyayı hedefler.

export interface BunnySorguSonucu {
  hazir: boolean;
  hatali: boolean;
}

export type IslemeDurumu = "isleniyor" | "hatali" | null;

export interface PollingKarari {
  durum: IslemeDurumu;
  devamEt: boolean; // bir sonraki sorgu zamanlanmalı mı
}

export const SORGU_ARALIGI_SANIYE = 15;
export const SORGU_ARALIGI_MS = SORGU_ARALIGI_SANIYE * 1000;
// Tavan: sonsuz polling yasak — bu süre dolunca durur, kullanıcı manuel yenilemeye döner.
export const TAVAN_SANIYE = 5 * 60;

/** Bunny sorgu sonucuna ve o ana kadar geçen süreye göre rozet durumunu ve pollinge devam kararını verir. */
export function pollingKarariVer(sonuc: BunnySorguSonucu, gecenSaniye: number): PollingKarari {
  if (sonuc.hatali) return { durum: "hatali", devamEt: false };
  if (sonuc.hazir) return { durum: null, devamEt: false };
  return { durum: "isleniyor", devamEt: gecenSaniye + SORGU_ARALIGI_SANIYE < TAVAN_SANIYE };
}
