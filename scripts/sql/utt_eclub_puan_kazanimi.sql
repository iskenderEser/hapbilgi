-- UTT/KD_UTT: E-Club kazanımını beşinci puan kalemi olarak ekle.
-- Mevcut eclub_utt_puanlari kayıtları okunur; yeni kazanım yazılmaz.
-- Geçmiş kayıtlar kendi kazanım tarihleriyle dahil olur. Öğrenme/izlenme sayıları değişmez.
-- BM kişisel C-Club hesabı, sipariş kilidi ve mağaza günleri değişmez.
-- Tek transaction: bir hata olursa bütün paket geri alınır. CASCADE kullanılmaz.
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TEMP TABLE hb_eclub_rpc_izinleri ON COMMIT DROP AS
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_userbyid(p.proowner) AS sahip, p.proacl, p.proowner,
       obj_description(p.oid, 'pg_proc') AS aciklama
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('get_kullanici_ozet','get_kullanici_urun_dagilimi','get_kullanici_kategori_dagilimi','get_bolge_bazli_grup','get_bm_utt_performans_v2','get_yonetici_hiyerarsi_v2','get_yonetici_rapor_ana_ozet_v2','get_tm_bm_performans_v1','get_yonetici_egitim_turu_etkisi_v3','_hb_ligi_v2_aralik','get_hb_ligi_aylik_v2','get_hb_ligi_donemlik_v2','get_hb_ligi_yillik_v2','get_hb_ligi_haftalik_v2');

DO $drop$
DECLARE r record;
BEGIN
  -- Çağıran RPC'ler önce kaldırılır; beklenmeyen bağımlılık varsa işlem durur.
  FOR r IN SELECT * FROM hb_eclub_rpc_izinleri
    ORDER BY CASE WHEN proname='get_tm_bm_performans_v1' THEN 0
                  WHEN proname LIKE 'get_hb_ligi_%' THEN 1 ELSE 2 END
  LOOP
    EXECUTE format('DROP FUNCTION public.%I(%s)', r.proname, r.args);
  END LOOP;
END;
$drop$;

CREATE INDEX IF NOT EXISTS eclub_utt_puanlari_utt_tarih_idx
  ON public.eclub_utt_puanlari (utt_id, created_at);

