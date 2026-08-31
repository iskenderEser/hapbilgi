-- Eczanem UTT→eczane ve eczane→müşteri dağıtımlarını ortak öğrenme aracı
-- kimliğine geçirir. Mevcut RPC imzaları korunur; trigger yayın kimliğini
-- v_yayin_detay üzerinden doğrulayıp her yeni dağıtıma yazar.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eczanem-ortak-arac-kimligi-v1', 1));

ALTER TABLE public.eczanem_eczane_gonderimleri
  ADD COLUMN IF NOT EXISTS arac_id uuid,
  ADD COLUMN IF NOT EXISTS arac_turu text;

ALTER TABLE public.eczanem_gonderimler
  ADD COLUMN IF NOT EXISTS arac_id uuid,
  ADD COLUMN IF NOT EXISTS arac_turu text;

UPDATE public.eczanem_eczane_gonderimleri g
SET arac_id = vyd.arac_id,
    arac_turu = vyd.arac_turu
FROM public.v_yayin_detay vyd
WHERE vyd.yayin_id = g.yayin_id
  AND (g.arac_id IS NULL OR g.arac_turu IS NULL);

UPDATE public.eczanem_gonderimler g
SET arac_id = vyd.arac_id,
    arac_turu = vyd.arac_turu
FROM public.v_yayin_detay vyd
WHERE vyd.yayin_id = g.yayin_id
  AND (g.arac_id IS NULL OR g.arac_turu IS NULL);

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.eczanem_eczane_gonderimleri g
    LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = g.yayin_id
    WHERE g.arac_id IS NULL OR g.arac_turu IS NULL
       OR g.arac_id IS DISTINCT FROM vyd.arac_id
       OR g.arac_turu IS DISTINCT FROM vyd.arac_turu
  ) THEN
    RAISE EXCEPTION 'UTT→eczane dağıtımlarında ortak araç kimliği eksik veya uyumsuz.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.eczanem_gonderimler g
    LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = g.yayin_id
    WHERE g.arac_id IS NULL OR g.arac_turu IS NULL
       OR g.arac_id IS DISTINCT FROM vyd.arac_id
       OR g.arac_turu IS DISTINCT FROM vyd.arac_turu
  ) THEN
    RAISE EXCEPTION 'Eczane→müşteri dağıtımlarında ortak araç kimliği eksik veya uyumsuz.';
  END IF;
END;
$kontrol$;

ALTER TABLE public.eczanem_eczane_gonderimleri
  ALTER COLUMN arac_id SET NOT NULL,
  ALTER COLUMN arac_turu SET NOT NULL;

ALTER TABLE public.eczanem_gonderimler
  ALTER COLUMN arac_id SET NOT NULL,
  ALTER COLUMN arac_turu SET NOT NULL;

DO $kisit$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='eczanem_eczane_gonderimleri_arac_id_fkey' AND conrelid='public.eczanem_eczane_gonderimleri'::regclass) THEN
    ALTER TABLE public.eczanem_eczane_gonderimleri
      ADD CONSTRAINT eczanem_eczane_gonderimleri_arac_id_fkey
      FOREIGN KEY (arac_id) REFERENCES public.ogrenme_araclari(arac_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='eczanem_eczane_gonderimleri_arac_turu_ck' AND conrelid='public.eczanem_eczane_gonderimleri'::regclass) THEN
    ALTER TABLE public.eczanem_eczane_gonderimleri
      ADD CONSTRAINT eczanem_eczane_gonderimleri_arac_turu_ck
      CHECK (arac_turu IN ('video','podcast','gorsel','flip_pdf'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='eczanem_gonderimler_arac_id_fkey' AND conrelid='public.eczanem_gonderimler'::regclass) THEN
    ALTER TABLE public.eczanem_gonderimler
      ADD CONSTRAINT eczanem_gonderimler_arac_id_fkey
      FOREIGN KEY (arac_id) REFERENCES public.ogrenme_araclari(arac_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='eczanem_gonderimler_arac_turu_ck' AND conrelid='public.eczanem_gonderimler'::regclass) THEN
    ALTER TABLE public.eczanem_gonderimler
      ADD CONSTRAINT eczanem_gonderimler_arac_turu_ck
      CHECK (arac_turu IN ('video','podcast','gorsel','flip_pdf'));
  END IF;
END;
$kisit$;

CREATE OR REPLACE FUNCTION public.eczanem_gonderim_arac_kimligi_dogrula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_arac_id uuid;
  v_arac_turu text;
BEGIN
  SELECT vyd.arac_id, vyd.arac_turu
  INTO v_arac_id, v_arac_turu
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = NEW.yayin_id;

  IF NOT FOUND OR v_arac_id IS NULL
     OR v_arac_turu NOT IN ('video','podcast','gorsel','flip_pdf') THEN
    RAISE EXCEPTION 'Yayının geçerli öğrenme aracı kimliği bulunamadı.' USING ERRCODE='23514';
  END IF;
  IF NEW.arac_id IS NOT NULL AND NEW.arac_id IS DISTINCT FROM v_arac_id THEN
    RAISE EXCEPTION 'Gönderim araç kimliği yayınla uyuşmuyor.' USING ERRCODE='23514';
  END IF;
  IF NEW.arac_turu IS NOT NULL AND NEW.arac_turu IS DISTINCT FROM v_arac_turu THEN
    RAISE EXCEPTION 'Gönderim araç türü yayınla uyuşmuyor.' USING ERRCODE='23514';
  END IF;

  NEW.arac_id := v_arac_id;
  NEW.arac_turu := v_arac_turu;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS trg_eczanem_eczane_gonderim_arac_kimligi ON public.eczanem_eczane_gonderimleri;
CREATE TRIGGER trg_eczanem_eczane_gonderim_arac_kimligi
BEFORE INSERT OR UPDATE OF yayin_id, arac_id, arac_turu
ON public.eczanem_eczane_gonderimleri
FOR EACH ROW EXECUTE FUNCTION public.eczanem_gonderim_arac_kimligi_dogrula();

DROP TRIGGER IF EXISTS trg_eczanem_musteri_gonderim_arac_kimligi ON public.eczanem_gonderimler;
CREATE TRIGGER trg_eczanem_musteri_gonderim_arac_kimligi
BEFORE INSERT OR UPDATE OF yayin_id, arac_id, arac_turu
ON public.eczanem_gonderimler
FOR EACH ROW EXECUTE FUNCTION public.eczanem_gonderim_arac_kimligi_dogrula();

COMMIT;

SELECT
  (SELECT count(*) FROM public.eczanem_eczane_gonderimleri WHERE arac_id IS NULL OR arac_turu IS NULL) AS eksik_eczane_dagitimi,
  (SELECT count(*) FROM public.eczanem_gonderimler WHERE arac_id IS NULL OR arac_turu IS NULL) AS eksik_musteri_dagitimi,
  to_regprocedure('public.eczanem_gonderim_arac_kimligi_dogrula()') IS NOT NULL AS kimlik_trigger_fonksiyonu_var;
