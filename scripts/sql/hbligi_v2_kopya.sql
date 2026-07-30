-- scripts/sql/hbligi_v2_kopya.sql
--
-- E9 Faz 1.1 — HBLigi_v2 birebir kopya (docs/E9_hebligi_gelistirme_is_plani.md).
-- v1'in aynısı, yalnız `_v2` ekiyle. Geliştirme (özet tablo, Faz 2) bunun
-- üzerinde yapılacak; v1 hiç durmadan çalışır.
--
-- Birebir: gövdeler v1'den (pg_get_viewdef / pg_get_functiondef, 31.07.2026)
-- aynen alındı; tek fark v_hbligi_sirali_v2'nin `FROM hb_ligi_v2` okumasıdır.
-- RPC'ler ham tablolardan okuduğu için iç değişiklik yok, yalnız ad `_v2`.
--
-- KOŞUM: tamamı bir kez çalıştırılır. Yeni adlar + CREATE OR REPLACE →
-- v1 nesnelerine ve veriye dokunmaz, tekrar koşumu güvenlidir.

-- 1) Alt katman: hb_ligi_v2 (SUM) ----------------------------------------------
CREATE OR REPLACE VIEW public.hb_ligi_v2 AS
 SELECT k.kullanici_id,
    k.rol,
    COALESCE(kp.izleme_puani, 0::bigint) AS izleme_puani,
    COALESCE(kp.cevaplama_puani, 0::bigint) AS cevaplama_puani,
    COALESCE(kp.oneri_puani, 0::bigint) AS oneri_puani,
    COALESCE(kp.extra_puani, 0::bigint) AS extra_puani,
    COALESCE(isk.toplam_kayip, 0::bigint) AS ileri_sarma_kaybi,
    COALESCE(ycb.toplam_kayip, 0::bigint) AS yanlis_cevap_kaybi,
    COALESCE(okb.toplam_kayip, 0::bigint) AS oneri_kaybi,
    COALESCE(kp.toplam_kazanim, 0::bigint) - COALESCE(isk.toplam_kayip, 0::bigint) - COALESCE(ycb.toplam_kayip, 0::bigint) - COALESCE(okb.toplam_kayip, 0::bigint) AS toplam_puan
   FROM kullanicilar k
     LEFT JOIN ( SELECT kazanilan_puanlar.kullanici_id,
            sum(CASE WHEN kazanilan_puanlar.puan_turu::text = 'izleme'::text THEN kazanilan_puanlar.puan ELSE 0 END) AS izleme_puani,
            sum(CASE WHEN kazanilan_puanlar.puan_turu::text = 'cevaplama'::text THEN kazanilan_puanlar.puan ELSE 0 END) AS cevaplama_puani,
            sum(CASE WHEN kazanilan_puanlar.puan_turu::text = 'oneri'::text THEN kazanilan_puanlar.puan ELSE 0 END) AS oneri_puani,
            sum(CASE WHEN kazanilan_puanlar.puan_turu::text = 'extra'::text THEN kazanilan_puanlar.puan ELSE 0 END) AS extra_puani,
            sum(kazanilan_puanlar.puan) AS toplam_kazanim
           FROM kazanilan_puanlar
          GROUP BY kazanilan_puanlar.kullanici_id) kp ON kp.kullanici_id = k.kullanici_id
     LEFT JOIN ( SELECT ileri_sarma_kayitlari.kullanici_id,
            sum(ileri_sarma_kayitlari.kaybedilen_puan) AS toplam_kayip
           FROM ileri_sarma_kayitlari
          GROUP BY ileri_sarma_kayitlari.kullanici_id) isk ON isk.kullanici_id = k.kullanici_id
     LEFT JOIN ( SELECT yanlis_cevap_kayitlari.kullanici_id,
            sum(yanlis_cevap_kayitlari.kaybedilen_puan) AS toplam_kayip
           FROM yanlis_cevap_kayitlari
          GROUP BY yanlis_cevap_kayitlari.kullanici_id) ycb ON ycb.kullanici_id = k.kullanici_id
     LEFT JOIN ( SELECT oneri_kayip_kayitlari.kullanici_id,
            sum(oneri_kayip_kayitlari.kaybedilen_puan) AS toplam_kayip
           FROM oneri_kayip_kayitlari
          GROUP BY oneri_kayip_kayitlari.kullanici_id) okb ON okb.kullanici_id = k.kullanici_id
  WHERE (k.rol::text = ANY (ARRAY['utt'::character varying, 'kd_utt'::character varying]::text[])) AND k.aktif_mi = true;

