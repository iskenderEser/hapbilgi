-- scripts/sql/hbligi_v2_okuma.sql
--
-- E9 Faz 2.4 — HBLigi_v2 okuma katmanı özet tablodan (docs/E9_hebligi_gelistirme_is_plani.md).
-- hb_ligi_v2 + 3 periyot RPC'si artık her okumada 4 tablodan SUM yapmak yerine
-- hb_ligi_ozet_v2 kovalarını okur (tüm-zaman = tüm aylar; çeyrek = 3 ay;
-- yıl = 12 ay; ay = tek kova). Çıktı sözleşmesi (22 kolon) DEĞİŞMEZ.
--
-- Hiyerarşi ve sıra hâlâ okuma anında: kullanicilar JOIN + row_number.
-- rol IN (utt,kd_utt) + aktif_mi süzgeci kullanicilar üzerinde (v1 semantiği:
-- puanı olmayan aktif UTT de 0'la listede; LEFT JOIN → COALESCE 0).
-- toplam_puan = 4 kazanım − 3 kayıp (periyot RPC'lerinin kanonik formülü).
--
-- KOŞUM: tamamı bir kez. CREATE OR REPLACE → tekrar koşumu güvenli.
-- Faz 2.6 bunu v1 canlı-SUM ile birebir doğrular.

-- 1) Tüm-zaman: hb_ligi_v2 (özet tablodan) ------------------------------------
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

-- Ortak periyot gövdesi (aylık/dönemlik/yıllık yalnız kova süzgecinde ayrışır).
-- 2) Aylık --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hb_ligi_aylik_v2(p_yil integer, p_ay integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
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
    WHERE o.yil = p_yil AND o.ay = p_ay
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

-- 3) Dönemlik (çeyrek = 3 ay) --------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hb_ligi_donemlik_v2(p_yil integer, p_ceyrek integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
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
    WHERE o.yil = p_yil AND o.ay BETWEEN (p_ceyrek - 1) * 3 + 1 AND p_ceyrek * 3
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

-- 4) Yıllık (12 ay) ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hb_ligi_yillik_v2(p_yil integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
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
    WHERE o.yil = p_yil
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
