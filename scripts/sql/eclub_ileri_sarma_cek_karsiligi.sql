-- scripts/sql/eclub_ileri_sarma_cek_karsiligi.sql
--
-- E-Club ileri sarma kaybının Çekli ve Çeksiz puanla uyumlu hale getirilmesi.
-- Supabase SQL Editor'da İskender tarafından çalıştırılır.
--
-- Kurallar:
--   * eclub_ileri_sarma_kayitlari tablosuna cek_karsiligi_var_mi boolean NOT NULL DEFAULT true eklenir.
--   * Mevcut ileri sarma kayıtları Çekli Puan kabul edilir (DEFAULT true + backfill).
--   * Merkezi BEFORE INSERT trigger'ı ile yeni kayıp kaydı doğrudan yayının
--     yayin_yonetimi.cek_karsiligi_var_mi değerini alır.
--   * İstemciden gelen puan sınıfına güvenilmez.
--   * Eksik veya geçersiz yayın bağlantısında sessizce değer üretilmez; fail-closed hata verilir.
--   * Kayıp sınıfı işlem anında sabitlenir; yayın kararı sonradan değişse dahi geçmiş kayıtlar değişmez.
--   * Çekli Puan yayınındaki ileri sarma kaybı lig ve Store hesaplarında mevcut davranışını korur (Store puanını azaltır).
--   * Çeksiz Puan yayınındaki ileri sarma kaybı lig hesabındaki mevcut etkisini korur; Store puanından düşülmez.
--   * get_eclub_store_firma_bakiye fonksiyonu yalnız Çekli Puan ileri sarma kayıplarını (cek_karsiligi_var_mi = true)
--     Store bakiyesinden düşer.

BEGIN;

-- 1. eclub_ileri_sarma_kayitlari tablosuna kolon ekleme ve backfill
ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;

ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.eclub_ileri_sarma_kayitlari
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- 2. Merkezi BEFORE INSERT trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.tg_eclub_ileri_sarma_kayitlari_cek_karsiligi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cek_karsiligi boolean;
BEGIN
  IF NEW.yayin_id IS NULL THEN
    RAISE EXCEPTION 'eclub_ileri_sarma_kayitlari: yayin_id zorunludur.';
  END IF;

  SELECT y.cek_karsiligi_var_mi
    INTO v_cek_karsiligi
    FROM public.yayin_yonetimi y
   WHERE y.yayin_id = NEW.yayin_id;

  IF v_cek_karsiligi IS NULL THEN
    RAISE EXCEPTION 'eclub_ileri_sarma_kayitlari: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı (yayin_id: %).', NEW.yayin_id;
  END IF;

  -- İstemci/RPC girdisine güvenilmez; doğrudan yayındaki değer sabitlenir.
  NEW.cek_karsiligi_var_mi := v_cek_karsiligi;
  RETURN NEW;
END;
$$;

-- 3. Trigger tanımı
DROP TRIGGER IF EXISTS trg_eclub_ileri_sarma_kayitlari_cek_karsiligi ON public.eclub_ileri_sarma_kayitlari;
CREATE TRIGGER trg_eclub_ileri_sarma_kayitlari_cek_karsiligi
  BEFORE INSERT ON public.eclub_ileri_sarma_kayitlari
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_eclub_ileri_sarma_kayitlari_cek_karsiligi();

-- 4. Store firma bakiyesi fonksiyonunun güncellenmesi (yalnızca Çekli Puan kayıplarını düşer)
CREATE OR REPLACE FUNCTION public.get_eclub_store_firma_bakiye(p_kisi_id uuid)
 RETURNS TABLE(firma_id uuid, firma_adi character varying, kazanilan bigint, harcanan bigint, bakiye bigint)
 LANGUAGE sql
 STABLE
AS $function$
  WITH kazanc AS (
    SELECT ky.firma_id, COALESCE(SUM(kp.puan), 0) AS kazanilan
    FROM public.eclub_kazanilan_puanlar kp
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kisi_id = p_kisi_id
      AND kp.cek_karsiligi_var_mi = true
    GROUP BY ky.firma_id
  ),
  kayip AS (
    SELECT ky.firma_id, COALESCE(SUM(ks.kaybedilen_puan), 0) AS kaybedilen
    FROM public.eclub_ileri_sarma_kayitlari ks
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = ks.yayin_id
    WHERE ks.kisi_id = p_kisi_id
      AND ks.cek_karsiligi_var_mi = true
    GROUP BY ky.firma_id
  ),
  harcama AS (
    SELECT sfp.firma_id, COALESCE(SUM(sfp.kullanilan_puan), 0) AS harcanan
    FROM public.eclub_store_siparis_firma_puan sfp
    JOIN public.eclub_store_siparisler s ON s.siparis_id = sfp.siparis_id
    WHERE s.kisi_id = p_kisi_id
      AND s.durum <> 'iptal'
    GROUP BY sfp.firma_id
  )
  SELECT
    f.firma_id,
    f.firma_adi,
    COALESCE(k.kazanilan, 0),
    COALESCE(h.harcanan, 0),
    (
      COALESCE(k.kazanilan, 0)
      - COALESCE(ka.kaybedilen, 0)
      - COALESCE(h.harcanan, 0)
    ) AS bakiye
  FROM public.firmalar f
  JOIN kazanc k ON k.firma_id = f.firma_id
  LEFT JOIN kayip ka ON ka.firma_id = f.firma_id
  LEFT JOIN harcama h ON h.firma_id = f.firma_id
  WHERE f.eclub_store_aktif = true
    AND (
      COALESCE(k.kazanilan, 0)
      - COALESCE(ka.kaybedilen, 0)
      - COALESCE(h.harcanan, 0)
    ) > 0
  ORDER BY bakiye DESC;
$function$;

COMMIT;
