-- Eczanem UTT -> eczane gönderimi, aynı UTT'nin geçerli yayın turunu
-- puansız/sorusuz tamamlamasını gerektirir. E-Club inceleme doğrulamasını
-- paylaşır; E-Club öneri ve Eczanem dağıtım iş kuralları ayrı kalır.
-- Supabase SQL Editor'da proje sahibi tarafından uygulanır.

CREATE OR REPLACE FUNCTION public.eczanem_utt_inceleme_gonderim_kilidi()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_tur timestamptz;
  v_periyot integer;
  v_arac_id uuid;
BEGIN
  SELECT COALESCE(
    (SELECT t.baslangic_tarihi
       FROM public.yayin_tekrar_kayitlari t
      WHERE t.yayin_id = NEW.yayin_id ORDER BY t.tur_no DESC LIMIT 1),
    y.yayin_tarihi
  ), y.tekrar_periyot_gun INTO v_tur, v_periyot
  FROM public.yayin_yonetimi y WHERE y.yayin_id = NEW.yayin_id;

  IF v_periyot > 0 AND v_tur < now() THEN
    v_tur := v_tur + floor(extract(epoch FROM (now() - v_tur)) / (v_periyot * 86400))::integer
      * make_interval(days => v_periyot);
  END IF;

  SELECT y.arac_id INTO v_arac_id
  FROM public.v_yayin_detay y WHERE y.yayin_id = NEW.yayin_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.eclub_utt_yayin_incelemeleri i
    WHERE i.utt_id = NEW.gonderen_utt_id AND i.yayin_id = NEW.yayin_id
      AND i.arac_id = v_arac_id
      AND i.tamamlandi_at IS NOT NULL
      AND i.tamamlandi_at >= v_tur
  ) THEN
    RAISE EXCEPTION 'Göndermek için yayını önce tamamlayın.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eczanem_utt_inceleme_gonderim_kilidi ON public.eczanem_eczane_gonderimleri;
CREATE TRIGGER trg_eczanem_utt_inceleme_gonderim_kilidi
BEFORE INSERT ON public.eczanem_eczane_gonderimleri
FOR EACH ROW EXECUTE FUNCTION public.eczanem_utt_inceleme_gonderim_kilidi();