CREATE OR REPLACE FUNCTION public.get_kullanici_ozet(p_baslangic timestamp with time zone, p_bitis timestamp with time zone, p_kullanici_id uuid DEFAULT NULL::uuid, p_bolge_id uuid DEFAULT NULL::uuid, p_takim_id uuid DEFAULT NULL::uuid, p_firma_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, izlenme_sayisi integer, video_puani integer, soru_puani integer, oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_net_puan integer, eclub_puani integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH
  scoped_users AS (
    SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad
    FROM kullanicilar k
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt', 'kd_utt')
      AND (p_kullanici_id IS NULL OR k.kullanici_id = p_kullanici_id)
      AND (p_bolge_id    IS NULL OR k.bolge_id    = p_bolge_id)
      AND (p_takim_id    IS NULL OR k.takim_id    = p_takim_id)
      AND (p_firma_id    IS NULL OR k.firma_id    = p_firma_id)
  ),
  kazanim AS (
    SELECT
      kp.kullanici_id,
      SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
      SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
      SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
      SUM(CASE WHEN kp.puan_turu = 'eclub' THEN kp.puan ELSE 0 END)::int AS eclub_puani,
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan,
      COUNT(*) FILTER (WHERE kp.puan_turu = 'izleme')::int AS izlenme_sayisi
    FROM (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp
    WHERE kp.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY kp.kullanici_id
  ),
  ileri_sarma AS (
    SELECT isk.kullanici_id, SUM(isk.kaybedilen_puan)::int AS toplam_kayip
    FROM ileri_sarma_kayitlari isk
    WHERE isk.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
    GROUP BY isk.kullanici_id
  ),
  yanlis_cevap AS (
    SELECT ycb.kullanici_id, SUM(ycb.kaybedilen_puan)::int AS toplam_kayip
    FROM yanlis_cevap_kayitlari ycb
    WHERE ycb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND ycb.created_at >= p_baslangic AND ycb.created_at <= p_bitis
    GROUP BY ycb.kullanici_id
  ),
  oneri_kayip AS (
    SELECT okb.kullanici_id, SUM(okb.kaybedilen_puan)::int AS toplam_kayip
    FROM oneri_kayip_kayitlari okb
    WHERE okb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND okb.created_at >= p_baslangic AND okb.created_at <= p_bitis
    GROUP BY okb.kullanici_id
  )
  SELECT
    su.kullanici_id,
    su.ad,
    su.soyad,
    COALESCE(k.izlenme_sayisi, 0),
    COALESCE(k.video_puani, 0),
    COALESCE(k.soru_puani, 0),
    COALESCE(k.oneri_puani, 0),
    COALESCE(k.extra_puan, 0),
    COALESCE(isk.toplam_kayip, 0),
    COALESCE(yc.toplam_kayip, 0),
    COALESCE(ok.toplam_kayip, 0),
    (COALESCE(k.video_puani, 0) + COALESCE(k.soru_puani, 0)
      + COALESCE(k.oneri_puani, 0) + COALESCE(k.extra_puan, 0) + COALESCE(k.eclub_puani, 0)
      - COALESCE(isk.toplam_kayip, 0) - COALESCE(yc.toplam_kayip, 0)
      - COALESCE(ok.toplam_kayip, 0))::int,
    COALESCE(k.eclub_puani, 0)::integer
  FROM scoped_users su
  LEFT JOIN kazanim     k   ON k.kullanici_id   = su.kullanici_id
  LEFT JOIN ileri_sarma isk ON isk.kullanici_id = su.kullanici_id
  LEFT JOIN yanlis_cevap yc ON yc.kullanici_id  = su.kullanici_id
  LEFT JOIN oneri_kayip  ok ON ok.kullanici_id  = su.kullanici_id
  ORDER BY su.ad, su.soyad;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_kullanici_urun_dagilimi(p_baslangic timestamp with time zone, p_bitis timestamp with time zone, p_kullanici_id uuid DEFAULT NULL::uuid, p_bolge_id uuid DEFAULT NULL::uuid, p_takim_id uuid DEFAULT NULL::uuid, p_firma_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, urun_id uuid, urun_adi text, izlenme_sayisi integer, video_puani integer, soru_puani integer, oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_net_puan integer, teknik_dagilimi jsonb, eclub_puani integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH
  scoped_users AS (
    SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad
    FROM kullanicilar k
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt', 'kd_utt')
      AND (p_kullanici_id IS NULL OR k.kullanici_id = p_kullanici_id)
      AND (p_bolge_id    IS NULL OR k.bolge_id    = p_bolge_id)
      AND (p_takim_id    IS NULL OR k.takim_id    = p_takim_id)
      AND (p_firma_id    IS NULL OR k.firma_id    = p_firma_id)
  ),
  kazanim AS (
    SELECT
      kp.kullanici_id,
      ky.urun_id,
      SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
      SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
      SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
      SUM(CASE WHEN kp.puan_turu = 'eclub' THEN kp.puan ELSE 0 END)::int AS eclub_puani,
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan,
      COUNT(*) FILTER (WHERE kp.puan_turu = 'izleme')::int AS izlenme_sayisi
    FROM (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp
    JOIN v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY kp.kullanici_id, ky.urun_id
  ),
  ileri_sarma AS (
    SELECT isk.kullanici_id, ky.urun_id, SUM(isk.kaybedilen_puan)::int AS toplam_kayip
    FROM ileri_sarma_kayitlari isk
    JOIN v_yayin_kunye ky ON ky.yayin_id = isk.yayin_id
    WHERE isk.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
    GROUP BY isk.kullanici_id, ky.urun_id
  ),
  yanlis_cevap AS (
    SELECT ycb.kullanici_id, ky.urun_id, SUM(ycb.kaybedilen_puan)::int AS toplam_kayip
    FROM yanlis_cevap_kayitlari ycb
    JOIN v_yayin_kunye ky ON ky.yayin_id = ycb.yayin_id
    WHERE ycb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND ycb.created_at >= p_baslangic AND ycb.created_at <= p_bitis
    GROUP BY ycb.kullanici_id, ky.urun_id
  ),
  oneri_kayip AS (
    SELECT okb.kullanici_id, ky.urun_id, SUM(okb.kaybedilen_puan)::int AS toplam_kayip
    FROM oneri_kayip_kayitlari okb
    JOIN v_yayin_kunye ky ON ky.yayin_id = okb.yayin_id
    WHERE okb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND okb.created_at >= p_baslangic AND okb.created_at <= p_bitis
    GROUP BY okb.kullanici_id, ky.urun_id
  ),
  teknik_kayitlari AS (
    SELECT
      kp.kullanici_id,
      ky.urun_id,
      tk.teknik_adi::text AS teknik_adi,
      COUNT(*)::int AS izlenme_sayisi
    FROM kazanilan_puanlar kp
    JOIN v_yayin_kunye ky ON ky.yayin_id  = kp.yayin_id
    JOIN teknikler tk     ON tk.teknik_id = ky.teknik_id
    WHERE kp.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND kp.puan_turu = 'izleme'
      AND kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY kp.kullanici_id, ky.urun_id, tk.teknik_adi
  ),
  teknik_dagilim AS (
    SELECT
      tk.kullanici_id,
      tk.urun_id,
      jsonb_agg(
        jsonb_build_object('teknik_adi', tk.teknik_adi, 'izlenme_sayisi', tk.izlenme_sayisi)
        ORDER BY tk.izlenme_sayisi DESC
      ) AS dagilim
    FROM teknik_kayitlari tk
    GROUP BY tk.kullanici_id, tk.urun_id
  ),
  birlesik AS (
    SELECT kullanici_id, urun_id FROM kazanim
    UNION
    SELECT kullanici_id, urun_id FROM ileri_sarma
    UNION
    SELECT kullanici_id, urun_id FROM yanlis_cevap
    UNION
    SELECT kullanici_id, urun_id FROM oneri_kayip
  )
  SELECT
    su.kullanici_id,
    su.ad,
    su.soyad,
    u.urun_id,
    u.urun_adi::text,
    COALESCE(k.izlenme_sayisi, 0),
    COALESCE(k.video_puani, 0),
    COALESCE(k.soru_puani, 0),
    COALESCE(k.oneri_puani, 0),
    COALESCE(k.extra_puan, 0),
    COALESCE(isk.toplam_kayip, 0),
    COALESCE(yc.toplam_kayip, 0),
    COALESCE(ok.toplam_kayip, 0),
    (COALESCE(k.video_puani, 0) + COALESCE(k.soru_puani, 0)
      + COALESCE(k.oneri_puani, 0) + COALESCE(k.extra_puan, 0) + COALESCE(k.eclub_puani, 0)
      - COALESCE(isk.toplam_kayip, 0) - COALESCE(yc.toplam_kayip, 0)
      - COALESCE(ok.toplam_kayip, 0))::int,
    COALESCE(td.dagilim, '[]'::jsonb),
    COALESCE(k.eclub_puani, 0)::integer
  FROM birlesik b
  JOIN scoped_users su ON su.kullanici_id = b.kullanici_id
  JOIN urunler u ON u.urun_id = b.urun_id
  LEFT JOIN kazanim      k   ON k.kullanici_id   = b.kullanici_id AND k.urun_id   = b.urun_id
  LEFT JOIN ileri_sarma  isk ON isk.kullanici_id = b.kullanici_id AND isk.urun_id = b.urun_id
  LEFT JOIN yanlis_cevap yc  ON yc.kullanici_id  = b.kullanici_id AND yc.urun_id  = b.urun_id
  LEFT JOIN oneri_kayip  ok  ON ok.kullanici_id  = b.kullanici_id AND ok.urun_id  = b.urun_id
  LEFT JOIN teknik_dagilim td ON td.kullanici_id = b.kullanici_id AND td.urun_id  = b.urun_id
  ORDER BY u.urun_adi, su.ad, su.soyad;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_kullanici_kategori_dagilimi(p_baslangic timestamp with time zone, p_bitis timestamp with time zone, p_kullanici_id uuid DEFAULT NULL::uuid, p_bolge_id uuid DEFAULT NULL::uuid, p_takim_id uuid DEFAULT NULL::uuid, p_firma_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, icerik_turu text, izlenme_sayisi integer, video_puani integer, soru_puani integer, oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_net_puan integer, teknik_dagilimi jsonb, eclub_puani integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH
  scoped_users AS (
    SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad
    FROM kullanicilar k
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt', 'kd_utt')
      AND (p_kullanici_id IS NULL OR k.kullanici_id = p_kullanici_id)
      AND (p_bolge_id    IS NULL OR k.bolge_id    = p_bolge_id)
      AND (p_takim_id    IS NULL OR k.takim_id    = p_takim_id)
      AND (p_firma_id    IS NULL OR k.firma_id    = p_firma_id)
  ),
  kazanim AS (
    SELECT
      kp.kullanici_id,
      ky.icerik_turu::text AS icerik_turu,
      SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
      SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
      SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
      SUM(CASE WHEN kp.puan_turu = 'eclub' THEN kp.puan ELSE 0 END)::int AS eclub_puani,
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan,
      COUNT(*) FILTER (WHERE kp.puan_turu = 'izleme')::int AS izlenme_sayisi
    FROM (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp
    JOIN v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY kp.kullanici_id, ky.icerik_turu
  ),
  ileri_sarma AS (
    SELECT isk.kullanici_id, ky.icerik_turu::text AS icerik_turu,
      SUM(isk.kaybedilen_puan)::int AS toplam_kayip
    FROM ileri_sarma_kayitlari isk
    JOIN v_yayin_kunye ky ON ky.yayin_id = isk.yayin_id
    WHERE isk.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
    GROUP BY isk.kullanici_id, ky.icerik_turu
  ),
  yanlis_cevap AS (
    SELECT ycb.kullanici_id, ky.icerik_turu::text AS icerik_turu,
      SUM(ycb.kaybedilen_puan)::int AS toplam_kayip
    FROM yanlis_cevap_kayitlari ycb
    JOIN v_yayin_kunye ky ON ky.yayin_id = ycb.yayin_id
    WHERE ycb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND ycb.created_at >= p_baslangic AND ycb.created_at <= p_bitis
    GROUP BY ycb.kullanici_id, ky.icerik_turu
  ),
  oneri_kayip AS (
    SELECT okb.kullanici_id, ky.icerik_turu::text AS icerik_turu,
      SUM(okb.kaybedilen_puan)::int AS toplam_kayip
    FROM oneri_kayip_kayitlari okb
    JOIN v_yayin_kunye ky ON ky.yayin_id = okb.yayin_id
    WHERE okb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND okb.created_at >= p_baslangic AND okb.created_at <= p_bitis
    GROUP BY okb.kullanici_id, ky.icerik_turu
  ),
  -- Teknik kırılımı ürün ikizindeki ile aynı mantıkta; tekniği olmayan
  -- kategorilerde (medikal, İK) doğal olarak boş kalır.
  teknik_kayitlari AS (
    SELECT
      kp.kullanici_id,
      ky.icerik_turu::text AS icerik_turu,
      tk.teknik_adi::text AS teknik_adi,
      COUNT(*)::int AS izlenme_sayisi
    FROM kazanilan_puanlar kp
    JOIN v_yayin_kunye ky ON ky.yayin_id  = kp.yayin_id
    JOIN teknikler tk     ON tk.teknik_id = ky.teknik_id
    WHERE kp.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND kp.puan_turu = 'izleme'
      AND kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY kp.kullanici_id, ky.icerik_turu, tk.teknik_adi
  ),
  teknik_dagilim AS (
    SELECT
      tk.kullanici_id,
      tk.icerik_turu,
      jsonb_agg(
        jsonb_build_object('teknik_adi', tk.teknik_adi, 'izlenme_sayisi', tk.izlenme_sayisi)
        ORDER BY tk.izlenme_sayisi DESC
      ) AS dagilim
    FROM teknik_kayitlari tk
    GROUP BY tk.kullanici_id, tk.icerik_turu
  ),
  birlesik AS (
    SELECT kullanici_id, icerik_turu FROM kazanim
    UNION
    SELECT kullanici_id, icerik_turu FROM ileri_sarma
    UNION
    SELECT kullanici_id, icerik_turu FROM yanlis_cevap
    UNION
    SELECT kullanici_id, icerik_turu FROM oneri_kayip
  )
  SELECT
    su.kullanici_id,
    su.ad,
    su.soyad,
    b.icerik_turu,
    COALESCE(k.izlenme_sayisi, 0),
    COALESCE(k.video_puani, 0),
    COALESCE(k.soru_puani, 0),
    COALESCE(k.oneri_puani, 0),
    COALESCE(k.extra_puan, 0),
    COALESCE(isk.toplam_kayip, 0),
    COALESCE(yc.toplam_kayip, 0),
    COALESCE(ok.toplam_kayip, 0),
    (COALESCE(k.video_puani, 0) + COALESCE(k.soru_puani, 0)
      + COALESCE(k.oneri_puani, 0) + COALESCE(k.extra_puan, 0) + COALESCE(k.eclub_puani, 0)
      - COALESCE(isk.toplam_kayip, 0) - COALESCE(yc.toplam_kayip, 0)
      - COALESCE(ok.toplam_kayip, 0))::int,
    COALESCE(td.dagilim, '[]'::jsonb),
    COALESCE(k.eclub_puani, 0)::integer
  FROM birlesik b
  JOIN scoped_users su ON su.kullanici_id = b.kullanici_id
  LEFT JOIN kazanim      k   ON k.kullanici_id   = b.kullanici_id AND k.icerik_turu   = b.icerik_turu
  LEFT JOIN ileri_sarma  isk ON isk.kullanici_id = b.kullanici_id AND isk.icerik_turu = b.icerik_turu
  LEFT JOIN yanlis_cevap yc  ON yc.kullanici_id  = b.kullanici_id AND yc.icerik_turu  = b.icerik_turu
  LEFT JOIN oneri_kayip  ok  ON ok.kullanici_id  = b.kullanici_id AND ok.icerik_turu  = b.icerik_turu
  LEFT JOIN teknik_dagilim td ON td.kullanici_id = b.kullanici_id AND td.icerik_turu  = b.icerik_turu
  ORDER BY b.icerik_turu, su.ad, su.soyad;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_bolge_bazli_grup(p_baslangic timestamp with time zone, p_bitis timestamp with time zone, p_takim_id uuid DEFAULT NULL::uuid, p_firma_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(bolge_id uuid, bolge_adi text, takim_id uuid, takim_adi text, bm_adi text, toplam_utt integer, aktif_utt integer, hic_izlemeyen_utt integer, video_puani integer, soru_puani integer, oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_net_puan integer, urun_dagilimi jsonb, eclub_puani integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH
  scoped_bolgeler AS (
    SELECT b.bolge_id, b.bolge_adi::text AS bolge_adi, b.takim_id, t.takim_adi::text AS takim_adi
    FROM bolgeler b
    JOIN takimlar t ON t.takim_id = b.takim_id
    WHERE (p_takim_id IS NULL OR b.takim_id = p_takim_id)
      AND (p_firma_id IS NULL OR t.firma_id = p_firma_id)
  ),
  bm_per_bolge AS (
    SELECT k.bolge_id, (k.ad || ' ' || k.soyad)::text AS bm_adi
    FROM kullanicilar k
    WHERE k.rol = 'bm'
      AND k.aktif_mi = true
      AND k.bolge_id IN (SELECT bolge_id FROM scoped_bolgeler)
  ),
  scoped_utt AS (
    SELECT k.kullanici_id, k.bolge_id
    FROM kullanicilar k
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt', 'kd_utt')
      AND k.bolge_id IN (SELECT bolge_id FROM scoped_bolgeler)
  ),
  toplam_utt_per_bolge AS (
    SELECT bolge_id, COUNT(*)::int AS toplam_utt
    FROM scoped_utt
    GROUP BY bolge_id
  ),
  kazanim AS (
    SELECT
      su.bolge_id,
      SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
      SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
      SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
      SUM(CASE WHEN kp.puan_turu = 'eclub' THEN kp.puan ELSE 0 END)::int AS eclub_puani,
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan,
      COUNT(DISTINCT kp.kullanici_id) FILTER (WHERE kp.puan_turu = 'izleme')::int AS aktif_utt
    FROM (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp
    JOIN scoped_utt su ON su.kullanici_id = kp.kullanici_id
    WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY su.bolge_id
  ),
  ileri_sarma AS (
    SELECT su.bolge_id, SUM(isk.kaybedilen_puan)::int AS toplam_kayip
    FROM ileri_sarma_kayitlari isk
    JOIN scoped_utt su ON su.kullanici_id = isk.kullanici_id
    WHERE isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
    GROUP BY su.bolge_id
  ),
  yanlis_cevap AS (
    SELECT su.bolge_id, SUM(ycb.kaybedilen_puan)::int AS toplam_kayip
    FROM yanlis_cevap_kayitlari ycb
    JOIN scoped_utt su ON su.kullanici_id = ycb.kullanici_id
    WHERE ycb.created_at >= p_baslangic AND ycb.created_at <= p_bitis
    GROUP BY su.bolge_id
  ),
  oneri_kayip AS (
    SELECT su.bolge_id, SUM(okb.kaybedilen_puan)::int AS toplam_kayip
    FROM oneri_kayip_kayitlari okb
    JOIN scoped_utt su ON su.kullanici_id = okb.kullanici_id
    WHERE okb.created_at >= p_baslangic AND okb.created_at <= p_bitis
    GROUP BY su.bolge_id
  ),
  urun_kazanim AS (
    SELECT
      su.bolge_id,
      ky.urun_id,
      SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
      SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
      SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
      SUM(CASE WHEN kp.puan_turu = 'eclub' THEN kp.puan ELSE 0 END)::int AS eclub_puani,
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan
    FROM (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp
    JOIN scoped_utt su    ON su.kullanici_id = kp.kullanici_id
    JOIN v_yayin_kunye ky ON ky.yayin_id     = kp.yayin_id
    WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY su.bolge_id, ky.urun_id
  ),
  urun_ileri_sarma AS (
    SELECT su.bolge_id, ky.urun_id, SUM(isk.kaybedilen_puan)::int AS toplam_kayip
    FROM ileri_sarma_kayitlari isk
    JOIN scoped_utt su    ON su.kullanici_id = isk.kullanici_id
    JOIN v_yayin_kunye ky ON ky.yayin_id     = isk.yayin_id
    WHERE isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
    GROUP BY su.bolge_id, ky.urun_id
  ),
  urun_yanlis_cevap AS (
    SELECT su.bolge_id, ky.urun_id, SUM(ycb.kaybedilen_puan)::int AS toplam_kayip
    FROM yanlis_cevap_kayitlari ycb
    JOIN scoped_utt su    ON su.kullanici_id = ycb.kullanici_id
    JOIN v_yayin_kunye ky ON ky.yayin_id     = ycb.yayin_id
    WHERE ycb.created_at >= p_baslangic AND ycb.created_at <= p_bitis
    GROUP BY su.bolge_id, ky.urun_id
  ),
  urun_oneri_kayip AS (
    SELECT su.bolge_id, ky.urun_id, SUM(okb.kaybedilen_puan)::int AS toplam_kayip
    FROM oneri_kayip_kayitlari okb
    JOIN scoped_utt su    ON su.kullanici_id = okb.kullanici_id
    JOIN v_yayin_kunye ky ON ky.yayin_id     = okb.yayin_id
    WHERE okb.created_at >= p_baslangic AND okb.created_at <= p_bitis
    GROUP BY su.bolge_id, ky.urun_id
  ),
  urun_birlesik AS (
    SELECT bolge_id, urun_id FROM urun_kazanim
    UNION
    SELECT bolge_id, urun_id FROM urun_ileri_sarma
    UNION
    SELECT bolge_id, urun_id FROM urun_yanlis_cevap
    UNION
    SELECT bolge_id, urun_id FROM urun_oneri_kayip
  ),
  urun_dagilim AS (
    SELECT
      ub.bolge_id,
      jsonb_agg(
        jsonb_build_object(
          'urun_id', ub.urun_id,
          'urun_adi', u.urun_adi,
          'video_puani', COALESCE(uk.video_puani, 0),
          'soru_puani', COALESCE(uk.soru_puani, 0),
          'oneri_puani', COALESCE(uk.oneri_puani, 0),
          'extra_puan', COALESCE(uk.extra_puan, 0),
          'eclub_puani', COALESCE(uk.eclub_puani, 0),
          'ileri_sarma_kaybi', COALESCE(uis.toplam_kayip, 0),
          'yanlis_cevap_kaybi', COALESCE(uyc.toplam_kayip, 0),
          'oneri_kaybi', COALESCE(uok.toplam_kayip, 0),
          'toplam_net_puan',
            COALESCE(uk.video_puani, 0) + COALESCE(uk.soru_puani, 0)
            + COALESCE(uk.oneri_puani, 0) + COALESCE(uk.extra_puan, 0) + COALESCE(uk.eclub_puani, 0)
            - COALESCE(uis.toplam_kayip, 0) - COALESCE(uyc.toplam_kayip, 0)
            - COALESCE(uok.toplam_kayip, 0)
        )
        ORDER BY u.urun_adi
      ) AS urun_dagilimi
    FROM urun_birlesik ub
    JOIN urunler u ON u.urun_id = ub.urun_id
    LEFT JOIN urun_kazanim       uk  ON uk.bolge_id  = ub.bolge_id AND uk.urun_id  = ub.urun_id
    LEFT JOIN urun_ileri_sarma   uis ON uis.bolge_id = ub.bolge_id AND uis.urun_id = ub.urun_id
    LEFT JOIN urun_yanlis_cevap  uyc ON uyc.bolge_id = ub.bolge_id AND uyc.urun_id = ub.urun_id
    LEFT JOIN urun_oneri_kayip   uok ON uok.bolge_id = ub.bolge_id AND uok.urun_id = ub.urun_id
    GROUP BY ub.bolge_id
  )
  SELECT
    sb.bolge_id,
    sb.bolge_adi,
    sb.takim_id,
    sb.takim_adi,
    COALESCE(bmb.bm_adi, '-')::text,
    COALESCE(tup.toplam_utt, 0),
    COALESCE(k.aktif_utt, 0),
    GREATEST(0, COALESCE(tup.toplam_utt, 0) - COALESCE(k.aktif_utt, 0)),
    COALESCE(k.video_puani, 0),
    COALESCE(k.soru_puani, 0),
    COALESCE(k.oneri_puani, 0),
    COALESCE(k.extra_puan, 0),
    COALESCE(isk.toplam_kayip, 0),
    COALESCE(yc.toplam_kayip, 0),
    COALESCE(ok.toplam_kayip, 0),
    (COALESCE(k.video_puani, 0) + COALESCE(k.soru_puani, 0)
      + COALESCE(k.oneri_puani, 0) + COALESCE(k.extra_puan, 0) + COALESCE(k.eclub_puani, 0)
      - COALESCE(isk.toplam_kayip, 0) - COALESCE(yc.toplam_kayip, 0)
      - COALESCE(ok.toplam_kayip, 0))::int,
    COALESCE(ud.urun_dagilimi, '[]'::jsonb),
    COALESCE(k.eclub_puani, 0)::integer
  FROM scoped_bolgeler sb
  LEFT JOIN bm_per_bolge          bmb ON bmb.bolge_id = sb.bolge_id
  LEFT JOIN toplam_utt_per_bolge  tup ON tup.bolge_id = sb.bolge_id
  LEFT JOIN kazanim               k   ON k.bolge_id   = sb.bolge_id
  LEFT JOIN ileri_sarma           isk ON isk.bolge_id = sb.bolge_id
  LEFT JOIN yanlis_cevap          yc  ON yc.bolge_id  = sb.bolge_id
  LEFT JOIN oneri_kayip           ok  ON ok.bolge_id  = sb.bolge_id
  LEFT JOIN urun_dagilim          ud  ON ud.bolge_id  = sb.bolge_id
  ORDER BY sb.takim_adi, sb.bolge_adi;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_bm_utt_performans_v2(p_bm_id uuid, p_baslangic timestamp with time zone, p_bitis timestamp with time zone)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, tamamlanan_izleme integer, benzersiz_yayin integer, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, kazanilan_toplam integer, kaybedilen_toplam integer, net_puan integer, eclub_puani integer)
 LANGUAGE sql
 STABLE
AS $function$
WITH
bm_scope AS (
  SELECT k.firma_id, k.takim_id, k.bolge_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_bm_id
    AND k.rol = 'bm'
    AND k.aktif_mi = true
),
scope_users AS (
  SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad
  FROM kullanicilar k
  JOIN bm_scope bs
    ON bs.firma_id = k.firma_id
   AND bs.takim_id = k.takim_id
   AND bs.bolge_id = k.bolge_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt', 'kd_utt')
),
izleme AS (
  SELECT
    ik.kullanici_id,
    COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
    COUNT(DISTINCT ik.yayin_id)::int AS benzersiz
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
  GROUP BY ik.kullanici_id
),
kazanim AS (
  SELECT
    kp.kullanici_id,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'eclub'), 0)::int AS eclub_puani,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  WHERE kp.created_at >= p_baslangic
    AND kp.created_at <= p_bitis
  GROUP BY kp.kullanici_id
),
ileri_sarma AS (
  SELECT isk.kullanici_id, SUM(isk.kaybedilen_puan)::int AS puan
  FROM ileri_sarma_kayitlari isk
  JOIN scope_users su ON su.kullanici_id = isk.kullanici_id
  WHERE isk.created_at >= p_baslangic
    AND isk.created_at <= p_bitis
  GROUP BY isk.kullanici_id
),
yanlis_cevap AS (
  SELECT yck.kullanici_id, SUM(yck.kaybedilen_puan)::int AS puan
  FROM yanlis_cevap_kayitlari yck
  JOIN scope_users su ON su.kullanici_id = yck.kullanici_id
  WHERE yck.created_at >= p_baslangic
    AND yck.created_at <= p_bitis
  GROUP BY yck.kullanici_id
),
oneri_kaybi AS (
  SELECT okk.kullanici_id, SUM(okk.kaybedilen_puan)::int AS puan
  FROM oneri_kayip_kayitlari okk
  JOIN scope_users su ON su.kullanici_id = okk.kullanici_id
  WHERE okk.created_at >= p_baslangic
    AND okk.created_at <= p_bitis
  GROUP BY okk.kullanici_id
)
SELECT
  su.kullanici_id,
  su.ad,
  su.soyad,
  COALESCE(i.tamamlanan, 0),
  COALESCE(i.benzersiz, 0),
  COALESCE(k.izleme, 0),
  COALESCE(k.cevaplama, 0),
  COALESCE(k.oneri, 0),
  COALESCE(k.extra, 0),
  COALESCE(isk.puan, 0),
  COALESCE(yc.puan, 0),
  COALESCE(ok.puan, 0),
  (
    COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0)
    + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0) + COALESCE(k.eclub_puani, 0)
  )::int,
  (
    COALESCE(isk.puan, 0) + COALESCE(yc.puan, 0) + COALESCE(ok.puan, 0)
  )::int,
  (
    COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0)
    + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0) + COALESCE(k.eclub_puani, 0)
    - COALESCE(isk.puan, 0) - COALESCE(yc.puan, 0) - COALESCE(ok.puan, 0)
  )::int,
    COALESCE(k.eclub_puani, 0)::integer
FROM scope_users su
LEFT JOIN izleme i ON i.kullanici_id = su.kullanici_id
LEFT JOIN kazanim k ON k.kullanici_id = su.kullanici_id
LEFT JOIN ileri_sarma isk ON isk.kullanici_id = su.kullanici_id
LEFT JOIN yanlis_cevap yc ON yc.kullanici_id = su.kullanici_id
LEFT JOIN oneri_kaybi ok ON ok.kullanici_id = su.kullanici_id
ORDER BY 15 DESC, 2, 3;
$function$;

CREATE OR REPLACE FUNCTION public.get_yonetici_hiyerarsi_v2(p_yonetici_id uuid, p_baslangic timestamp with time zone, p_bitis timestamp with time zone, p_seviye text, p_ust_birim_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(birim_id uuid, birim_adi text, toplam_utt integer, aktif_utt integer, tamamlanan_izleme integer, benzersiz_yayin integer, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, challenge_kaybi integer, kazanilan_toplam integer, kaybedilen_toplam integer, net_puan integer, eclub_puani integer)
 LANGUAGE sql
 STABLE
AS $function$
WITH
yonetici_scope AS (
  SELECT k.firma_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_yonetici_id
    AND k.aktif_mi = true
    AND k.rol IN ('gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm')
),
scope_users AS (
  SELECT
    k.kullanici_id,
    k.ad::text,
    k.soyad::text,
    k.takim_id,
    t.takim_adi::text,
    k.bolge_id,
    b.bolge_adi::text
  FROM kullanicilar k
  JOIN yonetici_scope ys ON ys.firma_id = k.firma_id
  LEFT JOIN takimlar t ON t.takim_id = k.takim_id AND t.firma_id = ys.firma_id
  LEFT JOIN bolgeler b ON b.bolge_id = k.bolge_id AND b.takim_id = k.takim_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt','kd_utt')
    AND (
      (p_seviye = 'takim' AND p_ust_birim_id IS NULL)
      OR (p_seviye = 'bolge' AND k.takim_id = p_ust_birim_id)
      OR (p_seviye = 'utt' AND k.bolge_id = p_ust_birim_id)
    )
),
varliklar AS (
  SELECT
    CASE p_seviye
      WHEN 'takim' THEN su.takim_id
      WHEN 'bolge' THEN su.bolge_id
      WHEN 'utt' THEN su.kullanici_id
    END AS id,
    CASE p_seviye
      WHEN 'takim' THEN COALESCE(su.takim_adi, 'Takımsız')
      WHEN 'bolge' THEN COALESCE(su.bolge_adi, 'Bölgesiz')
      WHEN 'utt' THEN CONCAT(su.ad, ' ', su.soyad)
    END::text AS ad,
    su.kullanici_id
  FROM scope_users su
),
kapsam AS (
  SELECT id, ad, COUNT(DISTINCT kullanici_id)::int AS toplam
  FROM varliklar
  WHERE id IS NOT NULL
  GROUP BY id, ad
),
izleme AS (
  SELECT
    v.id,
    COUNT(DISTINCT ik.kullanici_id)::int AS aktif,
    COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
    COUNT(DISTINCT (ik.kullanici_id, ik.yayin_id))::int AS benzersiz
  FROM varliklar v
  JOIN izleme_kayitlari ik ON ik.kullanici_id = v.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
  GROUP BY v.id
),
kazanim AS (
  SELECT
    v.id,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'eclub'), 0)::int AS eclub_puani,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM varliklar v
  JOIN (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp ON kp.kullanici_id = v.kullanici_id
  WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
  GROUP BY v.id
),
ileri_sarma AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN ileri_sarma_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
),
yanlis_cevap AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN yanlis_cevap_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
),
oneri_kaybi AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN oneri_kayip_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
),
challenge_kaybi AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN challenge_kayip_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
)
SELECT
  kp.id,
  kp.ad,
  kp.toplam,
  COALESCE(i.aktif, 0),
  COALESCE(i.tamamlanan, 0),
  COALESCE(i.benzersiz, 0),
  COALESCE(k.izleme, 0),
  COALESCE(k.cevaplama, 0),
  COALESCE(k.oneri, 0),
  COALESCE(k.extra, 0),
  COALESCE(isk.puan, 0),
  COALESCE(yc.puan, 0),
  COALESCE(oky.puan, 0),
  COALESCE(ch.puan, 0),
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0) + COALESCE(k.eclub_puani, 0))::int,
  (COALESCE(isk.puan, 0) + COALESCE(yc.puan, 0) + COALESCE(oky.puan, 0) + COALESCE(ch.puan, 0))::int,
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0) + COALESCE(k.eclub_puani, 0)
   - COALESCE(isk.puan, 0) - COALESCE(yc.puan, 0) - COALESCE(oky.puan, 0) - COALESCE(ch.puan, 0))::int,
    COALESCE(k.eclub_puani, 0)::integer
