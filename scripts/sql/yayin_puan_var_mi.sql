-- scripts/sql/yayin_puan_var_mi.sql
--
-- Talep/Yayın Silme — Adım 2, RPC 1/3 (24.07.2026).
-- "Puanlı yayın silinmez" kuralının tek kaynağı: bu yayına bağlı HERHANGİ bir
-- puan defterinde (kazanç ya da kayıp — puan puandır) kayıt varsa true döner.
--
-- Kapsam (Adım 0 keşfi — 4 kanal, 14 defter):
--   T-Club : kazanilan_puanlar, yanlis_cevap_kayitlari, ileri_sarma_kayitlari,
--            oneri_kayip_kayitlari
--   C-Club : cc_kazanilan_puanlar, cc_ileri_sarma_kayitlari,
--            cc_yanlis_cevap_kayitlari, challenge_kayip_kayitlari
--   E-Club : eclub_kazanilan_puanlar, eclub_utt_puanlari,
--            eclub_dogru_cevap_kayitlari, eclub_yanlis_cevap_kayitlari,
--            eclub_oneri_kayip_kayitlari
--   Eczanem: eczanem_puan_kayitlari (yayin_id YOK — izleme üzerinden)
--
-- 13 defter doğrudan yayin_id taşır; Eczanem yalnız izleme_id taşıdığından
-- eczanem_izleme_kayitlari.yayin_id üzerinden bağlanır. OR'lu EXISTS zinciri
-- ilk kayıtta kısa devre yapar (tüm tabloları taramaz).
--
-- KOŞUM: Supabase SQL editöründe bu dosya bir kez çalıştırılır. Yeniden koşum
-- güvenlidir (CREATE OR REPLACE). Salt-okuma (STABLE); veri değiştirmez.

CREATE OR REPLACE FUNCTION public.yayin_puan_var_mi(p_yayin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
  SELECT
       EXISTS (SELECT 1 FROM kazanilan_puanlar            WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM cc_kazanilan_puanlar         WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM eclub_kazanilan_puanlar      WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM eclub_utt_puanlari           WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM eclub_dogru_cevap_kayitlari  WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM yanlis_cevap_kayitlari       WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM ileri_sarma_kayitlari        WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM oneri_kayip_kayitlari        WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM cc_ileri_sarma_kayitlari     WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM cc_yanlis_cevap_kayitlari    WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM challenge_kayip_kayitlari    WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM eclub_yanlis_cevap_kayitlari WHERE yayin_id = p_yayin_id)
    OR EXISTS (SELECT 1 FROM eclub_oneri_kayip_kayitlari  WHERE yayin_id = p_yayin_id)
    OR EXISTS (
         SELECT 1
         FROM eczanem_puan_kayitlari epk
         JOIN eczanem_izleme_kayitlari eik ON eik.izleme_id = epk.izleme_id
         WHERE eik.yayin_id = p_yayin_id
       );
$fonk$;

-- Uygulama (service_role) ve diğer RPC'ler (tekil_talep_sil / toplu_test_sil) çağırabilsin.
GRANT EXECUTE ON FUNCTION public.yayin_puan_var_mi(uuid) TO service_role;

-- Doğrulama (isteğe bağlı): puanlı bilinen bir yayında true dönmeli.
-- SELECT public.yayin_puan_var_mi('<yayin_id>');
