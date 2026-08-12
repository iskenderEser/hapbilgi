-- Eski TM rapor RPC'leri kaldırılmadan önce bağımlılık taraması.
-- Salt-okuma sorgusudur; hiçbir nesneyi değiştirmez veya kaldırmaz.
--
-- Kaldırma adayı:
--   get_tm_rapor_ana_ozet_v2(uuid,timestamptz,timestamptz)
--   get_tm_bolge_performans_v2(uuid,timestamptz,timestamptz)
--   get_tm_utt_performans_v2(uuid,timestamptz,timestamptz)
--
-- KORUNACAK ve bu taramaya dahil değildir:
--   get_tm_etkilesim_v2(uuid,timestamptz,timestamptz)

WITH
hedef_imzalar(imza) AS (
  VALUES
    ('public.get_tm_rapor_ana_ozet_v2(uuid,timestamp with time zone,timestamp with time zone)'),
    ('public.get_tm_bolge_performans_v2(uuid,timestamp with time zone,timestamp with time zone)'),
    ('public.get_tm_utt_performans_v2(uuid,timestamp with time zone,timestamp with time zone)')
),
hedefler AS (
  SELECT
    hi.imza,
    to_regprocedure(hi.imza) AS hedef_oid
  FROM hedef_imzalar hi
),
bagimliliklar AS (
  SELECT
    h.imza,
    h.hedef_oid,
    d.deptype::text AS bagimlilik_turu,
    pg_describe_object(d.classid, d.objid, d.objsubid) AS bagimli_nesne
  FROM hedefler h
  JOIN pg_depend d
    ON d.refclassid = 'pg_proc'::regclass
   AND d.refobjid = h.hedef_oid
  WHERE h.hedef_oid IS NOT NULL
    AND d.deptype::text NOT IN ('i', 'e')
),
sonuclar AS (
  SELECT
    0 AS sira,
    'HEDEF'::text AS kontrol,
    h.imza::text AS nesne,
    CASE
      WHEN h.hedef_oid IS NULL THEN 'Fonksiyon bulunamadı'
      ELSE 'Fonksiyon bulundu'
    END::text AS detay
  FROM hedefler h

  UNION ALL

  SELECT
    1 AS sira,
    'BAĞIMLILIK'::text AS kontrol,
    b.imza::text AS nesne,
    (
      'deptype=' || b.bagimlilik_turu
      || ' | ' || b.bagimli_nesne
    )::text AS detay
  FROM bagimliliklar b

  UNION ALL

  SELECT
    2 AS sira,
    'ÖZET'::text AS kontrol,
    h.imza::text AS nesne,
    CASE
      WHEN h.hedef_oid IS NULL THEN 'Fonksiyon bulunamadı'
      WHEN COUNT(b.bagimli_nesne) = 0 THEN 'Veritabanı içinde bağımlılık bulunmadı'
      ELSE COUNT(b.bagimli_nesne)::text || ' bağımlılık bulundu'
    END::text AS detay
  FROM hedefler h
  LEFT JOIN bagimliliklar b
    ON b.imza = h.imza
  GROUP BY h.imza, h.hedef_oid
)
SELECT sira, kontrol, nesne, detay
FROM sonuclar
ORDER BY nesne, sira, detay;