FROM kapsam kp
LEFT JOIN izleme i ON i.id = kp.id
LEFT JOIN kazanim k ON k.id = kp.id
LEFT JOIN ileri_sarma isk ON isk.id = kp.id
LEFT JOIN yanlis_cevap yc ON yc.id = kp.id
LEFT JOIN oneri_kaybi oky ON oky.id = kp.id
LEFT JOIN challenge_kaybi ch ON ch.id = kp.id
ORDER BY 17 DESC, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_yonetici_rapor_ana_ozet_v2(p_yonetici_id uuid, p_baslangic timestamp with time zone, p_bitis timestamp with time zone)
 RETURNS TABLE(toplam_takim integer, toplam_bolge integer, toplam_utt integer, aktif_utt integer, donem_tamamlanan_izleme integer, donem_benzersiz_utt_yayin integer, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, challenge_kaybi integer, kazanilan_toplam integer, kaybedilen_toplam integer, net_puan integer, toplam_yayina_alma integer, donemde_yayina_alinan integer, su_an_yayinda integer, donem_urun_egitimi integer, donem_genel_egitim integer, donem_medikal_egitim integer, donem_ik_egitimi integer, donem_normal_uretim integer, donem_hazir_video integer, donem_hazir_soru_seti integer, donem_hazir_video_ve_soru_seti integer, guncel_tur_toplam_firsat integer, guncel_tur_tamamlanan integer, guncel_tur_kalan integer, guncel_tur_izlenme_orani integer, eclub_puani integer)
 LANGUAGE sql
 STABLE
