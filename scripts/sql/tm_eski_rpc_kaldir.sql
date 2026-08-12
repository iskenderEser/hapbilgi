-- Eski TM rapor RPC'lerini kaldırır.
-- CASCADE YOK: beklenmeyen bir bağımlılık varsa işlem güvenle hata verir.
-- get_tm_etkilesim_v2 korunur.

BEGIN;

DROP FUNCTION public.get_tm_rapor_ana_ozet_v2(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) RESTRICT;

DROP FUNCTION public.get_tm_bolge_performans_v2(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) RESTRICT;

DROP FUNCTION public.get_tm_utt_performans_v2(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) RESTRICT;

COMMIT;

-- Kaldırma sonrası doğrulama.
SELECT
  to_regprocedure(
    'public.get_tm_rapor_ana_ozet_v2(uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NULL AS ana_ozet_kaldirildi,
  to_regprocedure(
    'public.get_tm_bolge_performans_v2(uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NULL AS bolge_performans_kaldirildi,
  to_regprocedure(
    'public.get_tm_utt_performans_v2(uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NULL AS utt_performans_kaldirildi,
  to_regprocedure(
    'public.get_tm_bm_performans_v1(uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NOT NULL AS bm_performans_korundu,
  to_regprocedure(
    'public.get_tm_oneri_durumu_v1(uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NOT NULL AS oneri_durumu_korundu,
  to_regprocedure(
    'public.get_tm_etkilesim_v2(uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NOT NULL AS etkilesim_korundu;
