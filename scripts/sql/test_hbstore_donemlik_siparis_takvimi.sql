-- ============================================================================
-- HBStore: Dönemlik Sipariş Takvimi ("Store Günleri" — Tamamlanan Çeyrek Sonrası)
-- Doğrulama Test Paketi
-- Dosya: scripts/sql/test_hbstore_donemlik_siparis_takvimi.sql
--
-- KAPSAM:
--   1. Dört dönemin açılış ve kapanış sınır kontrolleri (Europe/Istanbul saati,
--      1–7 Nisan, 1–7 Temmuz, 1–7 Ekim, 1–7 Ocak, açılıştan hemen önce kapalı,
--      açılışta açık, kapanıştan hemen önce açık, kapanışta kapalı, sonraki yıl
--      ve artık yıl geçişi — 24 kontrol noktası).
--   2. Kapalı dönemde gerçek UTT/BM kullanıcısı ile store_siparis_olustur çağrısı;
--      siparişin kapalı hata mesajıyla reddedilmesi ve ürün stoğu, siparişler,
--      puan harcamalarının eksiksiz korunması (ayrıntılı eksik şart teşhisiyle).
--   3. Puan dönemi eşleştirmesi, çeyrek izolasyonu ve bakiye hesabı mimarisi:
--      - Açık dönemde hemen önce tamamlanan çeyrek kazanım penceresi kontrolü
--      - Yeni çeyrekte (sipariş haftasında) kazanılan puanların izole edilmesi
--      - UTT E-Club ve BM CC puanlarının kaynak çeyrekle sınırlandırılması
--      - Sipariş penceresi harcama ve iade eşleştirmesi (store_siparisler join)
--      - Sipariş haftası sonrası puanların sonraki döneme devretmemesi
--   4. store_siparis_olustur_cekirdek fonksiyonunda ürün kilidi (FOR UPDATE) ile
--      stok azaltımı (UPDATE store_urunler) arasında clock_timestamp() ile anlık
--      kapanış kontrolü yapıldığının statik kod analiziyle doğrulanması.
--
-- RAPORLAMA VE ÇIKTI BİÇİMİ:
--   * Tüm bölümlerin sonuçları tek bir geçici tabloda (test_hbstore_sonuclar) toplanır.
--   * Ara SELECT sorgusu bulunmaz; dosya sonunda TEK BİR SONUÇ SELECT'i üretilir.
--   * Sütunlar: bolum, test_adi, beklenen, gercek, durum, aciklama.
--
-- GÜVENLİK VE ÇALIŞTIRMA KURALLARI:
--   * İşlemler BEGIN … ROLLBACK bloğu içinde yürütülür; kalıcı veri ÜRETİLMEZ.
--   * Canlı fonksiyonlar veya sunucu saati test amacıyla DEĞİŞTİRİLMEZ.
--   * Mağaza açıksa kapalı dönem sipariş testi çalıştırılmaz; "ATLANDI" olarak belirtilir.
--   * Uygun kullanıcı/ürün/adres bulunamazsa kimlik UYDURULMAZ; "ATLANDI" döner.
--   * Son kapanış kontrolü eşzamanlılık (concurrency) testi yapılmış gibi RAPORLANMAZ.
-- ============================================================================

BEGIN;

-- ============================================================================
-- ORTAK TEST SONUÇLARI GEÇİCİ TABLOSU
-- ============================================================================
CREATE TEMP TABLE IF NOT EXISTS test_hbstore_sonuclar (
  sira integer,
  bolum text,
  test_adi text,
  beklenen text,
  gercek text,
  durum text,
  aciklama text
) ON COMMIT DROP;


-- ============================================================================
-- BÖLÜM 1: DÖRT DÖNEMİN SINIR KONTROLLERİ (Europe/Istanbul)
-- ============================================================================
-- Sipariş Takvimi Kuralları (Europe/Istanbul):
--   Q1 (Ocak–Mart Kazanımı):     1–7 Nisan     (Açılış: 1 Nisan 00:00, Kapanış: 8 Nisan 00:00 hariç)
--   Q2 (Nisan–Haziran Kazanımı): 1–7 Temmuz    (Açılış: 1 Temmuz 00:00, Kapanış: 8 Temmuz 00:00 hariç)
--   Q3 (Temmuz–Eylül Kazanımı):  1–7 Ekim      (Açılış: 1 Ekim 00:00, Kapanış: 8 Ekim 00:00 hariç)
--   Q4 (Ekim–Aralık Kazanımı):   1–7 Ocak (sonraki yıl) (Açılış: 1 Ocak 00:00, Kapanış: 8 Ocak 00:00 hariç)
-- ============================================================================

