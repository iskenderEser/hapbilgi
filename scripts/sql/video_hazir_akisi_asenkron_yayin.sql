-- Hazır Video yayınını Bunny'nin anlık işleme durumundan ayırır.
-- Video dışındaki öğrenme araçlarının onay/metadata kapıları korunur.
-- Tekrar çalıştırılabilir. Canlı veritabanında kullanıcı tarafından çalıştırılır.

BEGIN;

CREATE OR REPLACE FUNCTION public.yayin_arac_kapisini_dogrula()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac_durum_id uuid;
  v_arac_id uuid;
  v_arac_turu text;
  v_durum text;
  v_metadata_dogrulandi boolean;
BEGIN
  SELECT ss.arac_durum_id
    INTO v_arac_durum_id
  FROM public.soru_seti_durumu ssd
  JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  WHERE ssd.soru_seti_durum_id = NEW.soru_seti_durum_id;

  IF NEW.arac_durum_id IS NULL THEN NEW.arac_durum_id := v_arac_durum_id; END IF;
  IF NEW.arac_durum_id IS DISTINCT FROM v_arac_durum_id THEN
    RAISE EXCEPTION 'Yayın ile soru setinin öğrenme aracı eşleşmiyor.' USING ERRCODE = '23514';
  END IF;

  IF NEW.arac_durum_id IS NULL THEN RETURN NEW; END IF;

  SELECT d.arac_id, a.arac_turu, d.durum, a.metadata_dogrulandi
    INTO v_arac_id, v_arac_turu, v_durum, v_metadata_dogrulandi
  FROM public.ogrenme_araci_durumu d
  JOIN public.ogrenme_araclari a ON a.arac_id = d.arac_id
  WHERE d.arac_durum_id = NEW.arac_durum_id;

  IF v_arac_turu = 'video' THEN RETURN NEW; END IF;

  IF v_arac_id IS NULL OR v_durum <> 'onaylandi' OR v_metadata_dogrulandi IS NOT TRUE THEN
    RAISE EXCEPTION 'Onaylı ve metadata doğrulaması tamamlanmış öğrenme aracı olmadan yayın açılamaz.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS yayin_yonetimi_arac_kapisi_trg ON public.yayin_yonetimi;
CREATE TRIGGER yayin_yonetimi_arac_kapisi_trg
BEFORE INSERT OR UPDATE OF soru_seti_durum_id, arac_durum_id ON public.yayin_yonetimi
FOR EACH ROW EXECUTE FUNCTION public.yayin_arac_kapisini_dogrula();

COMMIT;

SELECT TRUE AS video_hazir_akisi_asenkron_yayin_kuruldu;
