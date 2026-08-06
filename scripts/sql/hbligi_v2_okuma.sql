-- scripts/sql/hbligi_v2_okuma.sql
--
-- E9 Faz 6.4+6.5 — HBLigi_v2 okuma katmanı GÜNLÜK özetten + haftalık RPC
-- (docs/E9_hebligi_gelistirme_is_plani.md).
--
-- hb_ligi_v2 (tüm-zaman) + aylık/dönemlik/yıllık/HAFTALIK RPC'leri, günlük özet
-- kovalarından tarih aralığıyla toplar. Çıktı sözleşmesi (22 kolon) DEĞİŞMEZ.
-- Hiyerarşi/sıra okuma anında: kullanicilar JOIN + row_number.
--
-- Periyot RPC'leri SECURITY DEFINER: hb_ligi_ozet_v2 iç/KORUMALI tablo; çağıran
-- rol (authenticated) SELECT edemez, RPC tanımlayıcı yetkisiyle okur. Tüm-zaman
-- view'ı yalnız admin (service_role) tarafından okunur → gerek yok.
--
-- Tarih aralıkları (make_date/date_trunc = TR takvim günü; kova ataması
-- (created_at AT TIME ZONE 'Europe/Istanbul')::date ile tutarlı):
--   aylık   : [make_date(yil,ay,1), +1 ay)
--   dönemlik: [make_date(yil,(çeyrek-1)*3+1,1), +3 ay)
--   yıllık  : [make_date(yil,1,1), make_date(yil+1,1,1))
--   haftalık: yılın ilk gününü içeren Pazartesi + (hafta-1)*7 gün, [bas, +7 gün)
--
-- KOŞUM: tamamı bir kez. CREATE OR REPLACE → tekrar koşumu güvenli.

-- 1) Tüm-zaman: hb_ligi_v2 (günlük özetten, tarih filtresiz)
CREATE OR REPLACE VIEW public.hb_ligi_v2 AS
 SELECT k.kullanici_id,
    k.rol,
    COALESCE(oz.izleme_puani, 0::bigint) AS izleme_puani,
    COALESCE(oz.cevaplama_puani, 0::bigint) AS cevaplama_puani,
    COALESCE(oz.oneri_puani, 0::bigint) AS oneri_puani,
    COALESCE(oz.extra_puani, 0::bigint) AS extra_puani,
    COALESCE(oz.ileri_sarma_kaybi, 0::bigint) AS ileri_sarma_kaybi,
    COALESCE(oz.yanlis_cevap_kaybi, 0::bigint) AS yanlis_cevap_kaybi,
    COALESCE(oz.oneri_kaybi, 0::bigint) AS oneri_kaybi,
    (COALESCE(oz.izleme_puani, 0::bigint) + COALESCE(oz.cevaplama_puani, 0::bigint)
       + COALESCE(oz.oneri_puani, 0::bigint) + COALESCE(oz.extra_puani, 0::bigint)
       - COALESCE(oz.ileri_sarma_kaybi, 0::bigint) - COALESCE(oz.yanlis_cevap_kaybi, 0::bigint)
       - COALESCE(oz.oneri_kaybi, 0::bigint)) AS toplam_puan
   FROM kullanicilar k
     LEFT JOIN ( SELECT hb_ligi_ozet_v2.kullanici_id,
            sum(hb_ligi_ozet_v2.izleme_puani) AS izleme_puani,
            sum(hb_ligi_ozet_v2.cevaplama_puani) AS cevaplama_puani,
            sum(hb_ligi_ozet_v2.oneri_puani) AS oneri_puani,
            sum(hb_ligi_ozet_v2.extra_puani) AS extra_puani,
            sum(hb_ligi_ozet_v2.ileri_sarma_kaybi) AS ileri_sarma_kaybi,
            sum(hb_ligi_ozet_v2.yanlis_cevap_kaybi) AS yanlis_cevap_kaybi,
            sum(hb_ligi_ozet_v2.oneri_kaybi) AS oneri_kaybi
           FROM hb_ligi_ozet_v2
          GROUP BY hb_ligi_ozet_v2.kullanici_id) oz ON oz.kullanici_id = k.kullanici_id
  WHERE (k.rol::text = ANY (ARRAY['utt'::character varying, 'kd_utt'::character varying]::text[])) AND k.aktif_mi = true;

-- 1b) Üst katman: v_hbligi_sirali_v2 (JOIN + row_number) — profil/getUttData okur.
CREATE OR REPLACE VIEW public.v_hbligi_sirali_v2 AS
 SELECT hl.kullanici_id, hl.rol,
    hl.izleme_puani, hl.cevaplama_puani, hl.oneri_puani, hl.extra_puani,
    hl.ileri_sarma_kaybi, hl.yanlis_cevap_kaybi, hl.oneri_kaybi, hl.toplam_puan,
    k.ad, k.soyad, k.eposta,
    f.firma_id, f.firma_adi, t.takim_id, t.takim_adi, b.bolge_id, b.bolge_adi,
    row_number() OVER (PARTITION BY f.firma_id ORDER BY hl.toplam_puan DESC) AS firma_sirasi,
    row_number() OVER (PARTITION BY b.bolge_id ORDER BY hl.toplam_puan DESC) AS bolge_sirasi,
    row_number() OVER (PARTITION BY t.takim_id ORDER BY hl.toplam_puan DESC) AS takim_sirasi
   FROM hb_ligi_v2 hl
     JOIN kullanicilar k ON k.kullanici_id = hl.kullanici_id
     LEFT JOIN firmalar f ON f.firma_id = k.firma_id
     LEFT JOIN takimlar t ON t.takim_id = k.takim_id
     LEFT JOIN bolgeler b ON b.bolge_id = k.bolge_id;

