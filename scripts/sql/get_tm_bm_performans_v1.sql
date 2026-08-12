-- TM raporu: bağlı BM'lerin bölge toplamlarını döndürür.
-- Her satır bir aktif BM'dir; puanlar BM'nin aktif UTT'lerinin toplamıdır.
-- Kapsam yalnız p_tm_id üzerinden firma ve takım ile belirlenir.
--
-- Geri dönüş:
--   DROP FUNCTION public.get_tm_bm_performans_v1(uuid,timestamptz,timestamptz);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_tm_bm_performans_v1(
  p_tm_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  bm_id uuid,
  bm_adi text,
  bolge_id uuid,
  bolge_adi text,
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
  COALESCE(SUM(up.net_puan), 0)::int AS net_puan
FROM scope_bm sb
LEFT JOIN LATERAL public.get_bm_utt_performans_v2(
  sb.bm_id,
  p_baslangic,
  p_bitis
) up ON true
GROUP BY sb.bm_id, sb.bm_adi, sb.bolge_id, sb.bolge_adi
ORDER BY 18 DESC, 2, 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_tm_bm_performans_v1(
  uuid,
  timestamptz,
  timestamptz
) TO service_role;

COMMIT;

-- Kurulum sonrası doğrulama: tüm aktif TM'lerin BM satırlarını gösterir.
WITH parametre AS (
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
    CONCAT(k.ad, ' ', k.soyad)::text AS tm_adi
  FROM public.kullanicilar k
  WHERE k.rol = 'tm'
    AND k.aktif_mi = true
)
SELECT
  tm.tm_id,
  tm.tm_adi,
  p.baslangic,
  p.bitis,
  bp.*
FROM aktif_tm tm
CROSS JOIN parametre p
CROSS JOIN LATERAL public.get_tm_bm_performans_v1(
  tm.tm_id,
  p.baslangic,
  p.bitis
) bp
ORDER BY tm.tm_adi, bp.net_puan DESC, bp.bm_adi;
