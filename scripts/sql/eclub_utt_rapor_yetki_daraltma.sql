-- Migration: get_eclub_utt_rapor Yetki Daraltma
-- SECURITY DEFINER fonksiyonun p_utt_id parametresi aldığı için authenticated rolünden yetkisi kaldırılır,
-- yalnız service_role için EXECUTE izni bırakılır.

BEGIN;

REVOKE ALL ON FUNCTION public.get_eclub_utt_rapor(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_eclub_utt_rapor(
  uuid,
  timestamp with time zone,
  timestamp with time zone
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
