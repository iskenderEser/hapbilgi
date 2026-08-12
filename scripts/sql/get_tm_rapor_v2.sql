-- TM raporu — takım kapsamındaki UTT etkileşimleri.
--
-- Eski ana özet, bölge performansı ve UTT performansı RPC'leri kaldırılmıştır.
-- Bu dosya yalnız uygulamanın kullanmaya devam ettiği etkileşim RPC'sini kurar.
--
-- Geri dönüş:
--   DROP FUNCTION public.get_tm_etkilesim_v2(uuid,timestamptz,timestamptz);

BEGIN;

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

GRANT EXECUTE ON FUNCTION public.get_tm_etkilesim_v2(
  uuid,
  timestamptz,
  timestamptz
) TO service_role;

COMMIT;
