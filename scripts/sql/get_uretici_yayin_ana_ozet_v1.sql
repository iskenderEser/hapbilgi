-- Üretici rol için kişisel Yayın Özeti ve Yayın Üretim Yöntemleri özeti.
-- Yönetici raporunun firma geneli kapsamına dokunmaz.
-- Exit: DROP FUNCTION public.get_uretici_yayin_ana_ozet_v1(uuid,timestamptz,timestamptz);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_uretici_yayin_ana_ozet_v1(
  p_uretici_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  toplam_yayina_alma integer,
  donemde_yayina_alinan integer,
  su_an_yayinda integer,
  donem_normal_uretim integer,
  donem_hazir_video integer,
  donem_hazir_soru_seti integer,
  donem_hazir_video_ve_soru_seti integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
uretici_scope AS (
  SELECT k.kullanici_id, k.firma_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_uretici_id
    AND k.aktif_mi = true
    AND k.rol IN (
      'pm','jr_pm','kd_pm','med_md','egt_md','egt_yrd_md','egt_yon','egt_uz',
      'ik_drk','ik_md','ik_yrd_md','ik_uz','ik_per'
    )
),
scope_yayinlari AS (
  SELECT DISTINCT
    yy.yayin_id,
    LOWER(COALESCE(yy.durum, '')) AS durum,
    yy.yayin_tarihi,
    COALESCE(t.hazir_video, false) AS hazir_video,
    COALESCE(t.hazir_soru_seti, false) AS hazir_soru_seti
  FROM yayin_yonetimi yy
  JOIN v_yayin_kunye ky ON ky.yayin_id = yy.yayin_id
  JOIN talepler t ON t.talep_id = ky.talep_id
  JOIN uretici_scope us
    ON us.firma_id = ky.firma_id
   AND us.kullanici_id = ky.uretici_id
)
SELECT
  COUNT(*)::int AS toplam_yayina_alma,
  COUNT(*) FILTER (
    WHERE yayin_tarihi >= p_baslangic AND yayin_tarihi <= p_bitis
  )::int AS donemde_yayina_alinan,
  COUNT(*) FILTER (WHERE durum = 'yayinda')::int AS su_an_yayinda,
  COUNT(*) FILTER (
    WHERE yayin_tarihi >= p_baslangic AND yayin_tarihi <= p_bitis
      AND hazir_video = false AND hazir_soru_seti = false
  )::int AS donem_normal_uretim,
  COUNT(*) FILTER (
    WHERE yayin_tarihi >= p_baslangic AND yayin_tarihi <= p_bitis
      AND hazir_video = true AND hazir_soru_seti = false
  )::int AS donem_hazir_video,
  COUNT(*) FILTER (
    WHERE yayin_tarihi >= p_baslangic AND yayin_tarihi <= p_bitis
      AND hazir_video = false AND hazir_soru_seti = true
  )::int AS donem_hazir_soru_seti,
  COUNT(*) FILTER (
    WHERE yayin_tarihi >= p_baslangic AND yayin_tarihi <= p_bitis
      AND hazir_video = true AND hazir_soru_seti = true
  )::int AS donem_hazir_video_ve_soru_seti
FROM scope_yayinlari;
$function$;

GRANT EXECUTE ON FUNCTION public.get_uretici_yayin_ana_ozet_v1(uuid,timestamptz,timestamptz) TO service_role;

COMMIT;
