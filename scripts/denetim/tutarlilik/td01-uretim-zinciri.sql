-- T-D1 — Üretim zinciri bütünlüğü:
-- 'yayinda' durumundaki her yayının talep→senaryo→video→soru seti→puan zinciri eksiksiz mi?
-- Boş dönüş = temiz; her satır bir İHLALDİR.
SELECT yayin_id, urun_adi,
  (senaryo_id IS NULL)      AS senaryo_yok,
  (video_durum_id IS NULL)  AS video_durum_yok,
  (soru_seti_id IS NULL)    AS soru_seti_yok,
  (video_url IS NULL)       AS video_url_yok,
  (video_puani IS NULL)     AS video_puani_yok,
  (soru_puani IS NULL)      AS soru_puani_yok,
  (sorular IS NULL)         AS sorular_yok
FROM v_yayin_detay
WHERE durum = 'yayinda'
  AND (senaryo_id IS NULL OR video_durum_id IS NULL OR soru_seti_id IS NULL
       OR video_url IS NULL OR video_puani IS NULL OR soru_puani IS NULL OR sorular IS NULL);
