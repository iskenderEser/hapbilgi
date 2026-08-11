-- Üretici raporu beğeni/favori görünümü — dört üretim varyantını ve takımsız
-- firma içeriklerini kapsayan v2 kaynak.
--
-- Exit: Mevcut v_rapor_begeni_favori korunur; uygulama geri bağlanabilir.

CREATE OR REPLACE VIEW public.v_rapor_begeni_favori_v2 AS
WITH yayin_bilgi AS (
  SELECT DISTINCT
    yy.yayin_id,
    t.takim_id,
    t.firma_id,
    COALESCE(u.urun_adi, t.urun_adi) AS urun_adi,
    tek.teknik_adi
  FROM yayin_yonetimi yy
  JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = yy.soru_seti_durum_id
  JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  JOIN talepler t ON t.talep_id = ss.talep_id
  LEFT JOIN urunler u ON u.urun_id = t.urun_id
  LEFT JOIN teknikler tek ON tek.teknik_id = t.teknik_id
  WHERE yy.durum = 'yayinda'
),
begeni_sayilari AS (
  SELECT yayin_id, COUNT(*)::bigint AS begeni_sayisi
  FROM video_begeniler
  GROUP BY yayin_id
),
favori_sayilari AS (
  SELECT yayin_id, COUNT(*)::bigint AS favori_sayisi
  FROM video_favoriler
  GROUP BY yayin_id
)
SELECT
  yb.takim_id,
  yb.firma_id,
  yb.yayin_id,
  yb.urun_adi,
  yb.teknik_adi,
  COALESCE(bs.begeni_sayisi, 0::bigint) AS begeni_sayisi,
  COALESCE(fs.favori_sayisi, 0::bigint) AS favori_sayisi
FROM yayin_bilgi yb
LEFT JOIN begeni_sayilari bs ON bs.yayin_id = yb.yayin_id
LEFT JOIN favori_sayilari fs ON fs.yayin_id = yb.yayin_id;

GRANT SELECT ON public.v_rapor_begeni_favori_v2 TO service_role;
