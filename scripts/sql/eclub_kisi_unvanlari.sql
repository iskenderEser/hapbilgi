BEGIN;

ALTER TABLE public.eclub_kisiler
  DROP CONSTRAINT IF EXISTS eclub_kisiler_rol_check;

ALTER TABLE public.eclub_kisiler
  ADD CONSTRAINT eclub_kisiler_rol_check
  CHECK (
    rol::text = ANY (
      ARRAY[
        'eczaci',
        'ikinci_eczaci',
        'yardimci_eczaci',
        'eczane_teknisyeni'
      ]::text[]
    )
  );

COMMIT;
