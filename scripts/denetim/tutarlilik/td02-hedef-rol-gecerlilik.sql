-- T-D2 — talepler/yayınlar çoğul hedef sözleşmesi dışında mı?
-- Boş dönüş = temiz.
SELECT 'talep_hedef_roller' AS tip, talep_id::text AS id,
       COALESCE(array_to_string(hedef_roller,','),'NULL') AS deger
FROM talepler
WHERE hedef_roller IS NULL OR hedef_roller = '{}'
   OR EXISTS (SELECT 1 FROM unnest(hedef_roller) h
              WHERE h NOT IN ('utt','bm','eczaci','eczane_teknisyeni','eczanem'))
   OR hedef_roller NOT IN (
        ARRAY['utt']::text[], ARRAY['bm']::text[], ARRAY['eczaci']::text[],
        ARRAY['eczane_teknisyeni']::text[], ARRAY['eczanem']::text[],
        ARRAY['eczaci','eczane_teknisyeni']::text[]
      );

SELECT 'yayin_hedef_roller' AS tip, yayin_id::text AS id,
       COALESCE(array_to_string(hedef_roller,','),'NULL') AS deger
FROM yayin_yonetimi
WHERE hedef_roller IS NULL OR hedef_roller = '{}'
   OR EXISTS (SELECT 1 FROM unnest(hedef_roller) h
              WHERE h NOT IN ('utt','bm','eczaci','eczane_teknisyeni','eczanem'))
   OR hedef_roller NOT IN (
        ARRAY['utt']::text[], ARRAY['bm']::text[], ARRAY['eczaci']::text[],
        ARRAY['eczane_teknisyeni']::text[], ARRAY['eczanem']::text[],
        ARRAY['eczaci','eczane_teknisyeni']::text[]
      );
