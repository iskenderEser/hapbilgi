-- ============================================================================
-- Rapor Puan Hesapları Ortaklaştırma Test Tabloları - Canlı Şema Doğrulama Sorgusu
-- Dosya: scripts/sql/sema_kontrol_test_rapor_tablolari.sql
--
-- AMAÇ:
--   test_rapor_puan_hesaplari_ortaklastirma.sql dosyasındaki tüm INSERT INTO
--   hedef tablolarının canlı veritabanındaki güncel şema bilgilerini çıkarmak.
--
-- KAPSAM:
--   1. Kolon adı, sırası ve veri tipi
--   2. NULL kabulü ve varsayılan değer
--   3. Birincil anahtar (Primary Key) tanımları
--   4. Yabancı anahtar (Foreign Key) tanımları
--   5. CHECK kısıtlarının tam tanımları
--   6. UNIQUE kısıtları ve benzersiz indeks tanımları
--   7. Etkin kullanıcı tetikleyicileri ve bağlı fonksiyon tanımları
--
-- KULLANIM:
--   Supabase SQL Editörü'nde doğrudan çalıştırılabilir.
--   Salt okunurdur (SELECT). Tek bir sonuç tablosu üretir.
-- ============================================================================

WITH hedef_tablolar AS (
  SELECT unnest(ARRAY[
    'firmalar',
    'takimlar',
    'bolgeler',
    'kullanicilar',
    'izleme_kayitlari',
    'kazanilan_puanlar',
    'eclub_utt_puanlari',
    'ileri_sarma_kayitlari',
    'yanlis_cevap_kayitlari',
    'oneri_kayip_kayitlari',
    'challenge_kayitlari',
    'challenge_kayip_kayitlari'
  ]::text[]) AS tablo_adi
),

-- 0. Tablo Durumu (Var / Yok Kontrolü)
tablo_varlik AS (
  SELECT
    ht.tablo_adi,
    '0_TABLO_DURUMU'::text AS kategori,
    0::int AS sira_no,
    ht.tablo_adi AS oge_adi,
    'TABLO MEVCUDİYETİ'::text AS detay_1,
    CASE WHEN cls.oid IS NOT NULL THEN 'MEVCUT' ELSE 'TABLO BULUNAMADI!' END AS detay_2,
    CASE WHEN cls.oid IS NOT NULL
         THEN 'public.' || ht.tablo_adi || ' tablosu veritabanında mevcuttur.'
         ELSE 'DİKKAT: Tablo public şemasında bulunamadı! İsim veya şema kontrol edilmelidir.'
    END AS tam_tanim
  FROM hedef_tablolar ht
  LEFT JOIN pg_class cls ON cls.relname = ht.tablo_adi
  LEFT JOIN pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = 'public'
),

-- 1. Kolonlar (Adı, Veri Tipi, NULL Kabulü, Varsayılan Değer)
kolonlar AS (
  SELECT
    cls.relname::text AS tablo_adi,
    '1_KOLON'::text AS kategori,
    att.attnum::int AS sira_no,
    att.attname::text AS oge_adi,
    format_type(att.atttypid, att.atttypmod) AS detay_1,
    CASE WHEN att.attnotnull THEN 'NOT NULL' ELSE 'NULL KABUL EDER' END AS detay_2,
    COALESCE(pg_get_expr(def.adbin, def.adrelid), 'VARSAYILAN YOK') AS tam_tanim
  FROM pg_class cls
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  JOIN pg_attribute att ON att.attrelid = cls.oid
  LEFT JOIN pg_attrdef def ON def.adrelid = cls.oid AND def.adnum = att.attnum
  WHERE ns.nspname = 'public'
    AND cls.relkind IN ('r', 'p')
    AND att.attnum > 0
    AND NOT att.attisdropped
    AND cls.relname IN (SELECT tablo_adi FROM hedef_tablolar)
),

-- 2. Birincil Anahtarlar (Primary Keys)
birincil_anahtarlar AS (
  SELECT
    cls.relname::text AS tablo_adi,
    '2_BIRINCIL_ANAHTAR'::text AS kategori,
    0::int AS sira_no,
    con.conname::text AS oge_adi,
    'PRIMARY KEY'::text AS detay_1,
    (
      SELECT string_agg(att.attname, ', ' ORDER BY k.n)
      FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, n)
      JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = k.attnum
    ) AS detay_2,
    pg_get_constraintdef(con.oid, true) AS tam_tanim
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
    AND con.contype = 'p'
    AND cls.relname IN (SELECT tablo_adi FROM hedef_tablolar)
),

-- 3. Yabancı Anahtarlar (Foreign Keys)
yabanci_anahtarlar AS (
  SELECT
    cls.relname::text AS tablo_adi,
    '3_YABANCI_ANAHTAR'::text AS kategori,
    0::int AS sira_no,
    con.conname::text AS oge_adi,
    (
      SELECT string_agg(att.attname, ', ' ORDER BY k.n)
      FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, n)
      JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = k.attnum
    ) AS detay_1,
    (
      SELECT ref_cls.relname || '(' || string_agg(ref_att.attname, ', ' ORDER BY rk.n) || ')'
      FROM pg_class ref_cls
      JOIN pg_attribute ref_att ON ref_att.attrelid = ref_cls.oid
      JOIN unnest(con.confkey) WITH ORDINALITY AS rk(attnum, n) ON ref_att.attnum = rk.attnum
      WHERE ref_cls.oid = con.confrelid
      GROUP BY ref_cls.relname
    ) AS detay_2,
    pg_get_constraintdef(con.oid, true) AS tam_tanim
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
    AND con.contype = 'f'
    AND cls.relname IN (SELECT tablo_adi FROM hedef_tablolar)
),