WITH test_zamanlari (sira, donem, kontrol_noktasi, test_zamani, beklenen) AS (
  VALUES
    -- ─── 2026 Q1 Siparişi: 1–7 Nisan (Ocak–Mart Puanı) ──────────────────────
    (1,  '2026 Q1 (Ocak–Mart Puanı)',     'Açılıştan hemen önce (31 Mart 23:59:59 TR)',        '2026-03-31 23:59:59+03'::timestamptz, false),
    (2,  '2026 Q1 (Ocak–Mart Puanı)',     'Açılış anı (1 Nisan 00:00:00 TR)',                  '2026-04-01 00:00:00+03'::timestamptz, true),
    (3,  '2026 Q1 (Ocak–Mart Puanı)',     'Kapanıştan hemen önce (7 Nisan 23:59:59 TR)',       '2026-04-07 23:59:59+03'::timestamptz, true),
    (4,  '2026 Q1 (Ocak–Mart Puanı)',     'Kapanış anı (8 Nisan 00:00:00 TR)',                 '2026-04-08 00:00:00+03'::timestamptz, false),

    -- ─── 2026 Q2 Siparişi: 1–7 Temmuz (Nisan–Haziran Puanı) ─────────────────
    (5,  '2026 Q2 (Nisan–Haziran Puanı)', 'Açılıştan hemen önce (30 Haziran 23:59:59 TR)',     '2026-06-30 23:59:59+03'::timestamptz, false),
    (6,  '2026 Q2 (Nisan–Haziran Puanı)', 'Açılış anı (1 Temmuz 00:00:00 TR)',                '2026-07-01 00:00:00+03'::timestamptz, true),
    (7,  '2026 Q2 (Nisan–Haziran Puanı)', 'Kapanıştan hemen önce (7 Temmuz 23:59:59 TR)',     '2026-07-07 23:59:59+03'::timestamptz, true),
    (8,  '2026 Q2 (Nisan–Haziran Puanı)', 'Kapanış anı (8 Temmuz 00:00:00 TR)',                '2026-07-08 00:00:00+03'::timestamptz, false),

    -- ─── 2026 Q3 Siparişi: 1–7 Ekim (Temmuz–Eylül Puanı) ───────────────────
    (9,  '2026 Q3 (Temmuz–Eylül Puanı)',  'Açılıştan hemen önce (30 Eylül 23:59:59 TR)',       '2026-09-30 23:59:59+03'::timestamptz, false),
    (10, '2026 Q3 (Temmuz–Eylül Puanı)',  'Açılış anı (1 Ekim 00:00:00 TR)',                  '2026-10-01 00:00:00+03'::timestamptz, true),
    (11, '2026 Q3 (Temmuz–Eylül Puanı)',  'Kapanıştan hemen önce (7 Ekim 23:59:59 TR)',        '2026-10-07 23:59:59+03'::timestamptz, true),
    (12, '2026 Q3 (Temmuz–Eylül Puanı)',  'Kapanış anı (8 Ekim 00:00:00 TR)',                  '2026-10-08 00:00:00+03'::timestamptz, false),

    -- ─── 2026 Q4 Siparişi: 1–7 Ocak 2027 (Ekim–Aralık Puanı / Yıl Geçişi) ──
    (13, '2026 Q4 (Ekim–Aralık Puanı)',  'Açılıştan hemen önce (31 Aralık 23:59:59 TR)',      '2026-12-31 23:59:59+03'::timestamptz, false),
    (14, '2026 Q4 / Yıl Geçişi',          'Açılış anı (1 Ocak 2027 00:00:00 TR)',             '2027-01-01 00:00:00+03'::timestamptz, true),
    (15, '2026 Q4 / Yıl Geçişi',          'Kapanıştan hemen önce (7 Ocak 2027 23:59:59 TR)',  '2027-01-07 23:59:59+03'::timestamptz, true),
    (16, '2026 Q4 / Yıl Geçişi',          'Kapanış anı (8 Ocak 2027 00:00:00 TR)',             '2027-01-08 00:00:00+03'::timestamptz, false),

    -- ─── Sonraki Yıl Geçişi (2027 Q1 Siparişi: 1–7 Nisan 2027) ──────────────
    (17, '2027 Q1 (Sonraki Yıl)',          'Açılıştan hemen önce (31 Mart 2027 23:59:59 TR)',   '2027-03-31 23:59:59+03'::timestamptz, false),
    (18, '2027 Q1 (Sonraki Yıl)',          'Açılış anı (1 Nisan 2027 00:00:00 TR)',             '2027-04-01 00:00:00+03'::timestamptz, true),
    (19, '2027 Q1 (Sonraki Yıl)',          'Kapanıştan hemen önce (7 Nisan 2027 23:59:59 TR)',  '2027-04-07 23:59:59+03'::timestamptz, true),
    (20, '2027 Q1 (Sonraki Yıl)',          'Kapanış anı (8 Nisan 2027 00:00:00 TR)',            '2027-04-08 00:00:00+03'::timestamptz, false),

    -- ─── Artık Yıl Kontrolleri (2028 Q1 Siparişi: 1–7 Nisan 2028) ────────────
    (21, '2028 Q1 (Artık Yıl)',            'Açılıştan hemen önce (31 Mart 2028 23:59:59 TR)',   '2028-03-31 23:59:59+03'::timestamptz, false),
    (22, '2028 Q1 (Artık Yıl)',            'Açılış anı (1 Nisan 2028 00:00:00 TR)',             '2028-04-01 00:00:00+03'::timestamptz, true),
    (23, '2028 Q1 (Artık Yıl)',            'Kapanıştan hemen önce (7 Nisan 2028 23:59:59 TR)',  '2028-04-07 23:59:59+03'::timestamptz, true),
    (24, '2028 Q1 (Artık Yıl)',            'Kapanış anı (8 Nisan 2028 00:00:00 TR)',            '2028-04-08 00:00:00+03'::timestamptz, false)
)
INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
SELECT
  sira,
  'Bölüm 1: Takvim Sınırları',
  donem || ' — ' || kontrol_noktasi,
  CASE WHEN beklenen THEN 'Açık (true)' ELSE 'Kapalı (false)' END,
  CASE WHEN public.hbstore_siparis_donemi_acik_mi(test_zamani) THEN 'Açık (true)' ELSE 'Kapalı (false)' END,
  CASE
    WHEN public.hbstore_siparis_donemi_acik_mi(test_zamani) = beklenen THEN 'GECTI'
    ELSE 'KALDI'
  END,
  'TR Zamanı: ' || to_char(test_zamani AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI:SS')
FROM test_zamanlari;


-- ============================================================================
-- BÖLÜM 2: KAPALI DÖNEMDE GERÇEK SİPARİŞ ÇAĞRISI VE VERİ BÜTÜNLÜĞÜ
-- ============================================================================
-- Kurallar:
--   * Gerçek bir UTT/BM kullanıcısı, erişebildiği ürün ve kendi adresi kullanılır.
--   * Bakiye kontrolünden önce takvim kontrolü yapıldığı için bakiye şartı aranmaz.
--   * Mağaza açıksa test çalıştırılmaz; "ATLANDI" olarak raporlanır.
--   * Uygun kullanıcı/ürün/adres bulunamazsa asla kimlik uydurulmaz; "ATLANDI" döner.
--   * Aday bulunamazsa eksik şartlar ayrı sayımlarla raporlanır.
--   * Öncesi–sonrası karşılaştırmasında stok, sipariş sayısı ve puan hareketleri
--     kesinlikle DEĞİŞMEMELİDİR.
-- ============================================================================

DO $kapali_siparis_testi$
DECLARE
  v_su_an timestamptz := clock_timestamp();
  v_acik_mi boolean;
  v_kullanici_id uuid;
  v_adres_id uuid;
  v_urun_id uuid;
  v_stok_once integer;
  v_stok_sonra integer;
  v_siparis_once integer;
  v_siparis_sonra integer;
  v_harcama_once integer;
  v_harcama_sonra integer;
  v_sonuc_ok boolean;
  v_sonuc_siparis_id uuid;
  v_sonuc_hata text;
  v_durum text;
  v_gercek text;
  v_aciklama text;
  -- Aday bulunamadığında ayrıntılı sayım teşhisi değişkenleri:
  v_sayi_kullanici integer := 0;
  v_sayi_firma_erisim integer := 0;
  v_sayi_adres integer := 0;
  v_sayi_uygun_urun integer := 0;
  v_sayi_erisebilir_urun integer := 0;
BEGIN
  -- 1. Anlık mağaza takvim durumunu kontrol et
  v_acik_mi := public.hbstore_siparis_donemi_acik_mi(v_su_an);

  -- Kural: Mağaza açıksa kapalı dönem sipariş testi çalıştırılmaz.
  IF v_acik_mi THEN
    INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      100,
      'Bölüm 2: Sipariş Reddi ve Bütünlük',
      'Kapalı Dönemde store_siparis_olustur Çağrısı',
      'Sipariş reddi (ok=false), kapalı hata mesajı, stok/sipariş/harcama değişimsizliği',
      'Mağaza şu an açık sipariş dönemindedir',
      'ATLANDI',
      'Mağaza şu an açık dönemde (Store Günleri aktif) olduğundan kapalı dönem sipariş testi bu anda koşulamaz; atlandı.'
    );
    RETURN;
  END IF;

  -- 2. Gerçek, aktif UTT/KD_UTT/BM; kendisine ait adres; HBStore’u açık firma ve
  --    erişilebilir, aktif, stoklu ürün adayı seç.
  SELECT
    k.kullanici_id,
    a.adres_id,
    u.urun_id,
    u.stok
  INTO
    v_kullanici_id,
    v_adres_id,
    v_urun_id,
    v_stok_once
  FROM public.kullanicilar k
  JOIN public.firmalar f ON f.firma_id = k.firma_id AND f.hbstore_aktif = true
  JOIN public.store_adresler a ON a.kullanici_id = k.kullanici_id
  JOIN public.store_urunler u ON u.aktif_mi = true AND u.stok > 0
  LEFT JOIN public.store_urun_firma_ayarlari fa ON fa.urun_id = u.urun_id AND fa.firma_id = f.firma_id
  WHERE lower(k.rol) IN ('utt', 'kd_utt', 'bm')
    AND k.aktif_mi IS TRUE
    AND COALESCE(fa.aktif_mi, true) = true
  ORDER BY u.stok DESC
  LIMIT 1;

  -- 3. Aday bulunamadıysa hangi şartın eksik olduğunu ayrı sayımlarla teşhis et
  IF v_kullanici_id IS NULL THEN
    SELECT count(*) INTO v_sayi_kullanici
    FROM public.kullanicilar k
    WHERE lower(k.rol) IN ('utt', 'kd_utt', 'bm')
      AND k.aktif_mi IS TRUE;

    SELECT count(DISTINCT k.kullanici_id) INTO v_sayi_firma_erisim
    FROM public.kullanicilar k
    JOIN public.firmalar f ON f.firma_id = k.firma_id AND f.hbstore_aktif = true
    WHERE lower(k.rol) IN ('utt', 'kd_utt', 'bm')
      AND k.aktif_mi IS TRUE;

    SELECT count(DISTINCT k.kullanici_id) INTO v_sayi_adres
    FROM public.kullanicilar k
    JOIN public.firmalar f ON f.firma_id = k.firma_id AND f.hbstore_aktif = true
    JOIN public.store_adresler a ON a.kullanici_id = k.kullanici_id
    WHERE lower(k.rol) IN ('utt', 'kd_utt', 'bm')
      AND k.aktif_mi IS TRUE;

    SELECT count(*) INTO v_sayi_uygun_urun
    FROM public.store_urunler u
    WHERE u.aktif_mi = true AND u.stok > 0;

    SELECT count(DISTINCT u.urun_id) INTO v_sayi_erisebilir_urun
    FROM public.store_urunler u
    JOIN public.firmalar f ON f.hbstore_aktif = true
    LEFT JOIN public.store_urun_firma_ayarlari fa ON fa.urun_id = u.urun_id AND fa.firma_id = f.firma_id
    WHERE u.aktif_mi = true AND u.stok > 0
      AND COALESCE(fa.aktif_mi, true) = true;

    v_aciklama := format(
      'Aday bulunamadı. Şart bazlı sayımlar -> [1] Aktif UTT/KD_UTT/BM: %s, [2] HBStore açık firma erişimi: %s, [3] Kendisine ait kayıtlı adres: %s, [4] Aktif stoklu ürün: %s (Firmaya açık: %s). Eksik şart: %s.',
      v_sayi_kullanici,
      v_sayi_firma_erisim,
      v_sayi_adres,
      v_sayi_uygun_urun,
      v_sayi_erisebilir_urun,
      CASE
        WHEN v_sayi_kullanici = 0 THEN 'Sistemde aktif UTT/KD_UTT/BM kullanıcısı bulunmuyor'
        WHEN v_sayi_firma_erisim = 0 THEN 'Kullanıcıların firmalarında HBStore aktif değil (f.hbstore_aktif = true)'
        WHEN v_sayi_adres = 0 THEN 'Erişimi olan kullanıcıların store_adresler tablosunda kayıtlı teslimat adresi yok'
        WHEN v_sayi_uygun_urun = 0 THEN 'store_urunler tablosunda aktif ve stoğu pozitif ürün yok'
        WHEN v_sayi_erisebilir_urun = 0 THEN 'store_urun_firma_ayarlari tablosunda firmaya satışa açık stoklu ürün yok'
        ELSE 'Kullanıcı, adres ve firma ürün ayarı kesişim kümesi boş'
      END
    );

    INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      100,
      'Bölüm 2: Sipariş Reddi ve Bütünlük',
      'Kapalı Dönemde store_siparis_olustur Çağrısı',
      'Sipariş reddi (ok=false), kapalı hata mesajı, stok/sipariş/harcama değişimsizliği',
      format('Aday bulunamadı (Kullanıcı: %s, Firma Erişimi: %s, Adres: %s, Uygun Ürün: %s)',
             v_sayi_kullanici, v_sayi_firma_erisim, v_sayi_adres, v_sayi_uygun_urun),
      'ATLANDI',
      v_aciklama
    );
    RETURN;
  END IF;

  -- 4. Öncesi durum sayılarını kaydet
  SELECT count(*) INTO v_siparis_once
  FROM public.store_siparisler
  WHERE kullanici_id = v_kullanici_id;

  SELECT count(*) INTO v_harcama_once
  FROM public.store_puan_harcamalari
  WHERE kullanici_id = v_kullanici_id;

  -- 5. store_siparis_olustur fonksiyonunu çağır
  SELECT sonuc.ok, sonuc.siparis_id, sonuc.hata
  INTO v_sonuc_ok, v_sonuc_siparis_id, v_sonuc_hata
  FROM public.store_siparis_olustur(
    v_kullanici_id,
    v_urun_id,
    v_adres_id,
    1
  ) AS sonuc;

  -- 6. Sonrası durum sayılarını kaydet
  SELECT stok INTO v_stok_sonra
  FROM public.store_urunler
  WHERE urun_id = v_urun_id;

  SELECT count(*) INTO v_siparis_sonra
  FROM public.store_siparisler
  WHERE kullanici_id = v_kullanici_id;

  SELECT count(*) INTO v_harcama_sonra
  FROM public.store_puan_harcamalari
  WHERE kullanici_id = v_kullanici_id;

  -- 7. Değerlendirme
  IF (v_sonuc_ok = false)
     AND (v_sonuc_hata ILIKE '%kapalı%' OR v_sonuc_hata ILIKE '%Store Günleri%')
     AND (v_stok_once = v_stok_sonra)
     AND (v_siparis_once = v_siparis_sonra)
     AND (v_harcama_once = v_harcama_sonra) THEN
    v_durum := 'GECTI';
    v_gercek := 'ok=false, kapalı mesajı alındı, stok/sipariş/harcama tam korundu';
    v_aciklama := format(
      'Kullanıcı: %s, Ürün: %s, Adres: %s, Stok (Önce/Sonra): %s/%s, Sipariş Sayısı: %s, Harcama Sayısı: %s. Dönen Hata: %s',
      v_kullanici_id,
      v_urun_id,
      v_adres_id,
      v_stok_once,
      v_stok_sonra,
      v_siparis_sonra,
      v_harcama_sonra,
      v_sonuc_hata
    );
  ELSE
    v_durum := 'KALDI';
    v_gercek := format(
      'Beklenmeyen sonuç: ok=%s, stok_farki=%s, siparis_farki=%s, harcama_farki=%s',
      v_sonuc_ok,
      (v_stok_sonra - v_stok_once),
      (v_siparis_sonra - v_siparis_once),
      (v_harcama_sonra - v_harcama_once)
    );
    v_aciklama := format('Hata mesajı: %s', v_sonuc_hata);
  END IF;

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    100,
    'Bölüm 2: Sipariş Reddi ve Bütünlük',
    'Kapalı Dönemde store_siparis_olustur Çağrısı',
    'Sipariş reddi (ok=false), kapalı hata mesajı, stok/sipariş/harcama değişimsizliği',
    v_gercek,
    v_durum,
    v_aciklama
  );
