-- Admin hiyerarşisi: eşzamanlı firma/takım/bölge oluşturma yarışını DB'de kapatır.
-- Mevcut mükerrer kayıt varsa hiçbir değişiklik yapmadan hata verir.

BEGIN;

CREATE OR REPLACE FUNCTION public.hiyerarsi_adi_anahtari(p_deger text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fonksiyon$
  SELECT lower(regexp_replace(btrim(p_deger), '\s+', ' ', 'g'))
$fonksiyon$;

DO $kontrol$
DECLARE
  v_mukerrer text;
BEGIN
  SELECT string_agg(format('%s (%s)', d.anahtar, d.adet), ', ')
    INTO v_mukerrer
  FROM (
    SELECT public.hiyerarsi_adi_anahtari(firma_adi) AS anahtar, count(*) AS adet
    FROM public.firmalar
    GROUP BY public.hiyerarsi_adi_anahtari(firma_adi)
    HAVING count(*) > 1
    LIMIT 10
  ) d;
  IF v_mukerrer IS NOT NULL THEN
    RAISE EXCEPTION 'Mükerrer firma adları çözülmeden tekillik paketi kurulamaz: %', v_mukerrer
      USING ERRCODE = '23505';
  END IF;

  SELECT string_agg(format('%s/%s (%s)', d.firma_id, d.anahtar, d.adet), ', ')
    INTO v_mukerrer
  FROM (
    SELECT firma_id, public.hiyerarsi_adi_anahtari(takim_adi) AS anahtar, count(*) AS adet
    FROM public.takimlar
    GROUP BY firma_id, public.hiyerarsi_adi_anahtari(takim_adi)
    HAVING count(*) > 1
    LIMIT 10
  ) d;
  IF v_mukerrer IS NOT NULL THEN
    RAISE EXCEPTION 'Mükerrer takım adları çözülmeden tekillik paketi kurulamaz: %', v_mukerrer
      USING ERRCODE = '23505';
  END IF;

  SELECT string_agg(format('%s/%s (%s)', d.takim_id, d.anahtar, d.adet), ', ')
    INTO v_mukerrer
  FROM (
    SELECT takim_id, public.hiyerarsi_adi_anahtari(bolge_adi) AS anahtar, count(*) AS adet
    FROM public.bolgeler
    GROUP BY takim_id, public.hiyerarsi_adi_anahtari(bolge_adi)
    HAVING count(*) > 1
    LIMIT 10
  ) d;
  IF v_mukerrer IS NOT NULL THEN
    RAISE EXCEPTION 'Mükerrer bölge adları çözülmeden tekillik paketi kurulamaz: %', v_mukerrer
      USING ERRCODE = '23505';
  END IF;
END
$kontrol$;

-- Firma numarası üretimini MAX+1 yarışından çıkarır.
CREATE SEQUENCE IF NOT EXISTS public.firmalar_firma_no_seq AS integer;
ALTER SEQUENCE public.firmalar_firma_no_seq OWNED BY public.firmalar.firma_no;

LOCK TABLE public.firmalar IN SHARE ROW EXCLUSIVE MODE;

SELECT setval(
  'public.firmalar_firma_no_seq',
  GREATEST(COALESCE(MAX(firma_no), 0), 1),
  COALESCE(MAX(firma_no), 0) > 0
)
FROM public.firmalar;

ALTER TABLE public.firmalar
  ALTER COLUMN firma_no SET DEFAULT nextval('public.firmalar_firma_no_seq');

CREATE OR REPLACE FUNCTION public.firma_no_ata()
RETURNS trigger
LANGUAGE plpgsql
AS $fonksiyon$
BEGIN
  IF NEW.firma_no IS NULL THEN
    NEW.firma_no := nextval('public.firmalar_firma_no_seq');
  END IF;
  RETURN NEW;
END
$fonksiyon$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_firmalar_firma_adi_anahtari
  ON public.firmalar (public.hiyerarsi_adi_anahtari(firma_adi));

CREATE UNIQUE INDEX IF NOT EXISTS ux_takimlar_firma_adi_anahtari
  ON public.takimlar (firma_id, public.hiyerarsi_adi_anahtari(takim_adi));

CREATE UNIQUE INDEX IF NOT EXISTS ux_bolgeler_takim_adi_anahtari
  ON public.bolgeler (takim_id, public.hiyerarsi_adi_anahtari(bolge_adi));

COMMIT;

SELECT
  to_regclass('public.firmalar_firma_no_seq') IS NOT NULL AS firma_no_sequence_kuruldu,
  to_regclass('public.ux_firmalar_firma_adi_anahtari') IS NOT NULL AS firma_tekilligi_kuruldu,
  to_regclass('public.ux_takimlar_firma_adi_anahtari') IS NOT NULL AS takim_tekilligi_kuruldu,
  to_regclass('public.ux_bolgeler_takim_adi_anahtari') IS NOT NULL AS bolge_tekilligi_kuruldu;
