-- ==========================================================================
-- FAZ 1A — yalnız niteliksiz E-Club puan test verisini temizleme
-- ==========================================================================
-- Bu dosya SQL'i çalıştırmaz; kullanıcı tarafından yalnız geliştirme/test
-- veritabanında, eclub_puan_eczane_sabitleme.sql öncesinde çalıştırılmak üzere
-- hazırlanmıştır.
--
-- Gerçek kullanıcı/veri bulunmadığı bilgisine dayanır. Store taleplerini,
-- bildirimleri, üyelikleri, eczaneleri veya başka modülleri silmez.
-- ==========================================================================

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('eclub-puan-test-verisi-temizle-faz-1a', 0)
);

LOCK TABLE public.eclub_kazanilan_puanlar IN ACCESS EXCLUSIVE MODE;

DELETE FROM public.eclub_kazanilan_puanlar;

COMMIT;
