-- Migration: Faz 9 — Geriye Dönük Uyumluluk ve Bütünlük Doğrulaması
-- Çekli Puan ve Çeksiz Puan ayrımının mevcut canlı kayıtları bozmamasını garanti eder.
-- Tekrar güvenlidir (idempotent): İkinci kez veya defalarca çalıştırıldığında mevcut veriyi bozmaz.

BEGIN;

-- 1. yayin_yonetimi: Kolonun varlığı, varsayılanı ve NULL backfill (yalnız IS NULL olanlar true yapılır)
ALTER TABLE public.yayin_yonetimi
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;

ALTER TABLE public.yayin_yonetimi
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.yayin_yonetimi
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.yayin_yonetimi
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- 2. eclub_kazanilan_puanlar: Kolonun varlığı, varsayılanı ve NULL backfill
ALTER TABLE public.eclub_kazanilan_puanlar
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;

ALTER TABLE public.eclub_kazanilan_puanlar
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.eclub_kazanilan_puanlar
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.eclub_kazanilan_puanlar
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- 3. eclub_ileri_sarma_kayitlari: Kolonun varlığı, varsayılanı ve NULL backfill
ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;

ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.eclub_ileri_sarma_kayitlari
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- 4. Bütünlük ve Güvenlik: İkinci kez çalıştırmada false olan yeni kayıtlar korunur.
-- NOT: UPDATE ifadeleri özellikle "WHERE cek_karsiligi_var_mi IS NULL" koşulunu kullanır.
-- Böylece Faz 1-8 sürecinde üretilen veya ileride eklenecek "cek_karsiligi_var_mi = false"
-- kayıtları asla ezilmez.

NOTIFY pgrst, 'reload schema';
COMMIT;
