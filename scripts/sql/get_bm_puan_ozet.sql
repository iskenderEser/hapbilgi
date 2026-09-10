-- scripts/sql/get_bm_puan_ozet.sql
--
-- BM kişisel puan özeti ortak fonksiyonu.
-- C-Club ligi, HBStore ve bi (HapBI) için BM'nin 5 kazanım ve 3 kayıp kalemini
-- ve toplamlarını tek bir kanonik kaynaktan hesaplar.
--
-- Kalemler:
--   Kazanımlar:
--     izleme_puani       (cc_kazanilan_puanlar, puan_turu = 'izleme')
--     cevaplama_puani    (cc_kazanilan_puanlar, puan_turu = 'cevaplama')
--     extra_puan         (cc_kazanilan_puanlar, puan_turu = 'extra')
--     cc_gonderme_puani  (cc_kazanilan_puanlar, puan_turu = 'cc_gonderme')
--     cc_referral_puani  (cc_kazanilan_puanlar, puan_turu = 'cc_referral')
--   Kayıplar:
--     ileri_sarma_kaybi  (cc_ileri_sarma_kayitlari, kaybedilen_puan)
--     yanlis_cevap_kaybi (cc_yanlis_cevap_kayitlari, kaybedilen_puan)
--     challenge_kaybi    (challenge_kayip_kayitlari, kaybedilen_puan)
--   Toplamlar:
--     toplam_kazanc      (5 kazanımın toplamı)
--     toplam_kayip       (3 kaybın toplamı)
--     toplam_net         (toplam_kazanc - toplam_kayip)

BEGIN;

CREATE OR REPLACE FUNCTION public.get_bm_puan_ozet(
  p_bm_id uuid,
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone
)
RETURNS TABLE(
  bm_id uuid,
  izleme_puani integer,
  cevaplama_puani integer,
  extra_puan integer,
  cc_gonderme_puani integer,
  cc_referral_puani integer,
  ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer,
  challenge_kaybi integer,
  toplam_kazanc integer,
  toplam_kayip integer,
  toplam_net integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
WITH
kazanim AS (
  SELECT
    COALESCE(SUM(CASE WHEN p.puan_turu = 'izleme' THEN p.puan ELSE 0 END), 0)::integer AS izleme_puani,
    COALESCE(SUM(CASE WHEN p.puan_turu = 'cevaplama' THEN p.puan ELSE 0 END), 0)::integer AS cevaplama_puani,
    COALESCE(SUM(CASE WHEN p.puan_turu = 'extra' THEN p.puan ELSE 0 END), 0)::integer AS extra_puan,
    COALESCE(SUM(CASE WHEN p.puan_turu = 'cc_gonderme' THEN p.puan ELSE 0 END), 0)::integer AS cc_gonderme_puani,
    COALESCE(SUM(CASE WHEN p.puan_turu = 'cc_referral' THEN p.puan ELSE 0 END), 0)::integer AS cc_referral_puani
  FROM public.cc_kazanilan_puanlar p
  WHERE p.bm_id = p_bm_id
    AND p.created_at >= p_baslangic
    AND p.created_at <= p_bitis
),
ileri AS (
  SELECT COALESCE(SUM(isk.kaybedilen_puan), 0)::integer AS ileri_sarma_kaybi
  FROM public.cc_ileri_sarma_kayitlari isk
  WHERE isk.bm_id = p_bm_id
    AND isk.created_at >= p_baslangic
    AND isk.created_at <= p_bitis
),
yanlis AS (
  SELECT COALESCE(SUM(yck.kaybedilen_puan), 0)::integer AS yanlis_cevap_kaybi
  FROM public.cc_yanlis_cevap_kayitlari yck
  WHERE yck.bm_id = p_bm_id
    AND yck.created_at >= p_baslangic
    AND yck.created_at <= p_bitis
),
challenge AS (
  SELECT COALESCE(SUM(ckk.kaybedilen_puan), 0)::integer AS challenge_kaybi
  FROM public.challenge_kayip_kayitlari ckk
  WHERE ckk.kullanici_id = p_bm_id
    AND ckk.created_at >= p_baslangic
    AND ckk.created_at <= p_bitis
)
SELECT
  p_bm_id AS bm_id,
  k.izleme_puani,
  k.cevaplama_puani,
  k.extra_puan,
  k.cc_gonderme_puani,
  k.cc_referral_puani,
  i.ileri_sarma_kaybi,
  y.yanlis_cevap_kaybi,
  c.challenge_kaybi,
  (k.izleme_puani + k.cevaplama_puani + k.extra_puan + k.cc_gonderme_puani + k.cc_referral_puani)::integer AS toplam_kazanc,
  (i.ileri_sarma_kaybi + y.yanlis_cevap_kaybi + c.challenge_kaybi)::integer AS toplam_kayip,
  ((k.izleme_puani + k.cevaplama_puani + k.extra_puan + k.cc_gonderme_puani + k.cc_referral_puani)
    - (i.ileri_sarma_kaybi + y.yanlis_cevap_kaybi + c.challenge_kaybi))::integer AS toplam_net
FROM kazanim k
CROSS JOIN ileri i
CROSS JOIN yanlis y
CROSS JOIN challenge c;
$function$;

REVOKE ALL ON FUNCTION public.get_bm_puan_ozet(uuid, timestamp with time zone, timestamp with time zone)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_bm_puan_ozet(uuid, timestamp with time zone, timestamp with time zone)
  TO service_role;

COMMIT;
