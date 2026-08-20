-- Eczanem bütünlük paketi — CANLI ÖN KONTROL.
-- İskender önce yalnız bu dosyayı çalıştırır. İki sorgunun da boş dönmesi gerekir.

-- 1) E-Club ile Eczanem arasında bugün var olan telefon çakışmaları.
-- Migration henüz kurulmadığı için normalizasyon burada bağımsız yazılmıştır.
WITH eclub AS (
  SELECT kisi_id,
         CASE
           WHEN regexp_replace(telefon, '\D', '', 'g') ~ '^905[0-9]{9}$' THEN substr(regexp_replace(telefon, '\D', '', 'g'), 3)
           WHEN regexp_replace(telefon, '\D', '', 'g') ~ '^05[0-9]{9}$' THEN substr(regexp_replace(telefon, '\D', '', 'g'), 2)
           WHEN regexp_replace(telefon, '\D', '', 'g') ~ '^5[0-9]{9}$' THEN regexp_replace(telefon, '\D', '', 'g')
           ELSE NULL
         END AS telefon
  FROM public.eclub_kisiler
), musteri AS (
  SELECT musteri_id,
         CASE
           WHEN regexp_replace(telefon, '\D', '', 'g') ~ '^905[0-9]{9}$' THEN substr(regexp_replace(telefon, '\D', '', 'g'), 3)
           WHEN regexp_replace(telefon, '\D', '', 'g') ~ '^05[0-9]{9}$' THEN substr(regexp_replace(telefon, '\D', '', 'g'), 2)
           WHEN regexp_replace(telefon, '\D', '', 'g') ~ '^5[0-9]{9}$' THEN regexp_replace(telefon, '\D', '', 'g')
           ELSE NULL
         END AS telefon
  FROM public.eczanem_musteriler
)
SELECT 'kimlik_telefon_cakismasi' AS bulgu, e.kisi_id, m.musteri_id, e.telefon
FROM eclub e
JOIN musteri m USING (telefon)
WHERE e.telefon IS NOT NULL;

-- 2) Koşullu UNIQUE index kurulmadan önce var olan mükerrer bekleyen siparişler.
SELECT 'mukerrer_bekleyen_siparis' AS bulgu,
       musteri_id, eczane_id, urun_id, count(*) AS adet
FROM public.eczanem_siparisler
WHERE durum = 'bekliyor' AND musteri_id IS NOT NULL
GROUP BY musteri_id, eczane_id, urun_id
HAVING count(*) > 1;