AS $function$
WITH
yonetici_scope AS (
  SELECT k.firma_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_yonetici_id
    AND k.aktif_mi = true
    AND k.rol IN ('gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm')
),
scope_users AS (
  SELECT k.kullanici_id, k.takim_id, k.bolge_id
  FROM kullanicilar k
  JOIN yonetici_scope ys ON ys.firma_id = k.firma_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt','kd_utt')
),
scope_yayinlari AS (
  SELECT DISTINCT
    yy.yayin_id,
    LOWER(COALESCE(yy.durum, '')) AS durum,
    yy.yayin_tarihi,
    yy.created_at,
    yy.hedef_roller,
    ky.icerik_turu,
    t.hazir_video,
    t.hazir_soru_seti
  FROM yayin_yonetimi yy
  JOIN v_yayin_kunye ky ON ky.yayin_id = yy.yayin_id
  JOIN talepler t ON t.talep_id = ky.talep_id
  JOIN yonetici_scope ys ON ys.firma_id = ky.firma_id
),
canli_yayinlar AS (
  SELECT
    sy.yayin_id,
    COALESCE(
      (
        SELECT ytk.baslangic_tarihi
        FROM yayin_tekrar_kayitlari ytk
        WHERE ytk.yayin_id = sy.yayin_id
        ORDER BY ytk.tur_no DESC, ytk.baslangic_tarihi DESC
        LIMIT 1
      ),
      sy.yayin_tarihi,
      sy.created_at
    ) AS guncel_tur_baslangici
  FROM scope_yayinlari sy
  WHERE sy.durum = 'yayinda'
    AND COALESCE(sy.hedef_roller, ARRAY['utt']::text[])
      && ARRAY['utt','kd_utt']::text[]
),
guncel_tur_firsatlari AS (
  SELECT cy.yayin_id, su.kullanici_id, cy.guncel_tur_baslangici
  FROM canli_yayinlar cy
  CROSS JOIN scope_users su
),
guncel_tur_tamamlananlar AS (
  SELECT DISTINCT gf.yayin_id, gf.kullanici_id
  FROM guncel_tur_firsatlari gf
  JOIN izleme_kayitlari ik
    ON ik.yayin_id = gf.yayin_id
   AND ik.kullanici_id = gf.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic)
      >= gf.guncel_tur_baslangici
),
donem_izleme AS (
  SELECT ik.izleme_id, ik.kullanici_id, ik.yayin_id
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
),
kazanim AS (
  SELECT
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'eclub'), 0)::int AS eclub_puani,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM (
      SELECT kullanici_id, yayin_id, puan_turu::text, puan, created_at FROM public.kazanilan_puanlar
      UNION ALL
      SELECT utt_id, yayin_id, 'eclub'::text, puan, created_at FROM public.eclub_utt_puanlari
    ) kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
),
ileri_sarma AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM ileri_sarma_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
yanlis_cevap AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM yanlis_cevap_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
oneri_kaybi AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM oneri_kayip_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
challenge_kaybi AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM challenge_kayip_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
sayilar AS (
  SELECT
    (SELECT COUNT(DISTINCT takim_id) FROM scope_users WHERE takim_id IS NOT NULL)::int AS takim,
    (SELECT COUNT(DISTINCT bolge_id) FROM scope_users WHERE bolge_id IS NOT NULL)::int AS bolge,
    (SELECT COUNT(*) FROM scope_users)::int AS utt,
    (SELECT COUNT(DISTINCT kullanici_id) FROM donem_izleme)::int AS aktif,
    (SELECT COUNT(DISTINCT izleme_id) FROM donem_izleme)::int AS donem_izleme,
    (SELECT COUNT(DISTINCT (kullanici_id, yayin_id)) FROM donem_izleme)::int AS donem_cift,
    (SELECT COUNT(*) FROM scope_yayinlari)::int AS tum_yayin,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis)::int AS donem_yayin,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE durum = 'yayinda')::int AS canli,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'urun')::int AS urun,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'egitim')::int AS egitim,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu IN ('medikal','urun_medikal'))::int AS medikal,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'ik')::int AS ik,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = false AND hazir_soru_seti = false)::int AS normal,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = true AND hazir_soru_seti = false)::int AS hazir_video,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = false AND hazir_soru_seti = true)::int AS hazir_set,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = true AND hazir_soru_seti = true)::int AS hazir_ikisi,
    (SELECT COUNT(*) FROM guncel_tur_firsatlari)::int AS firsat,
    (SELECT COUNT(*) FROM guncel_tur_tamamlananlar)::int AS tamamlanan
)
SELECT
  s.takim,
  s.bolge,
  s.utt,
  s.aktif,
  s.donem_izleme,
  s.donem_cift,
  k.izleme,
  k.cevaplama,
  k.oneri,
  k.extra,
  isk.puan,
  yc.puan,
  oky.puan,
  ch.puan,
  (k.izleme + k.cevaplama + k.oneri + k.extra + k.eclub_puani)::int,
  (isk.puan + yc.puan + oky.puan + ch.puan)::int,
  (k.izleme + k.cevaplama + k.oneri + k.extra + k.eclub_puani - isk.puan - yc.puan - oky.puan - ch.puan)::int,
  s.tum_yayin,
  s.donem_yayin,
  s.canli,
  s.urun,
  s.egitim,
  s.medikal,
  s.ik,
  s.normal,
  s.hazir_video,
  s.hazir_set,
  s.hazir_ikisi,
  s.firsat,
  s.tamamlanan,
  GREATEST(0, s.firsat - s.tamamlanan)::int,
  CASE WHEN s.firsat = 0 THEN 0
    ELSE ROUND(100.0 * s.tamamlanan / s.firsat)::int END,
    COALESCE(k.eclub_puani, 0)::integer
