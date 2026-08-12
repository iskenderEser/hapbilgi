-- TM toplamı = bağlı BM toplamları doğrulaması.
-- Salt-okuma sorgusudur; veritabanında değişiklik yapmaz.
-- Dönem: İstanbul saatine göre içinde bulunulan ayın başından şu ana kadar.

WITH
parametre AS (
  SELECT
    (
      date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')
      AT TIME ZONE 'Europe/Istanbul'
    )::timestamptz AS baslangic,
    CURRENT_TIMESTAMP::timestamptz AS bitis
),
aktif_tm AS (
  SELECT
    k.kullanici_id AS tm_id,
    CONCAT(k.ad, ' ', k.soyad)::text AS tm_adi,
    k.firma_id,
    k.takim_id
  FROM public.kullanicilar k
  WHERE k.rol = 'tm'
    AND k.aktif_mi = true
),
aktif_bm AS (
  SELECT
    tm.tm_id,
    bm.kullanici_id AS bm_id,
    bm.bolge_id
  FROM aktif_tm tm
  JOIN public.kullanicilar bm
    ON bm.firma_id = tm.firma_id
   AND bm.takim_id = tm.takim_id
   AND bm.rol = 'bm'
   AND bm.aktif_mi = true
),
bm_tekil_toplam AS (
  SELECT
    ab.tm_id,
    ab.bm_id,
    ab.bolge_id,
    COALESCE(SUM(bp.kazanilan_toplam), 0)::bigint AS kazanim,
    COALESCE(SUM(bp.kaybedilen_toplam), 0)::bigint AS kayip,
    COALESCE(SUM(bp.net_puan), 0)::bigint AS net
  FROM aktif_bm ab
  CROSS JOIN parametre p
  LEFT JOIN LATERAL public.get_bm_utt_performans_v2(
    ab.bm_id,
    p.baslangic,
    p.bitis
  ) bp ON true
  GROUP BY ab.tm_id, ab.bm_id, ab.bolge_id
),
bm_toplam AS (
  SELECT
    btt.tm_id,
    COUNT(*)::int AS aktif_bm,
    COUNT(DISTINCT btt.bolge_id)::int AS bm_bolgesi,
    COALESCE(SUM(btt.kazanim), 0)::bigint AS kazanim,
    COALESCE(SUM(btt.kayip), 0)::bigint AS kayip,
    COALESCE(SUM(btt.net), 0)::bigint AS net
  FROM bm_tekil_toplam btt
  GROUP BY btt.tm_id
),
coklu_bm_bolge AS (
  SELECT x.tm_id, COUNT(*)::int AS adet
  FROM (
    SELECT ab.tm_id, ab.bolge_id
    FROM aktif_bm ab
    GROUP BY ab.tm_id, ab.bolge_id
    HAVING COUNT(*) > 1
  ) x
  GROUP BY x.tm_id
),
tm_toplam AS (
  SELECT
    tm.tm_id,
    COUNT(tp.bolge_id)::int AS tm_bolge_satiri,
    COALESCE(SUM(tp.kazanilan_toplam), 0)::bigint AS kazanim,
    COALESCE(SUM(tp.kaybedilen_toplam), 0)::bigint AS kayip,
    COALESCE(SUM(tp.net_puan), 0)::bigint AS net,
    COUNT(tp.bolge_id) FILTER (
      WHERE tp.bolge_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.bolgeler b
          WHERE b.bolge_id = tp.bolge_id
            AND b.takim_id = tm.takim_id
        )
    )::int AS kapsam_disi_bolge
  FROM aktif_tm tm
  CROSS JOIN parametre p
  LEFT JOIN LATERAL public.get_tm_bolge_performans_v2(
    tm.tm_id,
    p.baslangic,
    p.bitis
  ) tp ON true
  GROUP BY tm.tm_id, tm.takim_id
)
SELECT
  tm.tm_id,
  tm.tm_adi,
  p.baslangic,
  p.bitis,
  COALESCE(bt.aktif_bm, 0) AS aktif_bm,
  COALESCE(bt.bm_bolgesi, 0) AS bm_bolgesi,
  COALESCE(tt.tm_bolge_satiri, 0) AS tm_bolge_satiri,
  COALESCE(bt.kazanim, 0) AS bm_kazanim,
  COALESCE(tt.kazanim, 0) AS tm_kazanim,
  COALESCE(bt.kazanim, 0) = COALESCE(tt.kazanim, 0) AS kazanim_esit,
  COALESCE(bt.kayip, 0) AS bm_kayip,
  COALESCE(tt.kayip, 0) AS tm_kayip,
  COALESCE(bt.kayip, 0) = COALESCE(tt.kayip, 0) AS kayip_esit,
  COALESCE(bt.net, 0) AS bm_net,
  COALESCE(tt.net, 0) AS tm_net,
  COALESCE(bt.net, 0) = COALESCE(tt.net, 0) AS net_esit,
  COALESCE(cbb.adet, 0) AS coklu_bm_bolgesi,
  COALESCE(tt.kapsam_disi_bolge, 0) AS kapsam_disi_bolge,
  CASE
    WHEN COALESCE(bt.kazanim, 0) = COALESCE(tt.kazanim, 0)
     AND COALESCE(bt.kayip, 0) = COALESCE(tt.kayip, 0)
     AND COALESCE(bt.net, 0) = COALESCE(tt.net, 0)
     AND COALESCE(cbb.adet, 0) = 0
     AND COALESCE(tt.kapsam_disi_bolge, 0) = 0
    THEN 'TEMİZ'
    ELSE 'FARK VAR'
  END AS sonuc
FROM aktif_tm tm
CROSS JOIN parametre p
LEFT JOIN bm_toplam bt ON bt.tm_id = tm.tm_id
LEFT JOIN tm_toplam tt ON tt.tm_id = tm.tm_id
LEFT JOIN coklu_bm_bolge cbb ON cbb.tm_id = tm.tm_id
ORDER BY tm.tm_adi, tm.tm_id;
