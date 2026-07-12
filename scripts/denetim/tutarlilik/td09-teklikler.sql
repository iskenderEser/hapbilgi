-- T-D9 — Teklikler: (a) beklenen UNIQUE kısıtlarından pg_constraint'te
-- bulunmayanlar; (b) dörtlü kilit kolonlarında NULL. Boş dönüş = temiz.
WITH beklenen(tablo, tanim) AS (VALUES
  ('yayin_tekrar_kayitlari',      'UNIQUE (yayin_id, tur_no)'),
  ('eczanem_gonderimler',         'UNIQUE (yayin_id, musteri_id)'),
  ('eczanem_eczane_gonderimleri', 'UNIQUE (yayin_id, eczane_id)'),
  ('eczanem_uyelikler',           'UNIQUE (musteri_id, eczane_id)'),
  ('eczanem_musteriler',          'UNIQUE (telefon)'),
  ('eczanem_musteriler',          'UNIQUE (auth_user_id)'),
  ('eczanem_siparisler',          'UNIQUE (islem_kodu)')
)
SELECT 'eksik_unique' AS tip, b.tablo, b.tanim
FROM beklenen b
WHERE NOT EXISTS (
  SELECT 1 FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  WHERE c.relname = b.tablo
    AND pg_get_constraintdef(con.oid) = b.tanim
);

SELECT 'dortlu_kilit_null' AS tip, kayit_id::text, NULL AS tanim
FROM eczanem_puan_kayitlari
WHERE musteri_id IS NULL OR eczane_id IS NULL OR firma_id IS NULL OR urun_id IS NULL;