FROM sayilar s
CROSS JOIN kazanim k
CROSS JOIN ileri_sarma isk
CROSS JOIN yanlis_cevap yc
CROSS JOIN oneri_kaybi oky
CROSS JOIN challenge_kaybi ch;
$function$;

CREATE OR REPLACE FUNCTION public.get_tm_bm_performans_v1(p_tm_id uuid, p_baslangic timestamp with time zone, p_bitis timestamp with time zone)
 RETURNS TABLE(bm_id uuid, bm_adi text, bolge_id uuid, bolge_adi text, toplam_utt integer, aktif_utt integer, tamamlanan_izleme integer, benzersiz_yayin integer, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, kazanilan_toplam integer, kaybedilen_toplam integer, net_puan integer, eclub_puani integer)
 LANGUAGE sql
 STABLE
AS $function$
WITH
tm_scope AS (
  SELECT k.firma_id, k.takim_id
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_tm_id
    AND k.rol = 'tm'
    AND k.aktif_mi = true
),
scope_bm AS (
  SELECT
    bm.kullanici_id AS bm_id,
    CONCAT(bm.ad, ' ', bm.soyad)::text AS bm_adi,
    bm.bolge_id,
    b.bolge_adi::text AS bolge_adi
  FROM public.kullanicilar bm
  JOIN tm_scope ts
    ON ts.firma_id = bm.firma_id
   AND ts.takim_id = bm.takim_id
  JOIN public.bolgeler b
    ON b.bolge_id = bm.bolge_id
   AND b.takim_id = ts.takim_id
  WHERE bm.rol = 'bm'
    AND bm.aktif_mi = true
)
SELECT
  sb.bm_id,
  sb.bm_adi,
  sb.bolge_id,
  sb.bolge_adi,
  COUNT(up.kullanici_id)::int AS toplam_utt,
  COUNT(up.kullanici_id) FILTER (WHERE up.tamamlanan_izleme > 0)::int AS aktif_utt,
  COALESCE(SUM(up.tamamlanan_izleme), 0)::int AS tamamlanan_izleme,
  COALESCE(SUM(up.benzersiz_yayin), 0)::int AS benzersiz_yayin,
  COALESCE(SUM(up.izleme_puani), 0)::int AS izleme_puani,
  COALESCE(SUM(up.cevaplama_puani), 0)::int AS cevaplama_puani,
  COALESCE(SUM(up.oneri_puani), 0)::int AS oneri_puani,
  COALESCE(SUM(up.extra_puan), 0)::int AS extra_puan,
  COALESCE(SUM(up.ileri_sarma_kaybi), 0)::int AS ileri_sarma_kaybi,
  COALESCE(SUM(up.yanlis_cevap_kaybi), 0)::int AS yanlis_cevap_kaybi,
  COALESCE(SUM(up.oneri_kaybi), 0)::int AS oneri_kaybi,
  COALESCE(SUM(up.kazanilan_toplam), 0)::int AS kazanilan_toplam,
  COALESCE(SUM(up.kaybedilen_toplam), 0)::int AS kaybedilen_toplam,
  COALESCE(SUM(up.net_puan), 0)::int AS net_puan,
    COALESCE(SUM(up.eclub_puani), 0)::integer
