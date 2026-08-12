-- TM raporu — bağlı aktif BM'lerin seçilen periyottaki öneri durumu.
--
-- Kapsam:
--   - p_tm_id aktif bir TM olmalıdır.
--   - Yalnız aynı firma + takımdaki aktif BM'lerin önerileri alınır.
--   - Her BM için yalnız kendi bölgesindeki aktif utt/kd_utt kayıtları alınır.
--   - TM'nin geçmişte doğrudan gönderdiği öneriler kapsama girmez.
--
-- Geri dönüş:
--   DROP FUNCTION public.get_tm_oneri_durumu_v1(uuid,timestamptz,timestamptz);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_tm_oneri_durumu_v1(
  p_tm_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  bm_id uuid,
  bm_adi text,
  bolge_id uuid,
  bolge_adi text,
  oneri_id uuid,
  kullanici_id uuid,
  utt_ad text,
  utt_soyad text,
  yayin_id uuid,
  urun_adi text,
  teknik_adi text,
  oneri_baslangic timestamptz,
  oneri_bitis timestamptz,
  created_at timestamptz,
  izleme_tarihi timestamptz,
  durum text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
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
  od.oneri_id,
  od.kullanici_id,
  od.utt_ad,
  od.utt_soyad,
  od.yayin_id,
  od.urun_adi,
  od.teknik_adi,
  od.oneri_baslangic,
  od.oneri_bitis,
  od.created_at,
  oi.izleme_tarihi,
  od.durum
FROM scope_bm sb
CROSS JOIN LATERAL public.get_bm_oneri_durumu_v1(
  sb.bm_id,
  p_baslangic,
  p_bitis
) od
LEFT JOIN LATERAL (
  SELECT ik.izleme_bitis AS izleme_tarihi
  FROM public.izleme_kayitlari ik
  WHERE ik.oneri_id = od.oneri_id
    AND ik.izleme_turu = 'oneri'
    AND ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND ik.izleme_bitis IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.ileri_sarma_kayitlari isk
      WHERE isk.izleme_id = ik.izleme_id
    )
  ORDER BY ik.izleme_bitis
  LIMIT 1
) oi ON true
ORDER BY od.created_at DESC, sb.bm_adi, od.utt_ad, od.utt_soyad, od.oneri_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_tm_oneri_durumu_v1(
  uuid,
  timestamptz,
  timestamptz
) TO service_role;

COMMIT;

