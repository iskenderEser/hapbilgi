-- UTT beğeni/favori yapısının E-Club kişi kimliğine bağlı karşılığı.

BEGIN;

CREATE TABLE IF NOT EXISTS public.eclub_video_begeniler (
  begeni_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kisi_id uuid NOT NULL REFERENCES public.eclub_kisiler(kisi_id),
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (kisi_id, yayin_id)
);

CREATE TABLE IF NOT EXISTS public.eclub_video_favoriler (
  favori_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kisi_id uuid NOT NULL REFERENCES public.eclub_kisiler(kisi_id),
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (kisi_id, yayin_id)
);

REVOKE ALL ON public.eclub_video_begeniler FROM anon, authenticated;
REVOKE ALL ON public.eclub_video_favoriler FROM anon, authenticated;
GRANT ALL ON public.eclub_video_begeniler TO service_role;
GRANT ALL ON public.eclub_video_favoriler TO service_role;

COMMIT;
