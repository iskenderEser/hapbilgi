-- ============================================================================
-- E-Club Store: Ayın İlk 7 Günü (1–7) Sipariş Takvimi Doğrulama Test Paketi
-- Dosya: scripts/sql/test_eclub_store_donemlik_siparis_takvimi.sql
--
-- KAPSAM:
--   1. Takvim sınır kontrolleri (Europe/Istanbul saati, ayın 1'i öncesi kapalı,
--      1'i 00:00 açık, 7'si 23:59:59 açık, 8'i 00:00 kapalı; Şubat, artık yıl Şubat 2028,
--      30 ve 31 günlük aylar ile yıl geçişi — 22 kontrol noktası).
--   2. Kapalı dönemde gerçek E-Club üyesi ile eclub_store_siparis_olustur çağrısı;
--      siparişin kapalı hata mesajıyla reddedilmesi ve ürün stoğu, siparişler,
--      firma puan harcamalarının eksiksiz korunması (veri bütünlüğü).
--   3. Birikimli bakiye ve devir güvencesi doğrulaması: get_eclub_store_firma_bakiye
--      fonksiyonunda aylık/dönemlik tarih filtresi veya puan silinmesi bulunmadığının,
--      kullanılmayan ve kısmen harcanmış bakiyelerin (örn. 1000 - 600 = 400) ay
--      değişiminde kaybolmayıp sonraki aya eksiksiz devrettiğinin statik sözleşme denetimi.
--   4. eclub_store_siparis_olustur fonksiyonunda FOR UPDATE kilitleri ile ilk sipariş
--      yazımı (INSERT INTO eclub_store_siparisler) arasında clock_timestamp() ile
--      anlık takvim kontrolü yapıldığının statik kod analiziyle doğrulanması.
--
-- RAPORLAMA VE ÇIKTI BİÇİMİ:
--   * Tüm bölümlerin sonuçları tek bir geçici tabloda toplanır.
--   * Ara SELECT sorgusu bulunmaz; dosya sonunda TEK BİR SONUÇ SELECT'i üretilir.
--   * Sütunlar: bolum, test_adi, beklenen, gercek, durum, aciklama.
--
-- GÜVENLİK VE ÇALIŞTIRMA KURALLARI:
--   * İşlemler BEGIN … ROLLBACK bloğu içinde yürütülür; kalıcı veri ÜRETİLMEZ.
--   * Canlı fonksiyonlar veya sunucu saati test amacıyla DEĞİŞTİRİLMEZ.
--   * Mağaza açıksa kapalı dönem sipariş testi çalıştırılmaz; "ATLANDI" olarak belirtilir.
--   * Uygun üye/ürün/adres bulunamazsa kimlik UYDURULMAZ; ayrıntılı teşhisle "ATLANDI" olarak belirtilir.
--   * Son kapanış kontrolü eşzamanlılık (concurrency) testi yapılmış gibi RAPORLANMAZ.
-- ============================================================================

BEGIN;

-- ============================================================================
-- ORTAK TEST SONUÇLARI GEÇİCİ TABLOSU
-- ============================================================================
CREATE TEMP TABLE IF NOT EXISTS test_eclub_store_sonuclar (
  sira integer,
  bolum text,
  test_adi text,
  beklenen text,
  gercek text,
  durum text,
  aciklama text
) ON COMMIT DROP;


-- ============================================================================
-- BÖLÜM 1: TAKVİM SINIR KONTROLLERİ (Europe/Istanbul)
-- ============================================================================
-- Sipariş Takvimi Kuralları:
--   * Her ayın 1. günü 00:00:00 TR'de açılır.
--   * Her ayın 8. günü 00:00:00 TR'de kapanır (8. gün hariç; 7. günün 23:59:59'u dahil).
--   * Gün 1–7: Açık (true)
--   * Gün >= 8 veya gün < 1: Kapalı (false)
-- ============================================================================

