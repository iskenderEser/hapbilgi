-- Üretici raporu — sade üretim özeti.
--
-- Seçili dönem:
--   toplam_talep      = dönemde üretici tarafından oluşturulan talepler
--   tamamlanan_talep  = bu taleplerden üretim zinciri soru seti onayına ulaşanlar
-- Güncel durum:
--   yayindaki_video   = üreticinin şu anda yayında olan yayınları
--   durdurulan_video  = üreticinin şu anda durdurulmuş yayınları

CREATE OR REPLACE FUNCTION public.get_uretici_rapor_ozet_v3(
  p_uretici_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  toplam_talep integer,
  tamamlanan_talep integer,
  yayindaki_video integer,
  durdurulan_video integer
)
LANGUAGE sql
STABLE
AS $function$
WITH donem_talepleri AS (
  SELECT t.talep_id
  FROM public.talepler t
  WHERE t.uretici_id = p_uretici_id
    AND t.created_at >= p_baslangic
    AND t.created_at <= p_bitis
),
tamamlanan_talepler AS (
  SELECT dt.talep_id
  FROM donem_talepleri dt
  JOIN public.v_uretici_icerik_takip vit
    ON vit.talep_id = dt.talep_id
  WHERE vit.soru_seti_durum = 'onaylandi'
)
SELECT
  (SELECT COUNT(*) FROM donem_talepleri)::integer,
  (SELECT COUNT(*) FROM tamamlanan_talepler)::integer,
  (
    SELECT COUNT(*)
    FROM public.yayin_yonetimi yy
    WHERE yy.uretici_id = p_uretici_id
      AND lower(yy.durum::text) = 'yayinda'
  )::integer,
  (
    SELECT COUNT(*)
    FROM public.yayin_yonetimi yy
    WHERE yy.uretici_id = p_uretici_id
      AND lower(yy.durum::text) = 'durduruldu'
  )::integer;
$function$;

GRANT EXECUTE ON FUNCTION public.get_uretici_rapor_ozet_v3(
  uuid, timestamptz, timestamptz
) TO service_role;
