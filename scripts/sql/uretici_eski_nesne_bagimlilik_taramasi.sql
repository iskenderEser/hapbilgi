-- Yeni üretici raporuna geçişten önce eski RPC ve view bağımlılıkları.
WITH hedefler AS (
  SELECT
    'public.get_uretici_rapor_ana_ozet_v2(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid)'::text AS nesne,
    to_regprocedure(
      'public.get_uretici_rapor_ana_ozet_v2(uuid,timestamp with time zone,timestamp with time zone,uuid,uuid)'
    )::oid AS oid
  UNION ALL
  SELECT
    'public.v_rapor_begeni_favori_v2',
    to_regclass('public.v_rapor_begeni_favori_v2')::oid
)
SELECT
  0 AS sira,
  'HEDEF' AS kontrol,
  h.nesne,
  CASE WHEN h.oid IS NULL THEN 'Nesne bulunamadı' ELSE 'Nesne bulundu' END AS detay
FROM hedefler h
UNION ALL
SELECT
  1,
  'BAĞIMLILIK',
  h.nesne,
  pg_describe_object(d.classid, d.objid, d.objsubid)
FROM hedefler h
JOIN pg_depend d ON d.refobjid = h.oid
WHERE d.deptype::text NOT IN ('i', 'e')
UNION ALL
SELECT
  2,
  'ÖZET',
  h.nesne,
  CASE
    WHEN h.oid IS NULL THEN 'Nesne bulunamadı'
    WHEN EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.refobjid = h.oid
        AND d.deptype::text NOT IN ('i', 'e')
    ) THEN 'Bağımlılık bulundu'
    ELSE 'Veritabanı içinde bağımlılık bulunmadı'
  END
FROM hedefler h
ORDER BY nesne, sira;