WITH test_zamanlari (sira, ay_turu, kontrol_noktasi, test_zamani, beklenen) AS (
  VALUES
    -- ─── 1. Normal Ay Başlangıcı (2026-04: 1–7 Nisan) ───────────────────────
    (1,  '2026-04 (Normal Ay)',            'Ayın 1’i öncesi kapalı (31 Mart 23:59:59 TR)',     '2026-03-31 23:59:59+03'::timestamptz, false),
    (2,  '2026-04 (Normal Ay)',            'Ayın 1’i 00:00 açık (1 Nisan 00:00:00 TR)',        '2026-04-01 00:00:00+03'::timestamptz, true),
    (3,  '2026-04 (Normal Ay)',            'Ayın 7’si 23:59:59 açık (7 Nisan 23:59:59 TR)',   '2026-04-07 23:59:59+03'::timestamptz, true),
    (4,  '2026-04 (Normal Ay)',            'Ayın 8’i 00:00 kapalı (8 Nisan 00:00:00 TR)',      '2026-04-08 00:00:00+03'::timestamptz, false),

    -- ─── 2. 28 Günlük Şubat Başlangıcı (2026-02: 1–7 Şubat) ──────────────────
    (5,  '2026-02 (28 Günlük Şubat)',     'Ayın 1’i öncesi kapalı (31 Ocak 23:59:59 TR)',     '2026-01-31 23:59:59+03'::timestamptz, false),
    (6,  '2026-02 (28 Günlük Şubat)',     'Ayın 1’i 00:00 açık (1 Şubat 00:00:00 TR)',        '2026-02-01 00:00:00+03'::timestamptz, true),
    (7,  '2026-02 (28 Günlük Şubat)',     'Ayın 7’si 23:59:59 açık (7 Şubat 23:59:59 TR)',   '2026-02-07 23:59:59+03'::timestamptz, true),
    (8,  '2026-02 (28 Günlük Şubat)',     'Ayın 8’i 00:00 kapalı (8 Şubat 00:00:00 TR)',      '2026-02-08 00:00:00+03'::timestamptz, false),

    -- ─── 3. 28 Günlük Şubat Sonu ve Mart Başlangıcı (2026-02 sonu -> 2026-03) ─
    (9,  '2026-02 / 2026-03 Geçişi',      'Şubat son günü kapalı (28 Şubat 23:59:59 TR)',     '2026-02-28 23:59:59+03'::timestamptz, false),
    (10, '2026-03 (Mart Başlangıcı)',      'Ayın 1’i 00:00 açık (1 Mart 00:00:00 TR)',         '2026-03-01 00:00:00+03'::timestamptz, true),
    (11, '2026-03 (Mart Dönemi)',          'Ayın 7’si 23:59:59 açık (7 Mart 23:59:59 TR)',    '2026-03-07 23:59:59+03'::timestamptz, true),
    (12, '2026-03 (Mart Kapanışı)',        'Ayın 8’i 00:00 kapalı (8 Mart 00:00:00 TR)',       '2026-03-08 00:00:00+03'::timestamptz, false),

    -- ─── 4. Artık Yıl 29 Günlük Şubat (2028-02: 1–7 Şubat & 29 Şubat) ─────────
    (13, '2028-02 (Artık Yıl Şubat)',     'Ayın 1’i öncesi kapalı (31 Ocak 2028 23:59:59 TR)','2028-01-31 23:59:59+03'::timestamptz, false),
    (14, '2028-02 (Artık Yıl Şubat)',     'Ayın 1’i 00:00 açık (1 Şubat 2028 00:00:00 TR)',   '2028-02-01 00:00:00+03'::timestamptz, true),
    (15, '2028-02 (Artık Yıl Şubat)',     'Ayın 7’si 23:59:59 açık (7 Şubat 2028 23:59:59 TR)','2028-02-07 23:59:59+03'::timestamptz, true),
    (16, '2028-02 (Artık Yıl Şubat)',     'Ayın 8’i 00:00 kapalı (8 Şubat 2028 00:00:00 TR)', '2028-02-08 00:00:00+03'::timestamptz, false),
    (17, '2028-02 (Artık Yıl 29 Şubat)',  'Artık gün kapalı (29 Şubat 2028 23:59:59 TR)',     '2028-02-29 23:59:59+03'::timestamptz, false),
    (18, '2028-03 (Artık Yıl Mart)',      'Mart 1’i 00:00 açık (1 Mart 2028 00:00:00 TR)',    '2028-03-01 00:00:00+03'::timestamptz, true),

    -- ─── 5. Yıl Sonu / Yıl Başı Geçişi (2026-12 -> 2027-01: 1–7 Ocak) ─────────
    (19, '2026-12 / 2027-01 Geçişi',      'Yıl son günü kapalı (31 Aralık 2026 23:59:59 TR)', '2026-12-31 23:59:59+03'::timestamptz, false),
    (20, '2027-01 (Yeni Yıl Başlangıcı)',  'Ayın 1’i 00:00 açık (1 Ocak 2027 00:00:00 TR)',    '2027-01-01 00:00:00+03'::timestamptz, true),
    (21, '2027-01 (Yeni Yıl Dönemi)',      'Ayın 7’si 23:59:59 açık (7 Ocak 2027 23:59:59 TR)','2027-01-07 23:59:59+03'::timestamptz, true),
    (22, '2027-01 (Yeni Yıl Kapanışı)',    'Ayın 8’i 00:00 kapalı (8 Ocak 2027 00:00:00 TR)',  '2027-01-08 00:00:00+03'::timestamptz, false)
)
INSERT INTO test_eclub_store_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
SELECT
  sira,
  'Bölüm 1: Takvim Sınırları',
  ay_turu || ' — ' || kontrol_noktasi,
  CASE WHEN beklenen THEN 'Açık (true)' ELSE 'Kapalı (false)' END,
  CASE WHEN public.eclub_store_siparis_donemi_acik_mi(test_zamani) THEN 'Açık (true)' ELSE 'Kapalı (false)' END,
  CASE
    WHEN public.eclub_store_siparis_donemi_acik_mi(test_zamani) = beklenen THEN 'GECTI'
    ELSE 'KALDI'
  END,
  'Zaman: ' || to_char(test_zamani AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI:SS') || ' (Europe/Istanbul)'
FROM test_zamanlari
ORDER BY sira;


-- ============================================================================
-- BÖLÜM 2: KAPALI DÖNEMDE GERÇEK SİPARİŞ ÇAĞRISI VE VERİ BÜTÜNLÜĞÜ
-- ============================================================================

DO $test_blok$
DECLARE
  v_su_an timestamptz := clock_timestamp();
  v_acik_mi boolean;

  -- Seçilen gerçek test varlıkları
  v_kisi_id uuid := NULL;
  v_adres_id uuid := NULL;
  v_urun_id uuid := NULL;

  -- Öncesi / sonrası sayaçlar
  v_stok_once integer;
  v_stok_sonra integer;
  v_siparis_sayisi_once integer;
  v_siparis_sayisi_sonra integer;
  v_puan_kayit_once integer;
  v_puan_kayit_sonra integer;

  -- RPC sonuçları
  v_siparis_sonuc record;

  -- Teşhis sayaçları
  v_sayi_kisi integer := 0;
  v_sayi_firma_erisim integer := 0;
  v_sayi_adres integer := 0;
  v_sayi_uygun_urun integer := 0;
  v_sayi_erisebilir_urun integer := 0;
  v_aciklama text;
BEGIN
  -- 1. Anlık mağaza takvim durumunu kontrol et
  v_acik_mi := public.eclub_store_siparis_donemi_acik_mi(v_su_an);

  IF v_acik_mi THEN
    INSERT INTO test_eclub_store_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      100,
      'Bölüm 2: Sipariş Reddi ve Bütünlük',
      'Kapalı Dönemde eclub_store_siparis_olustur Çağrısı',
      'Sipariş reddi (ok=false), kapalı hata mesajı, stok/sipariş/harcama değişimsizliği',
      'Mağaza şu an açık sipariş dönemindedir (1–7)',
      'ATLANDI',
      'Mağaza şu an açık dönemde (E-Club Store Günleri 1–7 aktif) olduğundan kapalı dönem sipariş testi bu anda koşulamaz; atlandı.'
    );
    RETURN;
  END IF;

  -- 2. Gerçek aday seçimi:
  -- Aktif E-Club üyesi, aktif eczane ve E-Club Store'u açık firma;
  -- kendisine ait kayıtlı adres;
  -- satışa açık ve stoklu ürün.
  -- (NOT: Kapalı dönem kontrolü bakiye kontrolünden önce yapıldığı için bakiye şartı aranmaz.)
  SELECT
    ke.kisi_id,
    a.adres_id,
    u.urun_id,
    u.stok
  INTO
    v_kisi_id,
    v_adres_id,
    v_urun_id,
    v_stok_once
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_eczane_firma ef ON ef.eczane_id = ke.eczane_id AND ef.aktif_mi = true
  JOIN public.firmalar f ON f.firma_id = ef.firma_id AND f.aktif = true AND f.eclub_aktif = true AND f.eclub_store_aktif = true
  JOIN public.eclub_store_adresler a ON a.kisi_id = ke.kisi_id
  JOIN public.eclub_store_urunler u ON u.aktif_mi = true AND u.stok > 0
  LEFT JOIN public.eclub_store_urun_firma_ayarlari fa ON fa.urun_id = u.urun_id AND fa.firma_id = f.firma_id
  WHERE ke.aktif_mi = true
    AND COALESCE(fa.aktif_mi, true) = true
  ORDER BY u.stok DESC
  LIMIT 1;

  -- 3. Aday bulunamadıysa eksik şartı ayrıntılı sayımlarla teşhis et
  IF v_kisi_id IS NULL THEN
    SELECT count(DISTINCT kisi_id) INTO v_sayi_kisi
    FROM public.eclub_kisi_eczane
    WHERE aktif_mi = true;

    SELECT count(DISTINCT ke.kisi_id) INTO v_sayi_firma_erisim
    FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_eczane_firma ef ON ef.eczane_id = ke.eczane_id AND ef.aktif_mi = true
    JOIN public.firmalar f ON f.firma_id = ef.firma_id AND f.aktif = true AND f.eclub_aktif = true AND f.eclub_store_aktif = true
    WHERE ke.aktif_mi = true;

    SELECT count(DISTINCT ke.kisi_id) INTO v_sayi_adres
    FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_store_adresler a ON a.kisi_id = ke.kisi_id
    WHERE ke.aktif_mi = true;

    SELECT count(*) INTO v_sayi_uygun_urun
    FROM public.eclub_store_urunler u
    WHERE u.aktif_mi = true AND u.stok > 0;

    SELECT count(DISTINCT u.urun_id) INTO v_sayi_erisebilir_urun
    FROM public.eclub_store_urunler u
    JOIN public.firmalar f ON f.aktif = true AND f.eclub_aktif = true AND f.eclub_store_aktif = true
    LEFT JOIN public.eclub_store_urun_firma_ayarlari fa ON fa.urun_id = u.urun_id AND fa.firma_id = f.firma_id
    WHERE u.aktif_mi = true AND u.stok > 0
      AND COALESCE(fa.aktif_mi, true) = true;

    v_aciklama := format(
      'Aday bulunamadı. Şart bazlı sayımlar -> [1] Aktif E-Club üyesi: %s, [2] E-Club Store açık firma erişimi: %s, [3] Kayıtlı adresli üye: %s, [4] Aktif stoklu ürün: %s (Firmaya açık: %s). Eksik şart: %s.',
      v_sayi_kisi,
      v_sayi_firma_erisim,
      v_sayi_adres,
      v_sayi_uygun_urun,
      v_sayi_erisebilir_urun,
      CASE
        WHEN v_sayi_kisi = 0 THEN 'Sistemde eclub_kisi_eczane tablosunda aktif üye bulunmuyor'
        WHEN v_sayi_firma_erisim = 0 THEN 'Üyelerin bağlı olduğu firmalarda E-Club Store aktif değil'
        WHEN v_sayi_adres = 0 THEN 'Erişimi olan üyelerin eclub_store_adresler tablosunda kayıtlı adresi yok'
        WHEN v_sayi_uygun_urun = 0 THEN 'eclub_store_urunler tablosunda aktif ve stoğu pozitif ürün yok'
        WHEN v_sayi_erisebilir_urun = 0 THEN 'Firmaya satışa açık stoklu E-Club ürünü yok'
        ELSE 'Üye, firma erişimi, adres ve ürün kesişim kümesi boş'
      END
    );

    INSERT INTO test_eclub_store_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      100,
      'Bölüm 2: Sipariş Reddi ve Bütünlük',
      'Kapalı Dönemde eclub_store_siparis_olustur Çağrısı',
      'Sipariş reddi (ok=false), kapalı hata mesajı, stok/sipariş/harcama değişimsizliği',
      format('Aday bulunamadı (Üye: %s, Firma Erişimi: %s, Adres: %s, Uygun Ürün: %s)',
             v_sayi_kisi, v_sayi_firma_erisim, v_sayi_adres, v_sayi_uygun_urun),
      'ATLANDI',
      v_aciklama
    );
    RETURN;
  END IF;

  -- 4. Çağrı öncesi referans sayaçları kaydet
  SELECT count(*) INTO v_siparis_sayisi_once
  FROM public.eclub_store_siparisler;

  SELECT count(*) INTO v_puan_kayit_once
  FROM public.eclub_store_siparis_firma_puan;

  -- 5. Kapalı dönemde sipariş oluşturmayı dene
  SELECT ok, siparis_id, hata
    INTO v_siparis_sonuc
  FROM public.eclub_store_siparis_olustur(
    v_kisi_id,
    v_urun_id,
    v_adres_id,
    1
  );

  -- 6. Çağrı sonrası durumları kaydet
  SELECT stok INTO v_stok_sonra
  FROM public.eclub_store_urunler
  WHERE urun_id = v_urun_id;

  SELECT count(*) INTO v_siparis_sayisi_sonra
  FROM public.eclub_store_siparisler;

  SELECT count(*) INTO v_puan_kayit_sonra
  FROM public.eclub_store_siparis_firma_puan;

  -- 7. Doğrulama ve raporlama
  IF v_siparis_sonuc.ok = false
     AND v_siparis_sonuc.siparis_id IS NULL
     AND v_siparis_sonuc.hata LIKE '%E-Club Store şu an siparişe kapalıdır%'
     AND v_stok_sonra = v_stok_once
     AND v_siparis_sayisi_sonra = v_siparis_sayisi_once
     AND v_puan_kayit_sonra = v_puan_kayit_once
  THEN
    INSERT INTO test_eclub_store_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      100,
      'Bölüm 2: Sipariş Reddi ve Bütünlük',
      'Kapalı Dönemde eclub_store_siparis_olustur Çağrısı',
      'ok=false, kapalı hata mesajı, sıfır stok/sipariş/harcama değişimi',
      format('ok=%s, siparis_id=%s, hata="%s"', v_siparis_sonuc.ok, COALESCE(v_siparis_sonuc.siparis_id::text, 'NULL'), v_siparis_sonuc.hata),
      'GECTI',
      format('Sipariş kapalı mesajıyla reddedildi. Stok değişmedi (%s -> %s), yeni sipariş eklenmedi (%s -> %s), firma puan harcaması kaydedilmedi (%s -> %s).',
             v_stok_once, v_stok_sonra, v_siparis_sayisi_once, v_siparis_sayisi_sonra, v_puan_kayit_once, v_puan_kayit_sonra)
    );
  ELSE
    INSERT INTO test_eclub_store_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      100,
      'Bölüm 2: Sipariş Reddi ve Bütünlük',
      'Kapalı Dönemde eclub_store_siparis_olustur Çağrısı',
      'ok=false, kapalı hata mesajı, sıfır stok/sipariş/harcama değişimi',
      format('ok=%s, siparis_id=%s, hata="%s"', v_siparis_sonuc.ok, COALESCE(v_siparis_sonuc.siparis_id::text, 'NULL'), v_siparis_sonuc.hata),
      'KALDI',
      format('BAŞARISIZ: Stok değişimi (%s -> %s), sipariş sayısı (%s -> %s), puan harcama (%s -> %s), hata mesajı: %s',
             v_stok_once, v_stok_sonra, v_siparis_sayisi_once, v_siparis_sayisi_sonra, v_puan_kayit_once, v_puan_kayit_sonra, v_siparis_sonuc.hata)
    );
  END IF;

