-- E-Club kazanılan puanların Çekli veya Çeksiz olarak sabitlenmesi.
-- Supabase SQL Editor'da İskender tarafından çalıştırılır.
--
-- Kurallar:
--   * eclub_kazanilan_puanlar tablosuna cek_karsiligi_var_mi boolean NOT NULL DEFAULT true eklenir.
--   * Mevcut puan kayıtları Çekli Puan kabul edilir.
--   * Merkezi BEFORE INSERT trigger'ı ile yeni puan kaydı doğrudan yayının
--     yayin_yonetimi.cek_karsiligi_var_mi değerini alır (video, podcast, görsel, flip_pdf, cevaplama).
--   * Eksik veya geçersiz yayın bağlantısında sessizce true üretilmez; hata verilir.
--   * Yayın kararı sonradan değişse dahi geçmiş puan kayıtlarının sınıfı değişmez (sabitlenir).
--   * Mevcut tekillik kısıtları (izleme_id, puan_turu) korunur.

BEGIN;

-- 1. eclub_kazanilan_puanlar tablosuna kolon ekleme ve backfill
ALTER TABLE public.eclub_kazanilan_puanlar
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;

ALTER TABLE public.eclub_kazanilan_puanlar
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.eclub_kazanilan_puanlar
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.eclub_kazanilan_puanlar
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- 2. Merkezi BEFORE INSERT trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.tg_eclub_kazanilan_puanlar_cek_karsiligi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cek_karsiligi boolean;
BEGIN
  IF NEW.yayin_id IS NULL THEN
    RAISE EXCEPTION 'eclub_kazanilan_puanlar: yayin_id zorunludur.';
  END IF;

  SELECT y.cek_karsiligi_var_mi
    INTO v_cek_karsiligi
    FROM public.yayin_yonetimi y
   WHERE y.yayin_id = NEW.yayin_id;

  IF v_cek_karsiligi IS NULL THEN
    RAISE EXCEPTION 'eclub_kazanilan_puanlar: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı (yayin_id: %).', NEW.yayin_id;
  END IF;

  -- İstemci/RPC girdisine güvenilmez; doğrudan yayındaki değer sabitlenir.
  NEW.cek_karsiligi_var_mi := v_cek_karsiligi;
  RETURN NEW;
END;
$$;

-- 3. Trigger tanımı
DROP TRIGGER IF EXISTS trg_eclub_kazanilan_puanlar_cek_karsiligi ON public.eclub_kazanilan_puanlar;
CREATE TRIGGER trg_eclub_kazanilan_puanlar_cek_karsiligi
  BEFORE INSERT ON public.eclub_kazanilan_puanlar
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_eclub_kazanilan_puanlar_cek_karsiligi();

COMMIT;
