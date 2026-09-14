-- E-Club yayınlarında Çekli / Çeksiz Puan seçimi (cek_karsiligi_var_mi).
-- Supabase SQL Editor'da İskender tarafından çalıştırılır.
--
-- Kurallar:
--   * yayin_yonetimi tablosuna cek_karsiligi_var_mi boolean alanı eklenir.
--   * Tekrar güvenlidir (IF NOT EXISTS).
--   * Mevcut yayınlar NOT NULL DEFAULT true ile Çekli Puan kabul edilir.

BEGIN;

ALTER TABLE public.yayin_yonetimi
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;

ALTER TABLE public.yayin_yonetimi
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.yayin_yonetimi
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.yayin_yonetimi
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

COMMIT;
