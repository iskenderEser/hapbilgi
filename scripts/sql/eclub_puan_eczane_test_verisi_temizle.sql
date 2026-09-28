-- ============================================================================
-- scripts/sql/eclub_puan_eczane_test_verisi_temizle.sql
-- ============================================================================
-- DİKKAT: YALNIZCA GELİŞTİRME VE TEST ORTAMINDA KULLANILMAK ÜZERE HAZIRLANMIŞTIR.
--
-- UYARI:
-- 1. Bu dosya canlı veya gerçek veri barındıran hiçbir ortamda çalıştırılamaz!
-- 2. E-Club test puanlarını ve test hediye çeki kayıtlarını GERİ DÖNDÜRÜLEMEZ
--    biçimde temizler.
-- 3. Faz 1A "Puanın kazanıldığı eczaneye sabitlenmesi" migration'ı öncesinde,
--    eczane_id alanı bulunmayan niteliksiz geliştirme test verilerini temizlemek
--    amacıyla çalıştırılır.
-- 4. Eczanem, T-Club, C-Club veya genel sistem/kullanıcı verilerine DOKUNMAZ.
-- 5. Foreign Key bağımlılık sırasına riayet eder.
-- ============================================================================

BEGIN;

-- İşlem süresince eşzamanlı veri yazımlarını kilitle
SELECT pg_advisory_xact_lock(hashtextextended('eclub-test-veri-temizle-lock', 0));

-- 1. Çek teslimat e-posta kuyruğu (FK: eclub_store_cek_talepleri)
DELETE FROM public.eclub_store_cek_eposta_kuyrugu;

-- 2. Hediye çeki teslimatı için oluşturulmuş in-app bildirimler
DELETE FROM public.eclub_bildirimler
 WHERE kayit_turu = 'cek';

-- 3. Dönemlik puan devirleri (FK: eclub_store_cek_talepleri)
DELETE FROM public.eclub_store_puan_devirleri;

-- 4. Hediye çeki talepleri
DELETE FROM public.eclub_store_cek_talepleri;

-- 5. E-Club kazanılan puan kayıtları
DELETE FROM public.eclub_kazanilan_puanlar;

COMMIT;
