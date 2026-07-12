-- T-D2 — hedef_rol CHECK-dışı / hedef_roller boş-NULL/geçersiz eleman.
-- Boş dönüş = temiz.
SELECT 'talep_gecersiz_hedef' AS tip, talep_id::text AS id, COALESCE(hedef_rol,'NULL') AS deger
FROM talepler
WHERE hedef_rol IS NULL
   OR hedef_rol NOT IN ('utt','bm','eczaci','eczane_teknisyeni','eczanem');

SELECT 'yayin_hedef_roller' AS tip, yayin_id::text AS id,
       COALESCE(array_to_string(hedef_roller,','),'NULL') AS deger
FROM yayin_yonetimi
WHERE hedef_roller IS NULL OR hedef_roller = '{}'
   OR EXISTS (SELECT 1 FROM unnest(hedef_roller) h
              WHERE h NOT IN ('utt','bm','eczaci','eczane_teknisyeni','eczanem'));
