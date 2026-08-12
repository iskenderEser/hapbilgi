-- Üretici raporu — yalnız üreticinin kendi canlı yayınlarının etkileşimi.

CREATE OR REPLACE VIEW public.v_rapor_begeni_favori_v3 AS
WITH yayin_bilgi AS (
  SELECT DISTINCT
    yy.uretici_id,
    yy.yayin_id,
    COALESCE(u.urun_adi, t.urun_adi) AS urun_adi,
    tek.teknik_adi
  FROM public.yayin_yonetimi yy
  JOIN public.soru_seti_durumu ssd
    ON ssd.soru_seti_durum_id = yy.soru_seti_durum_id
  JOIN public.soru_setleri ss
    ON ss.soru_seti_id = ssd.soru_seti_id
  JOIN public.talepler t
    ON t.talep_id = ss.talep_id
  LEFT JOIN public.urunler u
    ON u.urun_id = t.urun_id
  LEFT JOIN public.teknikler tek
    ON tek.teknik_id = t.teknik_id
  WHERE lower(yy.durum::text) = 'yayinda'
),
begeni_sayilari AS (
  SELECT vb.yayin_id, COUNT(*)::bigint AS begeni_sayisi
  FROM public.video_begeniler vb
  GROUP BY vb.yayin_id
),
favori_sayilari AS (
  SELECT vf.yayin_id, COUNT(*)::bigint AS favori_sayisi
  FROM public.video_favoriler vf
  GROUP BY vf.yayin_id
)
SELECT
  yb.uretici_id,
  yb.yayin_id,
  yb.urun_adi,
  yb.teknik_adi,
  COALESCE(bs.begeni_sayisi, 0::bigint) AS begeni_sayisi,
  COALESCE(fs.favori_sayisi, 0::bigint) AS favori_sayisi
FROM yayin_bilgi yb
LEFT JOIN begeni_sayilari bs ON bs.yayin_id = yb.yayin_id
LEFT JOIN favori_sayilari fs ON fs.yayin_id = yb.yayin_id;

GRANT SELECT ON public.v_rapor_begeni_favori_v3 TO service_role;
