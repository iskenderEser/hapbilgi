-- ============================================================================
-- Ortak Test Adresi Ataması
-- Dosya: scripts/sql/ortak_test_adresi_atama.sql
--
-- Kapsam:
--   Sipariş veren 4 rol grubu:
--     1) UTT / KD_UTT   (kullanicilar -> store_adresler)
--     2) BM             (kullanicilar -> store_adresler)
--     3) Eczacı         (eclub_kisiler -> eclub_store_adresler)
--     4) Teknisyen      (eclub_kisiler -> eclub_store_adresler)
--
-- Hedef Adres Bilgileri:
--   - İl: İstanbul
--   - İlçe: Sarıyer
--   - Açık Adres: 1.Caddde 2. sokak No:3 kat 4
--   - Adres Başlığı: Test Adresi
--
-- Kurallar ve Kısıtlar:
--   - Tek işlemde atomik çalışır (BEGIN ... COMMIT).
--   - Tekrar çalıştırıldığında 'Test Adresi' başlıklı adresi mükerrer eklemez.
--   - Mevcut diğer adresleri silmez veya ezmez.
--   - Kullanıcının önceden kayıtlı adresi yoksa varsayılan olarak işaretler;
--     varsa mevcut varsayılan adresi korur.
--   - Ad soyad doğrudan kişinin profil kaydından alınır.
--   - Eczane adı eclub_kisi_eczane -> eclub_eczaneler -> eclub_eczane_master zincirinden çözülür.
--   - Telefon numarası bulunamayan kayıtlar için uydurma değer kullanılmaz;
--     bu kayıtlar raporlanarak atlanır.
--   - E-Club tarafında aktif eczane bağı bulunamayan kayıtlar tahmin edilmez;
--     raporlanarak atlanır.
-- ============================================================================

BEGIN;

-- 1. E-Club Store adres tablosuna eczane_adi kolonunu ekle (yoksa)
ALTER TABLE public.eclub_store_adresler
  ADD COLUMN IF NOT EXISTS eczane_adi text;

-- 2. Aday havuzunu ve işlem durumlarını takip etmek için geçici tablo oluştur
CREATE TEMP TABLE temp_aday_kullanicilar (
  kaynak_duzlem text,        -- 'HBStore (kullanicilar)' veya 'E-Club Store (eclub_kisiler)'
  kullanici_id uuid,
  rol text,
  ad_soyad text,
  eposta text,
  telefon text,
  eczane_adi text,
  durum text,                -- 'EKLENECEK', 'ZATEN_VAR', 'EKSIK_TELEFON', 'EKSIK_ECZANE', 'EKLENDI'
  aciklama text
) ON COMMIT DROP;

-- 3. HBStore Adayları (UTT, KD_UTT, BM)
INSERT INTO temp_aday_kullanicilar (
  kaynak_duzlem,
  kullanici_id,
  rol,
  ad_soyad,
  eposta,
  telefon,
  eczane_adi,
  durum,
  aciklama
)
SELECT
  'HBStore (kullanicilar)' AS kaynak_duzlem,
  k.kullanici_id,
  k.rol,
  trim(concat(coalesce(k.ad, ''), ' ', coalesce(k.soyad, ''))) AS ad_soyad,
  k.eposta,
  k.telefon,
  NULL::text AS eczane_adi,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.store_adresler sa
      WHERE sa.kullanici_id = k.kullanici_id AND sa.baslik = 'Test Adresi'
    ) THEN 'ZATEN_VAR'
    WHEN k.telefon IS NULL OR trim(k.telefon) = '' THEN 'EKSIK_TELEFON'
    ELSE 'EKLENECEK'
  END AS durum,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.store_adresler sa
      WHERE sa.kullanici_id = k.kullanici_id AND sa.baslik = 'Test Adresi'
    ) THEN 'Kullanıcının zaten "Test Adresi" başlıklı bir adresi mevcut.'
    WHEN k.telefon IS NULL OR trim(k.telefon) = '' THEN 'Kullanıcı profilinde zorunlu telefon bilgisi bulunmuyor (uydurma değer kullanılmadı).'
    ELSE 'Test adresi eklenecek.'
  END AS aciklama
FROM public.kullanicilar k
WHERE lower(k.rol) IN ('utt', 'kd_utt', 'bm');

