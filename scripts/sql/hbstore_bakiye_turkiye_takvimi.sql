-- HBStore: bakiye çeyrek sınırlarını Europe/Istanbul takvimine sabitle.
-- Kaynak: kullanıcı tarafından iletilen mevcut veritabanı fonksiyon tanımı.
-- UTT/BM puan kaynakları, harcama/iade hesabı ve dönem devri davranışı korunur.
-- Başlangıç dahil, sonraki çeyrek başlangıcı hariç aralık kullanılır.
-- Sipariş kilidi ve mağaza erişim kuralları değişmez.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_harcama_bakiyesi(p_kullanici_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rol text;
  v_kazanim integer := 0;
  v_kayip integer := 0;
  v_harcama integer := 0;
  v_iade integer := 0;
  -- Türkiye takvimindeki çeyreği tek bir an üzerinden belirle.
  -- Yerel çeyrek sınırlarını mutlak zamanlara dönüştür; oturum TZ'sine bağlı kalma.
  v_ceyrek_yerel timestamp := date_trunc(
    'quarter', clock_timestamp() AT TIME ZONE 'Europe/Istanbul'
  );
  v_ceyrek_bas timestamptz := v_ceyrek_yerel AT TIME ZONE 'Europe/Istanbul';
  v_ceyrek_bit timestamptz :=
    (v_ceyrek_yerel + interval '3 months') AT TIME ZONE 'Europe/Istanbul';
BEGIN
  SELECT k.rol INTO v_rol
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_kullanici_id;

  IF v_rol NOT IN ('utt', 'kd_utt', 'bm') OR v_rol IS NULL THEN
    RETURN 0;
  END IF;

  IF v_rol IN ('utt', 'kd_utt') THEN
    SELECT COALESCE(SUM(p.puan), 0)::integer INTO v_kazanim
    FROM public.kazanilan_puanlar p
    WHERE p.kullanici_id = p_kullanici_id
      AND p.puan_turu IN ('izleme', 'cevaplama', 'oneri', 'extra')
      AND p.created_at >= v_ceyrek_bas AND p.created_at < v_ceyrek_bit;

    SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::integer INTO v_kayip
    FROM (
      SELECT kaybedilen_puan, created_at FROM public.ileri_sarma_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.yanlis_cevap_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.oneri_kayip_kayitlari WHERE kullanici_id = p_kullanici_id
    ) x
    WHERE x.created_at >= v_ceyrek_bas AND x.created_at < v_ceyrek_bit;
  ELSE
    SELECT COALESCE(SUM(p.puan), 0)::integer INTO v_kazanim
    FROM public.cc_kazanilan_puanlar p
    WHERE p.bm_id = p_kullanici_id
      AND p.puan_turu IN ('izleme', 'cevaplama', 'extra', 'cc_gonderme', 'cc_referral')
      AND p.created_at >= v_ceyrek_bas AND p.created_at < v_ceyrek_bit;

    SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::integer INTO v_kayip
    FROM (
      SELECT kaybedilen_puan, created_at FROM public.cc_ileri_sarma_kayitlari WHERE bm_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.cc_yanlis_cevap_kayitlari WHERE bm_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.challenge_kayip_kayitlari WHERE kullanici_id = p_kullanici_id
    ) x
    WHERE x.created_at >= v_ceyrek_bas AND x.created_at < v_ceyrek_bit;
  END IF;

  SELECT
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'harcama'), 0)::integer,
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'iade'), 0)::integer
  INTO v_harcama, v_iade
  FROM public.store_puan_harcamalari h
  WHERE h.kullanici_id = p_kullanici_id
    AND h.created_at >= v_ceyrek_bas AND h.created_at < v_ceyrek_bit;

  RETURN v_kazanim - v_kayip - v_harcama + v_iade;
END;
$function$;

COMMIT;