-- 2) Üst katman: v_hbligi_sirali_v2 (JOIN + row_number) — FROM hb_ligi_v2 -------
CREATE OR REPLACE VIEW public.v_hbligi_sirali_v2 AS
 SELECT hl.kullanici_id,
    hl.rol,
    hl.izleme_puani,
    hl.cevaplama_puani,
    hl.oneri_puani,
    hl.extra_puani,
    hl.ileri_sarma_kaybi,
    hl.yanlis_cevap_kaybi,
    hl.oneri_kaybi,
    hl.toplam_puan,
    k.ad,
    k.soyad,
    k.eposta,
    f.firma_id,
    f.firma_adi,
    t.takim_id,
    t.takim_adi,
    b.bolge_id,
    b.bolge_adi,
    row_number() OVER (PARTITION BY f.firma_id ORDER BY hl.toplam_puan DESC) AS firma_sirasi,
    row_number() OVER (PARTITION BY b.bolge_id ORDER BY hl.toplam_puan DESC) AS bolge_sirasi,
    row_number() OVER (PARTITION BY t.takim_id ORDER BY hl.toplam_puan DESC) AS takim_sirasi
   FROM hb_ligi_v2 hl
     JOIN kullanicilar k ON k.kullanici_id = hl.kullanici_id
     LEFT JOIN firmalar f ON f.firma_id = k.firma_id
     LEFT JOIN takimlar t ON t.takim_id = k.takim_id
     LEFT JOIN bolgeler b ON b.bolge_id = k.bolge_id;

