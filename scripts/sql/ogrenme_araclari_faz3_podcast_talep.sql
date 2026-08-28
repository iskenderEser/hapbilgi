BEGIN;

ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS ogrenme_araci_tercihleri jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'talepler_ogrenme_araci_tercihleri_nesne_ck'
      AND conrelid = 'public.talepler'::regclass
  ) THEN
    ALTER TABLE public.talepler
      ADD CONSTRAINT talepler_ogrenme_araci_tercihleri_nesne_ck
      CHECK (jsonb_typeof(ogrenme_araci_tercihleri) = 'object');
  END IF;
END;
$constraint$;

COMMIT;
