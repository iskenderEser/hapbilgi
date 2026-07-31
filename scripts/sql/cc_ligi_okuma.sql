-- scripts/sql/cc_ligi_okuma.sql
--
-- CC Ligi ölçek — okuma katmanı günlük özet'ten + haftalık RPC.
-- get_cc_ligi_aylik/donemlik/yillik artık canlı-SUM yerine cc_ligi_ozet'ten
-- tarih aralığıyla toplar; çıktı sözleşmesi (19 kolon, RANK) DEĞİŞMEZ.
-- Yeni get_cc_ligi_haftalik eklenir (Pazartesi bazlı, date_trunc('week')).
--
-- Ortak yardımcı _cc_ligi_aralik(bas, bit) — bir tarih aralığından sıralı lig.
-- SECURITY DEFINER: cc_ligi_ozet iç/KORUMALI tablo (CC api zaten service_role
-- kullanıyor ama tanımlayıcı yetkisi güvenli/geleceğe dönük).
--
-- KOŞUM: tamamı bir kez. CREATE OR REPLACE → tekrar koşumu güvenli.

CREATE OR REPLACE FUNCTION public._cc_ligi_aralik(p_bas date, p_bit date)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, challenge_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH oz AS (
    SELECT o.kullanici_id,
      SUM(o.izleme_puani)::integer AS izleme, SUM(o.cevaplama_puani)::integer AS cev, SUM(o.extra_puani)::integer AS extra,
      SUM(o.cc_gonderme_puani)::integer AS ccg, SUM(o.cc_referral_puani)::integer AS ccr,
      SUM(o.ileri_sarma_kaybi)::integer AS ileri, SUM(o.yanlis_cevap_kaybi)::integer AS yanlis, SUM(o.challenge_kaybi)::integer AS chl
    FROM cc_ligi_ozet o
    WHERE o.tarih >= p_bas AND o.tarih < p_bit
    GROUP BY o.kullanici_id
  ),
  birlesik AS (
    SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad, k.firma_id, k.takim_id, k.bolge_id,
      COALESCE(oz.izleme,0) AS izleme_puani, COALESCE(oz.cev,0) AS cevaplama_puani, COALESCE(oz.extra,0) AS extra_puani,
      COALESCE(oz.ccg,0) AS cc_gonderme_puani, COALESCE(oz.ccr,0) AS cc_referral_puani,
      COALESCE(oz.ileri,0) AS ileri_sarma_kaybi, COALESCE(oz.yanlis,0) AS yanlis_cevap_kaybi, COALESCE(oz.chl,0) AS challenge_kaybi,
      (COALESCE(oz.izleme,0)+COALESCE(oz.cev,0)+COALESCE(oz.extra,0)+COALESCE(oz.ccg,0)+COALESCE(oz.ccr,0)
       - COALESCE(oz.ileri,0) - COALESCE(oz.yanlis,0) - COALESCE(oz.chl,0))::integer AS toplam_net_puan
    FROM kullanicilar k
    LEFT JOIN oz ON oz.kullanici_id = k.kullanici_id
    WHERE k.rol = 'bm' AND k.aktif_mi = true
  )
  SELECT b.kullanici_id, b.ad, b.soyad, b.firma_id, b.takim_id, b.bolge_id,
    b.izleme_puani, b.cevaplama_puani, b.extra_puani, b.cc_gonderme_puani, b.cc_referral_puani,
    b.ileri_sarma_kaybi, b.yanlis_cevap_kaybi, b.challenge_kaybi, b.toplam_net_puan,
    RANK() OVER (ORDER BY b.toplam_net_puan DESC),
    RANK() OVER (PARTITION BY b.firma_id ORDER BY b.toplam_net_puan DESC),
    RANK() OVER (PARTITION BY b.takim_id ORDER BY b.toplam_net_puan DESC),
    RANK() OVER (PARTITION BY b.bolge_id ORDER BY b.toplam_net_puan DESC)
  FROM birlesik b
  ORDER BY b.toplam_net_puan DESC;
END;
$function$;

-- Aylık
CREATE OR REPLACE FUNCTION public.get_cc_ligi_aylik(p_yil integer, p_ay integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, challenge_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    make_date(p_yil, p_ay, 1),
    (make_date(p_yil, p_ay, 1) + interval '1 month')::date
  );
$function$;

-- Dönemlik (çeyrek = 3 ay)
CREATE OR REPLACE FUNCTION public.get_cc_ligi_donemlik(p_yil integer, p_ceyrek integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, challenge_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1),
    (make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1) + interval '3 months')::date
  );
$function$;

-- Yıllık
CREATE OR REPLACE FUNCTION public.get_cc_ligi_yillik(p_yil integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, challenge_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    make_date(p_yil, 1, 1),
    make_date(p_yil + 1, 1, 1)
  );
$function$;

-- Haftalık — Pazartesi bazlı; hafta 1 = yılın 1 Ocak'ını içeren haftanın Pazartesi'si.
CREATE OR REPLACE FUNCTION public.get_cc_ligi_haftalik(p_yil integer, p_hafta integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, challenge_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7),
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7 + 7)
  );
$function$;