-- 3) Periyot RPC'leri (birebir gövde, yalnız ad _v2) ---------------------------
CREATE OR REPLACE FUNCTION public.get_hb_ligi_aylik_v2(p_yil integer, p_ay integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_baslangic timestamptz := make_timestamptz(p_yil, p_ay, 1, 0, 0, 0);
  v_bitis timestamptz := make_timestamptz(p_yil, p_ay, 1, 0, 0, 0) + interval '1 month';
BEGIN
  RETURN QUERY
  WITH utt_puanlar AS (
    SELECT k.kullanici_id, k.rol::text AS rol, k.ad::text AS ad, k.soyad::text AS soyad, k.eposta::text AS eposta,
      k.firma_id, k.takim_id, k.bolge_id,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='izleme'),0)::integer AS izleme_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='cevaplama'),0)::integer AS cevaplama_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='oneri'),0)::integer AS oneri_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='extra'),0)::integer AS extra_puani
    FROM kullanicilar k
    LEFT JOIN kazanilan_puanlar kp ON kp.kullanici_id=k.kullanici_id AND kp.created_at>=v_baslangic AND kp.created_at<v_bitis
    WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi=true
    GROUP BY k.kullanici_id, k.rol, k.ad, k.soyad, k.eposta, k.firma_id, k.takim_id, k.bolge_id
  ),
  utt_kayiplar AS (
    SELECT k.kullanici_id,
      COALESCE((SELECT SUM(isk.kaybedilen_puan) FROM ileri_sarma_kayitlari isk WHERE isk.kullanici_id=k.kullanici_id AND isk.created_at>=v_baslangic AND isk.created_at<v_bitis),0)::integer AS ileri_sarma_kaybi,
      COALESCE((SELECT SUM(yck.kaybedilen_puan) FROM yanlis_cevap_kayitlari yck WHERE yck.kullanici_id=k.kullanici_id AND yck.created_at>=v_baslangic AND yck.created_at<v_bitis),0)::integer AS yanlis_cevap_kaybi,
      COALESCE((SELECT SUM(okk.kaybedilen_puan) FROM oneri_kayip_kayitlari okk WHERE okk.kullanici_id=k.kullanici_id AND okk.created_at>=v_baslangic AND okk.created_at<v_bitis),0)::integer AS oneri_kaybi
    FROM kullanicilar k WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi=true
  ),
  birlesik AS (
    SELECT p.kullanici_id, p.rol, p.ad, p.soyad, p.eposta, p.firma_id, p.takim_id, p.bolge_id,
      p.izleme_puani, p.cevaplama_puani, p.oneri_puani, p.extra_puani,
      kp.ileri_sarma_kaybi, kp.yanlis_cevap_kaybi, kp.oneri_kaybi,
      (p.izleme_puani+p.cevaplama_puani+p.oneri_puani+p.extra_puani - kp.ileri_sarma_kaybi - kp.yanlis_cevap_kaybi - kp.oneri_kaybi)::integer AS toplam_puan
    FROM utt_puanlar p JOIN utt_kayiplar kp ON kp.kullanici_id=p.kullanici_id
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

CREATE OR REPLACE FUNCTION public.get_hb_ligi_donemlik_v2(p_yil integer, p_ceyrek integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_baslangic timestamptz;
  v_bitis timestamptz;
  v_bitis_yil integer;
  v_bitis_ay integer;
BEGIN
  v_baslangic := make_timestamptz(p_yil, (p_ceyrek - 1) * 3 + 1, 1, 0, 0, 0);
  IF p_ceyrek = 4 THEN v_bitis_yil := p_yil + 1; v_bitis_ay := 1;
  ELSE v_bitis_yil := p_yil; v_bitis_ay := p_ceyrek * 3 + 1; END IF;
  v_bitis := make_timestamptz(v_bitis_yil, v_bitis_ay, 1, 0, 0, 0);

  RETURN QUERY
  WITH utt_puanlar AS (
    SELECT k.kullanici_id, k.rol::text AS rol, k.ad::text AS ad, k.soyad::text AS soyad, k.eposta::text AS eposta,
      k.firma_id, k.takim_id, k.bolge_id,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='izleme'),0)::integer AS izleme_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='cevaplama'),0)::integer AS cevaplama_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='oneri'),0)::integer AS oneri_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='extra'),0)::integer AS extra_puani
    FROM kullanicilar k
    LEFT JOIN kazanilan_puanlar kp ON kp.kullanici_id=k.kullanici_id AND kp.created_at>=v_baslangic AND kp.created_at<v_bitis
    WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi=true
    GROUP BY k.kullanici_id, k.rol, k.ad, k.soyad, k.eposta, k.firma_id, k.takim_id, k.bolge_id
  ),
  utt_kayiplar AS (
    SELECT k.kullanici_id,
      COALESCE((SELECT SUM(isk.kaybedilen_puan) FROM ileri_sarma_kayitlari isk WHERE isk.kullanici_id=k.kullanici_id AND isk.created_at>=v_baslangic AND isk.created_at<v_bitis),0)::integer AS ileri_sarma_kaybi,
      COALESCE((SELECT SUM(yck.kaybedilen_puan) FROM yanlis_cevap_kayitlari yck WHERE yck.kullanici_id=k.kullanici_id AND yck.created_at>=v_baslangic AND yck.created_at<v_bitis),0)::integer AS yanlis_cevap_kaybi,
      COALESCE((SELECT SUM(okk.kaybedilen_puan) FROM oneri_kayip_kayitlari okk WHERE okk.kullanici_id=k.kullanici_id AND okk.created_at>=v_baslangic AND okk.created_at<v_bitis),0)::integer AS oneri_kaybi
    FROM kullanicilar k WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi=true
  ),
  birlesik AS (
    SELECT p.kullanici_id, p.rol, p.ad, p.soyad, p.eposta, p.firma_id, p.takim_id, p.bolge_id,
      p.izleme_puani, p.cevaplama_puani, p.oneri_puani, p.extra_puani,
      kp.ileri_sarma_kaybi, kp.yanlis_cevap_kaybi, kp.oneri_kaybi,
      (p.izleme_puani+p.cevaplama_puani+p.oneri_puani+p.extra_puani - kp.ileri_sarma_kaybi - kp.yanlis_cevap_kaybi - kp.oneri_kaybi)::integer AS toplam_puan
    FROM utt_puanlar p JOIN utt_kayiplar kp ON kp.kullanici_id=p.kullanici_id
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

CREATE OR REPLACE FUNCTION public.get_hb_ligi_yillik_v2(p_yil integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_baslangic timestamptz := make_timestamptz(p_yil, 1, 1, 0, 0, 0);
  v_bitis timestamptz := make_timestamptz(p_yil + 1, 1, 1, 0, 0, 0);
BEGIN
  RETURN QUERY
  WITH utt_puanlar AS (
    SELECT k.kullanici_id, k.rol::text AS rol, k.ad::text AS ad, k.soyad::text AS soyad, k.eposta::text AS eposta,
      k.firma_id, k.takim_id, k.bolge_id,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='izleme'),0)::integer AS izleme_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='cevaplama'),0)::integer AS cevaplama_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='oneri'),0)::integer AS oneri_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu='extra'),0)::integer AS extra_puani
    FROM kullanicilar k
    LEFT JOIN kazanilan_puanlar kp ON kp.kullanici_id=k.kullanici_id AND kp.created_at>=v_baslangic AND kp.created_at<v_bitis
    WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi=true
    GROUP BY k.kullanici_id, k.rol, k.ad, k.soyad, k.eposta, k.firma_id, k.takim_id, k.bolge_id
  ),
  utt_kayiplar AS (
    SELECT k.kullanici_id,
      COALESCE((SELECT SUM(isk.kaybedilen_puan) FROM ileri_sarma_kayitlari isk WHERE isk.kullanici_id=k.kullanici_id AND isk.created_at>=v_baslangic AND isk.created_at<v_bitis),0)::integer AS ileri_sarma_kaybi,
      COALESCE((SELECT SUM(yck.kaybedilen_puan) FROM yanlis_cevap_kayitlari yck WHERE yck.kullanici_id=k.kullanici_id AND yck.created_at>=v_baslangic AND yck.created_at<v_bitis),0)::integer AS yanlis_cevap_kaybi,
      COALESCE((SELECT SUM(okk.kaybedilen_puan) FROM oneri_kayip_kayitlari okk WHERE okk.kullanici_id=k.kullanici_id AND okk.created_at>=v_baslangic AND okk.created_at<v_bitis),0)::integer AS oneri_kaybi
    FROM kullanicilar k WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi=true
  ),
  birlesik AS (
    SELECT p.kullanici_id, p.rol, p.ad, p.soyad, p.eposta, p.firma_id, p.takim_id, p.bolge_id,
      p.izleme_puani, p.cevaplama_puani, p.oneri_puani, p.extra_puani,
      kp.ileri_sarma_kaybi, kp.yanlis_cevap_kaybi, kp.oneri_kaybi,
      (p.izleme_puani+p.cevaplama_puani+p.oneri_puani+p.extra_puani - kp.ileri_sarma_kaybi - kp.yanlis_cevap_kaybi - kp.oneri_kaybi)::integer AS toplam_puan
    FROM utt_puanlar p JOIN utt_kayiplar kp ON kp.kullanici_id=p.kullanici_id
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
