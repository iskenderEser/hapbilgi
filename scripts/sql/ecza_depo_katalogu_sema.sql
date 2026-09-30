-- İlk ecza depo kataloğu. Supabase SQL Editor'da çalıştırılır.
-- aktif_mi uygulamada seçilebilirliktir, resmi ruhsat doğrulaması değildir.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ecza_depolari (
  depo_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depo_adi text NOT NULL UNIQUE CHECK (length(btrim(depo_adi)) > 0),
  aktif_mi boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ecza_depo_subeleri (
  depo_sube_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depo_id uuid NOT NULL REFERENCES public.ecza_depolari(depo_id),
  sube_adi text CHECK (sube_adi IS NULL OR length(btrim(sube_adi)) > 0),
  il text NOT NULL CHECK (length(btrim(il)) > 0),
  ilce text NOT NULL CHECK (length(btrim(ilce)) > 0),
  adres text NOT NULL CHECK (length(btrim(adres)) > 0),
  kaynak_sira_no integer CHECK (kaynak_sira_no > 0),
  kaynak_dosya text,
  aktif_mi boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kaynak_dosya, kaynak_sira_no)
);

CREATE INDEX IF NOT EXISTS ecza_depo_subeleri_depo_idx
  ON public.ecza_depo_subeleri (depo_id);
CREATE INDEX IF NOT EXISTS ecza_depo_subeleri_il_ilce_idx
  ON public.ecza_depo_subeleri (il, ilce) WHERE aktif_mi = true;

ALTER TABLE public.ecza_depolari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecza_depo_subeleri ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ecza_depolari, public.ecza_depo_subeleri
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ecza_depolari, public.ecza_depo_subeleri
  TO service_role;

COMMIT;
