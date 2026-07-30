-- scripts/sql/hbligi_v1_kaldir.sql
--
-- E9 Faz 5 — HBLigi v1 nesnelerinin kaldırılması (docs/E9_hebligi_gelistirme_is_plani.md).
-- v2 (özet tablo) tüm tüketicilerce kullanılıyor ve birebir + canlı doğrulandı;
-- v1 artık ölü. Tanımlar git geçmişinde (scripts/sql/hbligi_v2_kopya.sql v1'in
-- aynısıdır) — gerekirse geri kurulur.
--
-- SIRA: v_hbligi_sirali (hb_ligi'ye bağlı) → hb_ligi → 3 periyot RPC'si.
-- CASCADE YOK: beklenmeyen bir bağımlılık varsa DROP güvenle hata versin.

DROP VIEW IF EXISTS public.v_hbligi_sirali;
DROP VIEW IF EXISTS public.hb_ligi;

DROP FUNCTION IF EXISTS public.get_hb_ligi_aylik(integer, integer);
DROP FUNCTION IF EXISTS public.get_hb_ligi_donemlik(integer, integer);
DROP FUNCTION IF EXISTS public.get_hb_ligi_yillik(integer);
