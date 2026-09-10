-- ============================================================================
-- Rapor SQL'lerinde Tekrarlanan UTT Puan Hesaplarını Ortaklaştırma Migrasyonu
-- Dosya: scripts/sql/rapor_puan_hesaplari_ortaklastirma.sql
--
-- ÇALIŞTIRMA SIRASI:
--   1. Adım: scripts/sql/test_rapor_puan_hesaplari_ortaklastirma.sql
--            (Supabase SQL Editörü'nde çalıştırılır; eski ve yeni sürümleri
--             tüm alanlar, sıralamalar ve izinler düzeyinde doğrular;
--             BEGIN … ROLLBACK ile biter, DB'de kalıcı etki bırakmaz).
--   2. Adım: Test sonuçları onaylandıktan sonra bu dosya
--            (scripts/sql/rapor_puan_hesaplari_ortaklastirma.sql)
--            çalıştırılarak 4 fonksiyonun dar migrasyonu kalıcı olarak uygulanır.
--   NOT: utt_eclub_puan_kazanimi.sql dosyası yeniden ÇALIŞTIRILMAZ.
--
-- KAPSAM:
--   1. get_bolge_bazli_grup:
--      Bölge bazlı UTT puan toplamlarını (izleme, soru, öneri, extra, eclub,
--      ileri sarma, yanlış cevap, öneri kaybı, toplam net) get_kullanici_ozet
--      üzerinden okur. Ürün dağılımı (urun_dagilimi JSONB) ve izlenme durumu
--      hesapları korunur.
--   2. get_bm_utt_performans_v2:
--      BM'nin sahasındaki UTT/KD_UTT kullanıcılarının puan kalemlerini ve
--      toplamlarını get_kullanici_ozet üzerinden okur. İzleme kayıtları
--      üzerinden hesaplanan tamamlanan ve benzersiz yayın ölçütleri korunur.
--   3. get_yonetici_hiyerarsi_v2:
--      Takım, bölge veya UTT seviyesinde hiyerarşik puan özetini
--      get_kullanici_ozet üzerinden okur. İzleme ölçütleri ve UTT'lere özgü
--      challenge kaybı (challenge_kayip_kayitlari) CTE'si korunur ve
--      toplam kayıp / net puana dahil edilir.
--   4. get_yonetici_rapor_ana_ozet_v2:
--      Firma geneli yönetici özetindeki UTT puan kalemlerini
--      get_kullanici_ozet üzerinden okur. Yayın/içerik/üretim ve tur
--      fırsatı ölçütleri ile challenge kaybı CTE'si korunur.
--
-- KORUNAN KURALLAR VE İZİNLER:
--   - CASCADE kullanılmaz (DROP CASCADE yasaktır).
--   - Fonksiyon imzaları, dönüş kolonları ve tipleri birebir korunur.
--   - Mevcut çalıştırma izinleri (ACL/GRANT) ve güvenlik özellikleri korunur;
--     toplu REVOKE veya izin daraltıcı işlem uygulanmaz.
--   - BM kişisel C-Club puanı UTT saha toplamına dahil edilmez.
--   - E-Club kazanımı dahil kalır.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ----------------------------------------------------------------------------
-- 1. get_bolge_bazli_grup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bolge_bazli_grup(
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone,
  p_takim_id uuid DEFAULT NULL::uuid,
  p_firma_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  bolge_id uuid,
  bolge_adi text,
  takim_id uuid,
  takim_adi text,
  bm_adi text,
  toplam_utt integer,
  aktif_utt integer,
  hic_izlemeyen_utt integer,
  video_puani integer,
  soru_puani integer,
  oneri_puani integer,
  extra_puan integer,
  ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer,
  oneri_kaybi integer,
  toplam_net_puan integer,
  urun_dagilimi jsonb,
  eclub_puani integer
)
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
      AND k.bolge_id IN (SELECT sb.bolge_id FROM scoped_bolgeler sb)
  ),
  scoped_utt AS (
    SELECT k.kullanici_id, k.bolge_id
    FROM kullanicilar k
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt', 'kd_utt')
      AND k.bolge_id IN (SELECT sb.bolge_id FROM scoped_bolgeler sb)
  ),
  toplam_utt_per_bolge AS (
    SELECT su.bolge_id, COUNT(*)::int AS toplam_utt
    FROM scoped_utt su
    GROUP BY su.bolge_id
  ),
  puan_ozet AS (
    SELECT
      su.bolge_id,
      COUNT(DISTINCT o.kullanici_id) FILTER (WHERE o.izlenme_sayisi > 0)::int AS aktif_utt,
      SUM(o.video_puani)::int AS video_puani,
      SUM(o.soru_puani)::int AS soru_puani,
      SUM(o.oneri_puani)::int AS oneri_puani,
      SUM(o.extra_puan)::int AS extra_puan,
      SUM(o.ileri_sarma_kaybi)::int AS ileri_sarma_kaybi,
      SUM(o.yanlis_cevap_kaybi)::int AS yanlis_cevap_kaybi,
      SUM(o.oneri_kaybi)::int AS oneri_kaybi,
      SUM(o.toplam_net_puan)::int AS toplam_net_puan,
      SUM(o.eclub_puani)::int AS eclub_puani
    FROM public.get_kullanici_ozet(
      p_baslangic,
      p_bitis,
      NULL::uuid,
      NULL::uuid,
      p_takim_id,
      p_firma_id
    ) o
    JOIN scoped_utt su ON su.kullanici_id = o.kullanici_id
    GROUP BY su.bolge_id
  ),
  urun_kazanim AS (
    SELECT
      su.bolge_id,
      ky.urun_id,
      SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
      SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
      SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
      SUM(CASE WHEN kp.puan_turu = 'eclub'     THEN kp.puan ELSE 0 END)::int AS eclub_puani,
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
    COALESCE(po.aktif_utt, 0),
    GREATEST(0, COALESCE(tup.toplam_utt, 0) - COALESCE(po.aktif_utt, 0)),
    COALESCE(po.video_puani, 0),
    COALESCE(po.soru_puani, 0),
    COALESCE(po.oneri_puani, 0),
    COALESCE(po.extra_puan, 0),
    COALESCE(po.ileri_sarma_kaybi, 0),
    COALESCE(po.yanlis_cevap_kaybi, 0),
    COALESCE(po.oneri_kaybi, 0),
    COALESCE(po.toplam_net_puan, 0),
    COALESCE(ud.urun_dagilimi, '[]'::jsonb),
    COALESCE(po.eclub_puani, 0)::integer
  FROM scoped_bolgeler sb
  LEFT JOIN bm_per_bolge          bmb ON bmb.bolge_id = sb.bolge_id
  LEFT JOIN toplam_utt_per_bolge  tup ON tup.bolge_id = sb.bolge_id
  LEFT JOIN puan_ozet             po  ON po.bolge_id  = sb.bolge_id
  LEFT JOIN urun_dagilim          ud  ON ud.bolge_id  = sb.bolge_id
  ORDER BY sb.takim_adi, sb.bolge_adi;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 2. get_bm_utt_performans_v2
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_bm_utt_performans_v2(
  p_bm_id uuid,
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone
)
RETURNS TABLE(
  kullanici_id uuid,
  ad text,
  soyad text,
  tamamlanan_izleme integer,
  benzersiz_yayin integer,
  izleme_puani integer,
  cevaplama_puani integer,
  oneri_puani integer,
  extra_puan integer,
  ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer,
  oneri_kaybi integer,
  kazanilan_toplam integer,
  kaybedilen_toplam integer,
  net_puan integer,
  eclub_puani integer
)
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
puan_ozet AS (
  SELECT o.*
  FROM bm_scope bs
  CROSS JOIN LATERAL public.get_kullanici_ozet(
    p_baslangic,
    p_bitis,
    NULL::uuid,
    bs.bolge_id,
    bs.takim_id,
    bs.firma_id
  ) o
)
SELECT
  su.kullanici_id,
  su.ad,
  su.soyad,
  COALESCE(i.tamamlanan, 0)::integer AS tamamlanan_izleme,
  COALESCE(i.benzersiz, 0)::integer AS benzersiz_yayin,
  COALESCE(po.video_puani, 0)::integer AS izleme_puani,
  COALESCE(po.soru_puani, 0)::integer AS cevaplama_puani,
  COALESCE(po.oneri_puani, 0)::integer AS oneri_puani,
  COALESCE(po.extra_puan, 0)::integer AS extra_puan,
  COALESCE(po.ileri_sarma_kaybi, 0)::integer AS ileri_sarma_kaybi,
  COALESCE(po.yanlis_cevap_kaybi, 0)::integer AS yanlis_cevap_kaybi,
  COALESCE(po.oneri_kaybi, 0)::integer AS oneri_kaybi,
  (COALESCE(po.video_puani, 0) + COALESCE(po.soru_puani, 0) + COALESCE(po.oneri_puani, 0) + COALESCE(po.extra_puan, 0) + COALESCE(po.eclub_puani, 0))::integer AS kazanilan_toplam,
  (COALESCE(po.ileri_sarma_kaybi, 0) + COALESCE(po.yanlis_cevap_kaybi, 0) + COALESCE(po.oneri_kaybi, 0))::integer AS kaybedilen_toplam,
  COALESCE(po.toplam_net_puan, 0)::integer AS net_puan,
  COALESCE(po.eclub_puani, 0)::integer AS eclub_puani
FROM scope_users su
LEFT JOIN izleme i ON i.kullanici_id = su.kullanici_id
LEFT JOIN puan_ozet po ON po.kullanici_id = su.kullanici_id
ORDER BY 15 DESC, 2, 3;
$function$;

-- ----------------------------------------------------------------------------
-- 3. get_yonetici_hiyerarsi_v2
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_yonetici_hiyerarsi_v2(
  p_yonetici_id uuid,
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone,
  p_seviye text,
  p_ust_birim_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  birim_id uuid,
  birim_adi text,
  toplam_utt integer,
  aktif_utt integer,
  tamamlanan_izleme integer,
  benzersiz_yayin integer,
  izleme_puani integer,
  cevaplama_puani integer,
  oneri_puani integer,
  extra_puan integer,
  ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer,
  oneri_kaybi integer,
  challenge_kaybi integer,
  kazanilan_toplam integer,
  kaybedilen_toplam integer,
  net_puan integer,
  eclub_puani integer
)
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
puan_ozet AS (
  SELECT
    v.id,
    SUM(o.video_puani)::int AS izleme,
    SUM(o.soru_puani)::int AS cevaplama,
    SUM(o.oneri_puani)::int AS oneri,
    SUM(o.extra_puan)::int AS extra,
    SUM(o.eclub_puani)::int AS eclub_puani,
    SUM(o.ileri_sarma_kaybi)::int AS ileri_sarma_kaybi,
    SUM(o.yanlis_cevap_kaybi)::int AS yanlis_cevap_kaybi,
    SUM(o.oneri_kaybi)::int AS oneri_kaybi
  FROM yonetici_scope ys
  CROSS JOIN LATERAL public.get_kullanici_ozet(
    p_baslangic,
    p_bitis,
    NULL::uuid,
    NULL::uuid,
    NULL::uuid,
    ys.firma_id
  ) o
  JOIN varliklar v ON v.kullanici_id = o.kullanici_id
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
  COALESCE(i.aktif, 0)::int AS aktif_utt,
  COALESCE(i.tamamlanan, 0)::int AS tamamlanan_izleme,
  COALESCE(i.benzersiz, 0)::int AS benzersiz_yayin,
  COALESCE(po.izleme, 0)::int AS izleme_puani,
  COALESCE(po.cevaplama, 0)::int AS cevaplama_puani,
  COALESCE(po.oneri, 0)::int AS oneri_puani,
  COALESCE(po.extra, 0)::int AS extra_puan,
  COALESCE(po.ileri_sarma_kaybi, 0)::int AS ileri_sarma_kaybi,
  COALESCE(po.yanlis_cevap_kaybi, 0)::int AS yanlis_cevap_kaybi,
  COALESCE(po.oneri_kaybi, 0)::int AS oneri_kaybi,
  COALESCE(ch.puan, 0)::int AS challenge_kaybi,
  (COALESCE(po.izleme, 0) + COALESCE(po.cevaplama, 0) + COALESCE(po.oneri, 0) + COALESCE(po.extra, 0) + COALESCE(po.eclub_puani, 0))::int AS kazanilan_toplam,
  (COALESCE(po.ileri_sarma_kaybi, 0) + COALESCE(po.yanlis_cevap_kaybi, 0) + COALESCE(po.oneri_kaybi, 0) + COALESCE(ch.puan, 0))::int AS kaybedilen_toplam,
  (COALESCE(po.izleme, 0) + COALESCE(po.cevaplama, 0) + COALESCE(po.oneri, 0) + COALESCE(po.extra, 0) + COALESCE(po.eclub_puani, 0)
   - COALESCE(po.ileri_sarma_kaybi, 0) - COALESCE(po.yanlis_cevap_kaybi, 0) - COALESCE(po.oneri_kaybi, 0) - COALESCE(ch.puan, 0))::int AS net_puan,
  COALESCE(po.eclub_puani, 0)::int AS eclub_puani
FROM kapsam kp
LEFT JOIN izleme i ON i.id = kp.id
LEFT JOIN puan_ozet po ON po.id = kp.id
LEFT JOIN challenge_kaybi ch ON ch.id = kp.id
ORDER BY 17 DESC, 2;
$function$;

-- ----------------------------------------------------------------------------
-- 4. get_yonetici_rapor_ana_ozet_v2
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_yonetici_rapor_ana_ozet_v2(
  p_yonetici_id uuid,
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone
)
RETURNS TABLE(
  toplam_takim integer,
  toplam_bolge integer,
  toplam_utt integer,
  aktif_utt integer,
  donem_tamamlanan_izleme integer,
  donem_benzersiz_utt_yayin integer,
  izleme_puani integer,
  cevaplama_puani integer,
  oneri_puani integer,
  extra_puani integer,
  ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer,
  oneri_kaybi integer,
  challenge_kaybi integer,
  kazanilan_toplam integer,
  kaybedilen_toplam integer,
  net_puan integer,
  toplam_yayina_alma integer,
  donemde_yayina_alinan integer,
  su_an_yayinda integer,
  donem_urun_egitimi integer,
  donem_genel_egitim integer,
  donem_medikal_egitim integer,
  donem_ik_egitimi integer,
  donem_normal_uretim integer,
  donem_hazir_video integer,
  donem_hazir_soru_seti integer,
  donem_hazir_video_ve_soru_seti integer,
  guncel_tur_toplam_firsat integer,
  guncel_tur_tamamlanan integer,
  guncel_tur_kalan integer,
  guncel_tur_izlenme_orani integer,
  eclub_puani integer
)
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
puan_ozet AS (
  SELECT
    COALESCE(SUM(o.video_puani), 0)::int AS izleme,
    COALESCE(SUM(o.soru_puani), 0)::int AS cevaplama,
    COALESCE(SUM(o.oneri_puani), 0)::int AS oneri,
    COALESCE(SUM(o.extra_puan), 0)::int AS extra,
    COALESCE(SUM(o.eclub_puani), 0)::int AS eclub_puani,
    COALESCE(SUM(o.ileri_sarma_kaybi), 0)::int AS ileri_sarma_kaybi,
    COALESCE(SUM(o.yanlis_cevap_kaybi), 0)::int AS yanlis_cevap_kaybi,
    COALESCE(SUM(o.oneri_kaybi), 0)::int AS oneri_kaybi
  FROM yonetici_scope ys
  CROSS JOIN LATERAL public.get_kullanici_ozet(
    p_baslangic,
    p_bitis,
    NULL::uuid,
    NULL::uuid,
    NULL::uuid,
    ys.firma_id
  ) o
  JOIN scope_users su ON su.kullanici_id = o.kullanici_id
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
  po.izleme,
  po.cevaplama,
  po.oneri,
  po.extra,
  po.ileri_sarma_kaybi,
  po.yanlis_cevap_kaybi,
  po.oneri_kaybi,
  ch.puan,
  (po.izleme + po.cevaplama + po.oneri + po.extra + po.eclub_puani)::int AS kazanilan_toplam,
  (po.ileri_sarma_kaybi + po.yanlis_cevap_kaybi + po.oneri_kaybi + ch.puan)::int AS kaybedilen_toplam,
  (po.izleme + po.cevaplama + po.oneri + po.extra + po.eclub_puani - po.ileri_sarma_kaybi - po.yanlis_cevap_kaybi - po.oneri_kaybi - ch.puan)::int AS net_puan,
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
  GREATEST(0, s.firsat - s.tamamlanan)::int AS guncel_tur_kalan,
  CASE WHEN s.firsat = 0 THEN 0
    ELSE ROUND(100.0 * s.tamamlanan / s.firsat)::int END AS guncel_tur_izlenme_orani,
  COALESCE(po.eclub_puani, 0)::integer AS eclub_puani
FROM sayilar s
CROSS JOIN puan_ozet po
CROSS JOIN challenge_kaybi ch;
$function$;

-- ----------------------------------------------------------------------------
-- AÇIKLAMALAR
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION public.get_bolge_bazli_grup(timestamp with time zone, timestamp with time zone, uuid, uuid)
  IS 'Bölge bazlı UTT performans ve ürün dağılımı (puanlar ortak get_kullanici_ozet üzerinden okunur).';

COMMENT ON FUNCTION public.get_bm_utt_performans_v2(uuid, timestamp with time zone, timestamp with time zone)
  IS 'BM saha görünümü UTT performans tablosu (puanlar ortak get_kullanici_ozet üzerinden okunur).';

COMMENT ON FUNCTION public.get_yonetici_hiyerarsi_v2(uuid, timestamp with time zone, timestamp with time zone, text, uuid)
  IS 'Yönetici hiyerarşik raporu: takım, bölge veya UTT seviyesi (puanlar ortak get_kullanici_ozet üzerinden okunur).';

COMMENT ON FUNCTION public.get_yonetici_rapor_ana_ozet_v2(uuid, timestamp with time zone, timestamp with time zone)
  IS 'Yönetici rapor ana özeti: firma geneli saha ve yayın metrikleri (puanlar ortak get_kullanici_ozet üzerinden okunur).';

NOTIFY pgrst, 'reload schema';

COMMIT;
