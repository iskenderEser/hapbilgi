-- ============================================================================
-- Ortak BM Puan Özeti (get_bm_puan_ozet) ve HBStore Entegrasyon Doğrulama Paketi
-- Dosya: scripts/sql/test_bm_puan_ozet_ve_hbstore.sql
--
-- KAPSAM:
--   1. Challenge kaybı dahil 5 kazanç ve 3 kayıp kaleminin (tüm kalemler > 0)
--      doğrulanması; toplam kazanç, toplam kayıp ve net puan tutarlılığı.
--   2. Tarih aralıklarının tam sınırda (>= p_baslangic, <= p_bitis) ve sınır
--      dışında (öncesi/sonrası) test edilmesi.
--   3. Kullanıcı izolasyonu (farklı BM'lerin verilerinin karışmaması).
--   4. Kayıt bulunmayan durumda boş satır değil, sıfırlı özet döndürülmesi.
--   5. Kayıpların kazançtan büyük olduğu senaryoda negatif net puanın korunması.
--   6. HBStore BM öğrenme puanı hesabının (get_harcama_bakiyesi_tarihli)
--      get_bm_puan_ozet fonksiyonundan doğru veriyi çektiğinin, harcama ve iadelerin
--      kaynak çeyrekle doğru bağlandığının doğrulanması.
--
-- VERİ BÜTÜNLÜĞÜ VE TEKİLLİK KURALLARI:
--   * Her test izleme/puan olayı ayrı bir izleme oturumuna bağlanır (cc_puan_izleme_turu_uq).
--   * BM şemasına sadık kalınır: UTT'ye özgü gercek_oynatma_mi vb. alanlar kullanılmaz.
--   * Her challenge ilişkisi tekil (gonderen_id, alan_id, yayin_id) üçlüsüyle oluşturulur (challenge_gonderen_alici_yayin_uq).
--   * Tüm challenge kayıpları önce geçerli bir challenge_kayitlari satırına bağlanır (challenge_kayip_challenge_uq ve FK).
--   * Tetikleyiciler veya kısıtlar devre dışı bırakılmaz; gerçek şema kuralları altında doğrulanır.
--
-- ÇIKTI VE GÜVENLİK:
--   * Tüm sonuçlar tek bir geçici tabloda (test_bm_puan_sonuclari) toplanır.
--   * İşlemler BEGIN … ROLLBACK içinde yürütülür, kalıcı veri üretilmez.
--   * Bu dosya veritabanında otomatik çalıştırılmaz.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. SONUÇ TABLOSU
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE IF NOT EXISTS test_bm_puan_sonuclari (
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
  v_yayin_id uuid;
  v_arac_id uuid;
  v_arac_turu text;

  -- Test BM kullanıcıları
  v_bm1 uuid := gen_random_uuid();
  v_bm2 uuid := gen_random_uuid();
  v_bm_bos uuid := gen_random_uuid();
  v_bm_neg uuid := gen_random_uuid();
  v_bm_hbstore uuid := gen_random_uuid();

  -- Tekillik kuralı (gonderen_id, alan_id, yayin_id) için ayrı yardımcı BM kullanıcıları
  v_yardimci_bm1 uuid := gen_random_uuid();
  v_yardimci_bm2 uuid := gen_random_uuid();
  v_yardimci_bm3 uuid := gen_random_uuid();
  v_yardimci_bm4 uuid := gen_random_uuid();
  v_yardimci_bm5 uuid := gen_random_uuid();

  -- Bölüm 1 izleme ve challenge kimlikleri
  v_izleme_s1_izleme uuid;
  v_izleme_s1_cevap uuid;
  v_izleme_s1_extra uuid;
  v_izleme_s1_ileri uuid;
  v_izleme_s1_yanlis uuid;
  v_izleme_s1_ref uuid;
  v_challenge_s1_gonderme uuid;
  v_challenge_s1_ref uuid;
  v_challenge_s1_kayip uuid;

  -- Bölüm 2 izleme kimlikleri
  v_izleme_s2_once uuid;
  v_izleme_s2_bas uuid;
  v_izleme_s2_bit uuid;
  v_izleme_s2_sonra uuid;
  v_izleme_s2_ileri_dahil uuid;
  v_izleme_s2_ileri_once uuid;
  v_izleme_s2_ileri_sonra uuid;

  -- Bölüm 5 izleme ve challenge kimlikleri
  v_izleme_neg_izleme uuid;
  v_izleme_neg_ileri uuid;
  v_challenge_neg_kayip uuid;

  -- Bölüm 6 HBStore izleme ve challenge kimlikleri
  v_izleme_hb_izleme uuid;
  v_izleme_hb_cevap uuid;
  v_izleme_hb_ileri uuid;
  v_izleme_hb_q2 uuid;
  v_challenge_hb_kayip uuid;

  -- HBStore test varlıkları
  v_kat_id uuid;
  v_urun_id uuid := gen_random_uuid();
  v_siparis_id uuid := gen_random_uuid();

  -- Okunan değerler
  v_rec record;
  v_bakiye integer;
  v_satir_sayisi integer;

  v_bas timestamptz := '2026-05-01 00:00:00+03'::timestamptz;
  v_bit timestamptz := '2026-05-31 23:59:59.999+03'::timestamptz;
BEGIN
  -- --------------------------------------------------------------------------
  -- ÖN KOŞUL KONTROLÜ: Fonksiyonların varlığı ve yayın kaydı
  -- --------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_bm_puan_ozet'
  ) THEN
    INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      1, 'Ön Koşul', 'get_bm_puan_ozet Fonksiyon Varlığı',
      'public.get_bm_puan_ozet fonksiyonunun veritabanında tanımlı olması',
      'Fonksiyon bulunamadı', 'HATA',
      'scripts/sql/get_bm_puan_ozet.sql dosyası bu testten önce çalıştırılmalıdır.'
    );
    RETURN;
  END IF;

  -- Yayın ve araç bilgisi sağla
  SELECT y.yayin_id, vyd.arac_id, vyd.arac_turu
  INTO v_yayin_id, v_arac_id, v_arac_turu
  FROM public.v_yayin_detay vyd
  JOIN public.yayin_yonetimi y ON y.yayin_id = vyd.yayin_id
  WHERE vyd.arac_id IS NOT NULL AND vyd.arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf')
  LIMIT 1;

  IF v_yayin_id IS NULL THEN
    SELECT yayin_id INTO v_yayin_id FROM public.yayin_yonetimi LIMIT 1;
  END IF;

  IF v_yayin_id IS NULL THEN
    INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
    VALUES (
      2, 'Ön Koşul', 'Yayın Kaydı',
      'Test için geçerli bir yayın bulunması',
      'Yayın bulunamadı', 'ATLANDI',
      'Test verisi oluşturmak için public.yayin_yonetimi tablosunda kayıt bulunamadığından testler atlandı.'
    );
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST KULLANICILARININ OLUŞTURULMASI
  -- --------------------------------------------------------------------------
  INSERT INTO public.kullanicilar (kullanici_id, ad, soyad, eposta, rol, aktif_mi)
  VALUES
    (v_bm1, 'TestBM1', 'Pozitif', 'bm1_' || v_bm1::text || '@test.com', 'bm', true),
    (v_bm2, 'TestBM2', 'Sinir', 'bm2_' || v_bm2::text || '@test.com', 'bm', true),
    (v_bm_bos, 'TestBM', 'Bos', 'bmbos_' || v_bm_bos::text || '@test.com', 'bm', true),
    (v_bm_neg, 'TestBM', 'Negatif', 'bmneg_' || v_bm_neg::text || '@test.com', 'bm', true),
    (v_bm_hbstore, 'TestBM', 'HBStore', 'bmhb_' || v_bm_hbstore::text || '@test.com', 'bm', true),
    (v_yardimci_bm1, 'YardimciBM1', 'Gonderim', 'bmyard1_' || v_yardimci_bm1::text || '@test.com', 'bm', true),
    (v_yardimci_bm2, 'YardimciBM2', 'Referral', 'bmyard2_' || v_yardimci_bm2::text || '@test.com', 'bm', true),
    (v_yardimci_bm3, 'YardimciBM3', 'Kayip1', 'bmyard3_' || v_yardimci_bm3::text || '@test.com', 'bm', true),
    (v_yardimci_bm4, 'YardimciBM4', 'KayipNeg', 'bmyard4_' || v_yardimci_bm4::text || '@test.com', 'bm', true),
    (v_yardimci_bm5, 'YardimciBM5', 'KayipHb', 'bmyard5_' || v_yardimci_bm5::text || '@test.com', 'bm', true);

  -- --------------------------------------------------------------------------
  -- BÖLÜM 1: TÜM KALEMLER POZİTİF (CHALLENGE KAYBI DAHİL) VE TOPLAMLAR
  -- --------------------------------------------------------------------------
  -- Her kazanım ve kayıp kalemi için ayrı test izleme kaydı oluşturulur (cc_puan_izleme_turu_uq kısıtı)
  v_izleme_s1_izleme := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s1_izleme, v_bm1, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-10 10:00:00+03'::timestamptz, '2026-05-10 10:00:00+03'::timestamptz
  );

  v_izleme_s1_cevap := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s1_cevap, v_bm1, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-10 10:06:00+03'::timestamptz, '2026-05-10 10:06:00+03'::timestamptz
  );

  v_izleme_s1_extra := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s1_extra, v_bm1, v_yayin_id, v_arac_id, v_arac_turu, 'extra', true,
    120, '2026-05-10 10:12:00+03'::timestamptz, '2026-05-10 10:12:00+03'::timestamptz
  );

  v_izleme_s1_ileri := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s1_ileri, v_bm1, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-10 10:01:00+03'::timestamptz, '2026-05-10 10:01:00+03'::timestamptz
  );

  v_izleme_s1_yanlis := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s1_yanlis, v_bm1, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-10 10:07:00+03'::timestamptz, '2026-05-10 10:07:00+03'::timestamptz
  );

  -- 1a. Challenge Gönderme: BM1 -> YardimciBM1
  v_challenge_s1_gonderme := gen_random_uuid();
  INSERT INTO public.challenge_kayitlari (
    challenge_id, gonderen_id, alan_id, yayin_id, arac_id, arac_turu, son_tarih, izlendi_mi, created_at
  ) VALUES (
    v_challenge_s1_gonderme, v_bm1, v_yardimci_bm1, v_yayin_id, v_arac_id, v_arac_turu,
    '2026-05-20 00:00:00+03'::timestamptz, false, '2026-05-10 11:00:00+03'::timestamptz
  );

  -- 1b. Challenge Referral: BM1 -> YardimciBM2 (Farklı alıcı ile tekillik uq korunur)
  v_challenge_s1_ref := gen_random_uuid();
  INSERT INTO public.challenge_kayitlari (
    challenge_id, gonderen_id, alan_id, yayin_id, arac_id, arac_turu, son_tarih, izlendi_mi, created_at
  ) VALUES (
    v_challenge_s1_ref, v_bm1, v_yardimci_bm2, v_yayin_id, v_arac_id, v_arac_turu,
    '2026-05-25 00:00:00+03'::timestamptz, true, '2026-05-12 09:00:00+03'::timestamptz
  );

  -- Referral için YardimciBM2'nin izleme oturumu
  v_izleme_s1_ref := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, challenge_id, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s1_ref, v_yardimci_bm2, v_yayin_id, v_arac_id, v_arac_turu, v_challenge_s1_ref, 'challenge', true,
    120, '2026-05-12 10:00:00+03'::timestamptz, '2026-05-12 10:00:00+03'::timestamptz
  );

  -- 1c. Challenge Kaybı: YardimciBM3 -> BM1 (BM1 izlemediği için kayıp yazar)
  -- Önce challenge_kayitlari oluşturulur, ardından kayıp satırı bağlanır
  v_challenge_s1_kayip := gen_random_uuid();
  INSERT INTO public.challenge_kayitlari (
    challenge_id, gonderen_id, alan_id, yayin_id, arac_id, arac_turu, son_tarih, izlendi_mi, created_at
  ) VALUES (
    v_challenge_s1_kayip, v_yardimci_bm3, v_bm1, v_yayin_id, v_arac_id, v_arac_turu,
    '2026-05-14 00:00:00+03'::timestamptz, false, '2026-05-05 10:00:00+03'::timestamptz
  );

  -- 5 Kazanç kalemi (cc_kazanilan_puanlar)
  -- izleme: 100
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm1, v_yayin_id, v_izleme_s1_izleme, 'izleme', 100, '2026-05-10 10:05:00+03'::timestamptz);

  -- cevaplama: 40
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm1, v_yayin_id, v_izleme_s1_cevap, 'cevaplama', 40, '2026-05-10 10:10:00+03'::timestamptz);

  -- extra: 20
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm1, v_yayin_id, v_izleme_s1_extra, 'extra', 20, '2026-05-10 10:15:00+03'::timestamptz);

  -- cc_gonderme: 10
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, challenge_id, puan_turu, puan, created_at)
  VALUES (v_bm1, v_yayin_id, v_challenge_s1_gonderme, 'cc_gonderme', 10, '2026-05-10 11:00:00+03'::timestamptz);

  -- cc_referral: 30
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, challenge_id, puan_turu, puan, created_at)
  VALUES (v_bm1, v_yayin_id, v_izleme_s1_ref, v_challenge_s1_ref, 'cc_referral', 30, '2026-05-12 10:15:00+03'::timestamptz);

  -- 3 Kayıp kalemi
  -- ileri_sarma: 5
  INSERT INTO public.cc_ileri_sarma_kayitlari (
    bm_id, yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan, created_at
  ) VALUES (
    v_bm1, v_yayin_id, v_izleme_s1_ileri, 10, 25, 15, 5, '2026-05-10 10:02:00+03'::timestamptz
  );

  -- yanlis_cevap: 3
  INSERT INTO public.cc_yanlis_cevap_kayitlari (
    bm_id, yayin_id, izleme_id, soru_index, verilen_cevap, dogru_cevap, kaybedilen_puan, created_at
  ) VALUES (
    v_bm1, v_yayin_id, v_izleme_s1_yanlis, 1, 'Yanlış', 'Doğru', 3, '2026-05-10 10:08:00+03'::timestamptz
  );

  -- challenge_kaybi: 15 (Önceden oluşturulan v_challenge_s1_kayip referansıyla)
  INSERT INTO public.challenge_kayip_kayitlari (
    kullanici_id, yayin_id, challenge_id, kaybedilen_puan, created_at
  ) VALUES (
    v_bm1, v_yayin_id, v_challenge_s1_kayip, 15, '2026-05-15 12:00:00+03'::timestamptz
  );

  -- BM1 özetini oku ve doğrula
  SELECT * INTO v_rec
  FROM public.get_bm_puan_ozet(v_bm1, v_bas, v_bit);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (10, 'Bölüm 1', 'BM1 İzleme Puanı', '100', v_rec.izleme_puani::text,
     CASE WHEN v_rec.izleme_puani = 100 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'cc_kazanilan_puanlar puan_turu=izleme toplamı'),
    (11, 'Bölüm 1', 'BM1 Cevaplama Puanı', '40', v_rec.cevaplama_puani::text,
     CASE WHEN v_rec.cevaplama_puani = 40 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'cc_kazanilan_puanlar puan_turu=cevaplama toplamı'),
    (12, 'Bölüm 1', 'BM1 Extra Puan', '20', v_rec.extra_puan::text,
     CASE WHEN v_rec.extra_puan = 20 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'cc_kazanilan_puanlar puan_turu=extra toplamı'),
    (13, 'Bölüm 1', 'BM1 Challenge Gönderme Puanı', '10', v_rec.cc_gonderme_puani::text,
     CASE WHEN v_rec.cc_gonderme_puani = 10 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'cc_kazanilan_puanlar puan_turu=cc_gonderme toplamı'),
    (14, 'Bölüm 1', 'BM1 Challenge Referral Puanı', '30', v_rec.cc_referral_puani::text,
     CASE WHEN v_rec.cc_referral_puani = 30 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'cc_kazanilan_puanlar puan_turu=cc_referral toplamı'),
    (15, 'Bölüm 1', 'BM1 İleri Sarma Kaybı', '5', v_rec.ileri_sarma_kaybi::text,
     CASE WHEN v_rec.ileri_sarma_kaybi = 5 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'cc_ileri_sarma_kayitlari kaybedilen_puan toplamı'),
    (16, 'Bölüm 1', 'BM1 Yanlış Cevap Kaybı', '3', v_rec.yanlis_cevap_kaybi::text,
     CASE WHEN v_rec.yanlis_cevap_kaybi = 3 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'cc_yanlis_cevap_kayitlari kaybedilen_puan toplamı'),
    (17, 'Bölüm 1', 'BM1 Challenge Kaybı', '15', v_rec.challenge_kaybi::text,
     CASE WHEN v_rec.challenge_kaybi = 15 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'challenge_kayip_kayitlari kaybedilen_puan toplamı'),
    (18, 'Bölüm 1', 'BM1 Toplam Kazanç', '200', v_rec.toplam_kazanc::text,
     CASE WHEN v_rec.toplam_kazanc = 200 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     '5 kazanç kaleminin toplamı (100+40+20+10+30)'),
    (19, 'Bölüm 1', 'BM1 Toplam Kayıp', '23', v_rec.toplam_kayip::text,
     CASE WHEN v_rec.toplam_kayip = 23 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     '3 kayıp kaleminin toplamı (5+3+15)'),
    (20, 'Bölüm 1', 'BM1 Toplam Net Puan', '177', v_rec.toplam_net::text,
     CASE WHEN v_rec.toplam_net = 177 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'toplam_kazanc - toplam_kayip (200 - 23)');

  -- --------------------------------------------------------------------------
  -- BÖLÜM 2: TARİH SINIRLARI (TAM SINIRDA VE DIŞINDA)
  -- --------------------------------------------------------------------------
  -- Her tarih kontrol noktası için ayrı test izleme oturumu oluşturulur
  v_izleme_s2_once := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s2_once, v_bm2, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-04-30 23:58:00+03'::timestamptz, '2026-04-30 23:58:00+03'::timestamptz
  );

  v_izleme_s2_bas := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s2_bas, v_bm2, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-01 00:00:00+03'::timestamptz, '2026-05-01 00:00:00+03'::timestamptz
  );

  v_izleme_s2_bit := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s2_bit, v_bm2, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-31 23:58:00+03'::timestamptz, '2026-05-31 23:58:00+03'::timestamptz
  );

  v_izleme_s2_sonra := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s2_sonra, v_bm2, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-06-01 00:00:00+03'::timestamptz, '2026-06-01 00:00:00+03'::timestamptz
  );

  -- 1 saniye ÖNCE: 2026-04-30 23:59:59+03 (HARİÇ TUTULMALI)
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm2, v_yayin_id, v_izleme_s2_once, 'izleme', 50, '2026-04-30 23:59:59+03'::timestamptz);

  -- TAM BAŞLANGIÇ SINIRINDA: 2026-05-01 00:00:00+03 (DAHİL EDİLMELİ)
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm2, v_yayin_id, v_izleme_s2_bas, 'izleme', 100, '2026-05-01 00:00:00+03'::timestamptz);

  -- TAM BİTİŞ SINIRINDA: 2026-05-31 23:59:59.999+03 (DAHİL EDİLMELİ)
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm2, v_yayin_id, v_izleme_s2_bit, 'cevaplama', 50, '2026-05-31 23:59:59.999+03'::timestamptz);

  -- 1 milisaniye SONRA: 2026-06-01 00:00:00+03 (HARİÇ TUTULMALI)
  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm2, v_yayin_id, v_izleme_s2_sonra, 'izleme', 50, '2026-06-01 00:00:00+03'::timestamptz);

  -- İleri sarma oturumları
  v_izleme_s2_ileri_dahil := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s2_ileri_dahil, v_bm2, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-15 11:58:00+03'::timestamptz, '2026-05-15 11:58:00+03'::timestamptz
  );

  v_izleme_s2_ileri_once := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s2_ileri_once, v_bm2, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-04-30 23:55:00+03'::timestamptz, '2026-04-30 23:55:00+03'::timestamptz
  );

  v_izleme_s2_ileri_sonra := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_s2_ileri_sonra, v_bm2, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-06-01 00:01:00+03'::timestamptz, '2026-06-01 00:01:00+03'::timestamptz
  );

  -- Kayıp: Tam sınırda (DAHİL)
  INSERT INTO public.cc_ileri_sarma_kayitlari (
    bm_id, yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan, created_at
  ) VALUES (
    v_bm2, v_yayin_id, v_izleme_s2_ileri_dahil, 10, 20, 10, 10, '2026-05-15 12:00:00+03'::timestamptz
  );

  -- Kayıp: Sınır öncesi (HARİÇ)
  INSERT INTO public.cc_ileri_sarma_kayitlari (
    bm_id, yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan, created_at
  ) VALUES (
    v_bm2, v_yayin_id, v_izleme_s2_ileri_once, 20, 30, 10, 10, '2026-04-30 23:59:59+03'::timestamptz
  );

  -- Kayıp: Sınır sonrası (HARİÇ)
  INSERT INTO public.cc_ileri_sarma_kayitlari (
    bm_id, yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan, created_at
  ) VALUES (
    v_bm2, v_yayin_id, v_izleme_s2_ileri_sonra, 30, 40, 10, 10, '2026-06-01 00:00:00+03'::timestamptz
  );

  SELECT * INTO v_rec
  FROM public.get_bm_puan_ozet(v_bm2, v_bas, v_bit);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (30, 'Bölüm 2', 'Tarih Sınırları - Toplam Kazanç', '150', v_rec.toplam_kazanc::text,
     CASE WHEN v_rec.toplam_kazanc = 150 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Sınır anındaki 100+50 dahil, öncesi ve sonrasındaki 50+50 hariç tutuldu'),
    (31, 'Bölüm 2', 'Tarih Sınırları - Toplam Kayıp', '10', v_rec.toplam_kayip::text,
     CASE WHEN v_rec.toplam_kayip = 10 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Yalnız aralık içindeki 10 puan kayıp dahil edildi'),
    (32, 'Bölüm 2', 'Tarih Sınırları - Net Puan', '140', v_rec.toplam_net::text,
     CASE WHEN v_rec.toplam_net = 140 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     '150 - 10 = 140');

  -- --------------------------------------------------------------------------
  -- BÖLÜM 3: KULLANICI İZOLASYONU (BM1 ile BM2 Birbirine Karışmaz)
  -- --------------------------------------------------------------------------
  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (40, 'Bölüm 3', 'Kullanıcı İzolasyonu - BM1 Kazancı', '200',
     (SELECT toplam_kazanc::text FROM public.get_bm_puan_ozet(v_bm1, v_bas, v_bit)),
     CASE WHEN (SELECT toplam_kazanc FROM public.get_bm_puan_ozet(v_bm1, v_bas, v_bit)) = 200 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'BM2 verileri BM1 kazancına sızmadı'),
    (41, 'Bölüm 3', 'Kullanıcı İzolasyonu - BM2 Kazancı', '150',
     (SELECT toplam_kazanc::text FROM public.get_bm_puan_ozet(v_bm2, v_bas, v_bit)),
     CASE WHEN (SELECT toplam_kazanc FROM public.get_bm_puan_ozet(v_bm2, v_bas, v_bit)) = 150 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'BM1 verileri BM2 kazancına sızmadı');

  -- --------------------------------------------------------------------------
  -- BÖLÜM 4: KAYIT BULUNMAYAN DURUM (SIFIRLI ÖZET DÖNÜŞÜ)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*)::integer INTO v_satir_sayisi
  FROM public.get_bm_puan_ozet(v_bm_bos, v_bas, v_bit);

  SELECT * INTO v_rec
  FROM public.get_bm_puan_ozet(v_bm_bos, v_bas, v_bit);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (50, 'Bölüm 4', 'Boş Kayıt - Satır Sayısı', '1', v_satir_sayisi::text,
     CASE WHEN v_satir_sayisi = 1 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Kayıt yoksa boş sonuç kümesi (0 satır) değil, tek özet satırı dönmeli'),
    (51, 'Bölüm 4', 'Boş Kayıt - Sıfırlı Toplam Kazanç', '0', v_rec.toplam_kazanc::text,
     CASE WHEN v_rec.toplam_kazanc = 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Kayıt yokken NULL değil 0 dönmeli'),
    (52, 'Bölüm 4', 'Boş Kayıt - Sıfırlı Toplam Kayıp', '0', v_rec.toplam_kayip::text,
     CASE WHEN v_rec.toplam_kayip = 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Kayıt yokken NULL değil 0 dönmeli'),
    (53, 'Bölüm 4', 'Boş Kayıt - Sıfırlı Net Puan', '0', v_rec.toplam_net::text,
     CASE WHEN v_rec.toplam_net = 0 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Kayıt yokken net puan 0 dönmeli');

  -- --------------------------------------------------------------------------
  -- BÖLÜM 5: NEGATİF NET PUAN KORUNUMU (KAYIP > KAZANÇ)
  -- --------------------------------------------------------------------------
  v_izleme_neg_izleme := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_neg_izleme, v_bm_neg, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-15 10:00:00+03'::timestamptz, '2026-05-15 10:00:00+03'::timestamptz
  );

  v_izleme_neg_ileri := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_neg_ileri, v_bm_neg, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-05-15 10:01:00+03'::timestamptz, '2026-05-15 10:01:00+03'::timestamptz
  );

  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm_neg, v_yayin_id, v_izleme_neg_izleme, 'izleme', 50, '2026-05-15 10:05:00+03'::timestamptz);

  -- 30 ileri sarma
  INSERT INTO public.cc_ileri_sarma_kayitlari (
    bm_id, yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan, created_at
  ) VALUES (
    v_bm_neg, v_yayin_id, v_izleme_neg_ileri, 10, 40, 30, 30, '2026-05-15 10:02:00+03'::timestamptz
  );

  -- 50 challenge kaybı: Önce YardimciBM4 -> BM_NEG challenge satırı oluşturulur
  v_challenge_neg_kayip := gen_random_uuid();
  INSERT INTO public.challenge_kayitlari (
    challenge_id, gonderen_id, alan_id, yayin_id, arac_id, arac_turu, son_tarih, izlendi_mi, created_at
  ) VALUES (
    v_challenge_neg_kayip, v_yardimci_bm4, v_bm_neg, v_yayin_id, v_arac_id, v_arac_turu,
    '2026-05-10 00:00:00+03'::timestamptz, false, '2026-05-01 10:00:00+03'::timestamptz
  );

  INSERT INTO public.challenge_kayip_kayitlari (
    kullanici_id, yayin_id, challenge_id, kaybedilen_puan, created_at
  ) VALUES (
    v_bm_neg, v_yayin_id, v_challenge_neg_kayip, 50, '2026-05-15 11:00:00+03'::timestamptz
  );

  SELECT * INTO v_rec
  FROM public.get_bm_puan_ozet(v_bm_neg, v_bas, v_bit);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (60, 'Bölüm 5', 'Negatif Net Puan - Korunum', '-30', v_rec.toplam_net::text,
     CASE WHEN v_rec.toplam_net = -30 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     '50 kazanç - 80 kayıp = -30 net puan; sıfıra kırpılmadan negatif olarak korunur');

  -- --------------------------------------------------------------------------
  -- BÖLÜM 6: HBSTORE BM ÖĞRENME PUANI VE BAKİYE ENTEGRASYONU
  -- --------------------------------------------------------------------------
  -- BM_HBSTORE için 2026 Q1'de (Şubat 2026) öğrenme kayıtları oluşturulur:
  --   Kazanç: 400 (izleme) + 100 (cevaplama) = 500
  --   Kayıp:  30 (ileri sarma) + 20 (challenge kaybı) = 50
  --   Net Q1 Öğrenme Puanı = 450
  v_izleme_hb_izleme := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_hb_izleme, v_bm_hbstore, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-02-15 10:00:00+03'::timestamptz, '2026-02-15 10:00:00+03'::timestamptz
  );

  v_izleme_hb_cevap := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_hb_cevap, v_bm_hbstore, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-02-15 10:06:00+03'::timestamptz, '2026-02-15 10:06:00+03'::timestamptz
  );

  v_izleme_hb_ileri := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_hb_ileri, v_bm_hbstore, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-02-15 10:01:00+03'::timestamptz, '2026-02-15 10:01:00+03'::timestamptz
  );

  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES
    (v_bm_hbstore, v_yayin_id, v_izleme_hb_izleme, 'izleme', 400, '2026-02-15 10:05:00+03'::timestamptz),
    (v_bm_hbstore, v_yayin_id, v_izleme_hb_cevap, 'cevaplama', 100, '2026-02-15 10:10:00+03'::timestamptz);

  INSERT INTO public.cc_ileri_sarma_kayitlari (
    bm_id, yayin_id, izleme_id, atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan, created_at
  ) VALUES (
    v_bm_hbstore, v_yayin_id, v_izleme_hb_ileri, 10, 20, 10, 30, '2026-02-15 10:02:00+03'::timestamptz
  );

  -- YardimciBM5 -> BM_HBSTORE challenge kaydı oluşturulur
  v_challenge_hb_kayip := gen_random_uuid();
  INSERT INTO public.challenge_kayitlari (
    challenge_id, gonderen_id, alan_id, yayin_id, arac_id, arac_turu, son_tarih, izlendi_mi, created_at
  ) VALUES (
    v_challenge_hb_kayip, v_yardimci_bm5, v_bm_hbstore, v_yayin_id, v_arac_id, v_arac_turu,
    '2026-02-10 00:00:00+03'::timestamptz, false, '2026-02-01 10:00:00+03'::timestamptz
  );

  INSERT INTO public.challenge_kayip_kayitlari (
    kullanici_id, yayin_id, challenge_id, kaybedilen_puan, created_at
  ) VALUES (
    v_bm_hbstore, v_yayin_id, v_challenge_hb_kayip, 20, '2026-02-15 11:00:00+03'::timestamptz
  );

  -- Ayrıca 2026 Q2'de (Nisan sipariş haftası sonrası, 15 Nisan) 300 puan kazansın
  -- (Bu puan 1–7 Nisan sipariş haftasına DAHİL EDİLMEMELİDİR; ayrı oturum v_izleme_hb_q2 kullanılır)
  v_izleme_hb_q2 := gen_random_uuid();
  INSERT INTO public.cc_izleme_kayitlari (
    izleme_id, bm_id, yayin_id, arac_id, arac_turu, izleme_turu, tamamlandi_mi,
    video_suresi_saniye, izleme_baslangic, created_at
  ) VALUES (
    v_izleme_hb_q2, v_bm_hbstore, v_yayin_id, v_arac_id, v_arac_turu, 'kendi_izleme', true,
    120, '2026-04-15 10:00:00+03'::timestamptz, '2026-04-15 10:00:00+03'::timestamptz
  );

  INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
  VALUES (v_bm_hbstore, v_yayin_id, v_izleme_hb_q2, 'izleme', 300, '2026-04-15 10:05:00+03'::timestamptz);

  -- 1. HBStore açıkken (3 Nisan 2026 12:00 TR - Q1 Store Günleri):
  --    Henüz sipariş harcaması yokken bakiye = 450 olmalı
  v_bakiye := public.get_harcama_bakiyesi_tarihli(v_bm_hbstore, '2026-04-03 12:00:00+03'::timestamptz);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (70, 'Bölüm 6', 'HBStore Açık - Harcamasız Bakiye', '450', v_bakiye::text,
     CASE WHEN v_bakiye = 450 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Q1 Store Günlerinde yalnızca Q1 puanları (500 kazanç - 50 kayıp) çekildi; Q2 puanı izole edildi');

  -- Store ürün ve sipariş/harcama ekle
  SELECT kategori_id INTO v_kat_id FROM public.store_kategoriler LIMIT 1;
  IF v_kat_id IS NULL THEN
    v_kat_id := gen_random_uuid();
    INSERT INTO public.store_kategoriler (kategori_id, ad, sira, aktif_mi)
    VALUES (v_kat_id, 'Test Kat', 1, true);
  END IF;

  INSERT INTO public.store_urunler (urun_id, kategori_id, ad, puan_fiyati, stok, aktif_mi)
  VALUES (v_urun_id, v_kat_id, 'Test Ürün BM', 150, 10, true);

  -- Kullanıcı Q1 kaynak çeyreğiyle 150 puanlık sipariş verir
  INSERT INTO public.store_siparisler (
    siparis_id, kullanici_id, urun_id, adres_snapshot, adet, puan_birim_fiyat,
    toplam_puan, durum, kaynak_ceyrek_baslangici, created_at, guncellenme_at
  ) VALUES (
    v_siparis_id, v_bm_hbstore, v_urun_id, '{}'::jsonb, 1, 150, 150,
    'beklemede', '2026-01-01 00:00:00+03'::timestamptz,
    '2026-04-03 13:00:00+03'::timestamptz, '2026-04-03 13:00:00+03'::timestamptz
  );

  INSERT INTO public.store_puan_harcamalari (harcama_id, kullanici_id, siparis_id, puan_miktari, tur, created_at)
  VALUES (gen_random_uuid(), v_bm_hbstore, v_siparis_id, 150, 'harcama', '2026-04-03 13:00:00+03'::timestamptz);

  -- 2. Sipariş sonrası bakiye = 450 - 150 = 300 olmalı
  v_bakiye := public.get_harcama_bakiyesi_tarihli(v_bm_hbstore, '2026-04-03 14:00:00+03'::timestamptz);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (71, 'Bölüm 6', 'HBStore Açık - Sipariş Sonrası Bakiye', '300', v_bakiye::text,
     CASE WHEN v_bakiye = 300 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     '450 net öğrenme puanından 150 puanlık sipariş harcaması düşüldü');

  -- 3. 50 puan iade edilince bakiye = 300 + 50 = 350 olmalı
  INSERT INTO public.store_puan_harcamalari (harcama_id, kullanici_id, siparis_id, puan_miktari, tur, created_at)
  VALUES (gen_random_uuid(), v_bm_hbstore, v_siparis_id, 50, 'iade', '2026-04-04 10:00:00+03'::timestamptz);

  v_bakiye := public.get_harcama_bakiyesi_tarihli(v_bm_hbstore, '2026-04-04 11:00:00+03'::timestamptz);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (72, 'Bölüm 6', 'HBStore Açık - İade Sonrası Bakiye', '350', v_bakiye::text,
     CASE WHEN v_bakiye = 350 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     '50 puan iade siparişin kaynak çeyreğine eklenerek bakiye 350 oldu');

  -- 4. Mağaza kapalıyken (15 Şubat 2026 - Q1 birikim dönemi):
  --    get_harcama_bakiyesi_tarihli o an biriken Q1 puanını get_bm_puan_ozet ile okur
  v_bakiye := public.get_harcama_bakiyesi_tarihli(v_bm_hbstore, '2026-02-20 12:00:00+03'::timestamptz);

  INSERT INTO test_bm_puan_sonuclari (sira, bolum, test_adi, beklenen, gercek, durum, aciklama)
  VALUES
    (73, 'Bölüm 6', 'HBStore Kapalı - Birikim Dönemi Bakiyesi', '350', v_bakiye::text,
     CASE WHEN v_bakiye = 350 THEN 'GEÇTİ' ELSE 'BAŞARISIZ' END,
     'Mağaza kapalıyken de get_bm_puan_ozet üzerinden güncel çeyrek bakiyesi okunur');

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
FROM test_bm_puan_sonuclari
ORDER BY sira;

-- ----------------------------------------------------------------------------
-- ROLLBACK: Hiçbir kalıcı veri veya test kullanıcısı bırakılmaz
-- ----------------------------------------------------------------------------
ROLLBACK;