-- 4. CHECK Kısıtları
check_kisitlari AS (
  SELECT
    cls.relname::text AS tablo_adi,
    '4_CHECK_KISITI'::text AS kategori,
    0::int AS sira_no,
    con.conname::text AS oge_adi,
    COALESCE((
      SELECT string_agg(att.attname, ', ' ORDER BY k.n)
      FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, n)
      JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = k.attnum
    ), 'TABLO GENELİ') AS detay_1,
    'CHECK'::text AS detay_2,
    pg_get_constraintdef(con.oid, true) AS tam_tanim
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
    AND con.contype = 'c'
    AND cls.relname IN (SELECT tablo_adi FROM hedef_tablolar)
),

-- 5. UNIQUE Kısıtları ve Benzersiz İndeksler
benzersiz_kisit_ve_indeksler AS (
  SELECT
    cls.relname::text AS tablo_adi,
    '5_BENZERSIZ_KISIT_VE_INDEKS'::text AS kategori,
    0::int AS sira_no,
    idx_cls.relname::text AS oge_adi,
    CASE
      WHEN con.conname IS NOT NULL THEN 'UNIQUE CONSTRAINT'
      ELSE 'UNIQUE INDEX'
    END AS detay_1,
    pg_get_indexdef(idx.indexrelid) AS detay_2,
    COALESCE(pg_get_constraintdef(con.oid, true), pg_get_indexdef(idx.indexrelid)) AS tam_tanim
  FROM pg_index idx
  JOIN pg_class cls ON cls.oid = idx.indrelid
  JOIN pg_class idx_cls ON idx_cls.oid = idx.indexrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  LEFT JOIN pg_constraint con ON con.conindid = idx.indexrelid AND con.contype = 'u'
  WHERE ns.nspname = 'public'
    AND idx.indisunique
    AND NOT idx.indisprimary
    AND cls.relname IN (SELECT tablo_adi FROM hedef_tablolar)
),

-- 6. Etkin Kullanıcı Tetikleyicileri ve Bağlı Fonksiyon Tanımları
tetikleyiciler AS (
  SELECT
    cls.relname::text AS tablo_adi,
    '6_TETIKLEYICI'::text AS kategori,
    0::int AS sira_no,
    trg.tgname::text AS oge_adi,
    CASE trg.tgenabled
      WHEN 'O' THEN 'ETKİN (Origin/Local)'
      WHEN 'A' THEN 'ETKİN (Always)'
      WHEN 'R' THEN 'REPLICA'
      WHEN 'D' THEN 'DEVRE DIŞI'
    END AS detay_1,
    'Fonksiyon: ' || prc.proname || '(' || pg_get_function_identity_arguments(prc.oid) || ')' AS detay_2,
    'TETİKLEYİCİ TANIMI: ' || pg_get_triggerdef(trg.oid, true) || E'\n\n--- TETİKLEYİCİ FONKSİYONU GÖVDESİ ---\n' ||
    CASE
      WHEN lng.lanname = 'c' THEN 'Yerleşik C fonksiyonu: ' || prc.proname
      ELSE pg_get_functiondef(prc.oid)
    END AS tam_tanim
  FROM pg_trigger trg
  JOIN pg_class cls ON cls.oid = trg.tgrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  JOIN pg_proc prc ON prc.oid = trg.tgfoid
  JOIN pg_language lng ON lng.oid = prc.prolang
  WHERE ns.nspname = 'public'
    AND NOT trg.tgisinternal
    AND trg.tgenabled IN ('O', 'A')
    AND cls.relname IN (SELECT tablo_adi FROM hedef_tablolar)
)

-- Bütün kategorileri tek sonuç tablosunda birleştir
SELECT
  tablo_adi,
  kategori,
  sira_no,
  oge_adi,
  detay_1,
  detay_2,
  tam_tanim
FROM tablo_varlik

UNION ALL

SELECT
  tablo_adi,
  kategori,
  sira_no,
  oge_adi,
  detay_1,
  detay_2,
  tam_tanim
FROM kolonlar

UNION ALL

SELECT
  tablo_adi,
  kategori,
  sira_no,
  oge_adi,
  detay_1,
  detay_2,
  tam_tanim
FROM birincil_anahtarlar

UNION ALL

SELECT
  tablo_adi,
  kategori,
  sira_no,
  oge_adi,
  detay_1,
  detay_2,
  tam_tanim
FROM yabanci_anahtarlar

UNION ALL

SELECT
  tablo_adi,
  kategori,
  sira_no,
  oge_adi,
  detay_1,
  detay_2,
  tam_tanim
FROM check_kisitlari

UNION ALL

SELECT
  tablo_adi,
  kategori,
  sira_no,
  oge_adi,
  detay_1,
  detay_2,
  tam_tanim
FROM benzersiz_kisit_ve_indeksler

UNION ALL

SELECT
  tablo_adi,
  kategori,
  sira_no,
  oge_adi,
  detay_1,
  detay_2,
  tam_tanim
FROM tetikleyiciler

ORDER BY tablo_adi, kategori, sira_no, oge_adi;
