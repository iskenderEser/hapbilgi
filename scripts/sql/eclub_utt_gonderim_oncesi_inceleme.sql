-- UTT/KD_UTT'nin E-Club yayını gönderimden önce puansız ve sorusuz incelemesi.
-- Proje sahibi tarafından Supabase SQL Editor'da uygulanır.
CREATE TABLE IF NOT EXISTS public.eclub_utt_yayin_incelemeleri (
  inceleme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utt_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id) ON DELETE CASCADE,
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id) ON DELETE CASCADE,
  arac_id uuid NOT NULL REFERENCES public.ogrenme_araclari(arac_id),
  arac_turu text NOT NULL CHECK (arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf')),
  tur_baslangici timestamptz NOT NULL,
  basladi_at timestamptz NOT NULL DEFAULT now(),
  son_etkinlik_at timestamptz NOT NULL DEFAULT now(),
  dogrulanan_saniye numeric NOT NULL DEFAULT 0 CHECK (dogrulanan_saniye >= 0),
  son_konum_saniye numeric NOT NULL DEFAULT 0 CHECK (son_konum_saniye >= 0),
  sayfa_sureleri jsonb NOT NULL DEFAULT '{}'::jsonb,
  tamamlandi_at timestamptz,
  UNIQUE (utt_id, yayin_id, tur_baslangici)
);

CREATE INDEX IF NOT EXISTS ix_eclub_utt_inceleme_gonderim
  ON public.eclub_utt_yayin_incelemeleri (utt_id, yayin_id, tamamlandi_at);

ALTER TABLE public.eclub_utt_yayin_incelemeleri ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eclub_utt_yayin_incelemeleri FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.eclub_utt_yayin_incelemeleri TO service_role;

-- UI/API atlanarak doğrudan öneri RPC'si çağrılsa da tamamlanmamış yayın gönderilemez.
CREATE OR REPLACE FUNCTION public.eclub_utt_inceleme_gonderim_kilidi()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_rol text;
  v_tur timestamptz;
  v_periyot integer;
BEGIN
  SELECT lower(k.rol) INTO v_rol FROM public.kullanicilar k WHERE k.kullanici_id = NEW.oneren_id;
  IF v_rol NOT IN ('utt', 'kd_utt') THEN RETURN NEW; END IF;

  SELECT COALESCE(
    (SELECT t.baslangic_tarihi
       FROM public.yayin_tekrar_kayitlari t
      WHERE t.yayin_id = NEW.yayin_id ORDER BY t.tur_no DESC LIMIT 1),
    y.yayin_tarihi
  ), y.tekrar_periyot_gun INTO v_tur, v_periyot
  FROM public.yayin_yonetimi y WHERE y.yayin_id = NEW.yayin_id;

  -- Tur satırı henüz açılmamış olsa da takvimde dolmuş periyotları hesaba kat.
  IF v_periyot > 0 AND v_tur < now() THEN
    v_tur := v_tur + floor(extract(epoch FROM (now() - v_tur)) / (v_periyot * 86400))::integer
      * make_interval(days => v_periyot);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.eclub_utt_yayin_incelemeleri i
    WHERE i.utt_id = NEW.oneren_id AND i.yayin_id = NEW.yayin_id
      AND i.arac_id = NEW.arac_id
      AND i.tamamlandi_at IS NOT NULL
      AND i.tamamlandi_at >= v_tur
  ) THEN
    RAISE EXCEPTION 'Göndermek için yayını önce tamamlayın.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eclub_utt_inceleme_gonderim_kilidi ON public.eclub_oneri_kayitlari;
CREATE TRIGGER trg_eclub_utt_inceleme_gonderim_kilidi
BEFORE INSERT ON public.eclub_oneri_kayitlari
FOR EACH ROW EXECUTE FUNCTION public.eclub_utt_inceleme_gonderim_kilidi();