END;
$kapali_siparis_testi$;


-- ============================================================================
-- BÖLÜM 3: SAYISAL BAKİYE VE ÇEYREK İZOLASYONU DB TESTLERİ
-- ============================================================================
-- Kapsam:
--   1. Şema hazırlığı: kaynak_ceyrek_baslangici kolonunun mevcudiyeti
--   2. Gerçek şemaya uygun test verileri (store_urunler.ad, geçerli kategori_id,
--      yayin_yonetimi ve izleme_kayitlari gerçek foreign key referansları)
--   3. Kayıtlı kaynak çeyrekli sipariş harcamasının bakiyeden düşmesi (kaynak_ceyrek_baslangici)
--   4. Birden fazla yeni sipariş ve kısmi kalan bakiye (kaynak_ceyrek_baslangici ile)
--   5. İptal iadesi (iade tarihine değil, siparişin kaynak çeyreğine bağlanması)
--   6. Yeni çeyrek kazanımının cari sipariş haftasından hariç tutulması
--   7. Eski bakiyenin sonraki döneme taşınmaması (devretmeme kuralı)
--   8. Negatif bakiye davranışının korunması (GREATEST(0, ...) yokluğu)
--   9. 1–7 Ocak siparişinin yalnız önceki Q4'ten düşmesi ve yeni Q1'den DÜŞMEMESİ
--      (1–7 Ocak çakışmasının giderildiğinin kesin sayısal doğrulaması)
--   10. Mevcut get_harcama_bakiyesi(uuid) tekil çağrısı ve imzasının korunması
-- ============================================================================

