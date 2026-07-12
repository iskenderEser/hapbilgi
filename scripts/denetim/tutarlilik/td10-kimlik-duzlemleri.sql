-- T-D10 — Kimlik düzlemleri: (a) aynı auth_id birden çok düzlemde;
-- (b) auth.users'ta karşılığı olmayan bağ; (c) auth.users'ta olup hiçbir
-- düzlemde olmayan kullanıcı (test kalıntısı sınıfı — B-15 emsali).
-- Boş dönüş = temiz.
SELECT 'coklu_duzlem' AS tip, auth_id::text AS id,
       array_to_string(array_agg(kimlik_turu), ',') AS detay
FROM v_auth_kimlik_admin
GROUP BY auth_id HAVING COUNT(*) > 1;

SELECT 'sahipsiz_bag' AS tip, k.kullanici_id::text AS id, 'kullanicilar' AS detay
FROM kullanicilar k
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = k.kullanici_id)
UNION ALL
SELECT 'sahipsiz_bag', e.kisi_id::text, 'eclub_kisiler'
FROM eclub_kisiler e
WHERE e.auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.auth_user_id)
UNION ALL
SELECT 'sahipsiz_bag', m.musteri_id::text, 'eczanem_musteriler'
FROM eczanem_musteriler m
WHERE m.auth_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.auth_user_id);

SELECT 'duzlemsiz_auth' AS tip, u.id::text, u.email AS detay
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM v_auth_kimlik_admin v WHERE v.auth_id = u.id);