-- 4. E-Club Store Adayları (Eczacı, Teknisyen) ve Eczane İlişkisinin Çözümü
-- Aktif bağlantılar baslangic_tarihi DESC NULLS LAST, ardından created_at DESC sırasıyla değerlendirilir;
-- kayıtlı eczane adı bulunan ilk bağlantı kullanılır (API ile birebir aynı kural).
WITH kisi_ilk_eczane AS (
  SELECT DISTINCT ON (ke.kisi_id)
    ke.kisi_id,
    trim(m.eczane_adi) AS eczane_adi
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_eczaneler e ON e.eczane_id = ke.eczane_id
  JOIN public.eclub_eczane_master m ON m.gln = e.gln
  WHERE ke.aktif_mi = true
    AND m.eczane_adi IS NOT NULL
    AND trim(m.eczane_adi) <> ''
  ORDER BY ke.kisi_id, ke.baslangic_tarihi DESC NULLS LAST, ke.created_at DESC
),
kisi_eczane_cozum AS (
  SELECT
    ek.kisi_id,
    ek.rol,
    trim(concat(coalesce(ek.ad, ''), ' ', coalesce(ek.soyad, ''))) AS ad_soyad,
    ek.eposta,
    ek.telefon,
    kie.eczane_adi
  FROM public.eclub_kisiler ek
  LEFT JOIN kisi_ilk_eczane kie ON kie.kisi_id = ek.kisi_id
  WHERE lower(ek.rol) IN ('eczaci', 'ikinci_eczaci', 'yardimci_eczaci', 'eczane_teknisyeni')
)
INSERT INTO temp_aday_kullanicilar (
  kaynak_duzlem,
  kullanici_id,
  rol,
  ad_soyad,
  eposta,
  telefon,
  eczane_adi,
  durum,
  aciklama
)
SELECT
  'E-Club Store (eclub_kisiler)' AS kaynak_duzlem,
  kec.kisi_id AS kullanici_id,
  kec.rol,
  kec.ad_soyad,
  kec.eposta,
  kec.telefon,
  kec.eczane_adi,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.eclub_store_adresler esa
      WHERE esa.kisi_id = kec.kisi_id AND esa.baslik = 'Test Adresi'
    ) THEN 'ZATEN_VAR'
    WHEN kec.telefon IS NULL OR trim(kec.telefon) = '' THEN 'EKSIK_TELEFON'
    WHEN kec.eczane_adi IS NULL OR trim(kec.eczane_adi) = '' THEN 'EKSIK_ECZANE'
    ELSE 'EKLENECEK'
  END AS durum,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.eclub_store_adresler esa
      WHERE esa.kisi_id = kec.kisi_id AND esa.baslik = 'Test Adresi'
    ) THEN 'Üyenin zaten "Test Adresi" başlıklı bir adresi mevcut.'
    WHEN kec.telefon IS NULL OR trim(kec.telefon) = '' THEN 'Kişi kaydında zorunlu telefon bilgisi bulunmuyor (uydurma değer kullanılmadı).'
    WHEN kec.eczane_adi IS NULL OR trim(kec.eczane_adi) = '' THEN 'Sistem kayıtlarından aktif eczane ilişkisi çözülemedi (tahmin yapılmadı).'
    ELSE 'Test adresi eklenecek.'
  END AS aciklama
FROM kisi_eczane_cozum kec;

-- 5. HBStore için Adres Eklemeleri (public.store_adresler)
INSERT INTO public.store_adresler (
  kullanici_id,
  baslik,
  alici_adi,
  telefon,
  il,
  ilce,
  adres_detay,
  posta_kodu,
  varsayilan_mi
)
SELECT
  t.kullanici_id,
  'Test Adresi',
  t.ad_soyad,
  t.telefon,
  'İstanbul',
  'Sarıyer',
  '1.Caddde 2. sokak No:3 kat 4',
  NULL,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.store_adresler sa WHERE sa.kullanici_id = t.kullanici_id
    ) THEN true
    ELSE false
  END AS varsayilan_mi
FROM temp_aday_kullanicilar t
WHERE t.kaynak_duzlem = 'HBStore (kullanicilar)'
  AND t.durum = 'EKLENECEK';

UPDATE temp_aday_kullanicilar
SET durum = 'EKLENDI',
    aciklama = 'Test adresi başarıyla eklendi.'
WHERE kaynak_duzlem = 'HBStore (kullanicilar)'
  AND durum = 'EKLENECEK';

-- 6. E-Club Store için Adres Eklemeleri (public.eclub_store_adresler)
INSERT INTO public.eclub_store_adresler (
  kisi_id,
  baslik,
  ad_soyad,
  telefon,
  il,
  ilce,
  acik_adres,
  varsayilan_mi,
  eczane_adi
)
SELECT
  t.kullanici_id,
  'Test Adresi',
  t.ad_soyad,
  t.telefon,
  'İstanbul',
  'Sarıyer',
  '1.Caddde 2. sokak No:3 kat 4',
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.eclub_store_adresler esa WHERE esa.kisi_id = t.kullanici_id
    ) THEN true
    ELSE false
  END AS varsayilan_mi,
  t.eczane_adi
FROM temp_aday_kullanicilar t
WHERE t.kaynak_duzlem = 'E-Club Store (eclub_kisiler)'
  AND t.durum = 'EKLENECEK';

UPDATE temp_aday_kullanicilar
SET durum = 'EKLENDI',
    aciklama = 'Test adresi başarıyla eklendi.'
WHERE kaynak_duzlem = 'E-Club Store (eclub_kisiler)'
  AND durum = 'EKLENECEK';

-- 7. Özet Sonuç Raporu (Tek tabloda gösterim)
SELECT
  kaynak_duzlem,
  rol,
  count(*) AS toplam_aday_sayisi,
  count(*) FILTER (WHERE durum = 'EKLENDI') AS eklenen_test_adresi,
  count(*) FILTER (WHERE durum = 'ZATEN_VAR') AS zaten_mevcut_olanlar,
  count(*) FILTER (WHERE durum = 'EKSIK_TELEFON') AS eksik_telefon_sayisi,
  count(*) FILTER (WHERE durum = 'EKSIK_ECZANE') AS eksik_eczane_sayisi
FROM temp_aday_kullanicilar
GROUP BY kaynak_duzlem, rol
ORDER BY kaynak_duzlem, rol;

-- 8. Eksik Verisi Olan Kayıtların Detay Dökümü (Varsa bildirilir)
SELECT
  kaynak_duzlem,
  kullanici_id,
  rol,
  ad_soyad,
  eposta,
  coalesce(telefon, '—') AS telefon,
  coalesce(eczane_adi, '—') AS eczane_adi,
  durum,
  aciklama
FROM temp_aday_kullanicilar
WHERE durum IN ('EKSIK_TELEFON', 'EKSIK_ECZANE')
ORDER BY kaynak_duzlem, rol, ad_soyad;

COMMIT;