-- Test süresince kullanılacak kaynak_ceyrek_baslangici kolonunu güvenceye al
ALTER TABLE public.store_siparisler
  ADD COLUMN IF NOT EXISTS kaynak_ceyrek_baslangici timestamptz;

DO $sayisal_bakiye_testleri$
DECLARE
  v_test_uid uuid := gen_random_uuid();
  v_test_urun_id uuid;
  v_test_kategori_id uuid;
  v_test_yayin_id uuid;
  v_izleme_s1_id uuid := gen_random_uuid();
  v_izleme_s4_id uuid := gen_random_uuid();
  v_izleme_s6_id uuid := gen_random_uuid();
  v_izleme_s7_q4_id uuid := gen_random_uuid();
  v_izleme_s7_q1_id uuid := gen_random_uuid();
  v_siparis_eski_id uuid := gen_random_uuid();
  v_siparis_yeni1_id uuid := gen_random_uuid();
  v_siparis_yeni2_id uuid := gen_random_uuid();
  v_siparis_ocak_id uuid := gen_random_uuid();
  v_bakiye_gercek integer;
  v_bakiye_beklenen integer;
BEGIN
  -- 1. store_urunler tablosundan mevcut aktif bir ürün al veya gerçek şemaya uygun oluştur
  -- Not: Gerçek şemada kolon adı "ad"dır ("baslik" değil). kategori_id zorunludur.
  SELECT urun_id INTO v_test_urun_id FROM public.store_urunler WHERE aktif_mi = true LIMIT 1;
  IF v_test_urun_id IS NULL THEN
    SELECT kategori_id INTO v_test_kategori_id FROM public.store_kategoriler LIMIT 1;
    IF v_test_kategori_id IS NULL THEN
      v_test_kategori_id := gen_random_uuid();
      INSERT INTO public.store_kategoriler (kategori_id, ad, sira, aktif_mi)
      VALUES (v_test_kategori_id, 'Test Kategori', 1, true);
    END IF;
    v_test_urun_id := gen_random_uuid();
    INSERT INTO public.store_urunler (urun_id, kategori_id, ad, puan_fiyati, stok, aktif_mi)
    VALUES (v_test_urun_id, v_test_kategori_id, 'Test Ürün', 100, 100, true);
  END IF;

  -- 2. İzole test kullanıcısı oluştur
  INSERT INTO public.kullanicilar (kullanici_id, ad, soyad, eposta, rol, aktif_mi)
  VALUES (v_test_uid, 'BakiyeTest', 'Kullanici', 'test_bakiye_' || v_test_uid::text || '@test.com', 'utt', true);

  -- 3. Gerçek yayin_yonetimi tablosundan geçerli yayın yabancı anahtarı sağla
  SELECT yayin_id INTO v_test_yayin_id
  FROM public.yayin_yonetimi
  WHERE durum = 'yayinda'
  LIMIT 1;

  -- Kural: Uygun yayın bulunamazsa açık gerekçeyle ATLANDI döndürülür
  IF v_test_yayin_id IS NULL THEN
    SELECT yayin_id INTO v_test_yayin_id
    FROM public.yayin_yonetimi
    LIMIT 1;
  END IF;

  IF v_test_yayin_id IS NULL THEN
    INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      200,
      'Bölüm 3: Sayısal Bakiye Testleri',
      'Yayın Ön Koşulu Kontrolü',
      'yayin_yonetimi tablosunda kayıtlı yayın kaydı bulunması',
      'Uygun yayın bulunamadı',
      'ATLANDI',
      'Sayısal test senaryolarının gerektirdiği yabancı anahtar (FK) için public.yayin_yonetimi tablosunda uygun yayın kaydı bulunamadığından Bölüm 3 testleri atlandı.'
    );
    RETURN;
  END IF;

  -- ─── SENARYO 1: Kayıtlı kaynak çeyrekli sipariş harcamasının korunması ───────
  -- Test kullanıcısına ait izleme oturumu oluştur (kullanıcı, yayın ve izleme birebir eşleşir)
  INSERT INTO public.izleme_kayitlari (
    izleme_id, kullanici_id, yayin_id, izleme_turu, tamamlandi_mi,
    gercek_oynatma_mi, video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s1_id, v_test_uid, v_test_yayin_id, 'kendi_kendine', true,
    true, 120, '2026-02-15 09:50:00+03'::timestamptz, '2026-02-15 09:50:00+03'::timestamptz
  );

  -- Kullanıcı 2026 Q1'de (15 Şubat) 1.000 puan kazandı
  INSERT INTO public.kazanilan_puanlar (kazanilan_puan_id, kullanici_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_test_yayin_id, v_izleme_s1_id, 'izleme', 1000, '2026-02-15 10:00:00+03'::timestamptz);

  -- Kullanıcı 2026 Q1 kaynak çeyreğine ait ('2026-01-01 00:00:00+03') 600 puanlık sipariş verdi (kaynak_ceyrek_baslangici açıkça belirtilmiş)
  INSERT INTO public.store_siparisler (siparis_id, kullanici_id, urun_id, adres_snapshot, adet, puan_birim_fiyat, toplam_puan, durum, kaynak_ceyrek_baslangici, created_at, guncellenme_at)
  VALUES (v_siparis_eski_id, v_test_uid, v_test_urun_id, '{}'::jsonb, 1, 600, 600, 'beklemede', '2026-01-01 00:00:00+03'::timestamptz, '2026-03-26 14:00:00+03'::timestamptz, '2026-03-26 14:00:00+03'::timestamptz);

  INSERT INTO public.store_puan_harcamalari (harcama_id, kullanici_id, siparis_id, puan_miktari, tur, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_siparis_eski_id, 600, 'harcama', '2026-03-26 14:00:00+03'::timestamptz);

  -- 1–7 Nisan sipariş haftasında (ör. 3 Nisan) beklenen bakiye: 1000 - 600 = 400
  v_bakiye_beklenen := 400;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2026-04-03 12:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    201,
    'Bölüm 3: Sayısal Bakiye Testleri',
    'Kayıtlı kaynak çeyrekli sipariş harcamasının bakiyeden düşmesi',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('Q1 kazanımı: 1000, Q1 kaynaklı sipariş harcaması: 600. 3 Nisan sipariş haftası bakiyesi beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- ─── SENARYO 2: Birden fazla yeni sipariş ve kısmi kalan bakiye ────────────
  -- 1–7 Nisan haftasında açık kaynak_ceyrek_baslangici ile siparişler:
  -- Sipariş 1: 250 puan (2 Nisan, kaynak: 2026-01-01)
  INSERT INTO public.store_siparisler (siparis_id, kullanici_id, urun_id, adres_snapshot, adet, puan_birim_fiyat, toplam_puan, durum, kaynak_ceyrek_baslangici, created_at, guncellenme_at)
  VALUES (v_siparis_yeni1_id, v_test_uid, v_test_urun_id, '{}'::jsonb, 1, 250, 250, 'beklemede', '2026-01-01 00:00:00+03'::timestamptz, '2026-04-02 10:00:00+03'::timestamptz, '2026-04-02 10:00:00+03'::timestamptz);

  INSERT INTO public.store_puan_harcamalari (harcama_id, kullanici_id, siparis_id, puan_miktari, tur, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_siparis_yeni1_id, 250, 'harcama', '2026-04-02 10:00:00+03'::timestamptz);

  -- Sipariş 2: 100 puan (4 Nisan, kaynak: 2026-01-01)
  INSERT INTO public.store_siparisler (siparis_id, kullanici_id, urun_id, adres_snapshot, adet, puan_birim_fiyat, toplam_puan, durum, kaynak_ceyrek_baslangici, created_at, guncellenme_at)
  VALUES (v_siparis_yeni2_id, v_test_uid, v_test_urun_id, '{}'::jsonb, 1, 100, 100, 'beklemede', '2026-01-01 00:00:00+03'::timestamptz, '2026-04-04 15:00:00+03'::timestamptz, '2026-04-04 15:00:00+03'::timestamptz);

  INSERT INTO public.store_puan_harcamalari (harcama_id, kullanici_id, siparis_id, puan_miktari, tur, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_siparis_yeni2_id, 100, 'harcama', '2026-04-04 15:00:00+03'::timestamptz);

  -- 5 Nisan'da kalan bakiye: 400 - 250 - 100 = 50
  v_bakiye_beklenen := 50;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2026-04-05 12:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    202,
    'Bölüm 3: Sayısal Bakiye Testleri',
    'Birden fazla yeni sipariş sonrası kısmi kalan bakiye',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('Önceki bakiye: 400, Sipariş 1 (-250), Sipariş 2 (-100). Kalan bakiye beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- ─── SENARYO 3: İptal iadesi (siparişin kaynak çeyreğine bağlanması) ──────
  -- Sipariş 2 (100 puan) 15 Mayıs'ta (Q2 içinde) iptal edildi ve iade kaydı eklendi
  INSERT INTO public.store_puan_harcamalari (harcama_id, kullanici_id, siparis_id, puan_miktari, tur, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_siparis_yeni2_id, 100, 'iade', '2026-05-15 12:00:00+03'::timestamptz);

  -- İade siparişin kaynak çeyreğine (Q1) bağlanmalı: Q1 bakiyesi 50 + 100 = 150 olmalı
  v_bakiye_beklenen := 150;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2026-04-05 12:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    203,
    'Bölüm 3: Sayısal Bakiye Testleri',
    'İptal iadesinin sipariş kaynak çeyreğine bağlanması',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('Sipariş 2 Mayıs ayında iptal edilse dahi iade kaynak çeyreğe (Q1) dönmeli. Beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- ─── SENARYO 4: Yeni çeyrek kazanımının sipariş haftasından hariç tutulması ─
  -- Test kullanıcısına ait ayrı izleme oturumu oluştur (Senaryo 4 için)
  INSERT INTO public.izleme_kayitlari (
    izleme_id, kullanici_id, yayin_id, izleme_turu, tamamlandi_mi,
    gercek_oynatma_mi, video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s4_id, v_test_uid, v_test_yayin_id, 'kendi_kendine', true,
    true, 120, '2026-04-03 15:50:00+03'::timestamptz, '2026-04-03 15:50:00+03'::timestamptz
  );

  -- Sipariş haftası sürerken (3 Nisan) kullanıcı 500 yeni puan kazandı (bu puan Q2'ye aittir)
  INSERT INTO public.kazanilan_puanlar (kazanilan_puan_id, kullanici_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_test_yayin_id, v_izleme_s4_id, 'izleme', 500, '2026-04-03 16:00:00+03'::timestamptz);

  -- 5 Nisan'da Q1 sipariş haftasındaki bakiye hala 150 olmalı (500 puan eklenmemeli!)
  v_bakiye_beklenen := 150;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2026-04-05 18:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    204,
    'Bölüm 3: Sayısal Bakiye Testleri',
    'Yeni çeyrek kazanımının cari sipariş haftasından hariç tutulması',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('3 Nisan''da kazanılan 500 puan Q2''ye ait olduğundan 1–7 Nisan penceresine dahil edilmemeli. Beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- ─── SENARYO 5: Eski bakiyenin sonraki döneme devretmemesi ─────────────────
  -- Q1'den kalan 150 puan Q2'ye taşınmaz. Q2 sipariş haftasında (3 Temmuz 2026)
  -- kullanıcı yalnızca Q2'de kazandığı 500 puana sahip olmalıdır.
  v_bakiye_beklenen := 500;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2026-07-03 12:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    205,
    'Bölüm 3: Sayısal Bakiye Testleri',
    'Eski bakiyenin sonraki döneme taşınmaması (devretmeme kuralı)',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('Q1''den kalan 150 puan Q2''ye devretmez. Q2 (3 Temmuz) beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- ─── SENARYO 6: Negatif bakiye davranışının korunması (GREATEST yokluğu) ───
  -- Test kullanıcısına ait ayrı izleme oturumu oluştur (Senaryo 6 için)
  INSERT INTO public.izleme_kayitlari (
    izleme_id, kullanici_id, yayin_id, izleme_turu, tamamlandi_mi,
    gercek_oynatma_mi, video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s6_id, v_test_uid, v_test_yayin_id, 'kendi_kendine', true,
    true, 120, '2026-05-10 09:50:00+03'::timestamptz, '2026-05-10 09:50:00+03'::timestamptz
  );

  -- Kullanıcı Q2 içinde (10 Mayıs) 700 puan ceza aldı (yanlis_cevap_kayitlari)
  INSERT INTO public.yanlis_cevap_kayitlari (kayit_id, kullanici_id, yayin_id, izleme_id, soru_index, kaybedilen_puan, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_test_yayin_id, v_izleme_s6_id, 1, 700, '2026-05-10 10:00:00+03'::timestamptz);

  -- Q2 bakiyesi: 500 (kazanım) - 700 (kayıp) = -200. GREATEST(0, ...) olmadığı için negatif dönmelidir.
  v_bakiye_beklenen := -200;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2026-07-03 12:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    206,
    'Bölüm 3: Sayısal Bakiye Testleri',
    'Mevcut negatif bakiye davranışının korunması (GREATEST(0,...) yokluğu)',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('500 kazanım - 700 kayıp durumunda sıfıra yuvarlanmayıp negatif bakiye korunmalı. Beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- ─── SENARYO 7: 1–7 Ocak Siparişinin Yalnız Q4'ten Düşmesi ve Yeni Q1'den Düşmemesi ──
  -- 2026 Q4 izleme oturumu (ayrı izleme kaydı)
  INSERT INTO public.izleme_kayitlari (
    izleme_id, kullanici_id, yayin_id, izleme_turu, tamamlandi_mi,
    gercek_oynatma_mi, video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s7_q4_id, v_test_uid, v_test_yayin_id, 'kendi_kendine', true,
    true, 120, '2026-11-15 10:50:00+03'::timestamptz, '2026-11-15 10:50:00+03'::timestamptz
  );

  -- Kullanıcı 2026 Q4 içinde (15 Kasım 2026) 2.000 puan kazandı
  INSERT INTO public.kazanilan_puanlar (kazanilan_puan_id, kullanici_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_test_yayin_id, v_izleme_s7_q4_id, 'izleme', 2000, '2026-11-15 11:00:00+03'::timestamptz);

  -- 2027 Q1 izleme oturumu (ayrı izleme kaydı)
  INSERT INTO public.izleme_kayitlari (
    izleme_id, kullanici_id, yayin_id, izleme_turu, tamamlandi_mi,
    gercek_oynatma_mi, video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s7_q1_id, v_test_uid, v_test_yayin_id, 'kendi_kendine', true,
    true, 120, '2027-02-10 10:50:00+03'::timestamptz, '2027-02-10 10:50:00+03'::timestamptz
  );

  -- Kullanıcı 2027 Q1 içinde (10 Şubat 2027) 800 puan kazandı
  INSERT INTO public.kazanilan_puanlar (kazanilan_puan_id, kullanici_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_test_yayin_id, v_izleme_s7_q1_id, 'izleme', 800, '2027-02-10 11:00:00+03'::timestamptz);

  -- Kullanıcı 1–7 Ocak 2027 sipariş haftasında (3 Ocak 2027) 1.200 puanlık sipariş verdi
  -- Kaynak çeyrek sunucu tarafından 2026 Q4 (2026-10-01) olarak atanır:
  INSERT INTO public.store_siparisler (
    siparis_id, kullanici_id, urun_id, adres_snapshot, adet, puan_birim_fiyat, toplam_puan, durum,
    kaynak_ceyrek_baslangici, created_at, guncellenme_at
  )
  VALUES (
    v_siparis_ocak_id, v_test_uid, v_test_urun_id, '{}'::jsonb, 1, 1200, 1200, 'beklemede',
    '2026-10-01 00:00:00+03'::timestamptz, '2027-01-03 14:00:00+03'::timestamptz, '2027-01-03 14:00:00+03'::timestamptz
  );

  INSERT INTO public.store_puan_harcamalari (harcama_id, kullanici_id, siparis_id, puan_miktari, tur, created_at)
  VALUES (gen_random_uuid(), v_test_uid, v_siparis_ocak_id, 1200, 'harcama', '2027-01-03 14:00:00+03'::timestamptz);

  -- Kontrol A: 2026 Q4 Store Günleri sipariş haftasında (4 Ocak 2027 12:00 TR):
  -- Beklenen bakiye: 2000 (2026 Q4 kazanımı) - 1200 (3 Ocak siparişi) = 800 puan
  v_bakiye_beklenen := 800;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2027-01-04 12:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    207,
    'Bölüm 3: Sayısal Bakiye Testleri',
    '1–7 Ocak siparişinin yalnızca kaynak 2026 Q4 bakiyesinden düşmesi',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('2026 Q4 kazanımı: 2000, 3 Ocak Store Günleri siparişi: 1200. Q4 kalan bakiye beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- Kontrol B: 2027 Q1 Store Günleri sipariş haftasında (3 Nisan 2027 12:00 TR):
  -- 3 Ocak'ta verilen 1.200 puanlık sipariş 2026 Q4'e ait olduğundan 2027 Q1 bakiyesinden DÜŞMEMELİDİR.
  -- 2027 Q1 kazanımı 800 puandır; harcama yapılmadığından bakiye 800 olmalıdır.
  -- (Eski çakışma hatası olsaydı 800 - 1200 = -400 çıkardı).
  v_bakiye_beklenen := 800;
  v_bakiye_gercek := public.get_harcama_bakiyesi_tarihli(v_test_uid, '2027-04-03 12:00:00+03'::timestamptz);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    208,
    'Bölüm 3: Sayısal Bakiye Testleri',
    '1–7 Ocak siparişinin yeni 2027 Q1 bakiyesinden DÜŞMEMESİ (Çakışma / Overlap Giderimi)',
    v_bakiye_beklenen::text,
    v_bakiye_gercek::text,
    CASE WHEN v_bakiye_gercek = v_bakiye_beklenen THEN 'GECTI' ELSE 'KALDI' END,
    format('2027 Q1 kazanımı: 800. 3 Ocak siparişi (1200) Q4''e ait olduğu için Q1''den düşülmemelidir. Beklenen: %s, hesaplanan: %s.', v_bakiye_beklenen, v_bakiye_gercek)
  );

  -- ─── SENARYO 8: Mevcut get_harcama_bakiyesi(uuid) tekil çağrısı ────────────
  -- Tek parametreli get_harcama_bakiyesi(uuid) fonksiyonunun hatasız çalışması
  v_bakiye_gercek := public.get_harcama_bakiyesi(v_test_uid);

  INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    209,
    'Bölüm 3: Sayısal Bakiye Testleri',
    'Mevcut get_harcama_bakiyesi(uuid) tek parametreli imzasının doğrulanması',
    'Hatasız tamsayı değer',
    v_bakiye_gercek::text,
    'GECTI',
    format('Orijinal get_harcama_bakiyesi(uuid) fonksiyonu clock_timestamp() ile başarıyla çağrıldı ve sayısal bakiye üretti (%s).', v_bakiye_gercek)
  );
END;
$sayisal_bakiye_testleri$;


-- ============================================================================
-- BÖLÜM 4: SON KAPANIS KONTROLÜNÜN MİMARİ DOĞRULANMASI (KOD ANALİZİ)
-- ============================================================================
-- Kapsam:
--   store_siparis_olustur_cekirdek fonksiyonu içinde:
--   1. Ürün için row-level lock (FOR UPDATE) alınmış mı?
--   2. Stok azaltma (UPDATE store_urunler) işlemi var mı?
--   3. FOR UPDATE kilidi ile UPDATE store_urunler arasında clock_timestamp() ile
--      hbstore_siparis_donemi_acik_mi kontrolü yapılmış mı?
--
-- RAPORLAMA NOTU:
--   Bu kontrol, fonksiyon gövdesinin AST / metin analizini gerçekleştirir.
--   Canlı eşzamanlılık (concurrency / race condition) testi DEĞİLDİR ve
--   eşzamanlılık testi olarak sunulmaz.
-- ============================================================================

INSERT INTO test_hbstore_sonuclar (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
WITH fn_kontrol AS (
  SELECT to_regprocedure('public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer)') AS fn_oid
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
    position('update store_urunler' IN def) AS pos_stok_update
  FROM kaynak
),
dilim AS (
  SELECT
    fn_oid,
    pos_kilit,
    pos_stok_update,
    CASE
      WHEN pos_kilit > 0 AND pos_stok_update > pos_kilit
      THEN substring(def FROM pos_kilit FOR (pos_stok_update - pos_kilit))
      ELSE ''
    END AS kilit_ve_stok_arasi_kod
  FROM pozisyonlar
)
SELECT
  300 AS sira,
  'Bölüm 4: Son Kapanış Mimarisi',
  'store_siparis_olustur_cekirdek — Ürün kilidi sonrası clock_timestamp() kontrolü',
  'Ürün FOR UPDATE kilidi ile UPDATE store_urunler arasında clock_timestamp() takvim kontrolü',
  CASE
    WHEN fn_oid IS NULL THEN 'Fonksiyon veritabanında bulunamadı'
    WHEN pos_kilit > 0
     AND pos_stok_update > pos_kilit
     AND kilit_ve_stok_arasi_kod LIKE '%hbstore_siparis_donemi_acik_mi%'
     AND kilit_ve_stok_arasi_kod LIKE '%clock_timestamp()%'
    THEN 'Ürün FOR UPDATE kilidi sonrasında ve UPDATE store_urunler öncesinde clock_timestamp() kontrolü mevcut'
    ELSE 'Kilit ile stok güncelleme arasında clock_timestamp() kontrolü tespit edilemedi'
  END,
  CASE
    WHEN fn_oid IS NULL THEN 'KALDI'
    WHEN pos_kilit > 0
     AND pos_stok_update > pos_kilit
     AND kilit_ve_stok_arasi_kod LIKE '%hbstore_siparis_donemi_acik_mi%'
     AND kilit_ve_stok_arasi_kod LIKE '%clock_timestamp()%'
    THEN 'GECTI'
    ELSE 'KALDI'
  END,
  CASE
    WHEN fn_oid IS NULL THEN 'HATA: public.store_siparis_olustur_cekirdek fonksiyonu veritabanında bulunamadı.'
    WHEN pos_kilit > 0
     AND pos_stok_update > pos_kilit
     AND kilit_ve_stok_arasi_kod LIKE '%hbstore_siparis_donemi_acik_mi%'
     AND kilit_ve_stok_arasi_kod LIKE '%clock_timestamp()%'
    THEN 'KOD ANALİZİ DOĞRULANDI: Ürünün FOR UPDATE kilidi ve bakiye kontrolünden sonra, UPDATE store_urunler işleminden hemen önce clock_timestamp() ile anlık takvim kontrolü bulunmaktadır. (Statik fonksiyon tanımı denetimidir; canlı eşzamanlılık testi değildir.)'
    ELSE 'KOD ANALİZİ BAŞARISIZ: Ürün FOR UPDATE kilidi ile stok UPDATE arasında clock_timestamp() kontrolü tespit edilemedi.'
  END
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
FROM test_hbstore_sonuclar
ORDER BY sira;

-- ============================================================================
-- TEMİZLİK VE GÜVENLİ GERİ ALMA
-- ============================================================================
-- Test süresince yapılan tüm işlemler geri alınır; veritabanında hiçbir kalıcı
-- satır, sipariş, puan hareketi veya geçici tablo bırakılmaz.
-- ============================================================================
ROLLBACK;

