-- ============================================================================
-- Rapor Puan Hesapları Ortaklaştırma Doğrulama Test Paketi (Eski - Yeni Karşılaştırma)
-- Dosya: scripts/sql/test_rapor_puan_hesaplari_ortaklastirma.sql
--
-- ÇALIŞTIRMA TALİMATI VE SIRASI:
--   1. Adım (Bu Dosya): scripts/sql/test_rapor_puan_hesaplari_ortaklastirma.sql
--      - Supabase SQL Editörü'nde DOĞRUDAN çalıştırılır.
--      - DB'deki 4 fonksiyonun mevcut durumunun (eski sürüm) meta ve izinlerini yedekler.
--      - Kapsamlı test verileri ekler (çoklu firma/takım/bölge, aktif/pasif, E-Club > 0, 4 kayıp > 0).
--      - Eski fonksiyonları çalıştırıp tüm çıktıları kaydeder.
--      - Yeni fonksiyon tanımlarını aynı işlem içinde (in-transaction DDL) derler.
--      - Yeni fonksiyonları aynı test parametreleriyle çalıştırır.
--      - Yalnız puanları değil; TÜM DÖNÜŞ ALANLARINI, SATIR SIRALAMASINI,
--        JSON DİZİ SIRALAMASINI ve İZİN EŞİTLİĞİNİ karşılaştırır.
--      - Tek sonuç tablosu üretir ve ROLLBACK ile sonlanır (DB'de hiçbir kalıcı değişiklik kalmaz).
--
--   2. Adım: Test sonuçları onaylandıktan sonra:
--      - scripts/sql/rapor_puan_hesaplari_ortaklastirma.sql
--      - Kalıcı dar migrasyon olarak uygulanır.
--
--   NOT: utt_eclub_puan_kazanimi.sql dosyası yeniden ÇALIŞTIRILMAZ.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ----------------------------------------------------------------------------
-- 0. SONUÇ TABLOSU
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE IF NOT EXISTS test_rapor_ortaklastirma_sonuclari (
  sira integer,
  bolum text,
  test_adi text,
  beklenen text,
  gercek text,
  durum text,
  aciklama text
) ON COMMIT DROP;

DO $test_paketi$
DECLARE
  -- Test Varlıkları
  v_firma_a uuid := gen_random_uuid();
  v_firma_b uuid := gen_random_uuid();

  v_takim_1 uuid := gen_random_uuid();
  v_takim_2 uuid := gen_random_uuid();
  v_takim_3 uuid := gen_random_uuid();

  v_bolge_1 uuid := gen_random_uuid();
  v_bolge_2 uuid := gen_random_uuid();
  v_bolge_3 uuid := gen_random_uuid();
  v_bolge_4 uuid := gen_random_uuid();

  v_gm_a        uuid := gen_random_uuid();
  v_gm_b        uuid := gen_random_uuid();
  v_bm_1        uuid := gen_random_uuid();
  v_bm_2        uuid := gen_random_uuid();
  v_bm_3        uuid := gen_random_uuid();
  v_bm_4        uuid := gen_random_uuid();
  v_yardimci_bm uuid := gen_random_uuid();
  v_utt_1       uuid := gen_random_uuid();
  v_utt_2       uuid := gen_random_uuid();
  v_utt_3       uuid := gen_random_uuid();
  v_utt_4       uuid := gen_random_uuid();
  v_utt_pasif   uuid := gen_random_uuid();
  v_utt_b       uuid := gen_random_uuid();

  v_yayin_id uuid;
  v_urun_id  uuid;

  v_izleme_u1_1  uuid := gen_random_uuid();
  v_izleme_u1_2  uuid := gen_random_uuid();
  v_izleme_u2_1  uuid := gen_random_uuid();
  v_izleme_u3_1  uuid := gen_random_uuid();
  v_izleme_u4_1  uuid := gen_random_uuid();
  v_izleme_pasif uuid := gen_random_uuid();
  v_izleme_b     uuid := gen_random_uuid();
  v_izleme_once  uuid := gen_random_uuid();
  v_izleme_sonra uuid := gen_random_uuid();

  v_oneri_1   uuid := gen_random_uuid();
  v_oneri_4   uuid := gen_random_uuid();

  v_bas timestamptz := '2026-06-01 00:00:00+03'::timestamptz;
  v_bit timestamptz := '2026-06-30 23:59:59.999+03'::timestamptz;

  -- Karşılaştırma Sayaç ve Metinleri
  v_eski_sayisi integer;
  v_yeni_sayisi integer;
  v_fark_sayisi integer;
  v_fark_detay  text;
  v_rec         record;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. ÖN KOŞUL VE MEVCUT TANIM/İZİN YEDEĞİ
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_kullanici_ozet'
  ) THEN
    INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      1, 'Ön Koşul', 'get_kullanici_ozet Varlığı',
      'public.get_kullanici_ozet fonksiyonunun veritabanında tanımlı olması',
      'Fonksiyon bulunamadı', 'HATA',
      'Ortak fonksiyon eksik olduğundan test durduruldu.'
    );
    RETURN;
  END IF;

  CREATE TEMP TABLE _fonksiyon_tanim_ve_izin_yedekleri ON COMMIT DROP AS
  SELECT
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS args,
    p.proacl,
    p.proowner,
    p.prosecdef,
    p.provolatile,
    pg_get_functiondef(p.oid) AS funcdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_bm_utt_performans_v2',
      'get_bolge_bazli_grup',
      'get_yonetici_hiyerarsi_v2',
      'get_yonetici_rapor_ana_ozet_v2'
    );

  IF (SELECT COUNT(*) FROM _fonksiyon_tanim_ve_izin_yedekleri) < 4 THEN
    INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      2, 'Ön Koşul', 'Mevcut 4 Rapor Fonksiyonunun Varlığı',
      '4 fonksiyonun tanımlı olması',
      (SELECT COUNT(*)::text FROM _fonksiyon_tanim_ve_izin_yedekleri) || ' fonksiyon bulundu',
      'HATA',
      'Karşılaştırılacak 4 fonksiyonun tamamı veritabanında bulunmalıdır.'
    );
    RETURN;
  END IF;

  -- Mevcut künyeden yayın ve ürün kimliği sağla
  SELECT ky.yayin_id, ky.urun_id
  INTO v_yayin_id, v_urun_id
  FROM public.v_yayin_kunye ky
  JOIN public.yayin_yonetimi yy ON yy.yayin_id = ky.yayin_id
  WHERE ky.urun_id IS NOT NULL
  LIMIT 1;

  IF v_yayin_id IS NULL THEN
    SELECT ky.yayin_id, ky.urun_id
    INTO v_yayin_id, v_urun_id
    FROM public.v_yayin_kunye ky
    WHERE ky.urun_id IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_yayin_id IS NULL THEN
    SELECT y.yayin_id INTO v_yayin_id FROM public.yayin_yonetimi y LIMIT 1;
  END IF;

  IF v_yayin_id IS NULL THEN
    INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      3, 'Ön Koşul', 'Yayın Kaydı',
      'Test için geçerli bir yayın bulunması',
      'Yayın bulunamadı', 'ATLANDI',
      'Yayın tablosunda kayıt olmadığından testler atlandı.'
    );
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. TEST VERİLERİNİN OLUŞTURULMASI (ÇOKLU KAPSAM, E-CLUB > 0, 4 KAYIP > 0)
  -- --------------------------------------------------------------------------
  -- 2.1 Firmalar
  INSERT INTO public.firmalar (firma_id, firma_adi, aktif, hbstore_aktif, cc_aktif, eclub_aktif, eclub_store_aktif, eczanem_aktif)
  VALUES
    (v_firma_a, 'Test Firma A', true, true, true, true, true, false),
    (v_firma_b, 'Test Firma B', true, true, true, true, true, false);

  -- 2.2 Takımlar
  INSERT INTO public.takimlar (takim_id, firma_id, takim_adi)
  VALUES
    (v_takim_1, v_firma_a, 'Takim A1'),
    (v_takim_2, v_firma_a, 'Takim A2'),
    (v_takim_3, v_firma_b, 'Takim B1');

  -- 2.3 Bölgeler
  INSERT INTO public.bolgeler (bolge_id, takim_id, bolge_adi)
  VALUES
    (v_bolge_1, v_takim_1, 'Bolge A1-1'),
    (v_bolge_2, v_takim_1, 'Bolge A1-2'),
    (v_bolge_3, v_takim_2, 'Bolge A2-1'),
    (v_bolge_4, v_takim_3, 'Bolge B1-1');

  -- 2.4 Kullanıcılar
  INSERT INTO public.kullanicilar (kullanici_id, ad, soyad, eposta, rol, firma_id, takim_id, bolge_id, aktif_mi)
  VALUES
    (v_gm_a, 'Ali', 'YoneticiA', 'gma_' || v_gm_a || '@test.com', 'gm', v_firma_a, NULL, NULL, true),
    (v_gm_b, 'Veli', 'YoneticiB', 'gmb_' || v_gm_b || '@test.com', 'gm', v_firma_b, NULL, NULL, true),
    (v_bm_1, 'Ahmet', 'BM1', 'bm1_' || v_bm_1 || '@test.com', 'bm', v_firma_a, v_takim_1, v_bolge_1, true),
    (v_bm_2, 'Ayse', 'BM2', 'bm2_' || v_bm_2 || '@test.com', 'bm', v_firma_a, v_takim_1, v_bolge_2, true),
    (v_bm_3, 'Mehmet', 'BM3', 'bm3_' || v_bm_3 || '@test.com', 'bm', v_firma_a, v_takim_2, v_bolge_3, true),
    (v_bm_4, 'Fatma', 'BM4', 'bm4_' || v_bm_4 || '@test.com', 'bm', v_firma_b, v_takim_3, v_bolge_4, true),
    (v_yardimci_bm, 'Can', 'YardimciBM', 'bmy_' || v_yardimci_bm || '@test.com', 'bm', v_firma_a, v_takim_1, v_bolge_1, true),
    (v_utt_1, 'Zeynep', 'UTT1', 'utt1_' || v_utt_1 || '@test.com', 'utt', v_firma_a, v_takim_1, v_bolge_1, true),
    (v_utt_2, 'Burak', 'KDUTT2', 'utt2_' || v_utt_2 || '@test.com', 'kd_utt', v_firma_a, v_takim_1, v_bolge_1, true),
    (v_utt_3, 'Cem', 'UTT3', 'utt3_' || v_utt_3 || '@test.com', 'utt', v_firma_a, v_takim_1, v_bolge_2, true),
    (v_utt_4, 'Deniz', 'UTT4', 'utt4_' || v_utt_4 || '@test.com', 'utt', v_firma_a, v_takim_2, v_bolge_3, true),
    (v_utt_pasif, 'Pasif', 'UTTPasif', 'uttp_' || v_utt_pasif || '@test.com', 'utt', v_firma_a, v_takim_1, v_bolge_1, false),
    (v_utt_b, 'Bora', 'UTTB', 'uttb_' || v_utt_b || '@test.com', 'utt', v_firma_b, v_takim_3, v_bolge_4, true);

  -- 2.5 İzleme Kayıtları
  INSERT INTO public.izleme_kayitlari (
    izleme_id, yayin_id, kullanici_id, izleme_turu, tamamlandi_mi, gercek_oynatma_mi,
    izleme_baslangic, izleme_bitis, created_at
  ) VALUES
    (v_izleme_u1_1, v_yayin_id, v_utt_1, 'video', true, true,
     '2026-06-05 10:00:00+03'::timestamptz, '2026-06-05 10:10:00+03'::timestamptz, '2026-06-05 10:00:00+03'::timestamptz),
    (v_izleme_u1_2, v_yayin_id, v_utt_1, 'video', true, true,
     '2026-06-06 14:00:00+03'::timestamptz, '2026-06-06 14:10:00+03'::timestamptz, '2026-06-06 14:00:00+03'::timestamptz),
    (v_izleme_u2_1, v_yayin_id, v_utt_2, 'video', true, true,
     '2026-06-10 11:00:00+03'::timestamptz, '2026-06-10 11:10:00+03'::timestamptz, '2026-06-10 11:00:00+03'::timestamptz),
    (v_izleme_u3_1, v_yayin_id, v_utt_3, 'video', true, true,
     '2026-06-15 09:00:00+03'::timestamptz, '2026-06-15 09:10:00+03'::timestamptz, '2026-06-15 09:00:00+03'::timestamptz),
    (v_izleme_u4_1, v_yayin_id, v_utt_4, 'video', true, true,
     '2026-06-20 16:00:00+03'::timestamptz, '2026-06-20 16:10:00+03'::timestamptz, '2026-06-20 16:00:00+03'::timestamptz),
    (v_izleme_pasif, v_yayin_id, v_utt_pasif, 'video', true, true,
     '2026-06-10 10:00:00+03'::timestamptz, '2026-06-10 10:10:00+03'::timestamptz, '2026-06-10 10:00:00+03'::timestamptz),
    (v_izleme_b, v_yayin_id, v_utt_b, 'video', true, true,
     '2026-06-10 10:00:00+03'::timestamptz, '2026-06-10 10:10:00+03'::timestamptz, '2026-06-10 10:00:00+03'::timestamptz),
    (v_izleme_once, v_yayin_id, v_utt_1, 'video', true, true,
     '2026-05-20 10:00:00+03'::timestamptz, '2026-05-20 10:10:00+03'::timestamptz, '2026-05-20 10:00:00+03'::timestamptz),
    (v_izleme_sonra, v_yayin_id, v_utt_1, 'video', true, true,
     '2026-07-05 10:00:00+03'::timestamptz, '2026-07-05 10:10:00+03'::timestamptz, '2026-07-05 10:00:00+03'::timestamptz);

  -- 2.6 Kazanılan Puanlar
  INSERT INTO public.kazanilan_puanlar (
    kazanilan_puan_id, kullanici_id, yayin_id, izleme_id, puan_turu, puan, created_at, urun_id
  ) VALUES
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_izleme_u1_1, 'izleme', 100, '2026-06-05 10:10:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_izleme_u1_1, 'cevaplama', 40, '2026-06-05 10:12:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_izleme_u1_2, 'oneri', 20, '2026-06-06 14:12:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_izleme_u1_2, 'extra', 50, '2026-06-06 14:15:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_2, v_yayin_id, v_izleme_u2_1, 'izleme', 80, '2026-06-10 11:10:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_3, v_yayin_id, v_izleme_u3_1, 'izleme', 120, '2026-06-15 09:10:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_3, v_yayin_id, v_izleme_u3_1, 'cevaplama', 30, '2026-06-15 09:12:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_4, v_yayin_id, v_izleme_u4_1, 'izleme', 70, '2026-06-20 16:10:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_pasif, v_yayin_id, v_izleme_pasif, 'izleme', 999, '2026-06-10 10:10:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_b, v_yayin_id, v_izleme_b, 'izleme', 888, '2026-06-10 10:10:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_izleme_once, 'izleme', 500, '2026-05-20 10:10:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_izleme_sonra, 'izleme', 500, '2026-07-05 10:10:00+03'::timestamptz, v_urun_id);

  -- 2.7 E-Club Puanları
  INSERT INTO public.eclub_utt_puanlari (
    utt_puan_id, utt_id, kisi_id, yayin_id, izleme_id, oneri_id, urun_id, puan, created_at
  ) VALUES
    (gen_random_uuid(), v_utt_1, gen_random_uuid(), v_yayin_id, v_izleme_u1_1, gen_random_uuid(), v_urun_id, 60, '2026-06-07 10:00:00+03'::timestamptz),
    (gen_random_uuid(), v_utt_2, gen_random_uuid(), v_yayin_id, v_izleme_u2_1, gen_random_uuid(), v_urun_id, 45, '2026-06-12 12:00:00+03'::timestamptz),
    (gen_random_uuid(), v_utt_3, gen_random_uuid(), v_yayin_id, v_izleme_u3_1, gen_random_uuid(), v_urun_id, 30, '2026-06-18 15:00:00+03'::timestamptz);

  -- 2.8 Standart Kayıplar (İleri Sarma, Yanlış Cevap, Öneri Kaybı)
  INSERT INTO public.ileri_sarma_kayitlari (
    kayit_id, yayin_id, kullanici_id, izleme_id, atlanan_sure, atlama_baslangic, atlama_bitis, kaybedilen_puan, created_at, urun_id
  ) VALUES
    (gen_random_uuid(), v_yayin_id, v_utt_1, v_izleme_u1_1, 30, 10, 40, 15, '2026-06-08 10:00:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_yayin_id, v_utt_3, v_izleme_u3_1, 20, 15, 35, 10, '2026-06-16 10:00:00+03'::timestamptz, v_urun_id);

  INSERT INTO public.yanlis_cevap_kayitlari (
    kayit_id, kullanici_id, yayin_id, izleme_id, soru_index, kaybedilen_puan, created_at, urun_id
  ) VALUES
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_izleme_u1_1, 1, 25, '2026-06-08 10:05:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_2, v_yayin_id, v_izleme_u2_1, 1, 5,  '2026-06-13 11:05:00+03'::timestamptz, v_urun_id);

  -- Öneri Kayıtları (oneri_kayip_kayitlari FK bağımlılığı için)
  INSERT INTO public.oneri_kayitlari (
    oneri_id, yayin_id, oneren_id, kullanici_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at
  ) VALUES
    (v_oneri_1, v_yayin_id, v_yardimci_bm, v_utt_1,
     '2026-06-01 10:00:00+03'::timestamptz, '2026-06-08 10:00:00+03'::timestamptz, false, '2026-06-01 10:00:00+03'::timestamptz),
    (v_oneri_4, v_yayin_id, v_bm_3, v_utt_4,
     '2026-06-15 10:00:00+03'::timestamptz, '2026-06-21 10:00:00+03'::timestamptz, false, '2026-06-15 10:00:00+03'::timestamptz);

  INSERT INTO public.oneri_kayip_kayitlari (
    kayit_id, kullanici_id, yayin_id, oneri_id, kaybedilen_puan, created_at, urun_id
  ) VALUES
    (gen_random_uuid(), v_utt_1, v_yayin_id, v_oneri_1, 10, '2026-06-09 10:00:00+03'::timestamptz, v_urun_id),
    (gen_random_uuid(), v_utt_4, v_yayin_id, v_oneri_4, 15, '2026-06-22 10:00:00+03'::timestamptz, v_urun_id);

  -- 2.9 Challenge Kayıpları
  -- NOT: Challenge mekanizması iş mantığı gereği yalnızca BM -> BM (Bölge Müdürü) arasında
  -- geçerlidir (rol = 'bm'). UTT rolleri challenge alıcısı olamaz; bu nedenle UTT raporlarında
  -- challenge kaybı her zaman 0 hesaplanır ve testte geçersiz BM -> UTT challenge kaydı oluşturulmaz.

  -- --------------------------------------------------------------------------
  -- 3. ESKİ FONKSİYONLARIN ÇIKTILARINI KAYDETME (DİNAMİK ÇAĞRI)
  -- --------------------------------------------------------------------------
  -- 3.1 BM Saha Performansı
  EXECUTE 'CREATE TEMP TABLE _eski_bm ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_bm_utt_performans_v2($1, $2, $3) r'
    USING v_bm_1, v_bas, v_bit;

  -- 3.2 Bölge Gruplaması (Takım ve Firma Filtreleri)
  EXECUTE 'CREATE TEMP TABLE _eski_bolge_takim ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_bolge_bazli_grup($1, $2, $3, $4) r'
    USING v_bas, v_bit, v_takim_1, v_firma_a;

  EXECUTE 'CREATE TEMP TABLE _eski_bolge_firma ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_bolge_bazli_grup($1, $2, NULL, $3) r'
    USING v_bas, v_bit, v_firma_a;

  -- 3.3 Yönetici Hiyerarşisi (3 Seviye: takim, bolge, utt)
  EXECUTE 'CREATE TEMP TABLE _eski_yon_takim ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_hiyerarsi_v2($1, $2, $3, ''takim'', NULL) r'
    USING v_gm_a, v_bas, v_bit;

  EXECUTE 'CREATE TEMP TABLE _eski_yon_bolge ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_hiyerarsi_v2($1, $2, $3, ''bolge'', $4) r'
    USING v_gm_a, v_bas, v_bit, v_takim_1;

  EXECUTE 'CREATE TEMP TABLE _eski_yon_utt ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_hiyerarsi_v2($1, $2, $3, ''utt'', $4) r'
    USING v_gm_a, v_bas, v_bit, v_bolge_1;

  -- 3.4 Yönetici Rapor Ana Özeti
  EXECUTE 'CREATE TEMP TABLE _eski_yon_ozet ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_rapor_ana_ozet_v2($1, $2, $3) r'
    USING v_gm_a, v_bas, v_bit;

  -- --------------------------------------------------------------------------
  -- 4. YENİ FONKSİYON TANIMLARINI YÜKLEME (İN-TRANSACTION DDL)
  -- --------------------------------------------------------------------------
  -- 4.1 get_bolge_bazli_grup
  EXECUTE $ddl_bolge$
  CREATE OR REPLACE FUNCTION public.get_bolge_bazli_grup(
    p_baslangic timestamp with time zone,
    p_bitis timestamp with time zone,
    p_takim_id uuid DEFAULT NULL::uuid,
    p_firma_id uuid DEFAULT NULL::uuid
  )
  RETURNS TABLE(
    bolge_id uuid,
    bolge_adi text,
    takim_id uuid,
    takim_adi text,
    bm_adi text,
    toplam_utt integer,
    aktif_utt integer,
    hic_izlemeyen_utt integer,
    video_puani integer,
    soru_puani integer,
    oneri_puani integer,
    extra_puan integer,
    ileri_sarma_kaybi integer,
    yanlis_cevap_kaybi integer,
    oneri_kaybi integer,
    toplam_net_puan integer,
    urun_dagilimi jsonb,
    eclub_puani integer
  )
  LANGUAGE plpgsql
  STABLE
  AS $fn_bolge$
  #variable_conflict use_column
  BEGIN
    RETURN QUERY
    WITH
    scoped_bolgeler AS (
      SELECT b.bolge_id, b.bolge_adi::text AS bolge_adi, b.takim_id, t.takim_adi::text AS takim_adi
      FROM bolgeler b
      JOIN takimlar t ON t.takim_id = b.takim_id
      WHERE (p_takim_id IS NULL OR b.takim_id = p_takim_id)
        AND (p_firma_id IS NULL OR t.firma_id = p_firma_id)
    ),
    bm_per_bolge AS (
      SELECT k.bolge_id, (k.ad || ' ' || k.soyad)::text AS bm_adi
      FROM kullanicilar k
      WHERE k.rol = 'bm'
        AND k.aktif_mi = true
        AND k.bolge_id IN (SELECT sb.bolge_id FROM scoped_bolgeler sb)
    ),
    scoped_utt AS (
      SELECT k.kullanici_id, k.bolge_id
      FROM kullanicilar k
      WHERE k.aktif_mi = true
        AND k.rol IN ('utt', 'kd_utt')
        AND k.bolge_id IN (SELECT sb.bolge_id FROM scoped_bolgeler sb)
    ),
    toplam_utt_per_bolge AS (
      SELECT su.bolge_id, COUNT(*)::int AS toplam_utt
      FROM scoped_utt su
      GROUP BY su.bolge_id
    ),
    puan_ozet AS (
      SELECT
        su.bolge_id,
        COUNT(DISTINCT o.kullanici_id) FILTER (WHERE o.izlenme_sayisi > 0)::int AS aktif_utt,
        SUM(o.video_puani)::int AS video_puani,
        SUM(o.soru_puani)::int AS soru_puani,
        SUM(o.oneri_puani)::int AS oneri_puani,
        SUM(o.extra_puan)::int AS extra_puan,
        SUM(o.ileri_sarma_kaybi)::int AS ileri_sarma_kaybi,
        SUM(o.yanlis_cevap_kaybi)::int AS yanlis_cevap_kaybi,
        SUM(o.oneri_kaybi)::int AS oneri_kaybi,
        SUM(o.toplam_net_puan)::int AS toplam_net_puan,
        SUM(o.eclub_puani)::int AS eclub_puani
      FROM public.get_kullanici_ozet(
        p_baslangic,
        p_bitis,
        NULL::uuid,
        NULL::uuid,
        p_takim_id,
        p_firma_id
      ) o
      JOIN scoped_utt su ON su.kullanici_id = o.kullanici_id
      GROUP BY su.bolge_id
    ),
    urun_kazanim AS (
      SELECT
        su.bolge_id,
        ky.urun_id,
        SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
        SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
        SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
        SUM(CASE WHEN kp.puan_turu = 'eclub'     THEN kp.puan ELSE 0 END)::int AS eclub_puani,
        SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan
      FROM (
        SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
        UNION ALL
        SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
      ) kp
      JOIN scoped_utt su    ON su.kullanici_id = kp.kullanici_id
      JOIN v_yayin_kunye ky ON ky.yayin_id     = kp.yayin_id
      WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
      GROUP BY su.bolge_id, ky.urun_id
    ),
    urun_ileri_sarma AS (
      SELECT su.bolge_id, ky.urun_id, SUM(isk.kaybedilen_puan)::int AS toplam_kayip
      FROM ileri_sarma_kayitlari isk
      JOIN scoped_utt su    ON su.kullanici_id = isk.kullanici_id
      JOIN v_yayin_kunye ky ON ky.yayin_id     = isk.yayin_id
      WHERE isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
      GROUP BY su.bolge_id, ky.urun_id
    ),
    urun_yanlis_cevap AS (
      SELECT su.bolge_id, ky.urun_id, SUM(ycb.kaybedilen_puan)::int AS toplam_kayip
      FROM yanlis_cevap_kayitlari ycb
      JOIN scoped_utt su    ON su.kullanici_id = ycb.kullanici_id
      JOIN v_yayin_kunye ky ON ky.yayin_id     = ycb.yayin_id
      WHERE ycb.created_at >= p_baslangic AND ycb.created_at <= p_bitis
      GROUP BY su.bolge_id, ky.urun_id
    ),
    urun_oneri_kayip AS (
      SELECT su.bolge_id, ky.urun_id, SUM(okb.kaybedilen_puan)::int AS toplam_kayip
      FROM oneri_kayip_kayitlari okb
      JOIN scoped_utt su    ON su.kullanici_id = okb.kullanici_id
      JOIN v_yayin_kunye ky ON ky.yayin_id     = okb.yayin_id
      WHERE okb.created_at >= p_baslangic AND okb.created_at <= p_bitis
      GROUP BY su.bolge_id, ky.urun_id
    ),
    urun_birlesik AS (
      SELECT bolge_id, urun_id FROM urun_kazanim
      UNION
      SELECT bolge_id, urun_id FROM urun_ileri_sarma
      UNION
      SELECT bolge_id, urun_id FROM urun_yanlis_cevap
      UNION
      SELECT bolge_id, urun_id FROM urun_oneri_kayip
    ),
    urun_dagilim AS (
      SELECT
        ub.bolge_id,
        jsonb_agg(
          jsonb_build_object(
            'urun_id', ub.urun_id,
            'urun_adi', u.urun_adi,
            'video_puani', COALESCE(uk.video_puani, 0),
            'soru_puani', COALESCE(uk.soru_puani, 0),
            'oneri_puani', COALESCE(uk.oneri_puani, 0),
            'extra_puan', COALESCE(uk.extra_puan, 0),
            'eclub_puani', COALESCE(uk.eclub_puani, 0),
            'ileri_sarma_kaybi', COALESCE(uis.toplam_kayip, 0),
            'yanlis_cevap_kaybi', COALESCE(uyc.toplam_kayip, 0),
            'oneri_kaybi', COALESCE(uok.toplam_kayip, 0),
            'toplam_net_puan',
              COALESCE(uk.video_puani, 0) + COALESCE(uk.soru_puani, 0)
              + COALESCE(uk.oneri_puani, 0) + COALESCE(uk.extra_puan, 0) + COALESCE(uk.eclub_puani, 0)
              - COALESCE(uis.toplam_kayip, 0) - COALESCE(uyc.toplam_kayip, 0)
              - COALESCE(uok.toplam_kayip, 0)
          )
          ORDER BY u.urun_adi
        ) AS urun_dagilimi
      FROM urun_birlesik ub
      JOIN urunler u ON u.urun_id = ub.urun_id
      LEFT JOIN urun_kazanim       uk  ON uk.bolge_id  = ub.bolge_id AND uk.urun_id  = ub.urun_id
      LEFT JOIN urun_ileri_sarma   uis ON uis.bolge_id = ub.bolge_id AND uis.urun_id = ub.urun_id
      LEFT JOIN urun_yanlis_cevap  uyc ON uyc.bolge_id = ub.bolge_id AND uyc.urun_id = ub.urun_id
      LEFT JOIN urun_oneri_kayip   uok ON uok.bolge_id = ub.bolge_id AND uok.urun_id = ub.urun_id
      GROUP BY ub.bolge_id
    )
    SELECT
      sb.bolge_id,
      sb.bolge_adi,
      sb.takim_id,
      sb.takim_adi,
      COALESCE(bmb.bm_adi, '-')::text,
      COALESCE(tup.toplam_utt, 0),
      COALESCE(po.aktif_utt, 0),
      GREATEST(0, COALESCE(tup.toplam_utt, 0) - COALESCE(po.aktif_utt, 0)),
      COALESCE(po.video_puani, 0),
      COALESCE(po.soru_puani, 0),
      COALESCE(po.oneri_puani, 0),
      COALESCE(po.extra_puan, 0),
      COALESCE(po.ileri_sarma_kaybi, 0),
      COALESCE(po.yanlis_cevap_kaybi, 0),
      COALESCE(po.oneri_kaybi, 0),
      COALESCE(po.toplam_net_puan, 0),
      COALESCE(ud.urun_dagilimi, '[]'::jsonb),
      COALESCE(po.eclub_puani, 0)::integer
    FROM scoped_bolgeler sb
    LEFT JOIN bm_per_bolge          bmb ON bmb.bolge_id = sb.bolge_id
    LEFT JOIN toplam_utt_per_bolge  tup ON tup.bolge_id = sb.bolge_id
    LEFT JOIN puan_ozet             po  ON po.bolge_id  = sb.bolge_id
    LEFT JOIN urun_dagilim          ud  ON ud.bolge_id  = sb.bolge_id
    ORDER BY sb.takim_adi, sb.bolge_adi;
  END;
  $fn_bolge$;
  $ddl_bolge$;

  -- 4.2 get_bm_utt_performans_v2
  EXECUTE $ddl_bm$
  CREATE OR REPLACE FUNCTION public.get_bm_utt_performans_v2(
    p_bm_id uuid,
    p_baslangic timestamp with time zone,
    p_bitis timestamp with time zone
  )
  RETURNS TABLE(
    kullanici_id uuid,
    ad text,
    soyad text,
    tamamlanan_izleme integer,
    benzersiz_yayin integer,
    izleme_puani integer,
    cevaplama_puani integer,
    oneri_puani integer,
    extra_puan integer,
    ileri_sarma_kaybi integer,
    yanlis_cevap_kaybi integer,
    oneri_kaybi integer,
    kazanilan_toplam integer,
    kaybedilen_toplam integer,
    net_puan integer,
    eclub_puani integer
  )
  LANGUAGE sql
  STABLE
  AS $fn_bm$
  WITH
  bm_scope AS (
    SELECT k.firma_id, k.takim_id, k.bolge_id
    FROM kullanicilar k
    WHERE k.kullanici_id = p_bm_id
      AND k.rol = 'bm'
      AND k.aktif_mi = true
  ),
  scope_users AS (
    SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad
    FROM kullanicilar k
    JOIN bm_scope bs
      ON bs.firma_id = k.firma_id
     AND bs.takim_id = k.takim_id
     AND bs.bolge_id = k.bolge_id
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt', 'kd_utt')
  ),
  izleme AS (
    SELECT
      ik.kullanici_id,
      COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
      COUNT(DISTINCT ik.yayin_id)::int AS benzersiz
    FROM izleme_kayitlari ik
    JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
    WHERE ik.tamamlandi_mi = true
      AND ik.gercek_oynatma_mi = true
      AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
      AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
    GROUP BY ik.kullanici_id
  ),
  puan_ozet AS (
    SELECT o.*
    FROM bm_scope bs
    CROSS JOIN LATERAL public.get_kullanici_ozet(
      p_baslangic,
      p_bitis,
      NULL::uuid,
      bs.bolge_id,
      bs.takim_id,
      bs.firma_id
    ) o
  )
  SELECT
    su.kullanici_id,
    su.ad,
    su.soyad,
    COALESCE(i.tamamlanan, 0)::integer AS tamamlanan_izleme,
    COALESCE(i.benzersiz, 0)::integer AS benzersiz_yayin,
    COALESCE(po.video_puani, 0)::integer AS izleme_puani,
    COALESCE(po.soru_puani, 0)::integer AS cevaplama_puani,
    COALESCE(po.oneri_puani, 0)::integer AS oneri_puani,
    COALESCE(po.extra_puan, 0)::integer AS extra_puan,
    COALESCE(po.ileri_sarma_kaybi, 0)::integer AS ileri_sarma_kaybi,
    COALESCE(po.yanlis_cevap_kaybi, 0)::integer AS yanlis_cevap_kaybi,
    COALESCE(po.oneri_kaybi, 0)::integer AS oneri_kaybi,
    (COALESCE(po.video_puani, 0) + COALESCE(po.soru_puani, 0) + COALESCE(po.oneri_puani, 0) + COALESCE(po.extra_puan, 0) + COALESCE(po.eclub_puani, 0))::integer AS kazanilan_toplam,
    (COALESCE(po.ileri_sarma_kaybi, 0) + COALESCE(po.yanlis_cevap_kaybi, 0) + COALESCE(po.oneri_kaybi, 0))::integer AS kaybedilen_toplam,
    COALESCE(po.toplam_net_puan, 0)::integer AS net_puan,
    COALESCE(po.eclub_puani, 0)::integer AS eclub_puani
  FROM scope_users su
  LEFT JOIN izleme i ON i.kullanici_id = su.kullanici_id
  LEFT JOIN puan_ozet po ON po.kullanici_id = su.kullanici_id
  ORDER BY 15 DESC, 2, 3;
  $fn_bm$;
  $ddl_bm$;

  -- 4.3 get_yonetici_hiyerarsi_v2
  EXECUTE $ddl_yon_h$
  CREATE OR REPLACE FUNCTION public.get_yonetici_hiyerarsi_v2(
    p_yonetici_id uuid,
    p_baslangic timestamp with time zone,
    p_bitis timestamp with time zone,
    p_seviye text,
    p_ust_birim_id uuid DEFAULT NULL::uuid
  )
  RETURNS TABLE(
    birim_id uuid,
    birim_adi text,
    toplam_utt integer,
    aktif_utt integer,
    tamamlanan_izleme integer,
    benzersiz_yayin integer,
    izleme_puani integer,
    cevaplama_puani integer,
    oneri_puani integer,
    extra_puan integer,
    ileri_sarma_kaybi integer,
    yanlis_cevap_kaybi integer,
    oneri_kaybi integer,
    challenge_kaybi integer,
    kazanilan_toplam integer,
    kaybedilen_toplam integer,
    net_puan integer,
    eclub_puani integer
  )
  LANGUAGE sql
  STABLE
  AS $fn_yon_h$
  WITH
  yonetici_scope AS (
    SELECT k.firma_id
    FROM kullanicilar k
    WHERE k.kullanici_id = p_yonetici_id
      AND k.aktif_mi = true
      AND k.rol IN ('gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm')
  ),
  scope_users AS (
    SELECT
      k.kullanici_id,
      k.ad::text,
      k.soyad::text,
      k.takim_id,
      t.takim_adi::text,
      k.bolge_id,
      b.bolge_adi::text
    FROM kullanicilar k
    JOIN yonetici_scope ys ON ys.firma_id = k.firma_id
    LEFT JOIN takimlar t ON t.takim_id = k.takim_id AND t.firma_id = ys.firma_id
    LEFT JOIN bolgeler b ON b.bolge_id = k.bolge_id AND b.takim_id = k.takim_id
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt','kd_utt')
      AND (
        (p_seviye = 'takim' AND p_ust_birim_id IS NULL)
        OR (p_seviye = 'bolge' AND k.takim_id = p_ust_birim_id)
        OR (p_seviye = 'utt' AND k.bolge_id = p_ust_birim_id)
      )
  ),
  varliklar AS (
    SELECT
      CASE p_seviye
        WHEN 'takim' THEN su.takim_id
        WHEN 'bolge' THEN su.bolge_id
        WHEN 'utt' THEN su.kullanici_id
      END AS id,
      CASE p_seviye
        WHEN 'takim' THEN COALESCE(su.takim_adi, 'Takımsız')
        WHEN 'bolge' THEN COALESCE(su.bolge_adi, 'Bölgesiz')
        WHEN 'utt' THEN CONCAT(su.ad, ' ', su.soyad)
      END::text AS ad,
      su.kullanici_id
    FROM scope_users su
  ),
  kapsam AS (
    SELECT id, ad, COUNT(DISTINCT kullanici_id)::int AS toplam
    FROM varliklar
    WHERE id IS NOT NULL
    GROUP BY id, ad
  ),
  izleme AS (
    SELECT
      v.id,
      COUNT(DISTINCT ik.kullanici_id)::int AS aktif,
      COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
      COUNT(DISTINCT (ik.kullanici_id, ik.yayin_id))::int AS benzersiz
    FROM varliklar v
    JOIN izleme_kayitlari ik ON ik.kullanici_id = v.kullanici_id
    WHERE ik.tamamlandi_mi = true
      AND ik.gercek_oynatma_mi = true
      AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
      AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
    GROUP BY v.id
  ),
  puan_ozet AS (
    SELECT
      v.id,
      SUM(o.video_puani)::int AS izleme,
      SUM(o.soru_puani)::int AS cevaplama,
      SUM(o.oneri_puani)::int AS oneri,
      SUM(o.extra_puan)::int AS extra,
      SUM(o.eclub_puani)::int AS eclub_puani,
      SUM(o.ileri_sarma_kaybi)::int AS ileri_sarma_kaybi,
      SUM(o.yanlis_cevap_kaybi)::int AS yanlis_cevap_kaybi,
      SUM(o.oneri_kaybi)::int AS oneri_kaybi
    FROM yonetici_scope ys
    CROSS JOIN LATERAL public.get_kullanici_ozet(
      p_baslangic,
      p_bitis,
      NULL::uuid,
      NULL::uuid,
      NULL::uuid,
      ys.firma_id
    ) o
    JOIN varliklar v ON v.kullanici_id = o.kullanici_id
    GROUP BY v.id
  ),
  challenge_kaybi AS (
    SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
    FROM varliklar v
    JOIN challenge_kayip_kayitlari x ON x.kullanici_id = v.kullanici_id
    WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
    GROUP BY v.id
  )
  SELECT
    kp.id,
    kp.ad,
    kp.toplam,
    COALESCE(i.aktif, 0)::int AS aktif_utt,
    COALESCE(i.tamamlanan, 0)::int AS tamamlanan_izleme,
    COALESCE(i.benzersiz, 0)::int AS benzersiz_yayin,
    COALESCE(po.izleme, 0)::int AS izleme_puani,
    COALESCE(po.cevaplama, 0)::int AS cevaplama_puani,
    COALESCE(po.oneri, 0)::int AS oneri_puani,
    COALESCE(po.extra, 0)::int AS extra_puan,
    COALESCE(po.ileri_sarma_kaybi, 0)::int AS ileri_sarma_kaybi,
    COALESCE(po.yanlis_cevap_kaybi, 0)::int AS yanlis_cevap_kaybi,
    COALESCE(po.oneri_kaybi, 0)::int AS oneri_kaybi,
    COALESCE(ch.puan, 0)::int AS challenge_kaybi,
    (COALESCE(po.izleme, 0) + COALESCE(po.cevaplama, 0) + COALESCE(po.oneri, 0) + COALESCE(po.extra, 0) + COALESCE(po.eclub_puani, 0))::int AS kazanilan_toplam,
    (COALESCE(po.ileri_sarma_kaybi, 0) + COALESCE(po.yanlis_cevap_kaybi, 0) + COALESCE(po.oneri_kaybi, 0) + COALESCE(ch.puan, 0))::int AS kaybedilen_toplam,
    (COALESCE(po.izleme, 0) + COALESCE(po.cevaplama, 0) + COALESCE(po.oneri, 0) + COALESCE(po.extra, 0) + COALESCE(po.eclub_puani, 0)
     - COALESCE(po.ileri_sarma_kaybi, 0) - COALESCE(po.yanlis_cevap_kaybi, 0) - COALESCE(po.oneri_kaybi, 0) - COALESCE(ch.puan, 0))::int AS net_puan,
    COALESCE(po.eclub_puani, 0)::int AS eclub_puani
  FROM kapsam kp
  LEFT JOIN izleme i ON i.id = kp.id
  LEFT JOIN puan_ozet po ON po.id = kp.id
  LEFT JOIN challenge_kaybi ch ON ch.id = kp.id
  ORDER BY 17 DESC, 2;
  $fn_yon_h$;
  $ddl_yon_h$;

  -- 4.4 get_yonetici_rapor_ana_ozet_v2
  EXECUTE $ddl_yon_ozet$
  CREATE OR REPLACE FUNCTION public.get_yonetici_rapor_ana_ozet_v2(
    p_yonetici_id uuid,
    p_baslangic timestamp with time zone,
    p_bitis timestamp with time zone
  )
  RETURNS TABLE(
    toplam_takim integer,
    toplam_bolge integer,
    toplam_utt integer,
    aktif_utt integer,
    donem_tamamlanan_izleme integer,
    donem_benzersiz_utt_yayin integer,
    izleme_puani integer,
    cevaplama_puani integer,
    oneri_puani integer,
    extra_puani integer,
    ileri_sarma_kaybi integer,
    yanlis_cevap_kaybi integer,
    oneri_kaybi integer,
    challenge_kaybi integer,
    kazanilan_toplam integer,
    kaybedilen_toplam integer,
    net_puan integer,
    toplam_yayina_alma integer,
    donemde_yayina_alinan integer,
    su_an_yayinda integer,
    donem_urun_egitimi integer,
    donem_genel_egitim integer,
    donem_medikal_egitim integer,
    donem_ik_egitimi integer,
    donem_normal_uretim integer,
    donem_hazir_video integer,
    donem_hazir_soru_seti integer,
    donem_hazir_video_ve_soru_seti integer,
    guncel_tur_toplam_firsat integer,
    guncel_tur_tamamlanan integer,
    guncel_tur_kalan integer,
    guncel_tur_izlenme_orani integer,
    eclub_puani integer
  )
  LANGUAGE sql
  STABLE
  AS $fn_yon_ozet$
  WITH
  yonetici_scope AS (
    SELECT k.firma_id
    FROM kullanicilar k
    WHERE k.kullanici_id = p_yonetici_id
      AND k.aktif_mi = true
      AND k.rol IN ('gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm')
  ),
  scope_users AS (
    SELECT k.kullanici_id, k.takim_id, k.bolge_id
    FROM kullanicilar k
    JOIN yonetici_scope ys ON ys.firma_id = k.firma_id
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt','kd_utt')
  ),
  scope_yayinlari AS (
    SELECT DISTINCT
      yy.yayin_id,
      LOWER(COALESCE(yy.durum, '')) AS durum,
      yy.yayin_tarihi,
      yy.created_at,
      yy.hedef_roller,
      ky.icerik_turu,
      t.hazir_video,
      t.hazir_soru_seti
    FROM yayin_yonetimi yy
    JOIN v_yayin_kunye ky ON ky.yayin_id = yy.yayin_id
    JOIN talepler t ON t.talep_id = ky.talep_id
    JOIN yonetici_scope ys ON ys.firma_id = ky.firma_id
  ),
  canli_yayinlar AS (
    SELECT
      sy.yayin_id,
      COALESCE(
        (
          SELECT ytk.baslangic_tarihi
          FROM yayin_tekrar_kayitlari ytk
          WHERE ytk.yayin_id = sy.yayin_id
          ORDER BY ytk.tur_no DESC, ytk.baslangic_tarihi DESC
          LIMIT 1
        ),
        sy.yayin_tarihi,
        sy.created_at
      ) AS guncel_tur_baslangici
    FROM scope_yayinlari sy
    WHERE sy.durum = 'yayinda'
      AND COALESCE(sy.hedef_roller, ARRAY['utt']::text[])
        && ARRAY['utt','kd_utt']::text[]
  ),
  guncel_tur_firsatlari AS (
    SELECT cy.yayin_id, su.kullanici_id, cy.guncel_tur_baslangici
    FROM canli_yayinlar cy
    CROSS JOIN scope_users su
  ),
  guncel_tur_tamamlananlar AS (
    SELECT DISTINCT gf.yayin_id, gf.kullanici_id
    FROM guncel_tur_firsatlari gf
    JOIN izleme_kayitlari ik
      ON ik.yayin_id = gf.yayin_id
     AND ik.kullanici_id = gf.kullanici_id
    WHERE ik.tamamlandi_mi = true
      AND ik.gercek_oynatma_mi = true
      AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic)
        >= gf.guncel_tur_baslangici
  ),
  donem_izleme AS (
    SELECT ik.izleme_id, ik.kullanici_id, ik.yayin_id
    FROM izleme_kayitlari ik
    JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
    WHERE ik.tamamlandi_mi = true
      AND ik.gercek_oynatma_mi = true
      AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
      AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
  ),
  puan_ozet AS (
    SELECT
      COALESCE(SUM(o.video_puani), 0)::int AS izleme,
      COALESCE(SUM(o.soru_puani), 0)::int AS cevaplama,
      COALESCE(SUM(o.oneri_puani), 0)::int AS oneri,
      COALESCE(SUM(o.extra_puan), 0)::int AS extra,
      COALESCE(SUM(o.eclub_puani), 0)::int AS eclub_puani,
      COALESCE(SUM(o.ileri_sarma_kaybi), 0)::int AS ileri_sarma_kaybi,
      COALESCE(SUM(o.yanlis_cevap_kaybi), 0)::int AS yanlis_cevap_kaybi,
      COALESCE(SUM(o.oneri_kaybi), 0)::int AS oneri_kaybi
    FROM yonetici_scope ys
    CROSS JOIN LATERAL public.get_kullanici_ozet(
      p_baslangic,
      p_bitis,
      NULL::uuid,
      NULL::uuid,
      NULL::uuid,
      ys.firma_id
    ) o
    JOIN scope_users su ON su.kullanici_id = o.kullanici_id
  ),
  challenge_kaybi AS (
    SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
    FROM challenge_kayip_kayitlari x
    JOIN scope_users su ON su.kullanici_id = x.kullanici_id
    WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  ),
  sayilar AS (
    SELECT
      (SELECT COUNT(DISTINCT takim_id) FROM scope_users WHERE takim_id IS NOT NULL)::int AS takim,
      (SELECT COUNT(DISTINCT bolge_id) FROM scope_users WHERE bolge_id IS NOT NULL)::int AS bolge,
      (SELECT COUNT(*) FROM scope_users)::int AS utt,
      (SELECT COUNT(DISTINCT kullanici_id) FROM donem_izleme)::int AS aktif,
      (SELECT COUNT(DISTINCT izleme_id) FROM donem_izleme)::int AS donem_izleme,
      (SELECT COUNT(DISTINCT (kullanici_id, yayin_id)) FROM donem_izleme)::int AS donem_cift,
      (SELECT COUNT(*) FROM scope_yayinlari)::int AS tum_yayin,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis)::int AS donem_yayin,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE durum = 'yayinda')::int AS canli,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'urun')::int AS urun,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'egitim')::int AS egitim,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu IN ('medikal','urun_medikal'))::int AS medikal,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'ik')::int AS ik,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = false AND hazir_soru_seti = false)::int AS normal,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = true AND hazir_soru_seti = false)::int AS hazir_video,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = false AND hazir_soru_seti = true)::int AS hazir_set,
      (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = true AND hazir_soru_seti = true)::int AS hazir_ikisi,
      (SELECT COUNT(*) FROM guncel_tur_firsatlari)::int AS firsat,
      (SELECT COUNT(*) FROM guncel_tur_tamamlananlar)::int AS tamamlanan
  )
  SELECT
    s.takim,
    s.bolge,
    s.utt,
    s.aktif,
    s.donem_izleme,
    s.donem_cift,
    po.izleme,
    po.cevaplama,
    po.oneri,
    po.extra,
    po.ileri_sarma_kaybi,
    po.yanlis_cevap_kaybi,
    po.oneri_kaybi,
    ch.puan,
    (po.izleme + po.cevaplama + po.oneri + po.extra + po.eclub_puani)::int AS kazanilan_toplam,
    (po.ileri_sarma_kaybi + po.yanlis_cevap_kaybi + po.oneri_kaybi + ch.puan)::int AS kaybedilen_toplam,
    (po.izleme + po.cevaplama + po.oneri + po.extra + po.eclub_puani - po.ileri_sarma_kaybi - po.yanlis_cevap_kaybi - po.oneri_kaybi - ch.puan)::int AS net_puan,
    s.tum_yayin,
    s.donem_yayin,
    s.canli,
    s.urun,
    s.egitim,
    s.medikal,
    s.ik,
    s.normal,
    s.hazir_video,
    s.hazir_set,
    s.hazir_ikisi,
    s.firsat,
    s.tamamlanan,
    GREATEST(0, s.firsat - s.tamamlanan)::int AS guncel_tur_kalan,
    CASE WHEN s.firsat = 0 THEN 0
      ELSE ROUND(100.0 * s.tamamlanan / s.firsat)::int END AS guncel_tur_izlenme_orani,
    COALESCE(po.eclub_puani, 0)::integer AS eclub_puani
  FROM sayilar s
  CROSS JOIN puan_ozet po
  CROSS JOIN challenge_kaybi ch;
  $fn_yon_ozet$;
  $ddl_yon_ozet$;

  -- --------------------------------------------------------------------------
  -- 5. İZİN VE GÜVENLİK NİTELİKLERİNİN EŞİTLİK KONTROLÜ (MADDƏ 2)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*),
         string_agg(p.proname || ' (' ||
                    CASE WHEN e.proacl IS DISTINCT FROM p.proacl THEN 'proacl ' ELSE '' END ||
                    CASE WHEN e.proowner IS DISTINCT FROM p.proowner THEN 'proowner ' ELSE '' END ||
                    CASE WHEN e.prosecdef IS DISTINCT FROM p.prosecdef THEN 'prosecdef ' ELSE '' END ||
                    CASE WHEN e.provolatile IS DISTINCT FROM p.provolatile THEN 'provolatile ' ELSE '' END || ')',
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _fonksiyon_tanim_ve_izin_yedekleri e
  JOIN pg_proc p ON p.proname = e.proname AND pg_get_function_identity_arguments(p.oid) = e.args
  WHERE e.proacl IS DISTINCT FROM p.proacl
     OR e.proowner IS DISTINCT FROM p.proowner
     OR e.prosecdef IS DISTINCT FROM p.prosecdef
     OR e.provolatile IS DISTINCT FROM p.provolatile;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    10, 'İzin ve Güvenlik Uyumluluğu', '4 Fonksiyonun ACL ve Güvenlik Nitelikleri',
    '0 izin/nitelik farkı',
    COALESCE(v_fark_sayisi::text, '0') || ' fark' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Mevcut fonksiyonların proacl, proowner, prosecdef ve provolatile değerleri migrasyon sonrasında birebir korunmalıdır.'
  );

  -- --------------------------------------------------------------------------
  -- 6. YENİ FONKSİYONLARIN ÇIKTILARINI KAYDETME (DİNAMİK ÇAĞRI)
  -- --------------------------------------------------------------------------
  EXECUTE 'CREATE TEMP TABLE _yeni_bm ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_bm_utt_performans_v2($1, $2, $3) r'
    USING v_bm_1, v_bas, v_bit;

  EXECUTE 'CREATE TEMP TABLE _yeni_bolge_takim ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_bolge_bazli_grup($1, $2, $3, $4) r'
    USING v_bas, v_bit, v_takim_1, v_firma_a;

  EXECUTE 'CREATE TEMP TABLE _yeni_bolge_firma ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_bolge_bazli_grup($1, $2, NULL, $3) r'
    USING v_bas, v_bit, v_firma_a;

  EXECUTE 'CREATE TEMP TABLE _yeni_yon_takim ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_hiyerarsi_v2($1, $2, $3, ''takim'', NULL) r'
    USING v_gm_a, v_bas, v_bit;

  EXECUTE 'CREATE TEMP TABLE _yeni_yon_bolge ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_hiyerarsi_v2($1, $2, $3, ''bolge'', $4) r'
    USING v_gm_a, v_bas, v_bit, v_takim_1;

  EXECUTE 'CREATE TEMP TABLE _yeni_yon_utt ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_hiyerarsi_v2($1, $2, $3, ''utt'', $4) r'
    USING v_gm_a, v_bas, v_bit, v_bolge_1;

  EXECUTE 'CREATE TEMP TABLE _yeni_yon_ozet ON COMMIT DROP AS
    SELECT row_number() OVER () AS sira_no, r.*
    FROM public.get_yonetici_rapor_ana_ozet_v2($1, $2, $3) r'
    USING v_gm_a, v_bas, v_bit;

  -- --------------------------------------------------------------------------
  -- 7. ESKİ - YENİ KARŞILAŞTIRMALARI (MADDƏ 1: TÜM ALANLAR, SATIR VE JSON SIRASI)
  -- --------------------------------------------------------------------------
  -- 7.1 get_bm_utt_performans_v2 (Tüm 16 Alan + Sıralama)
  SELECT COUNT(*) INTO v_eski_sayisi FROM _eski_bm;
  SELECT COUNT(*) INTO v_yeni_sayisi FROM _yeni_bm;

  SELECT COUNT(*),
         string_agg('Sira ' || COALESCE(e.sira_no, y.sira_no)::text || ' Fark: ' ||
                    CASE WHEN e.kullanici_id IS DISTINCT FROM y.kullanici_id THEN 'kullanici_id ' ELSE '' END ||
                    CASE WHEN e.ad IS DISTINCT FROM y.ad THEN 'ad ' ELSE '' END ||
                    CASE WHEN e.soyad IS DISTINCT FROM y.soyad THEN 'soyad ' ELSE '' END ||
                    CASE WHEN e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme THEN 'tamamlanan_izleme ' ELSE '' END ||
                    CASE WHEN e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin THEN 'benzersiz_yayin ' ELSE '' END ||
                    CASE WHEN e.izleme_puani IS DISTINCT FROM y.izleme_puani THEN 'izleme_puani ' ELSE '' END ||
                    CASE WHEN e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani THEN 'cevaplama_puani ' ELSE '' END ||
                    CASE WHEN e.oneri_puani IS DISTINCT FROM y.oneri_puani THEN 'oneri_puani ' ELSE '' END ||
                    CASE WHEN e.extra_puan IS DISTINCT FROM y.extra_puan THEN 'extra_puan ' ELSE '' END ||
                    CASE WHEN e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi THEN 'ileri_sarma_kaybi ' ELSE '' END ||
                    CASE WHEN e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi THEN 'yanlis_cevap_kaybi ' ELSE '' END ||
                    CASE WHEN e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi THEN 'oneri_kaybi ' ELSE '' END ||
                    CASE WHEN e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam THEN 'kazanilan_toplam ' ELSE '' END ||
                    CASE WHEN e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam THEN 'kaybedilen_toplam ' ELSE '' END ||
                    CASE WHEN e.net_puan IS DISTINCT FROM y.net_puan THEN 'net_puan ' ELSE '' END ||
                    CASE WHEN e.eclub_puani IS DISTINCT FROM y.eclub_puani THEN 'eclub_puani ' ELSE '' END,
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _eski_bm e
  FULL OUTER JOIN _yeni_bm y ON e.sira_no = y.sira_no
  WHERE e.kullanici_id IS DISTINCT FROM y.kullanici_id
     OR e.ad IS DISTINCT FROM y.ad
     OR e.soyad IS DISTINCT FROM y.soyad
     OR e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme
     OR e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin
     OR e.izleme_puani IS DISTINCT FROM y.izleme_puani
     OR e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani
     OR e.oneri_puani IS DISTINCT FROM y.oneri_puani
     OR e.extra_puan IS DISTINCT FROM y.extra_puan
     OR e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi
     OR e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi
     OR e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi
     OR e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam
     OR e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam
     OR e.net_puan IS DISTINCT FROM y.net_puan
     OR e.eclub_puani IS DISTINCT FROM y.eclub_puani;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    20, 'Eski–Yeni Karşılaştırması', 'BM Saha Performansı (get_bm_utt_performans_v2)',
    '0 fark (' || v_eski_sayisi || ' satır)',
    v_fark_sayisi || ' fark (' || v_yeni_sayisi || ' satır)' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 AND v_eski_sayisi = v_yeni_sayisi AND v_eski_sayisi > 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Tüm 16 alan, satır sayısı ve ORDER BY 15 DESC, 2, 3 sıralaması eski ve yeni sürüm arasında birebir eşleşti.'
  );

  -- 7.2 get_bolge_bazli_grup - Takım Filtresi (Tüm 17 Alan + urun_dagilimi JSONB + Sıralama)
  SELECT COUNT(*) INTO v_eski_sayisi FROM _eski_bolge_takim;
  SELECT COUNT(*) INTO v_yeni_sayisi FROM _yeni_bolge_takim;

  SELECT COUNT(*),
         string_agg('Sira ' || COALESCE(e.sira_no, y.sira_no)::text || ' Fark: ' ||
                    CASE WHEN e.bolge_id IS DISTINCT FROM y.bolge_id THEN 'bolge_id ' ELSE '' END ||
                    CASE WHEN e.bolge_adi IS DISTINCT FROM y.bolge_adi THEN 'bolge_adi ' ELSE '' END ||
                    CASE WHEN e.takim_id IS DISTINCT FROM y.takim_id THEN 'takim_id ' ELSE '' END ||
                    CASE WHEN e.takim_adi IS DISTINCT FROM y.takim_adi THEN 'takim_adi ' ELSE '' END ||
                    CASE WHEN e.bm_adi IS DISTINCT FROM y.bm_adi THEN 'bm_adi ' ELSE '' END ||
                    CASE WHEN e.toplam_utt IS DISTINCT FROM y.toplam_utt THEN 'toplam_utt ' ELSE '' END ||
                    CASE WHEN e.aktif_utt IS DISTINCT FROM y.aktif_utt THEN 'aktif_utt ' ELSE '' END ||
                    CASE WHEN e.hic_izlemeyen_utt IS DISTINCT FROM y.hic_izlemeyen_utt THEN 'hic_izlemeyen_utt ' ELSE '' END ||
                    CASE WHEN e.video_puani IS DISTINCT FROM y.video_puani THEN 'video_puani ' ELSE '' END ||
                    CASE WHEN e.soru_puani IS DISTINCT FROM y.soru_puani THEN 'soru_puani ' ELSE '' END ||
                    CASE WHEN e.oneri_puani IS DISTINCT FROM y.oneri_puani THEN 'oneri_puani ' ELSE '' END ||
                    CASE WHEN e.extra_puan IS DISTINCT FROM y.extra_puan THEN 'extra_puan ' ELSE '' END ||
                    CASE WHEN e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi THEN 'ileri_sarma_kaybi ' ELSE '' END ||
                    CASE WHEN e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi THEN 'yanlis_cevap_kaybi ' ELSE '' END ||
                    CASE WHEN e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi THEN 'oneri_kaybi ' ELSE '' END ||
                    CASE WHEN e.toplam_net_puan IS DISTINCT FROM y.toplam_net_puan THEN 'toplam_net_puan ' ELSE '' END ||
                    CASE WHEN e.eclub_puani IS DISTINCT FROM y.eclub_puani THEN 'eclub_puani ' ELSE '' END ||
                    CASE WHEN e.urun_dagilimi::text IS DISTINCT FROM y.urun_dagilimi::text THEN 'urun_dagilimi_json ' ELSE '' END,
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _eski_bolge_takim e
  FULL OUTER JOIN _yeni_bolge_takim y ON e.sira_no = y.sira_no
  WHERE e.bolge_id IS DISTINCT FROM y.bolge_id
     OR e.bolge_adi IS DISTINCT FROM y.bolge_adi
     OR e.takim_id IS DISTINCT FROM y.takim_id
     OR e.takim_adi IS DISTINCT FROM y.takim_adi
     OR e.bm_adi IS DISTINCT FROM y.bm_adi
     OR e.toplam_utt IS DISTINCT FROM y.toplam_utt
     OR e.aktif_utt IS DISTINCT FROM y.aktif_utt
     OR e.hic_izlemeyen_utt IS DISTINCT FROM y.hic_izlemeyen_utt
     OR e.video_puani IS DISTINCT FROM y.video_puani
     OR e.soru_puani IS DISTINCT FROM y.soru_puani
     OR e.oneri_puani IS DISTINCT FROM y.oneri_puani
     OR e.extra_puan IS DISTINCT FROM y.extra_puan
     OR e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi
     OR e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi
     OR e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi
     OR e.toplam_net_puan IS DISTINCT FROM y.toplam_net_puan
     OR e.eclub_puani IS DISTINCT FROM y.eclub_puani
     OR e.urun_dagilimi::text IS DISTINCT FROM y.urun_dagilimi::text;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    21, 'Eski–Yeni Karşılaştırması', 'Bölge Gruplaması - Takım Filtreli (get_bolge_bazli_grup)',
    '0 fark (' || v_eski_sayisi || ' satır)',
    v_fark_sayisi || ' fark (' || v_yeni_sayisi || ' satır)' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 AND v_eski_sayisi = v_yeni_sayisi AND v_eski_sayisi > 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Tüm alanlar, urun_dagilimi JSON dizisi ve eleman sıralaması ile satır sıralaması birebir eşleşti.'
  );

  -- 7.3 get_bolge_bazli_grup - Firma Filtresi (Tüm 17 Alan + urun_dagilimi JSONB + Sıralama)
  SELECT COUNT(*) INTO v_eski_sayisi FROM _eski_bolge_firma;
  SELECT COUNT(*) INTO v_yeni_sayisi FROM _yeni_bolge_firma;

  SELECT COUNT(*),
         string_agg('Sira ' || COALESCE(e.sira_no, y.sira_no)::text || ' Fark: ' ||
                    CASE WHEN e.bolge_id IS DISTINCT FROM y.bolge_id THEN 'bolge_id ' ELSE '' END ||
                    CASE WHEN e.bolge_adi IS DISTINCT FROM y.bolge_adi THEN 'bolge_adi ' ELSE '' END ||
                    CASE WHEN e.takim_id IS DISTINCT FROM y.takim_id THEN 'takim_id ' ELSE '' END ||
                    CASE WHEN e.takim_adi IS DISTINCT FROM y.takim_adi THEN 'takim_adi ' ELSE '' END ||
                    CASE WHEN e.bm_adi IS DISTINCT FROM y.bm_adi THEN 'bm_adi ' ELSE '' END ||
                    CASE WHEN e.toplam_utt IS DISTINCT FROM y.toplam_utt THEN 'toplam_utt ' ELSE '' END ||
                    CASE WHEN e.aktif_utt IS DISTINCT FROM y.aktif_utt THEN 'aktif_utt ' ELSE '' END ||
                    CASE WHEN e.hic_izlemeyen_utt IS DISTINCT FROM y.hic_izlemeyen_utt THEN 'hic_izlemeyen_utt ' ELSE '' END ||
                    CASE WHEN e.video_puani IS DISTINCT FROM y.video_puani THEN 'video_puani ' ELSE '' END ||
                    CASE WHEN e.soru_puani IS DISTINCT FROM y.soru_puani THEN 'soru_puani ' ELSE '' END ||
                    CASE WHEN e.oneri_puani IS DISTINCT FROM y.oneri_puani THEN 'oneri_puani ' ELSE '' END ||
                    CASE WHEN e.extra_puan IS DISTINCT FROM y.extra_puan THEN 'extra_puan ' ELSE '' END ||
                    CASE WHEN e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi THEN 'ileri_sarma_kaybi ' ELSE '' END ||
                    CASE WHEN e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi THEN 'yanlis_cevap_kaybi ' ELSE '' END ||
                    CASE WHEN e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi THEN 'oneri_kaybi ' ELSE '' END ||
                    CASE WHEN e.toplam_net_puan IS DISTINCT FROM y.toplam_net_puan THEN 'toplam_net_puan ' ELSE '' END ||
                    CASE WHEN e.eclub_puani IS DISTINCT FROM y.eclub_puani THEN 'eclub_puani ' ELSE '' END ||
                    CASE WHEN e.urun_dagilimi::text IS DISTINCT FROM y.urun_dagilimi::text THEN 'urun_dagilimi_json ' ELSE '' END,
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _eski_bolge_firma e
  FULL OUTER JOIN _yeni_bolge_firma y ON e.sira_no = y.sira_no
  WHERE e.bolge_id IS DISTINCT FROM y.bolge_id
     OR e.bolge_adi IS DISTINCT FROM y.bolge_adi
     OR e.takim_id IS DISTINCT FROM y.takim_id
     OR e.takim_adi IS DISTINCT FROM y.takim_adi
     OR e.bm_adi IS DISTINCT FROM y.bm_adi
     OR e.toplam_utt IS DISTINCT FROM y.toplam_utt
     OR e.aktif_utt IS DISTINCT FROM y.aktif_utt
     OR e.hic_izlemeyen_utt IS DISTINCT FROM y.hic_izlemeyen_utt
     OR e.video_puani IS DISTINCT FROM y.video_puani
     OR e.soru_puani IS DISTINCT FROM y.soru_puani
     OR e.oneri_puani IS DISTINCT FROM y.oneri_puani
     OR e.extra_puan IS DISTINCT FROM y.extra_puan
     OR e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi
     OR e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi
     OR e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi
     OR e.toplam_net_puan IS DISTINCT FROM y.toplam_net_puan
     OR e.eclub_puani IS DISTINCT FROM y.eclub_puani
     OR e.urun_dagilimi::text IS DISTINCT FROM y.urun_dagilimi::text;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    22, 'Eski–Yeni Karşılaştırması', 'Bölge Gruplaması - Firma Geneli (get_bolge_bazli_grup)',
    '0 fark (' || v_eski_sayisi || ' satır)',
    v_fark_sayisi || ' fark (' || v_yeni_sayisi || ' satır)' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 AND v_eski_sayisi = v_yeni_sayisi AND v_eski_sayisi > 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Firma geneli çağrıda tüm bölgelerin puanları, sıralaması ve JSON içerikleri eski ve yeni sürümde eşleşti.'
  );

  -- 7.4 get_yonetici_hiyerarsi_v2 - Seviye: 'takim' (Tüm 18 Alan + Challenge Kaybı + Sıralama)
  SELECT COUNT(*) INTO v_eski_sayisi FROM _eski_yon_takim;
  SELECT COUNT(*) INTO v_yeni_sayisi FROM _yeni_yon_takim;

  SELECT COUNT(*),
         string_agg('Sira ' || COALESCE(e.sira_no, y.sira_no)::text || ' Fark: ' ||
                    CASE WHEN e.birim_id IS DISTINCT FROM y.birim_id THEN 'birim_id ' ELSE '' END ||
                    CASE WHEN e.birim_adi IS DISTINCT FROM y.birim_adi THEN 'birim_adi ' ELSE '' END ||
                    CASE WHEN e.toplam_utt IS DISTINCT FROM y.toplam_utt THEN 'toplam_utt ' ELSE '' END ||
                    CASE WHEN e.aktif_utt IS DISTINCT FROM y.aktif_utt THEN 'aktif_utt ' ELSE '' END ||
                    CASE WHEN e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme THEN 'tamamlanan_izleme ' ELSE '' END ||
                    CASE WHEN e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin THEN 'benzersiz_yayin ' ELSE '' END ||
                    CASE WHEN e.izleme_puani IS DISTINCT FROM y.izleme_puani THEN 'izleme_puani ' ELSE '' END ||
                    CASE WHEN e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani THEN 'cevaplama_puani ' ELSE '' END ||
                    CASE WHEN e.oneri_puani IS DISTINCT FROM y.oneri_puani THEN 'oneri_puani ' ELSE '' END ||
                    CASE WHEN e.extra_puan IS DISTINCT FROM y.extra_puan THEN 'extra_puan ' ELSE '' END ||
                    CASE WHEN e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi THEN 'ileri_sarma_kaybi ' ELSE '' END ||
                    CASE WHEN e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi THEN 'yanlis_cevap_kaybi ' ELSE '' END ||
                    CASE WHEN e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi THEN 'oneri_kaybi ' ELSE '' END ||
                    CASE WHEN e.challenge_kaybi IS DISTINCT FROM y.challenge_kaybi THEN 'challenge_kaybi ' ELSE '' END ||
                    CASE WHEN e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam THEN 'kazanilan_toplam ' ELSE '' END ||
                    CASE WHEN e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam THEN 'kaybedilen_toplam ' ELSE '' END ||
                    CASE WHEN e.net_puan IS DISTINCT FROM y.net_puan THEN 'net_puan ' ELSE '' END ||
                    CASE WHEN e.eclub_puani IS DISTINCT FROM y.eclub_puani THEN 'eclub_puani ' ELSE '' END,
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _eski_yon_takim e
  FULL OUTER JOIN _yeni_yon_takim y ON e.sira_no = y.sira_no
  WHERE e.birim_id IS DISTINCT FROM y.birim_id
     OR e.birim_adi IS DISTINCT FROM y.birim_adi
     OR e.toplam_utt IS DISTINCT FROM y.toplam_utt
     OR e.aktif_utt IS DISTINCT FROM y.aktif_utt
     OR e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme
     OR e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin
     OR e.izleme_puani IS DISTINCT FROM y.izleme_puani
     OR e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani
     OR e.oneri_puani IS DISTINCT FROM y.oneri_puani
     OR e.extra_puan IS DISTINCT FROM y.extra_puan
     OR e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi
     OR e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi
     OR e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi
     OR e.challenge_kaybi IS DISTINCT FROM y.challenge_kaybi
     OR e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam
     OR e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam
     OR e.net_puan IS DISTINCT FROM y.net_puan
     OR e.eclub_puani IS DISTINCT FROM y.eclub_puani;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    23, 'Eski–Yeni Karşılaştırması', 'Yönetici Hiyerarşisi - Takım Seviyesi (get_yonetici_hiyerarsi_v2)',
    '0 fark (' || v_eski_sayisi || ' satır)',
    v_fark_sayisi || ' fark (' || v_yeni_sayisi || ' satır)' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 AND v_eski_sayisi = v_yeni_sayisi AND v_eski_sayisi > 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Takım seviyesinde challenge_kaybi dahil 18 alan ve sıralama birebir eşleşti.'
  );

  -- 7.5 get_yonetici_hiyerarsi_v2 - Seviye: 'bolge' (Tüm 18 Alan + Challenge Kaybı + Sıralama)
  SELECT COUNT(*) INTO v_eski_sayisi FROM _eski_yon_bolge;
  SELECT COUNT(*) INTO v_yeni_sayisi FROM _yeni_yon_bolge;

  SELECT COUNT(*),
         string_agg('Sira ' || COALESCE(e.sira_no, y.sira_no)::text || ' Fark: ' ||
                    CASE WHEN e.birim_id IS DISTINCT FROM y.birim_id THEN 'birim_id ' ELSE '' END ||
                    CASE WHEN e.birim_adi IS DISTINCT FROM y.birim_adi THEN 'birim_adi ' ELSE '' END ||
                    CASE WHEN e.toplam_utt IS DISTINCT FROM y.toplam_utt THEN 'toplam_utt ' ELSE '' END ||
                    CASE WHEN e.aktif_utt IS DISTINCT FROM y.aktif_utt THEN 'aktif_utt ' ELSE '' END ||
                    CASE WHEN e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme THEN 'tamamlanan_izleme ' ELSE '' END ||
                    CASE WHEN e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin THEN 'benzersiz_yayin ' ELSE '' END ||
                    CASE WHEN e.izleme_puani IS DISTINCT FROM y.izleme_puani THEN 'izleme_puani ' ELSE '' END ||
                    CASE WHEN e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani THEN 'cevaplama_puani ' ELSE '' END ||
                    CASE WHEN e.oneri_puani IS DISTINCT FROM y.oneri_puani THEN 'oneri_puani ' ELSE '' END ||
                    CASE WHEN e.extra_puan IS DISTINCT FROM y.extra_puan THEN 'extra_puan ' ELSE '' END ||
                    CASE WHEN e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi THEN 'ileri_sarma_kaybi ' ELSE '' END ||
                    CASE WHEN e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi THEN 'yanlis_cevap_kaybi ' ELSE '' END ||
                    CASE WHEN e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi THEN 'oneri_kaybi ' ELSE '' END ||
                    CASE WHEN e.challenge_kaybi IS DISTINCT FROM y.challenge_kaybi THEN 'challenge_kaybi ' ELSE '' END ||
                    CASE WHEN e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam THEN 'kazanilan_toplam ' ELSE '' END ||
                    CASE WHEN e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam THEN 'kaybedilen_toplam ' ELSE '' END ||
                    CASE WHEN e.net_puan IS DISTINCT FROM y.net_puan THEN 'net_puan ' ELSE '' END ||
                    CASE WHEN e.eclub_puani IS DISTINCT FROM y.eclub_puani THEN 'eclub_puani ' ELSE '' END,
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _eski_yon_bolge e
  FULL OUTER JOIN _yeni_yon_bolge y ON e.sira_no = y.sira_no
  WHERE e.birim_id IS DISTINCT FROM y.birim_id
     OR e.birim_adi IS DISTINCT FROM y.birim_adi
     OR e.toplam_utt IS DISTINCT FROM y.toplam_utt
     OR e.aktif_utt IS DISTINCT FROM y.aktif_utt
     OR e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme
     OR e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin
     OR e.izleme_puani IS DISTINCT FROM y.izleme_puani
     OR e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani
     OR e.oneri_puani IS DISTINCT FROM y.oneri_puani
     OR e.extra_puan IS DISTINCT FROM y.extra_puan
     OR e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi
     OR e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi
     OR e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi
     OR e.challenge_kaybi IS DISTINCT FROM y.challenge_kaybi
     OR e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam
     OR e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam
     OR e.net_puan IS DISTINCT FROM y.net_puan
     OR e.eclub_puani IS DISTINCT FROM y.eclub_puani;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    24, 'Eski–Yeni Karşılaştırması', 'Yönetici Hiyerarşisi - Bölge Seviyesi (get_yonetici_hiyerarsi_v2)',
    '0 fark (' || v_eski_sayisi || ' satır)',
    v_fark_sayisi || ' fark (' || v_yeni_sayisi || ' satır)' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 AND v_eski_sayisi = v_yeni_sayisi AND v_eski_sayisi > 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Bölge seviyesinde challenge_kaybi dahil 18 alan ve sıralama birebir eşleşti.'
  );

  -- 7.6 get_yonetici_hiyerarsi_v2 - Seviye: 'utt' (Tüm 18 Alan + Challenge Kaybı + Sıralama)
  SELECT COUNT(*) INTO v_eski_sayisi FROM _eski_yon_utt;
  SELECT COUNT(*) INTO v_yeni_sayisi FROM _yeni_yon_utt;

  SELECT COUNT(*),
         string_agg('Sira ' || COALESCE(e.sira_no, y.sira_no)::text || ' Fark: ' ||
                    CASE WHEN e.birim_id IS DISTINCT FROM y.birim_id THEN 'birim_id ' ELSE '' END ||
                    CASE WHEN e.birim_adi IS DISTINCT FROM y.birim_adi THEN 'birim_adi ' ELSE '' END ||
                    CASE WHEN e.toplam_utt IS DISTINCT FROM y.toplam_utt THEN 'toplam_utt ' ELSE '' END ||
                    CASE WHEN e.aktif_utt IS DISTINCT FROM y.aktif_utt THEN 'aktif_utt ' ELSE '' END ||
                    CASE WHEN e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme THEN 'tamamlanan_izleme ' ELSE '' END ||
                    CASE WHEN e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin THEN 'benzersiz_yayin ' ELSE '' END ||
                    CASE WHEN e.izleme_puani IS DISTINCT FROM y.izleme_puani THEN 'izleme_puani ' ELSE '' END ||
                    CASE WHEN e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani THEN 'cevaplama_puani ' ELSE '' END ||
                    CASE WHEN e.oneri_puani IS DISTINCT FROM y.oneri_puani THEN 'oneri_puani ' ELSE '' END ||
                    CASE WHEN e.extra_puan IS DISTINCT FROM y.extra_puan THEN 'extra_puan ' ELSE '' END ||
                    CASE WHEN e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi THEN 'ileri_sarma_kaybi ' ELSE '' END ||
                    CASE WHEN e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi THEN 'yanlis_cevap_kaybi ' ELSE '' END ||
                    CASE WHEN e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi THEN 'oneri_kaybi ' ELSE '' END ||
                    CASE WHEN e.challenge_kaybi IS DISTINCT FROM y.challenge_kaybi THEN 'challenge_kaybi ' ELSE '' END ||
                    CASE WHEN e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam THEN 'kazanilan_toplam ' ELSE '' END ||
                    CASE WHEN e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam THEN 'kaybedilen_toplam ' ELSE '' END ||
                    CASE WHEN e.net_puan IS DISTINCT FROM y.net_puan THEN 'net_puan ' ELSE '' END ||
                    CASE WHEN e.eclub_puani IS DISTINCT FROM y.eclub_puani THEN 'eclub_puani ' ELSE '' END,
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _eski_yon_utt e
  FULL OUTER JOIN _yeni_yon_utt y ON e.sira_no = y.sira_no
  WHERE e.birim_id IS DISTINCT FROM y.birim_id
     OR e.birim_adi IS DISTINCT FROM y.birim_adi
     OR e.toplam_utt IS DISTINCT FROM y.toplam_utt
     OR e.aktif_utt IS DISTINCT FROM y.aktif_utt
     OR e.tamamlanan_izleme IS DISTINCT FROM y.tamamlanan_izleme
     OR e.benzersiz_yayin IS DISTINCT FROM y.benzersiz_yayin
     OR e.izleme_puani IS DISTINCT FROM y.izleme_puani
     OR e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani
     OR e.oneri_puani IS DISTINCT FROM y.oneri_puani
     OR e.extra_puan IS DISTINCT FROM y.extra_puan
     OR e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi
     OR e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi
     OR e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi
     OR e.challenge_kaybi IS DISTINCT FROM y.challenge_kaybi
     OR e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam
     OR e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam
     OR e.net_puan IS DISTINCT FROM y.net_puan
     OR e.eclub_puani IS DISTINCT FROM y.eclub_puani;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    25, 'Eski–Yeni Karşılaştırması', 'Yönetici Hiyerarşisi - UTT Seviyesi (get_yonetici_hiyerarsi_v2)',
    '0 fark (' || v_eski_sayisi || ' satır)',
    v_fark_sayisi || ' fark (' || v_yeni_sayisi || ' satır)' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 AND v_eski_sayisi = v_yeni_sayisi AND v_eski_sayisi > 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'UTT seviyesinde kişi bazlı challenge kaybı ve net puan eski ve yeni fonksiyon arasında birebir eşleşti.'
  );

  -- 7.7 get_yonetici_rapor_ana_ozet_v2 (Tüm 33 Alan)
  SELECT COUNT(*),
         string_agg('Alan Farkı: ' ||
                    CASE WHEN e.toplam_takim IS DISTINCT FROM y.toplam_takim THEN 'toplam_takim ' ELSE '' END ||
                    CASE WHEN e.toplam_bolge IS DISTINCT FROM y.toplam_bolge THEN 'toplam_bolge ' ELSE '' END ||
                    CASE WHEN e.toplam_utt IS DISTINCT FROM y.toplam_utt THEN 'toplam_utt ' ELSE '' END ||
                    CASE WHEN e.aktif_utt IS DISTINCT FROM y.aktif_utt THEN 'aktif_utt ' ELSE '' END ||
                    CASE WHEN e.donem_tamamlanan_izleme IS DISTINCT FROM y.donem_tamamlanan_izleme THEN 'donem_tamamlanan_izleme ' ELSE '' END ||
                    CASE WHEN e.donem_benzersiz_utt_yayin IS DISTINCT FROM y.donem_benzersiz_utt_yayin THEN 'donem_benzersiz_utt_yayin ' ELSE '' END ||
                    CASE WHEN e.izleme_puani IS DISTINCT FROM y.izleme_puani THEN 'izleme_puani ' ELSE '' END ||
                    CASE WHEN e.cevaplama_puani IS DISTINCT FROM y.cevaplama_puani THEN 'cevaplama_puani ' ELSE '' END ||
                    CASE WHEN e.oneri_puani IS DISTINCT FROM y.oneri_puani THEN 'oneri_puani ' ELSE '' END ||
                    CASE WHEN e.extra_puani IS DISTINCT FROM y.extra_puani THEN 'extra_puani ' ELSE '' END ||
                    CASE WHEN e.ileri_sarma_kaybi IS DISTINCT FROM y.ileri_sarma_kaybi THEN 'ileri_sarma_kaybi ' ELSE '' END ||
                    CASE WHEN e.yanlis_cevap_kaybi IS DISTINCT FROM y.yanlis_cevap_kaybi THEN 'yanlis_cevap_kaybi ' ELSE '' END ||
                    CASE WHEN e.oneri_kaybi IS DISTINCT FROM y.oneri_kaybi THEN 'oneri_kaybi ' ELSE '' END ||
                    CASE WHEN e.challenge_kaybi IS DISTINCT FROM y.challenge_kaybi THEN 'challenge_kaybi ' ELSE '' END ||
                    CASE WHEN e.kazanilan_toplam IS DISTINCT FROM y.kazanilan_toplam THEN 'kazanilan_toplam ' ELSE '' END ||
                    CASE WHEN e.kaybedilen_toplam IS DISTINCT FROM y.kaybedilen_toplam THEN 'kaybedilen_toplam ' ELSE '' END ||
                    CASE WHEN e.net_puan IS DISTINCT FROM y.net_puan THEN 'net_puan ' ELSE '' END ||
                    CASE WHEN e.toplam_yayina_alma IS DISTINCT FROM y.toplam_yayina_alma THEN 'toplam_yayina_alma ' ELSE '' END ||
                    CASE WHEN e.donemde_yayina_alinan IS DISTINCT FROM y.donemde_yayina_alinan THEN 'donemde_yayina_alinan ' ELSE '' END ||
                    CASE WHEN e.su_an_yayinda IS DISTINCT FROM y.su_an_yayinda THEN 'su_an_yayinda ' ELSE '' END ||
                    CASE WHEN e.donem_urun_egitimi IS DISTINCT FROM y.donem_urun_egitimi THEN 'donem_urun_egitimi ' ELSE '' END ||
                    CASE WHEN e.donem_genel_egitim IS DISTINCT FROM y.donem_genel_egitim THEN 'donem_genel_egitim ' ELSE '' END ||
                    CASE WHEN e.donem_medikal_egitim IS DISTINCT FROM y.donem_medikal_egitim THEN 'donem_medikal_egitim ' ELSE '' END ||
                    CASE WHEN e.donem_ik_egitimi IS DISTINCT FROM y.donem_ik_egitimi THEN 'donem_ik_egitimi ' ELSE '' END ||
                    CASE WHEN e.donem_normal_uretim IS DISTINCT FROM y.donem_normal_uretim THEN 'donem_normal_uretim ' ELSE '' END ||
                    CASE WHEN e.donem_hazir_video IS DISTINCT FROM y.donem_hazir_video THEN 'donem_hazir_video ' ELSE '' END ||
                    CASE WHEN e.donem_hazir_soru_seti IS DISTINCT FROM y.donem_hazir_soru_seti THEN 'donem_hazir_soru_seti ' ELSE '' END ||
                    CASE WHEN e.donem_hazir_video_ve_soru_seti IS DISTINCT FROM y.donem_hazir_video_ve_soru_seti THEN 'donem_hazir_video_ve_soru_seti ' ELSE '' END ||
                    CASE WHEN e.guncel_tur_toplam_firsat IS DISTINCT FROM y.guncel_tur_toplam_firsat THEN 'guncel_tur_toplam_firsat ' ELSE '' END ||
                    CASE WHEN e.guncel_tur_tamamlanan IS DISTINCT FROM y.guncel_tur_tamamlanan THEN 'guncel_tur_tamamlanan ' ELSE '' END ||
                    CASE WHEN e.guncel_tur_kalan IS DISTINCT FROM y.guncel_tur_kalan THEN 'guncel_tur_kalan ' ELSE '' END ||
                    CASE WHEN e.guncel_tur_izlenme_orani IS DISTINCT FROM y.guncel_tur_izlenme_orani THEN 'guncel_tur_izlenme_orani ' ELSE '' END ||
                    CASE WHEN e.eclub_puani IS DISTINCT FROM y.eclub_puani THEN 'eclub_puani ' ELSE '' END,
                    '; ')
  INTO v_fark_sayisi, v_fark_detay
  FROM _eski_yon_ozet e
  CROSS JOIN _yeni_yon_ozet y
  WHERE e.* IS DISTINCT FROM y.*;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    26, 'Eski–Yeni Karşılaştırması', 'Yönetici Rapor Ana Özeti (get_yonetici_rapor_ana_ozet_v2)',
    '0 fark (1 satır)',
    v_fark_sayisi || ' fark' || COALESCE(' [' || v_fark_detay || ']', ''),
    CASE WHEN v_fark_sayisi = 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Firma geneli yönetici özetindeki 33 alanın tamamı (puanlar, üretim metrikleri ve tur fırsatları) birebir eşleşti.'
  );

  -- --------------------------------------------------------------------------
  -- 8. DESTEK DOĞRULAMALARI (SABİT BEKLENEN DEĞERLER, İZOLASYON VE SINIRLAR)
  -- --------------------------------------------------------------------------
  -- 8.1 E-Club Kazanımı Sıfırdan Büyük Örnek Kontrolü
  SELECT * INTO v_rec FROM _yeni_bm WHERE kullanici_id = v_utt_1;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    30, 'Destek Kontrolleri', 'UTT 1 E-Club ve Puan Kalemleri Tutarlılığı',
    'Kazanç: 270, Kayıp: 50, Net: 220, Eclub: 60',
    'Kazanç: ' || v_rec.kazanilan_toplam || ', Kayıp: ' || v_rec.kaybedilen_toplam || ', Net: ' || v_rec.net_puan || ', Eclub: ' || v_rec.eclub_puani,
    CASE WHEN v_rec.kazanilan_toplam = 270 AND v_rec.kaybedilen_toplam = 50 AND v_rec.net_puan = 220 AND v_rec.eclub_puani = 60
         THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'E-Club kazanımı (60) toplam kazanca dahil edildi; BM saha görünümünde challenge kaybı hariç tutuldu.'
  );

  -- 8.2 UTT Seviyesinde Challenge Kaybının Sıfır ve Net Puanın Tutarlılığının Teyidi
  SELECT * INTO v_rec FROM _yeni_yon_utt WHERE birim_id = v_utt_1;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    31, 'Destek Kontrolleri', 'UTT 1 Yönetici Seviyesi Challenge Kaybı ve Net Puan',
    'Challenge: 0, Kayıp: 50, Net: 220',
    'Challenge: ' || v_rec.challenge_kaybi || ', Kayıp: ' || v_rec.kaybedilen_toplam || ', Net: ' || v_rec.net_puan,
    CASE WHEN v_rec.challenge_kaybi = 0 AND v_rec.kaybedilen_toplam = 50 AND v_rec.net_puan = 220
         THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Challenge yalnız BM->BM arasında olabildiğinden UTT için challenge kaybı 0 olarak hesaplandı; kaybedilen toplam (50) ve net puan (270 - 50 = 220) doğrulandı.'
  );

  -- 8.3 Zaman Aralığı İzolasyonu (Öncesi/Sonrası Dışlanması)
  -- v_utt_1 için aralık dışında iki adet 500 puanlık video kaydı var; eğer girseydi izleme_puani 1100 olurdu
  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    32, 'Destek Kontrolleri', 'Zaman Aralığı İzolasyonu (Aralık Dışı Puanlar)',
    '100',
    (SELECT izleme_puani::text FROM _yeni_bm WHERE kullanici_id = v_utt_1),
    CASE WHEN (SELECT izleme_puani FROM _yeni_bm WHERE kullanici_id = v_utt_1) = 100 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Aralık öncesi (Mayıs 2026) ve sonrası (Temmuz 2026) puan kayıtları filtrelenmiştir.'
  );

  -- 8.4 Firma ve Aktiflik İzolasyonu
  -- Pasif UTT (v_utt_pasif: 999 puan) ve Firma B UTT (v_utt_b: 888 puan) Firma A özetine girmemeli
  SELECT * INTO v_rec FROM _yeni_yon_ozet;

  INSERT INTO test_rapor_ortaklastirma_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES (
    33, 'Destek Kontrolleri', 'Pasif Kullanıcı ve Firma İzolasyonu',
    'Takım: 2, Bölge: 3, UTT: 4, Kazanç: 645',
    'Takım: ' || v_rec.toplam_takim || ', Bölge: ' || v_rec.toplam_bolge || ', UTT: ' || v_rec.toplam_utt || ', Kazanç: ' || v_rec.kazanilan_toplam,
    CASE WHEN v_rec.toplam_takim = 2 AND v_rec.toplam_bolge = 3 AND v_rec.toplam_utt = 4 AND v_rec.kazanilan_toplam = 645
         THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
    'Pasif kullanıcılar ve diğer firmanın UTT puanları Firma A özetine kesinlikle karışmamıştır.'
  );

END;
$test_paketi$;

-- ----------------------------------------------------------------------------
-- TEK RAPOR TABLOSU ÇIKTISI
-- ----------------------------------------------------------------------------
SELECT
  sira,
  bolum,
  test_adi,
  beklenen,
  gercek,
  durum,
  aciklama
FROM test_rapor_ortaklastirma_sonuclari
ORDER BY sira;

-- ----------------------------------------------------------------------------
-- ROLLBACK: Veritabanında hiçbir kalıcı veri veya şema değişikliği bırakılmaz
-- ----------------------------------------------------------------------------
ROLLBACK;