FROM scope_bm sb
LEFT JOIN LATERAL public.get_bm_utt_performans_v2(
  sb.bm_id,
  p_baslangic,
  p_bitis
) up ON true
GROUP BY sb.bm_id, sb.bm_adi, sb.bolge_id, sb.bolge_adi
ORDER BY 18 DESC, 2, 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_yonetici_egitim_turu_etkisi_v3(p_yonetici_id uuid, p_baslangic timestamp with time zone, p_bitis timestamp with time zone)
 RETURNS TABLE(egitim_turu text, donemde_yayina_alinan integer, tamamlanan_izleme integer, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, challenge_kaybi integer, kazanilan_toplam integer, kaybedilen_toplam integer, net_puan integer, begeni_sayisi integer, favori_sayisi integer, extra_izleme_sayisi integer, urun_dagilimi jsonb, eclub_puani integer)
 LANGUAGE sql
 STABLE
AS $function$
WITH
turler AS (
  SELECT *
  FROM (VALUES
    (1, 'urun_egitimi'::text),
    (2, 'satis_teknikleri'::text),
    (3, 'medikal_egitim'::text),
    (4, 'urun_medikal_egitim'::text),
    (5, 'ik_egitimi'::text)
  ) AS t(sira, egitim_turu)
),
yonetici_scope AS (
  SELECT k.firma_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_yonetici_id
    AND k.aktif_mi = true
    AND k.rol IN ('gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm')
),
scope_users AS (
  SELECT k.kullanici_id
  FROM kullanicilar k
  JOIN yonetici_scope ys ON ys.firma_id = k.firma_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt','kd_utt')
),
scope_yayinlari AS (
  SELECT DISTINCT
    yy.yayin_id,
    yy.created_at AS yayina_alma_tarihi,
    ky.egitim_turu::text,
    ky.urun_id,
    COALESCE(u.urun_adi, 'Ürün bağlantısı yok')::text AS urun_adi
  FROM yayin_yonetimi yy
  JOIN v_yayin_kunye ky ON ky.yayin_id = yy.yayin_id
  JOIN yonetici_scope ys ON ys.firma_id = ky.firma_id
  LEFT JOIN urunler u ON u.urun_id = ky.urun_id
  WHERE ky.egitim_turu IN (
    'urun_egitimi', 'satis_teknikleri', 'medikal_egitim',
    'urun_medikal_egitim', 'ik_egitimi'
  )
),
uretim AS (
  SELECT
    sy.egitim_turu,
    sy.urun_id,
    sy.urun_adi,
    COUNT(DISTINCT sy.yayin_id)::int AS adet
  FROM scope_yayinlari sy
  WHERE sy.yayina_alma_tarihi >= p_baslangic
    AND sy.yayina_alma_tarihi <= p_bitis
  GROUP BY sy.egitim_turu, sy.urun_id, sy.urun_adi
),
izleme AS (
  SELECT
    sy.egitim_turu,
    COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'extra')::int AS extra
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = ik.yayin_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
  GROUP BY sy.egitim_turu
),
puan_hareketleri AS (
  SELECT kp.kullanici_id, kp.yayin_id, kp.created_at,
    kp.puan_turu::text AS tur, kp.puan::int AS kazanilan, 0::int AS kaybedilen
  FROM kazanilan_puanlar kp
  UNION ALL
  SELECT ep.utt_id, ep.yayin_id, ep.created_at,
    'eclub', ep.puan::int, 0::int
  FROM public.eclub_utt_puanlari ep
  UNION ALL
  SELECT x.kullanici_id, x.yayin_id, x.created_at,
    'ileri_sarma', 0, x.kaybedilen_puan::int
  FROM ileri_sarma_kayitlari x
  UNION ALL
  SELECT x.kullanici_id, x.yayin_id, x.created_at,
    'yanlis_cevap', 0, x.kaybedilen_puan::int
  FROM yanlis_cevap_kayitlari x
  UNION ALL
  SELECT x.kullanici_id, x.yayin_id, x.created_at,
    'oneri_kaybi', 0, x.kaybedilen_puan::int
  FROM oneri_kayip_kayitlari x
  UNION ALL
  SELECT x.kullanici_id, x.yayin_id, x.created_at,
    'challenge_kaybi', 0, x.kaybedilen_puan::int
  FROM challenge_kayip_kayitlari x
),
puan AS (
  SELECT
    sy.egitim_turu,
    sy.urun_id,
    sy.urun_adi,
    COALESCE(SUM(ph.kazanilan) FILTER (WHERE ph.tur = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(ph.kazanilan) FILTER (WHERE ph.tur = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(ph.kazanilan) FILTER (WHERE ph.tur = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(ph.kazanilan) FILTER (WHERE ph.tur = 'extra'), 0)::int AS extra,
    COALESCE(SUM(ph.kazanilan) FILTER (WHERE ph.tur = 'eclub'), 0)::int AS eclub,
    COALESCE(SUM(ph.kaybedilen) FILTER (WHERE ph.tur = 'ileri_sarma'), 0)::int AS ileri,
    COALESCE(SUM(ph.kaybedilen) FILTER (WHERE ph.tur = 'yanlis_cevap'), 0)::int AS yanlis,
    COALESCE(SUM(ph.kaybedilen) FILTER (WHERE ph.tur = 'oneri_kaybi'), 0)::int AS oneri_kaybi,
    COALESCE(SUM(ph.kaybedilen) FILTER (WHERE ph.tur = 'challenge_kaybi'), 0)::int AS challenge
  FROM puan_hareketleri ph
  JOIN scope_users su ON su.kullanici_id = ph.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = ph.yayin_id
  WHERE ph.created_at >= p_baslangic AND ph.created_at <= p_bitis
  GROUP BY sy.egitim_turu, sy.urun_id, sy.urun_adi
),
etkilesim AS (
  SELECT x.egitim_turu,
    SUM(x.begeni)::int AS begeni,
    SUM(x.favori)::int AS favori
  FROM (
    SELECT sy.egitim_turu, 1::int AS begeni, 0::int AS favori
    FROM video_begeniler vb
    JOIN scope_users su ON su.kullanici_id = vb.kullanici_id
    JOIN scope_yayinlari sy ON sy.yayin_id = vb.yayin_id
    WHERE vb.created_at >= p_baslangic AND vb.created_at <= p_bitis
    UNION ALL
    SELECT sy.egitim_turu, 0, 1
    FROM video_favoriler vf
    JOIN scope_users su ON su.kullanici_id = vf.kullanici_id
    JOIN scope_yayinlari sy ON sy.yayin_id = vf.yayin_id
    WHERE vf.created_at >= p_baslangic AND vf.created_at <= p_bitis
  ) x
  GROUP BY x.egitim_turu
),
urun_gruplari AS (
  SELECT egitim_turu, urun_id, urun_adi FROM uretim
  UNION
  SELECT egitim_turu, urun_id, urun_adi FROM puan
),
urun_ozet AS (
  SELECT
    ug.egitim_turu,
    ug.urun_id,
    ug.urun_adi,
    COALESCE(u.adet, 0)::int AS yayina_alinan,
    COALESCE(p.eclub, 0)::int AS eclub_puani,
    (COALESCE(p.izleme, 0) + COALESCE(p.cevaplama, 0) + COALESCE(p.oneri, 0) + COALESCE(p.extra, 0) + COALESCE(p.eclub, 0))::int AS kazanilan,
    (COALESCE(p.ileri, 0) + COALESCE(p.yanlis, 0) + COALESCE(p.oneri_kaybi, 0) + COALESCE(p.challenge, 0))::int AS kaybedilen
  FROM urun_gruplari ug
  LEFT JOIN uretim u
    ON u.egitim_turu = ug.egitim_turu
   AND u.urun_id IS NOT DISTINCT FROM ug.urun_id
   AND u.urun_adi = ug.urun_adi
  LEFT JOIN puan p
    ON p.egitim_turu = ug.egitim_turu
   AND p.urun_id IS NOT DISTINCT FROM ug.urun_id
   AND p.urun_adi = ug.urun_adi
),
urun_json AS (
  SELECT
    uo.egitim_turu,
    jsonb_agg(
      jsonb_build_object(
        'urun_id', uo.urun_id,
        'urun_adi', uo.urun_adi,
        'yayina_alinan', uo.yayina_alinan,
        'eclub_puani', uo.eclub_puani,
        'kazanilan_toplam', uo.kazanilan,
        'kaybedilen_toplam', uo.kaybedilen,
        'net_puan', uo.kazanilan - uo.kaybedilen
      )
      ORDER BY (uo.kazanilan - uo.kaybedilen) DESC, uo.urun_adi
    ) AS dagilim
  FROM urun_ozet uo
  GROUP BY uo.egitim_turu
),
tur_puan AS (
  SELECT
    p.egitim_turu,
    SUM(p.izleme)::int AS izleme,
    SUM(p.cevaplama)::int AS cevaplama,
    SUM(p.oneri)::int AS oneri,
    SUM(p.extra)::int AS extra,
    SUM(p.eclub)::int AS eclub,
    SUM(p.ileri)::int AS ileri,
    SUM(p.yanlis)::int AS yanlis,
    SUM(p.oneri_kaybi)::int AS oneri_kaybi,
    SUM(p.challenge)::int AS challenge
  FROM puan p
  GROUP BY p.egitim_turu
),
tur_uretim AS (
  SELECT u.egitim_turu, SUM(u.adet)::int AS adet
  FROM uretim u
  GROUP BY u.egitim_turu
)
SELECT
  t.egitim_turu,
  COALESCE(tu.adet, 0)::int,
  COALESCE(i.tamamlanan, 0)::int,
  COALESCE(tp.izleme, 0)::int,
  COALESCE(tp.cevaplama, 0)::int,
  COALESCE(tp.oneri, 0)::int,
  COALESCE(tp.extra, 0)::int,
  COALESCE(tp.ileri, 0)::int,
  COALESCE(tp.yanlis, 0)::int,
  COALESCE(tp.oneri_kaybi, 0)::int,
  COALESCE(tp.challenge, 0)::int,
  (COALESCE(tp.izleme, 0) + COALESCE(tp.cevaplama, 0) + COALESCE(tp.oneri, 0) + COALESCE(tp.extra, 0) + COALESCE(tp.eclub, 0))::int,
  (COALESCE(tp.ileri, 0) + COALESCE(tp.yanlis, 0) + COALESCE(tp.oneri_kaybi, 0) + COALESCE(tp.challenge, 0))::int,
  (COALESCE(tp.izleme, 0) + COALESCE(tp.cevaplama, 0) + COALESCE(tp.oneri, 0) + COALESCE(tp.extra, 0) + COALESCE(tp.eclub, 0)
   - COALESCE(tp.ileri, 0) - COALESCE(tp.yanlis, 0) - COALESCE(tp.oneri_kaybi, 0) - COALESCE(tp.challenge, 0))::int,
  COALESCE(e.begeni, 0)::int,
  COALESCE(e.favori, 0)::int,
  COALESCE(i.extra, 0)::int,
  COALESCE(uj.dagilim, '[]'::jsonb),
    COALESCE(tp.eclub, 0)::integer
FROM turler t
LEFT JOIN tur_uretim tu ON tu.egitim_turu = t.egitim_turu
LEFT JOIN izleme i ON i.egitim_turu = t.egitim_turu
LEFT JOIN tur_puan tp ON tp.egitim_turu = t.egitim_turu
LEFT JOIN etkilesim e ON e.egitim_turu = t.egitim_turu
LEFT JOIN urun_json uj ON uj.egitim_turu = t.egitim_turu
ORDER BY t.sira;
$function$;

CREATE OR REPLACE FUNCTION public._hb_ligi_v2_aralik(p_bas date, p_bit date)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint, eclub_puani integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
      COALESCE(ep.eclub_puani,0)::integer AS eclub_puani,
      COALESCE(oz.ileri,0) AS ileri_sarma_kaybi, COALESCE(oz.yanlis,0) AS yanlis_cevap_kaybi,
      COALESCE(oz.onerikayip,0) AS oneri_kaybi,
      (COALESCE(oz.izleme,0)+COALESCE(oz.cev,0)+COALESCE(oz.oneri,0)+COALESCE(oz.extra,0) + COALESCE(ep.eclub_puani,0)
       - COALESCE(oz.ileri,0) - COALESCE(oz.yanlis,0) - COALESCE(oz.onerikayip,0))::integer AS toplam_puan
    FROM kullanicilar k
    LEFT JOIN oz ON oz.kullanici_id = k.kullanici_id
    LEFT JOIN (
      SELECT utt_id, SUM(puan)::integer AS eclub_puani
      FROM public.eclub_utt_puanlari
      WHERE created_at >= (p_bas::timestamp AT TIME ZONE 'Europe/Istanbul')
        AND created_at < (p_bit::timestamp AT TIME ZONE 'Europe/Istanbul')
      GROUP BY utt_id
    ) ep ON ep.utt_id = k.kullanici_id
    WHERE k.rol IN ('utt','kd_utt') AND k.aktif_mi = true
  )
  SELECT b.kullanici_id, b.rol, b.izleme_puani, b.cevaplama_puani, b.oneri_puani, b.extra_puani,
    b.ileri_sarma_kaybi, b.yanlis_cevap_kaybi, b.oneri_kaybi, b.toplam_puan,
    b.ad, b.soyad, b.eposta, f.firma_id, f.firma_adi::text, t.takim_id, t.takim_adi::text, bo.bolge_id, bo.bolge_adi::text,
    row_number() OVER (PARTITION BY f.firma_id ORDER BY b.toplam_puan DESC),
    row_number() OVER (PARTITION BY bo.bolge_id ORDER BY b.toplam_puan DESC),
    row_number() OVER (PARTITION BY t.takim_id ORDER BY b.toplam_puan DESC),
    b.eclub_puani
  FROM birlesik b
  LEFT JOIN firmalar f ON f.firma_id=b.firma_id
  LEFT JOIN takimlar t ON t.takim_id=b.takim_id
  LEFT JOIN bolgeler bo ON bo.bolge_id=b.bolge_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_hb_ligi_aylik_v2(p_yil integer, p_ay integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint, eclub_puani integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    make_date(p_yil, p_ay, 1),
    (make_date(p_yil, p_ay, 1) + interval '1 month')::date
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_hb_ligi_donemlik_v2(p_yil integer, p_ceyrek integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint, eclub_puani integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1),
    (make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1) + interval '3 months')::date
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_hb_ligi_yillik_v2(p_yil integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint, eclub_puani integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    make_date(p_yil, 1, 1),
    make_date(p_yil + 1, 1, 1)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_hb_ligi_haftalik_v2(p_yil integer, p_hafta integer)
 RETURNS TABLE(kullanici_id uuid, rol text, izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_puan integer, ad text, soyad text, eposta text, firma_id uuid, firma_adi text, takim_id uuid, takim_adi text, bolge_id uuid, bolge_adi text, firma_sirasi bigint, bolge_sirasi bigint, takim_sirasi bigint, eclub_puani integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._hb_ligi_v2_aralik(
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7),
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7 + 7)
  );
$function$;

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
    -- UTT'nin E-Club kazanımı aynı çeyrekte harcanabilir bakiyeye dahildir.
    SELECT v_kazanim + COALESCE(SUM(ep.puan), 0)::integer INTO v_kazanim
    FROM public.eclub_utt_puanlari ep
    WHERE ep.utt_id = p_kullanici_id
      AND ep.created_at >= v_ceyrek_bas AND ep.created_at < v_ceyrek_bit;
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

CREATE OR REPLACE VIEW public.hb_ligi_v2 AS
 SELECT k.kullanici_id,
    k.rol,
    COALESCE(oz.izleme_puani, (0)::bigint) AS izleme_puani,
    COALESCE(oz.cevaplama_puani, (0)::bigint) AS cevaplama_puani,
    COALESCE(oz.oneri_puani, (0)::bigint) AS oneri_puani,
    COALESCE(oz.extra_puani, (0)::bigint) AS extra_puani,
    COALESCE(oz.ileri_sarma_kaybi, (0)::bigint) AS ileri_sarma_kaybi,
    COALESCE(oz.yanlis_cevap_kaybi, (0)::bigint) AS yanlis_cevap_kaybi,
    COALESCE(oz.oneri_kaybi, (0)::bigint) AS oneri_kaybi,
    ((((((COALESCE(oz.izleme_puani, (0)::bigint) + COALESCE(oz.cevaplama_puani, (0)::bigint)) + COALESCE(oz.oneri_puani, (0)::bigint)) + COALESCE(oz.extra_puani, (0)::bigint)) - COALESCE(oz.ileri_sarma_kaybi, (0)::bigint)) - COALESCE(oz.yanlis_cevap_kaybi, (0)::bigint)) - COALESCE(oz.oneri_kaybi, (0)::bigint)) + COALESCE(ep.eclub_puani, 0::bigint) AS toplam_puan,
    COALESCE(ep.eclub_puani, 0::bigint) AS eclub_puani
   FROM (kullanicilar k
     LEFT JOIN ( SELECT hb_ligi_ozet_v2.kullanici_id,
            sum(hb_ligi_ozet_v2.izleme_puani) AS izleme_puani,
            sum(hb_ligi_ozet_v2.cevaplama_puani) AS cevaplama_puani,
            sum(hb_ligi_ozet_v2.oneri_puani) AS oneri_puani,
            sum(hb_ligi_ozet_v2.extra_puani) AS extra_puani,
            sum(hb_ligi_ozet_v2.ileri_sarma_kaybi) AS ileri_sarma_kaybi,
            sum(hb_ligi_ozet_v2.yanlis_cevap_kaybi) AS yanlis_cevap_kaybi,
            sum(hb_ligi_ozet_v2.oneri_kaybi) AS oneri_kaybi
           FROM hb_ligi_ozet_v2
          GROUP BY hb_ligi_ozet_v2.kullanici_id) oz ON ((oz.kullanici_id = k.kullanici_id)))
  LEFT JOIN (
    SELECT utt_id, SUM(puan)::bigint AS eclub_puani
    FROM public.eclub_utt_puanlari GROUP BY utt_id
  ) ep ON ep.utt_id = k.kullanici_id
  WHERE (((k.rol)::text = ANY (ARRAY[('utt'::character varying)::text, ('kd_utt'::character varying)::text])) AND (k.aktif_mi = true));

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
    row_number() OVER (PARTITION BY t.takim_id ORDER BY hl.toplam_puan DESC) AS takim_sirasi,
    hl.eclub_puani
   FROM ((((hb_ligi_v2 hl
     JOIN kullanicilar k ON ((k.kullanici_id = hl.kullanici_id)))
     LEFT JOIN firmalar f ON ((f.firma_id = k.firma_id)))
     LEFT JOIN takimlar t ON ((t.takim_id = k.takim_id)))
     LEFT JOIN bolgeler b ON ((b.bolge_id = k.bolge_id)));

DO $izinler$
DECLARE r record; a record; hedef text;
BEGIN
  FOR r IN SELECT * FROM hb_eclub_rpc_izinleri LOOP
    -- Yeniden oluşturmadaki varsayılan izinleri temizle, eski ACL'yi geri yükle.
    FOR a IN
      SELECT acl.grantee FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f',p.proowner))) acl
      WHERE n.nspname='public' AND p.proname=r.proname
    LOOP
      hedef := CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM %s', r.proname,r.args,hedef);
    END LOOP;
    EXECUTE format('ALTER FUNCTION public.%I(%s) OWNER TO %I',r.proname,r.args,r.sahip);
    FOR a IN SELECT * FROM aclexplode(COALESCE(r.proacl, acldefault('f',r.proowner))) LOOP
      hedef := CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
      EXECUTE format('GRANT %s ON FUNCTION public.%I(%s) TO %s%s',a.privilege_type,r.proname,r.args,hedef,
        CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    END LOOP;
    IF r.aciklama IS NOT NULL THEN
      EXECUTE format('COMMENT ON FUNCTION public.%I(%s) IS %L',r.proname,r.args,r.aciklama);
    END IF;
  END LOOP;
END;
$izinler$;
NOTIFY pgrst, 'reload schema';
COMMIT;
