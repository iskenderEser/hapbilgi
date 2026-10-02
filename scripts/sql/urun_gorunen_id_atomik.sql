-- Ürün UUID'sini değiştirmeden kullanıcıya görünen ürün ID'sini üretir.
-- Firma öneki = firma_no * 10; örnek: firma_no 3, üçüncü ürün => 30-003.
-- Mevcut ürünler firma içinde created_at, urun_id sırasıyla numaralanır.
-- Bu dosya yalnız bir kez, Supabase SQL Editor'de bütün olarak çalıştırılır.
-- Bütün şema/veri değişiklikleri tek transaction'dadır; hata halinde geri alınır.

BEGIN;

LOCK TABLE public.urunler IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.firmalar IN SHARE ROW EXCLUSIVE MODE;

DO $kontrol$
BEGIN
  IF EXISTS (SELECT 1 FROM public.firmalar WHERE firma_no IS NULL OR firma_no < 1) THEN
    RAISE EXCEPTION 'Pozitif firma_no bulunmayan firma var; ürün ID kurulumu durduruldu.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.urunler
    GROUP BY firma_id HAVING COUNT(*) > 999
  ) THEN
    RAISE EXCEPTION 'Bir firmada 999 ürün sınırı aşıldı; üç haneli ürün sırası yeterli değil.';
  END IF;
END;
$kontrol$;

ALTER TABLE public.firmalar
  ADD COLUMN son_urun_sira integer NOT NULL DEFAULT 0
  CHECK (son_urun_sira BETWEEN 0 AND 999);

ALTER TABLE public.urunler
  ADD COLUMN urun_sira integer,
  ADD COLUMN gorunen_urun_id text;

WITH sirali AS (
  SELECT u.urun_id, u.firma_id,
    ROW_NUMBER() OVER (
      PARTITION BY u.firma_id ORDER BY u.created_at NULLS LAST, u.urun_id
    )::integer AS sira
  FROM public.urunler u
)
UPDATE public.urunler u
SET urun_sira = s.sira,
    gorunen_urun_id = (f.firma_no * 10)::text || '-' || LPAD(s.sira::text, 3, '0')
FROM sirali s
JOIN public.firmalar f ON f.firma_id = s.firma_id
WHERE u.urun_id = s.urun_id;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.urunler
    WHERE urun_sira IS NULL OR gorunen_urun_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Bazı ürünlerin firma bağı bulunamadı; ürün ID kurulumu geri alındı.';
  END IF;
END;
$kontrol$;

UPDATE public.firmalar f
SET son_urun_sira = COALESCE((
  SELECT MAX(u.urun_sira) FROM public.urunler u WHERE u.firma_id = f.firma_id
), 0);

ALTER TABLE public.urunler
  ALTER COLUMN urun_sira SET NOT NULL,
  ALTER COLUMN gorunen_urun_id SET NOT NULL,
  ADD CONSTRAINT urunler_urun_sira_aralik CHECK (urun_sira BETWEEN 1 AND 999),
  ADD CONSTRAINT urunler_firma_urun_sira_key UNIQUE (firma_id, urun_sira),
  ADD CONSTRAINT urunler_gorunen_urun_id_key UNIQUE (gorunen_urun_id);

CREATE FUNCTION public.urun_gorunen_id_koru_ve_ata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_firma_no integer;
  v_sira integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.firma_id IS DISTINCT FROM OLD.firma_id
       OR NEW.urun_sira IS DISTINCT FROM OLD.urun_sira
       OR NEW.gorunen_urun_id IS DISTINCT FROM OLD.gorunen_urun_id THEN
      RAISE EXCEPTION 'Ürünün firması ve görünen ürün ID''si değiştirilemez.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.urun_sira IS NOT NULL OR NEW.gorunen_urun_id IS NOT NULL THEN
    RAISE EXCEPTION 'Görünen ürün ID''si elle verilemez; veritabanı tarafından atanır.';
  END IF;

  -- UPDATE firma satırını kilitler; aynı firmadaki eşzamanlı ürün girişleri sıraya girer.
  -- İşlem geri alınırsa sayaç artışı da geri alınır; silinen ürünün sırası korunur.
  UPDATE public.firmalar
  SET son_urun_sira = son_urun_sira + 1
  WHERE firma_id = NEW.firma_id AND son_urun_sira < 999
  RETURNING firma_no, son_urun_sira INTO v_firma_no, v_sira;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Firma bulunamadı veya 999 ürün sınırına ulaşıldı.';
  END IF;

  NEW.urun_sira := v_sira;
  NEW.gorunen_urun_id := (v_firma_no * 10)::text || '-' || LPAD(v_sira::text, 3, '0');
  RETURN NEW;
END;
$fonksiyon$;

CREATE TRIGGER trg_urun_gorunen_id_koru_ve_ata
BEFORE INSERT OR UPDATE ON public.urunler
FOR EACH ROW
EXECUTE FUNCTION public.urun_gorunen_id_koru_ve_ata();

CREATE FUNCTION public.firma_no_urun_id_koru()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fonksiyon$
BEGIN
  IF NEW.firma_no IS DISTINCT FROM OLD.firma_no THEN
    RAISE EXCEPTION 'Firma numarası değiştirilemez; görünen ürün ID''lerinde kullanılıyor.';
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

CREATE TRIGGER trg_firma_no_urun_id_koru
BEFORE UPDATE OF firma_no ON public.firmalar
FOR EACH ROW
EXECUTE FUNCTION public.firma_no_urun_id_koru();

COMMIT;

-- Beklenen mevcut sonuç: Mill 20-001..003, Hepifarma 30-001..005.
SELECT f.firma_adi, f.firma_no, u.urun_adi, u.gorunen_urun_id
FROM public.urunler u
JOIN public.firmalar f ON f.firma_id = u.firma_id
ORDER BY f.firma_no, u.urun_sira;
