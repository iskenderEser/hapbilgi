-- Yönetici raporu eğitim türü etkisi v3.
--
-- Beş kanonik eğitim türünü ana eksen, ürünü alt eksen olarak döndürür.
-- Mevcut v2 fonksiyonlarına dokunmaz; uygulama bağlanana kadar davranış değişmez.
-- Exit: DROP FUNCTION public.get_yonetici_egitim_turu_etkisi_v3(uuid,timestamptz,timestamptz);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_yonetici_egitim_turu_etkisi_v3(
  p_yonetici_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  egitim_turu text,
  donemde_yayina_alinan integer,
  tamamlanan_izleme integer,
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
  begeni_sayisi integer,
  favori_sayisi integer,
  extra_izleme_sayisi integer,
  urun_dagilimi jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
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
    (COALESCE(p.izleme, 0) + COALESCE(p.cevaplama, 0) + COALESCE(p.oneri, 0) + COALESCE(p.extra, 0))::int AS kazanilan,
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
  (COALESCE(tp.izleme, 0) + COALESCE(tp.cevaplama, 0) + COALESCE(tp.oneri, 0) + COALESCE(tp.extra, 0))::int,
  (COALESCE(tp.ileri, 0) + COALESCE(tp.yanlis, 0) + COALESCE(tp.oneri_kaybi, 0) + COALESCE(tp.challenge, 0))::int,
  (COALESCE(tp.izleme, 0) + COALESCE(tp.cevaplama, 0) + COALESCE(tp.oneri, 0) + COALESCE(tp.extra, 0)
   - COALESCE(tp.ileri, 0) - COALESCE(tp.yanlis, 0) - COALESCE(tp.oneri_kaybi, 0) - COALESCE(tp.challenge, 0))::int,
  COALESCE(e.begeni, 0)::int,
  COALESCE(e.favori, 0)::int,
  COALESCE(i.extra, 0)::int,
  COALESCE(uj.dagilim, '[]'::jsonb)
FROM turler t
LEFT JOIN tur_uretim tu ON tu.egitim_turu = t.egitim_turu
LEFT JOIN izleme i ON i.egitim_turu = t.egitim_turu
LEFT JOIN tur_puan tp ON tp.egitim_turu = t.egitim_turu
LEFT JOIN etkilesim e ON e.egitim_turu = t.egitim_turu
LEFT JOIN urun_json uj ON uj.egitim_turu = t.egitim_turu
ORDER BY t.sira;
$function$;

GRANT EXECUTE ON FUNCTION public.get_yonetici_egitim_turu_etkisi_v3(uuid,timestamptz,timestamptz) TO service_role;

COMMIT;
