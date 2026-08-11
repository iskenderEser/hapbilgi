-- TM raporu v2 — takım performansının kanonik, kapsam-güvenli okuma katmanı.
--
-- Yeni fonksiyonlar mevcut TM raporunu değiştirmez. Uygulama bunlara
-- geçirilene kadar eski davranış sürer. Kapsam yalnız TM kimliğinden çözülür.
--
-- Exit / geri dönüş:
--   DROP FUNCTION public.get_tm_rapor_ana_ozet_v2(uuid,timestamptz,timestamptz);
--   DROP FUNCTION public.get_tm_bolge_performans_v2(uuid,timestamptz,timestamptz);
--   DROP FUNCTION public.get_tm_utt_performans_v2(uuid,timestamptz,timestamptz);
--   DROP FUNCTION public.get_tm_etkilesim_v2(uuid,timestamptz,timestamptz);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_tm_rapor_ana_ozet_v2(
  p_tm_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  toplam_yayin integer,
  toplam_bolge integer,
  toplam_utt integer,
  guncel_tur_toplam_firsat integer,
  guncel_tur_tamamlanan integer,
  guncel_tur_kalan integer,
  guncel_tur_izlenme_orani integer,
  donem_tamamlanan_izleme integer,
  donem_benzersiz_utt_yayin integer,
  donem_aktif_utt integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
tm_scope AS (
  SELECT k.firma_id, k.takim_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_tm_id
    AND k.rol = 'tm'
    AND k.aktif_mi = true
),
scope_bolgeler AS (
  SELECT b.bolge_id
  FROM bolgeler b
  JOIN tm_scope ts ON ts.takim_id = b.takim_id
),
scope_users AS (
  SELECT k.kullanici_id, k.bolge_id
  FROM kullanicilar k
  JOIN tm_scope ts
    ON ts.firma_id = k.firma_id
   AND ts.takim_id = k.takim_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt', 'kd_utt')
),
scope_yayinlari AS (
  SELECT DISTINCT ym.yayin_id, ym.durum, ym.yayin_tarihi, ym.created_at
  FROM yayin_yonetimi ym
  JOIN v_yayin_kunye ky ON ky.yayin_id = ym.yayin_id
  JOIN tm_scope ts ON ts.firma_id = ky.firma_id
  WHERE COALESCE(ym.hedef_roller, ARRAY['utt']::text[])
    && ARRAY['utt', 'kd_utt']::text[]
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
donem_izlemeleri AS (
  SELECT ik.izleme_id, ik.kullanici_id, ik.yayin_id
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = ik.yayin_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
),
sayilar AS (
  SELECT
    (SELECT COUNT(*) FROM canli_yayinlar)::int AS toplam_yayin,
    (SELECT COUNT(*) FROM scope_bolgeler)::int AS toplam_bolge,
    (SELECT COUNT(*) FROM scope_users)::int AS toplam_utt,
    (SELECT COUNT(*) FROM guncel_tur_firsatlari)::int AS toplam_firsat,
    (SELECT COUNT(*) FROM guncel_tur_tamamlananlar)::int AS tamamlanan,
    (SELECT COUNT(DISTINCT izleme_id) FROM donem_izlemeleri)::int AS donem_izleme,
    (SELECT COUNT(DISTINCT (kullanici_id, yayin_id)) FROM donem_izlemeleri)::int AS donem_cift,
    (SELECT COUNT(DISTINCT kullanici_id) FROM donem_izlemeleri)::int AS donem_aktif
)
SELECT
  s.toplam_yayin,
  s.toplam_bolge,
  s.toplam_utt,
  s.toplam_firsat,
  s.tamamlanan,
  GREATEST(0, s.toplam_firsat - s.tamamlanan)::int,
  CASE WHEN s.toplam_firsat = 0 THEN 0
    ELSE ROUND(100.0 * s.tamamlanan / s.toplam_firsat)::int END,
  s.donem_izleme,
  s.donem_cift,
  s.donem_aktif
FROM sayilar s;
$function$;

CREATE OR REPLACE FUNCTION public.get_tm_bolge_performans_v2(
  p_tm_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  bolge_id uuid,
  bolge_adi text,
  bm_adi text,
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
  kazanilan_toplam integer,
  kaybedilen_toplam integer,
  net_puan integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
tm_scope AS (
  SELECT k.firma_id, k.takim_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_tm_id
    AND k.rol = 'tm'
    AND k.aktif_mi = true
),
scope_bolgeler AS (
  SELECT b.bolge_id, b.bolge_adi::text
  FROM bolgeler b
  JOIN tm_scope ts ON ts.takim_id = b.takim_id
),
scope_users AS (
  SELECT k.kullanici_id, k.bolge_id
  FROM kullanicilar k
  JOIN tm_scope ts
    ON ts.firma_id = k.firma_id
   AND ts.takim_id = k.takim_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt', 'kd_utt')
),
bm AS (
  SELECT k.bolge_id, CONCAT(k.ad, ' ', k.soyad)::text AS ad
  FROM kullanicilar k
  JOIN tm_scope ts
    ON ts.firma_id = k.firma_id
   AND ts.takim_id = k.takim_id
  WHERE k.aktif_mi = true AND k.rol = 'bm'
),
izleme AS (
  SELECT
    su.bolge_id,
    COUNT(DISTINCT ik.kullanici_id)::int AS aktif,
    COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
    COUNT(DISTINCT (ik.kullanici_id, ik.yayin_id))::int AS benzersiz
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
  GROUP BY su.bolge_id
),
kazanim AS (
  SELECT
    su.bolge_id,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM kazanilan_puanlar kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
  GROUP BY su.bolge_id
),
ileri_sarma AS (
  SELECT su.bolge_id, SUM(isk.kaybedilen_puan)::int AS puan
  FROM ileri_sarma_kayitlari isk
  JOIN scope_users su ON su.kullanici_id = isk.kullanici_id
  WHERE isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
  GROUP BY su.bolge_id
),
yanlis_cevap AS (
  SELECT su.bolge_id, SUM(yck.kaybedilen_puan)::int AS puan
  FROM yanlis_cevap_kayitlari yck
  JOIN scope_users su ON su.kullanici_id = yck.kullanici_id
  WHERE yck.created_at >= p_baslangic AND yck.created_at <= p_bitis
  GROUP BY su.bolge_id
),
oneri_kaybi AS (
  SELECT su.bolge_id, SUM(okk.kaybedilen_puan)::int AS puan
  FROM oneri_kayip_kayitlari okk
  JOIN scope_users su ON su.kullanici_id = okk.kullanici_id
  WHERE okk.created_at >= p_baslangic AND okk.created_at <= p_bitis
  GROUP BY su.bolge_id
),
utt_sayisi AS (
  SELECT bolge_id, COUNT(*)::int AS adet FROM scope_users GROUP BY bolge_id
)
SELECT
  sb.bolge_id,
  sb.bolge_adi,
  COALESCE(bm.ad, '—')::text,
  COALESCE(us.adet, 0),
  COALESCE(i.aktif, 0),
  COALESCE(i.tamamlanan, 0),
  COALESCE(i.benzersiz, 0),
  COALESCE(k.izleme, 0),
  COALESCE(k.cevaplama, 0),
  COALESCE(k.oneri, 0),
  COALESCE(k.extra, 0),
  COALESCE(isk.puan, 0),
  COALESCE(yc.puan, 0),
  COALESCE(ok.puan, 0),
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0))::int,
  (COALESCE(isk.puan, 0) + COALESCE(yc.puan, 0) + COALESCE(ok.puan, 0))::int,
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0)
    - COALESCE(isk.puan, 0) - COALESCE(yc.puan, 0) - COALESCE(ok.puan, 0))::int