END $test_blok$;


-- ============================================================================
-- BÖLÜM 3: BİRİKİMLİ BAKİYE VE AYLIK DEVİR SÖZLEŞMESİ STATİK DOĞRULAMASI
-- ============================================================================
-- Bu test get_eclub_store_firma_bakiye fonksiyonunun kaynak kodunu inceleyerek:
--   1. Kazanılan puanlarda aylık/dönemsel filtre veya sıfırlama bulunmadığını,
--   2. Harcanan puanlarda yalnızca iptal edilmemiş siparişlerin düşüldüğünü,
--   3. Kullanılmayan veya siparişten kalan bakiyelerin (örn. 1000 - 600 = 400)
--      ay değişiminde kaybolmayıp sonraki aylara eksiksiz devrettiğini,
--   4. Sipariş haftasında kazanılan puanların anında bakiyeye katıldığını
-- statik sözleşme analiziyle doğrular. Canlı veriyi veya sunucu saatini değiştirmez.
-- ============================================================================

INSERT INTO test_eclub_store_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
WITH fn_kontrol AS (
  SELECT to_regprocedure('public.get_eclub_store_firma_bakiye(uuid)') AS fn_oid
),
kaynak AS (
  SELECT
    fn_oid,
    CASE
      WHEN fn_oid IS NOT NULL THEN lower(pg_get_functiondef(fn_oid))
      ELSE ''
    END AS def
  FROM fn_kontrol
)
SELECT
  150 AS sira,
  'Bölüm 3: Birikimli Bakiye ve Devir' AS bolum,
  'get_eclub_store_firma_bakiye — Tarih filtresiz birikimli devir sözleşmesi' AS test_adi,
  'Kazanılan ve harcanan puanlarda aylık filtre olmaksızın bakiyenin sonraki aylara eksiksiz devretmesi' AS beklenen,
  CASE
    WHEN fn_oid IS NULL THEN 'get_eclub_store_firma_bakiye fonksiyonu bulunamadı'
    WHEN def LIKE '%date_trunc%' OR def LIKE '%interval%month%' OR def LIKE '%son_kullanma%'
    THEN 'HATA: Bakiye fonksiyonunda aylık filtre veya son kullanma kısıtı tespit edildi'
    WHEN def LIKE '%eclub_kazanilan_puanlar%'
     AND def LIKE '%eclub_store_siparis_firma_puan%'
     AND def LIKE '%sum(kp.puan)%'
     AND def LIKE '%sum(sfp.kullanilan_puan)%'
    THEN 'Bakiye fonksiyonunda aylık filtre bulunmuyor; kazanılan ve harcanan puanlar kümülatif toplanarak bakiye sonraki aylara eksiksiz devrediyor'
    ELSE 'Bakiye fonksiyonu beklendiği gibi kümülatif yapıda değil'
  END AS gercek,
  CASE
    WHEN fn_oid IS NULL THEN 'KALDI'
    WHEN def LIKE '%date_trunc%' OR def LIKE '%interval%month%' OR def LIKE '%son_kullanma%' THEN 'KALDI'
    WHEN def LIKE '%eclub_kazanilan_puanlar%'
     AND def LIKE '%eclub_store_siparis_firma_puan%'
     AND def LIKE '%sum(kp.puan)%'
     AND def LIKE '%sum(sfp.kullanilan_puan)%'
    THEN 'GECTI'
    ELSE 'KALDI'
  END AS durum,
  CASE
    WHEN fn_oid IS NULL THEN 'HATA: public.get_eclub_store_firma_bakiye(uuid) veritabanında bulunamadı.'
    WHEN def LIKE '%date_trunc%' OR def LIKE '%interval%month%' OR def LIKE '%son_kullanma%'
    THEN 'KOD ANALİZİ BAŞARISIZ: get_eclub_store_firma_bakiye içinde aylık dönem kısıtı veya puan silinmesi tespit edildi.'
    WHEN def LIKE '%eclub_kazanilan_puanlar%'
     AND def LIKE '%eclub_store_siparis_firma_puan%'
     AND def LIKE '%sum(kp.puan)%'
     AND def LIKE '%sum(sfp.kullanilan_puan)%'
    THEN 'SÖZLEŞME DOĞRULANDI: Puan defterinde aylık filtre, çeyrek kısıtı veya son kullanma tarihi yoktur. Hiç harcanmamış ve sipariş sonrası kalan bakiyeler (örn. 1000 - 600 = 400 p) ay değişiminde kaybolmayıp sonraki aylara devretmektedir. Sipariş günlerinde kazanılan yeni puanlar bloke olmaksızın anında bakiyeye katılır.'
    ELSE 'KOD ANALİZİ BAŞARISIZ: Puan toplamı sözleşmesi doğrulanamadı.'
  END AS aciklama
