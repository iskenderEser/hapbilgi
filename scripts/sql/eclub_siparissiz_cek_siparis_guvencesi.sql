-- Dört E-Club kazanım modelinden "siparişsiz çek" için veri bütünlüğü.
-- Mevcut çek talebi fonksiyonunu yeniden tanımlamaz; yalnız yeni modelin
-- siparişe dönüşmesini veritabanı düzeyinde engeller.
-- Supabase SQL Editor'da tamamı tek parça çalıştırılır.

BEGIN;

DO $kontrol$
BEGIN
  IF to_regclass('public.eclub_store_cek_talepleri') IS NULL THEN
    RAISE EXCEPTION 'E-Club çek talepleri tablosu bulunamadı.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.eclub_store_cek_talepleri'::regclass
      AND conname = 'eclub_siparissiz_cek_siparis_yok_check'
  ) THEN
    ALTER TABLE public.eclub_store_cek_talepleri
      ADD CONSTRAINT eclub_siparissiz_cek_siparis_yok_check
      CHECK (
        siparis_tipi IS DISTINCT FROM 'siparissiz_cek'
        OR (
          siparis_verildi_mi = false
          AND siparis_adet = 0
          AND siparis_mal_fazlasi = 0
        )
      );
  END IF;
END;
$kontrol$;

COMMIT;

SELECT conname AS kural_adi,
       pg_get_constraintdef(oid) AS kural
FROM pg_constraint
WHERE conrelid = 'public.eclub_store_cek_talepleri'::regclass
  AND conname = 'eclub_siparissiz_cek_siparis_yok_check';
