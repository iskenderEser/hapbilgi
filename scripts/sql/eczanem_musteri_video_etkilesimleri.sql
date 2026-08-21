-- Eczanem müşteri ana sayfası: müşteri-global beğeni/favori ve tamamlanmış
-- izleme sayaçları. Değerler yalnız müşteriye gönderilmiş yayınların dijital
-- kanal raflarını sıralar; E-Club/UTT etkileşim tablolarıyla birleşmez.

BEGIN;

-- Yalnız müşteri modülü, yarım bırakılan videoyu kaldığı saniyeden sürdürür.
ALTER TABLE public.eczanem_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS son_konum_saniye integer NOT NULL DEFAULT 0
  CHECK (son_konum_saniye >= 0);

CREATE TABLE IF NOT EXISTS public.eczanem_video_begeniler (
  begeni_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid NOT NULL REFERENCES public.eczanem_musteriler(musteri_id) ON DELETE CASCADE,
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (musteri_id, yayin_id)
);

CREATE TABLE IF NOT EXISTS public.eczanem_video_favoriler (
  favori_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid NOT NULL REFERENCES public.eczanem_musteriler(musteri_id) ON DELETE CASCADE,
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (musteri_id, yayin_id)
);

CREATE INDEX IF NOT EXISTS ix_eczanem_video_begeniler_yayin
  ON public.eczanem_video_begeniler (yayin_id);
CREATE INDEX IF NOT EXISTS ix_eczanem_video_favoriler_yayin
  ON public.eczanem_video_favoriler (yayin_id);
CREATE INDEX IF NOT EXISTS ix_eczanem_izleme_tamamlanan_yayin
  ON public.eczanem_izleme_kayitlari (yayin_id)
  WHERE tamamlandi_mi = true;

REVOKE ALL ON public.eczanem_video_begeniler FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.eczanem_video_favoriler FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.eczanem_video_begeniler TO service_role;
GRANT ALL ON public.eczanem_video_favoriler TO service_role;

CREATE OR REPLACE FUNCTION public.eczanem_musteri_video_etkilesim_degistir(
  p_musteri_id uuid,
  p_yayin_id uuid,
  p_tur text
)
RETURNS TABLE(aktif boolean, sayi integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_silinen integer := 0;
BEGIN
  -- Aynı müşterinin aynı yayına eşzamanlı iki isteği toggle sonucunu tersine
  -- çevirmesin. Kilit yalnız bu müşteri+yayın+etkileşim anahtarını kapsar.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_musteri_id::text || ':' || p_yayin_id::text || ':' || p_tur, 0));

  IF p_tur = 'begeni' THEN
    DELETE FROM public.eczanem_video_begeniler
    WHERE musteri_id = p_musteri_id AND yayin_id = p_yayin_id;
    GET DIAGNOSTICS v_silinen = ROW_COUNT;
    IF v_silinen = 0 THEN
      INSERT INTO public.eczanem_video_begeniler (musteri_id, yayin_id)
      VALUES (p_musteri_id, p_yayin_id)
      ON CONFLICT (musteri_id, yayin_id) DO NOTHING;
    END IF;
    RETURN QUERY
    SELECT
      EXISTS (SELECT 1 FROM public.eczanem_video_begeniler b WHERE b.musteri_id = p_musteri_id AND b.yayin_id = p_yayin_id),
      (SELECT count(*)::integer FROM public.eczanem_video_begeniler b WHERE b.yayin_id = p_yayin_id);
    RETURN;
  END IF;

  IF p_tur = 'favori' THEN
    DELETE FROM public.eczanem_video_favoriler
    WHERE musteri_id = p_musteri_id AND yayin_id = p_yayin_id;
    GET DIAGNOSTICS v_silinen = ROW_COUNT;
    IF v_silinen = 0 THEN
      INSERT INTO public.eczanem_video_favoriler (musteri_id, yayin_id)
      VALUES (p_musteri_id, p_yayin_id)
      ON CONFLICT (musteri_id, yayin_id) DO NOTHING;
    END IF;
    RETURN QUERY
    SELECT
      EXISTS (SELECT 1 FROM public.eczanem_video_favoriler f WHERE f.musteri_id = p_musteri_id AND f.yayin_id = p_yayin_id),
      (SELECT count(*)::integer FROM public.eczanem_video_favoriler f WHERE f.yayin_id = p_yayin_id);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Geçersiz müşteri video etkileşim türü.' USING ERRCODE = '22023';
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.get_eczanem_musteri_video_etkilesimleri(
  p_musteri_id uuid,
  p_yayin_idler uuid[]
)
RETURNS TABLE(
  yayin_id uuid,
  begeni_sayisi integer,
  favori_sayisi integer,
  izlenme_sayisi integer,
  begeni_mi boolean,
  favori_mi boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
  SELECT
    y.yayin_id,
    (SELECT count(*)::integer FROM public.eczanem_video_begeniler b WHERE b.yayin_id = y.yayin_id),
    (SELECT count(*)::integer FROM public.eczanem_video_favoriler f WHERE f.yayin_id = y.yayin_id),
    (SELECT count(*)::integer FROM public.eczanem_izleme_kayitlari i WHERE i.yayin_id = y.yayin_id AND i.tamamlandi_mi = true),
    EXISTS (SELECT 1 FROM public.eczanem_video_begeniler b WHERE b.yayin_id = y.yayin_id AND b.musteri_id = p_musteri_id),
    EXISTS (SELECT 1 FROM public.eczanem_video_favoriler f WHERE f.yayin_id = y.yayin_id AND f.musteri_id = p_musteri_id)
  FROM unnest(COALESCE(p_yayin_idler, ARRAY[]::uuid[])) AS y(yayin_id);
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_musteri_video_etkilesim_degistir(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_eczanem_musteri_video_etkilesimleri(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_musteri_video_etkilesim_degistir(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_eczanem_musteri_video_etkilesimleri(uuid, uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