FROM scope_bolgeler sb
LEFT JOIN bm ON bm.bolge_id = sb.bolge_id
LEFT JOIN utt_sayisi us ON us.bolge_id = sb.bolge_id
LEFT JOIN izleme i ON i.bolge_id = sb.bolge_id
LEFT JOIN kazanim k ON k.bolge_id = sb.bolge_id
LEFT JOIN ileri_sarma isk ON isk.bolge_id = sb.bolge_id
LEFT JOIN yanlis_cevap yc ON yc.bolge_id = sb.bolge_id
LEFT JOIN oneri_kaybi ok ON ok.bolge_id = sb.bolge_id
ORDER BY 17 DESC, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_tm_utt_performans_v2(
  p_tm_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  kullanici_id uuid,
  ad text,
  soyad text,
  bolge_id uuid,
  bolge_adi text,
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
  net_puan integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
tm_scope AS (
  SELECT k.firma_id, k.takim_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_tm_id
    AND k.rol = 'tm'
    AND k.aktif_mi = true
),
scope_users AS (
  SELECT k.kullanici_id, k.ad::text, k.soyad::text, k.bolge_id, b.bolge_adi::text
  FROM kullanicilar k
  JOIN tm_scope ts
    ON ts.firma_id = k.firma_id
   AND ts.takim_id = k.takim_id
  JOIN bolgeler b ON b.bolge_id = k.bolge_id
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
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM kazanilan_puanlar kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
  GROUP BY kp.kullanici_id
),
ileri_sarma AS (
  SELECT isk.kullanici_id, SUM(isk.kaybedilen_puan)::int AS puan
  FROM ileri_sarma_kayitlari isk
  JOIN scope_users su ON su.kullanici_id = isk.kullanici_id
  WHERE isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
  GROUP BY isk.kullanici_id
),
yanlis_cevap AS (
  SELECT yck.kullanici_id, SUM(yck.kaybedilen_puan)::int AS puan
  FROM yanlis_cevap_kayitlari yck
  JOIN scope_users su ON su.kullanici_id = yck.kullanici_id
  WHERE yck.created_at >= p_baslangic AND yck.created_at <= p_bitis
  GROUP BY yck.kullanici_id
),
oneri_kaybi AS (
  SELECT okk.kullanici_id, SUM(okk.kaybedilen_puan)::int AS puan
  FROM oneri_kayip_kayitlari okk
  JOIN scope_users su ON su.kullanici_id = okk.kullanici_id
  WHERE okk.created_at >= p_baslangic AND okk.created_at <= p_bitis
  GROUP BY okk.kullanici_id
)
SELECT
  su.kullanici_id,
  su.ad,
  su.soyad,
  su.bolge_id,
  su.bolge_adi,
  COALESCE(i.tamamlanan, 0),
  COALESCE(i.benzersiz, 0),
  COALESCE(k.izleme, 0),
  COALESCE(k.cevaplama, 0),
  COALESCE(k.oneri, 0),
  COALESCE(k.extra, 0),
  COALESCE(isk.puan, 0),
  COALESCE(yc.puan, 0),
  COALESCE(ok.puan, 0),
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0))::int,
  (COALESCE(isk.puan, 0) + COALESCE(yc.puan, 0) + COALESCE(ok.puan, 0))::int,
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0)
    - COALESCE(isk.puan, 0) - COALESCE(yc.puan, 0) - COALESCE(ok.puan, 0))::int