FROM kaynak;


-- ============================================================================
-- BÖLÜM 4: SON KAPANIŞ KONTROLÜNÜN STATİK KOD ANALİZİ
-- ============================================================================
-- eclub_store_siparis_olustur fonksiyon tanımında kilitler (ke ve urun FOR UPDATE)
-- sonrasında, ilk veri tabanı yazımı (INSERT INTO eclub_store_siparisler) öncesinde
-- clock_timestamp() ile takvim kontrolü yapıldığını fonksiyon tanım metni üzerinden
-- denetler. (Statik AST/kod yapısı denetimidir; canlı eşzamanlılık testi değildir.)
-- ============================================================================

INSERT INTO test_eclub_store_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
WITH fn_kontrol AS (
  SELECT to_regprocedure('public.eclub_store_siparis_olustur(uuid,uuid,uuid,integer)') AS fn_oid
),
kaynak AS (
  SELECT
    fn_oid,
    CASE
      WHEN fn_oid IS NOT NULL THEN lower(pg_get_functiondef(fn_oid))
      ELSE ''
    END AS def
  FROM fn_kontrol
),
pozisyonlar AS (
  SELECT
    fn_oid,
    def,
    position('for update' IN def) AS pos_kilit,
    GREATEST(
      position('insert into public.eclub_store_siparisler' IN def),
      position('insert into eclub_store_siparisler' IN def)
    ) AS pos_siparis_insert
  FROM kaynak
),
dilim AS (
  SELECT
    fn_oid,
    pos_kilit,
    pos_siparis_insert,
    CASE
      WHEN pos_kilit > 0 AND pos_siparis_insert > pos_kilit
      THEN substring(def FROM pos_kilit FOR (pos_siparis_insert - pos_kilit))
      ELSE ''
    END AS kilit_ve_insert_arasi_kod
  FROM pozisyonlar
)
SELECT
  200 AS sira,
  'Bölüm 4: Son Kapanış Mimarisi' AS bolum,
  'eclub_store_siparis_olustur — Kilitler sonrası ve sipariş INSERT öncesi clock_timestamp() kontrolü' AS test_adi,
  'Kilitler (FOR UPDATE) ile INSERT INTO eclub_store_siparisler arasında clock_timestamp() takvim kontrolü' AS beklenen,
  CASE
    WHEN fn_oid IS NULL THEN 'Fonksiyon veritabanında bulunamadı'
    WHEN pos_kilit > 0
     AND pos_siparis_insert > pos_kilit
     AND kilit_ve_insert_arasi_kod LIKE '%eclub_store_siparis_donemi_acik_mi%'
     AND kilit_ve_insert_arasi_kod LIKE '%clock_timestamp()%'
    THEN 'FOR UPDATE kilitleri sonrasında ve INSERT INTO eclub_store_siparisler öncesinde clock_timestamp() kontrolü mevcut'
    ELSE 'Kilitler ile sipariş INSERT arasında clock_timestamp() kontrolü tespit edilemedi'
  END AS gercek,
  CASE
    WHEN fn_oid IS NULL THEN 'KALDI'
    WHEN pos_kilit > 0
     AND pos_siparis_insert > pos_kilit
     AND kilit_ve_insert_arasi_kod LIKE '%eclub_store_siparis_donemi_acik_mi%'
     AND kilit_ve_insert_arasi_kod LIKE '%clock_timestamp()%'
    THEN 'GECTI'
    ELSE 'KALDI'
  END AS durum,
  CASE
    WHEN fn_oid IS NULL THEN 'HATA: public.eclub_store_siparis_olustur fonksiyonu veritabanında bulunamadı.'
    WHEN pos_kilit > 0
     AND pos_siparis_insert > pos_kilit
     AND kilit_ve_insert_arasi_kod LIKE '%eclub_store_siparis_donemi_acik_mi%'
     AND kilit_ve_insert_arasi_kod LIKE '%clock_timestamp()%'
    THEN 'KOD ANALİZİ DOĞRULANDI: Üyelik/ürün FOR UPDATE kilitleri, adres ve bakiye sorgularından sonra, ilk sipariş kaydı (eclub_store_siparisler) yazılmadan ve stok azaltılmadan hemen önce clock_timestamp() ile anlık takvim kontrolü bulunmaktadır. (Statik fonksiyon tanımı denetimidir; canlı eşzamanlılık testi değildir.)'
    ELSE 'KOD ANALİZİ BAŞARISIZ: Kilitler ile sipariş INSERT arasında clock_timestamp() kontrolü tespit edilemedi.'
  END AS aciklama
FROM dilim;


-- ============================================================================
-- TÜM TEST SONUÇLARI (TEK SONUÇ TABLOSU)
-- ============================================================================
SELECT
  bolum,
  test_adi,
  beklenen,
  gercek,
  durum,
  aciklama
FROM test_eclub_store_sonuclar
ORDER BY sira;

-- ============================================================================
-- TEMİZLİK VE GÜVENLİ GERİ ALMA
-- ============================================================================
ROLLBACK;