-- Kurulum sonrası doğrulama — içinde bulunulan ay, tüm aktif TM'ler.
-- Sonuç TEMİZ, toplam eşitlikleri true ve kapsam sayıları sıfır olmalıdır.
WITH
parametre AS (
  SELECT
    (
      date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')
      AT TIME ZONE 'Europe/Istanbul'
    )::timestamptz AS baslangic,
    CURRENT_TIMESTAMP::timestamptz AS bitis
),
aktif_tm AS (
  SELECT
    k.kullanici_id AS tm_id,
    CONCAT(k.ad, ' ', k.soyad)::text AS tm_adi,
    k.firma_id,
    k.takim_id
  FROM public.kullanicilar k
  WHERE k.rol = 'tm'
    AND k.aktif_mi = true
),
aktif_bm AS (
  SELECT
    tm.tm_id,
    bm.kullanici_id AS bm_id,
    bm.firma_id,
    bm.takim_id,
    bm.bolge_id
  FROM aktif_tm tm
  JOIN public.kullanicilar bm
    ON bm.firma_id = tm.firma_id
   AND bm.takim_id = tm.takim_id
   AND bm.rol = 'bm'
   AND bm.aktif_mi = true
),
beklenen AS (
  SELECT
    tm.tm_id,
    COUNT(ok.oneri_id)::int AS toplam
  FROM aktif_tm tm
  CROSS JOIN parametre p
  LEFT JOIN aktif_bm bm ON bm.tm_id = tm.tm_id
  LEFT JOIN public.oneri_kayitlari ok
    ON ok.oneren_id = bm.bm_id
   AND ok.created_at >= p.baslangic
   AND ok.created_at <= p.bitis
  LEFT JOIN public.kullanicilar u
    ON u.kullanici_id = ok.kullanici_id
   AND u.firma_id = bm.firma_id
   AND u.takim_id = bm.takim_id
   AND u.bolge_id = bm.bolge_id
   AND u.rol IN ('utt', 'kd_utt')
   AND u.aktif_mi = true
  WHERE ok.oneri_id IS NULL OR u.kullanici_id IS NOT NULL
  GROUP BY tm.tm_id
),
detay AS (
  SELECT tm.tm_id, d.*
  FROM aktif_tm tm
  CROSS JOIN parametre p
  CROSS JOIN LATERAL public.get_tm_oneri_durumu_v1(
    tm.tm_id,
    p.baslangic,
    p.bitis
  ) d
),
gelen AS (
  SELECT
    tm.tm_id,
    COUNT(d.oneri_id)::int AS toplam,
    COUNT(d.oneri_id) FILTER (WHERE d.durum = 'tamamlanan')::int AS tamamlanan,
    COUNT(d.oneri_id) FILTER (WHERE d.durum = 'bekleyen')::int AS bekleyen,
    COUNT(d.oneri_id) FILTER (WHERE d.durum = 'suresi_gecmis')::int AS suresi_gecmis,
    COUNT(d.oneri_id) FILTER (
      WHERE d.oneri_id IS NOT NULL
        AND (
          bm.kullanici_id IS NULL
          OR bm.rol IS DISTINCT FROM 'bm'
          OR bm.aktif_mi IS DISTINCT FROM true
          OR bm.firma_id IS DISTINCT FROM tm.firma_id
          OR bm.takim_id IS DISTINCT FROM tm.takim_id
        )
    )::int AS kapsam_disi_bm,
    COUNT(d.oneri_id) FILTER (
      WHERE d.oneri_id IS NOT NULL
        AND (
          u.kullanici_id IS NULL
          OR u.rol NOT IN ('utt', 'kd_utt')
          OR u.aktif_mi IS DISTINCT FROM true
          OR u.firma_id IS DISTINCT FROM bm.firma_id
          OR u.takim_id IS DISTINCT FROM bm.takim_id
          OR u.bolge_id IS DISTINCT FROM bm.bolge_id
        )
    )::int AS kapsam_disi_utt,
    COUNT(d.oneri_id) FILTER (
      WHERE d.oneri_id IS NOT NULL
        AND ok.oneren_id = tm.tm_id
    )::int AS tm_onerisi_kapsama_alindi
  FROM aktif_tm tm
  LEFT JOIN detay d ON d.tm_id = tm.tm_id
  LEFT JOIN public.kullanicilar bm ON bm.kullanici_id = d.bm_id
  LEFT JOIN public.kullanicilar u ON u.kullanici_id = d.kullanici_id
  LEFT JOIN public.oneri_kayitlari ok ON ok.oneri_id = d.oneri_id
  GROUP BY tm.tm_id
)
SELECT
  tm.tm_id,
  tm.tm_adi,
  COALESCE(g.toplam, 0) AS toplam,
  COALESCE(g.tamamlanan, 0) AS tamamlanan,
  COALESCE(g.bekleyen, 0) AS bekleyen,
  COALESCE(g.suresi_gecmis, 0) AS suresi_gecmis,
  COALESCE(g.toplam, 0) =
    COALESCE(g.tamamlanan, 0)
    + COALESCE(g.bekleyen, 0)
    + COALESCE(g.suresi_gecmis, 0) AS durum_toplami_esit,
  COALESCE(b.toplam, 0) AS beklenen_bm_onerisi,
  COALESCE(g.toplam, 0) = COALESCE(b.toplam, 0) AS bm_kapsami_esit,
  COALESCE(g.kapsam_disi_bm, 0) AS kapsam_disi_bm,
  COALESCE(g.kapsam_disi_utt, 0) AS kapsam_disi_utt,
  COALESCE(g.tm_onerisi_kapsama_alindi, 0) AS tm_onerisi_kapsama_alindi,
  CASE
    WHEN COALESCE(g.toplam, 0) =
      COALESCE(g.tamamlanan, 0)
      + COALESCE(g.bekleyen, 0)
      + COALESCE(g.suresi_gecmis, 0)
     AND COALESCE(g.toplam, 0) = COALESCE(b.toplam, 0)
     AND COALESCE(g.kapsam_disi_bm, 0) = 0
     AND COALESCE(g.kapsam_disi_utt, 0) = 0
     AND COALESCE(g.tm_onerisi_kapsama_alindi, 0) = 0
    THEN 'TEMİZ'
    ELSE 'FARK VAR'
  END AS sonuc
FROM aktif_tm tm
LEFT JOIN beklenen b ON b.tm_id = tm.tm_id
LEFT JOIN gelen g ON g.tm_id = tm.tm_id
ORDER BY tm.tm_adi, tm.tm_id;