-- View'lara SELECT yetkisi — yeniden kurulduğunda düşer, burada geri verilir.
-- Rapor (getUttData) bu view'ları service_role ile okur; yetki yoksa PostgREST
-- "42501 permission denied" döner ve rapor katkı/sıra 0/"-" gösterir (06.08.2026).
GRANT SELECT ON public.hb_ligi_v2, public.v_hbligi_sirali_v2 TO anon, authenticated, service_role;

-- Ortak: bir tarih aralığından [p_bas, p_bit) sıralı 22-kolon lig döndürür.
CREATE OR REPLACE FUNCTION public._hb_ligi_v2_aralik(p_bas date, p_bit date)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH oz AS (
    SELECT o.kullanici_id,
      SUM(o.izleme_puani)::integer AS izleme, SUM(o.cevaplama_puani)::integer AS cev,
      SUM(o.oneri_puani)::integer AS oneri, SUM(o.extra_puani)::integer AS extra,
      SUM(o.ileri_sarma_kaybi)::integer AS ileri, SUM(o.yanlis_cevap_kaybi)::integer AS yanlis,
      SUM(o.oneri_kaybi)::integer AS onerikayip
    FROM hb_ligi_ozet_v2 o
    WHERE o.tarih >= p_bas AND o.tarih < p_bit
    GROUP BY o.kullanici_id
  ),
  birlesik AS (
    SELECT k.kullanici_id, k.rol::text AS rol, k.ad::text AS ad, k.soyad::text AS soyad, k.eposta::text AS eposta,
      k.firma_id, k.takim_id, k.bolge_id,
      COALESCE(oz.izleme,0) AS izleme_puani, COALESCE(oz.cev,0) AS cevaplama_puani,
      COALESCE(oz.oneri,0) AS oneri_puani, COALESCE(oz.extra,0) AS extra_puani,
      COALESCE(oz.ileri,0) AS ileri_sarma_kaybi, COALESCE(oz.yanlis,0) AS yanlis_cevap_kaybi,
      COALESCE(oz.onerikayip,0) AS oneri_kaybi,
      (COALESCE(oz.izleme,0)+COALESCE(oz.cev,0)+COALESCE(oz.oneri,0)+COALESCE(oz.extra,0)
       - COALESCE(oz.ileri,0) - COALESCE(oz.yanlis,0) - COALESCE(oz.onerikayip,0))::integer AS toplam_puan
    FROM kullanicilar k
    LEFT JOIN oz ON oz.kullanici_id = k.kullanici_id
    WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi = true
  )
  SELECT b.kullanici_id, b.rol, b.izleme_puani, b.cevaplama_puani, b.oneri_puani, b.extra_puani,
    b.ileri_sarma_kaybi, b.yanlis_cevap_kaybi, b.oneri_kaybi, b.toplam_puan,
    b.ad, b.soyad, b.eposta, f.firma_id, f.firma_adi::text, t.takim_id, t.takim_adi::text, bo.bolge_id, bo.bolge_adi::text,
    row_number() OVER (PARTITION BY f.firma_id ORDER BY b.toplam_puan DESC),
    row_number() OVER (PARTITION BY bo.bolge_id ORDER BY b.toplam_puan DESC),
    row_number() OVER (PARTITION BY t.takim_id ORDER BY b.toplam_puan DESC)
  FROM birlesik b
  LEFT JOIN firmalar f ON f.firma_id=b.firma_id
  LEFT JOIN takimlar t ON t.takim_id=b.takim_id
  LEFT JOIN bolgeler bo ON bo.bolge_id=b.bolge_id;
END;
$function$;

-- 2) Aylık
CREATE OR REPLACE FUNCTION public.get_hb_ligi_aylik_v2(p_yil integer, p_ay integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    make_date(p_yil, p_ay, 1),
    (make_date(p_yil, p_ay, 1) + interval '1 month')::date
  );
$function$;

-- 3) Dönemlik (çeyrek = 3 ay)
CREATE OR REPLACE FUNCTION public.get_hb_ligi_donemlik_v2(p_yil integer, p_ceyrek integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1),
    (make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1) + interval '3 months')::date
  );
$function$;

-- 4) Yıllık
CREATE OR REPLACE FUNCTION public.get_hb_ligi_yillik_v2(p_yil integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    make_date(p_yil, 1, 1),
    make_date(p_yil + 1, 1, 1)
  );
$function$;

-- 5) Haftalık — Pazartesi bazlı; hafta 1 = yılın 1 Ocak'ını içeren haftanın Pazartesi'si.
CREATE OR REPLACE FUNCTION public.get_hb_ligi_haftalik_v2(p_yil integer, p_hafta integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7),
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7 + 7)
  );
$function$;
