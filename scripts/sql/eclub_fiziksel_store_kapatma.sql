-- Faz 2B: Eski fiziksel E-Club Store işlem yüzeyini kapatır.
-- Geçmiş sipariş kayıtları ve tablolar korunur; hiçbir veri silinmez.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-fiziksel-store-kapatma-v1', 1));

DROP FUNCTION IF EXISTS public.eclub_store_siparis_olustur(uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.eclub_store_siparis_iptal(uuid, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.eclub_store_teslim_aldim(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_eclub_utt_siparisler(uuid, uuid, uuid, text, timestamptz, timestamptz, integer, integer);
DROP FUNCTION IF EXISTS public.get_eclub_store_firma_bakiye(uuid);
DROP FUNCTION IF EXISTS public.eclub_store_siparis_donemi_acik_mi(timestamptz);

DO $blok$
DECLARE
  tablo_adi text;
BEGIN
  FOREACH tablo_adi IN ARRAY ARRAY[
    'eclub_store_kategoriler',
    'eclub_store_urunler',
    'eclub_store_urun_firma_ayarlari',
    'eclub_store_adresler',
    'eclub_store_siparisler',
    'eclub_store_siparis_firma_puan'
  ]
  LOOP
    IF to_regclass(format('public.%I', tablo_adi)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
        tablo_adi
      );
    END IF;
  END LOOP;
END
$blok$;

COMMIT;
