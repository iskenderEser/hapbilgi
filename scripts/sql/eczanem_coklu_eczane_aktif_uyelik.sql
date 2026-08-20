-- Eczanem çoklu eczane gönderimi + aktif üyelik veritabanı kapısı.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.
--
-- 1. Aynı yayın aynı müşteriye farklı eczanelerden gönderilebilir.
-- 2. Aynı eczane aynı yayın/müşteri gönderimini çoğaltamaz.
-- 3. Pasif veya silinmiş üyelik üzerinden izleme başlatılamaz/tamamlanamaz.
-- 4. Pasif veya silinmiş üyelik adına yeni puan kaydı oluşturulamaz.

BEGIN;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.eczanem_gonderimler
    GROUP BY yayin_id, musteri_id, eczane_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'eczanem_gonderimler içinde mükerrer yayin/musteri/eczane kaydı var. Paket kurulmadı.';
  END IF;
END;
$kontrol$;

-- Eski global teklik: UNIQUE (yayin_id, musteri_id).
-- Kısıt adı kurulumlar arasında değişebileceği için tanımından bulunur.
DO $teklik$
DECLARE
  v_kisit record;
BEGIN
  FOR v_kisit IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.eczanem_gonderimler'::regclass
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) = 'UNIQUE (yayin_id, musteri_id)'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.eczanem_gonderimler DROP CONSTRAINT %I',
      v_kisit.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'public.eczanem_gonderimler'::regclass
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) = 'UNIQUE (yayin_id, musteri_id, eczane_id)'
  ) THEN
    ALTER TABLE public.eczanem_gonderimler
      ADD CONSTRAINT eczanem_gonderimler_yayin_musteri_eczane_key
      UNIQUE (yayin_id, musteri_id, eczane_id);
  END IF;
END;
$teklik$;

CREATE OR REPLACE FUNCTION public.eczanem_izleme_aktif_uyelik_kapisi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_eczane_id uuid;
BEGIN
  SELECT g.eczane_id
  INTO v_eczane_id
  FROM public.eczanem_gonderimler g
  WHERE g.gonderim_id = NEW.gonderim_id
    AND g.musteri_id = NEW.musteri_id
    AND g.yayin_id = NEW.yayin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzlemenin gönderim bağı doğrulanamadı.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.eczanem_uyelikler u
    WHERE u.musteri_id = NEW.musteri_id
      AND u.eczane_id = v_eczane_id
      AND u.aktif_mi = true
  ) THEN
    RAISE EXCEPTION 'Bu eczanedeki üyeliğiniz aktif değil.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS eczanem_izleme_aktif_uyelik_trg
  ON public.eczanem_izleme_kayitlari;
CREATE TRIGGER eczanem_izleme_aktif_uyelik_trg
  BEFORE INSERT OR UPDATE ON public.eczanem_izleme_kayitlari
  FOR EACH ROW
  EXECUTE FUNCTION public.eczanem_izleme_aktif_uyelik_kapisi();

CREATE OR REPLACE FUNCTION public.eczanem_puan_aktif_uyelik_kapisi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.eczanem_uyelikler u
    WHERE u.musteri_id = NEW.musteri_id
      AND u.eczane_id = NEW.eczane_id
      AND u.aktif_mi = true
  ) THEN
    RAISE EXCEPTION 'Bu eczanedeki üyeliğiniz aktif değil; puan kazanılamaz.' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.izleme_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.eczanem_izleme_kayitlari ik
    JOIN public.eczanem_gonderimler g ON g.gonderim_id = ik.gonderim_id
    WHERE ik.izleme_id = NEW.izleme_id
      AND ik.musteri_id = NEW.musteri_id
      AND g.musteri_id = NEW.musteri_id
      AND g.eczane_id = NEW.eczane_id
      AND g.yayin_id = ik.yayin_id
  ) THEN
    RAISE EXCEPTION 'Puan kaydının izleme/eczane bağı doğrulanamadı.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS eczanem_puan_aktif_uyelik_trg
  ON public.eczanem_puan_kayitlari;
CREATE TRIGGER eczanem_puan_aktif_uyelik_trg
  BEFORE INSERT ON public.eczanem_puan_kayitlari
  FOR EACH ROW
  EXECUTE FUNCTION public.eczanem_puan_aktif_uyelik_kapisi();

COMMIT;
