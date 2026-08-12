DROP FUNCTION IF EXISTS public.get_uretici_rapor_ana_ozet_v2(
  uuid, timestamptz, timestamptz, uuid, uuid
);

DROP VIEW IF EXISTS public.v_rapor_begeni_favori_v2;

SELECT
  to_regprocedure(
    'public.get_uretici_rapor_ana_ozet_v2(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid)'
  ) IS NULL AS eski_ozet_kaldirildi,
  to_regclass('public.v_rapor_begeni_favori_v2') IS NULL AS eski_etkilesim_kaldirildi,
  to_regprocedure(
    'public.get_uretici_rapor_ozet_v3(uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NOT NULL AS yeni_ozet_korundu,
  to_regclass('public.v_rapor_begeni_favori_v3') IS NOT NULL AS yeni_etkilesim_korundu;