FROM scope_users su
LEFT JOIN izleme i ON i.kullanici_id = su.kullanici_id
LEFT JOIN kazanim k ON k.kullanici_id = su.kullanici_id
LEFT JOIN ileri_sarma isk ON isk.kullanici_id = su.kullanici_id
LEFT JOIN yanlis_cevap yc ON yc.kullanici_id = su.kullanici_id
LEFT JOIN oneri_kaybi ok ON ok.kullanici_id = su.kullanici_id
ORDER BY 17 DESC, 2, 3;
$function$;

CREATE OR REPLACE FUNCTION public.get_tm_etkilesim_v2(
  p_tm_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  yayin_id uuid,
  icerik_adi text,
  teknik_adi text,
  begeni_sayisi integer,
  favori_sayisi integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
tm_scope AS (
  SELECT k.firma_id, k.takim_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_tm_id
    AND k.rol = 'tm'
    AND k.aktif_mi = true
),
scope_users AS (
  SELECT k.kullanici_id
  FROM kullanicilar k
  JOIN tm_scope ts
    ON ts.firma_id = k.firma_id
   AND ts.takim_id = k.takim_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt', 'kd_utt')
),
scope_yayinlari AS (
  SELECT DISTINCT
    ky.yayin_id,
    COALESCE(
      u.urun_adi,
      CASE ky.icerik_turu
        WHEN 'satis_teknikleri' THEN 'Satış Teknikleri'
        WHEN 'medikal_egitim' THEN 'Medikal Eğitim'
        WHEN 'urun_medikal_egitim' THEN 'Ürün Medikal Eğitimi'
        WHEN 'ik_egitimi' THEN 'İK Eğitimi'
        ELSE 'Ürün Dışı Eğitim'
      END
    )::text AS icerik_adi,
    COALESCE(t.teknik_adi, '—')::text AS teknik_adi
  FROM v_yayin_kunye ky
  JOIN tm_scope ts ON ts.firma_id = ky.firma_id
  JOIN yayin_yonetimi ym ON ym.yayin_id = ky.yayin_id
  LEFT JOIN urunler u ON u.urun_id = ky.urun_id
  LEFT JOIN teknikler t ON t.teknik_id = ky.teknik_id
  WHERE COALESCE(ym.hedef_roller, ARRAY['utt']::text[])
    && ARRAY['utt', 'kd_utt']::text[]
),
begeni AS (
  SELECT vb.yayin_id, COUNT(*)::int AS adet
  FROM video_begeniler vb
  JOIN scope_users su ON su.kullanici_id = vb.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = vb.yayin_id
  WHERE vb.created_at >= p_baslangic AND vb.created_at <= p_bitis
  GROUP BY vb.yayin_id
),
favori AS (
  SELECT vf.yayin_id, COUNT(*)::int AS adet
  FROM video_favoriler vf
  JOIN scope_users su ON su.kullanici_id = vf.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = vf.yayin_id
  WHERE vf.created_at >= p_baslangic AND vf.created_at <= p_bitis
  GROUP BY vf.yayin_id
),
etkilesimli AS (
  SELECT yayin_id FROM begeni
  UNION
  SELECT yayin_id FROM favori
)
SELECT
  sy.yayin_id,
  sy.icerik_adi,
  sy.teknik_adi,
  COALESCE(b.adet, 0),
  COALESCE(f.adet, 0)
FROM etkilesimli e
JOIN scope_yayinlari sy ON sy.yayin_id = e.yayin_id
LEFT JOIN begeni b ON b.yayin_id = e.yayin_id
LEFT JOIN favori f ON f.yayin_id = e.yayin_id
ORDER BY (COALESCE(b.adet, 0) + COALESCE(f.adet, 0)) DESC, sy.icerik_adi;
$function$;

GRANT EXECUTE ON FUNCTION public.get_tm_rapor_ana_ozet_v2(uuid,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tm_bolge_performans_v2(uuid,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tm_utt_performans_v2(uuid,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tm_etkilesim_v2(uuid,timestamptz,timestamptz) TO service_role;

COMMIT;
