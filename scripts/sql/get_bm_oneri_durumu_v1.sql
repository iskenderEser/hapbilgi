-- BM raporu — seçilen periyotta gönderilen önerilerin durum ve UTT ayrıntısı.
--
-- Kapsam:
--   - p_bm_id aktif bir BM olmalıdır.
--   - Yalnız BM ile aynı firma + takım + bölgedeki aktif utt/kd_utt kayıtları.
--   - Yalnız bu BM'nin gönderdiği ve created_at değeri verilen periyoda düşen öneriler.
--
-- Durum:
--   tamamlanan   = izlendi_mi true
--   suresi_gecmis = izlendi_mi false ve oneri_bitis geçmiş
--   bekleyen      = diğer izlenmemiş öneriler
--
-- Geri dönüş:
--   DROP FUNCTION public.get_bm_oneri_durumu_v1(uuid,timestamptz,timestamptz);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_bm_oneri_durumu_v1(
  p_bm_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
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
  durum text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
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
)
SELECT
  ok.oneri_id,
  su.kullanici_id,
  su.ad,
  su.soyad,
  ok.yayin_id,
  yd.urun_adi,
  yd.teknik_adi,
  ok.oneri_baslangic,
  ok.oneri_bitis,
  ok.created_at,
  CASE
    WHEN COALESCE(ok.izlendi_mi, false) THEN 'tamamlanan'
    WHEN ok.oneri_bitis < CURRENT_TIMESTAMP THEN 'suresi_gecmis'
    ELSE 'bekleyen'
  END::text AS durum
FROM oneri_kayitlari ok
JOIN scope_users su ON su.kullanici_id = ok.kullanici_id
LEFT JOIN v_yayin_detay yd ON yd.yayin_id = ok.yayin_id
WHERE ok.oneren_id = p_bm_id
  AND ok.created_at >= p_baslangic
  AND ok.created_at <= p_bitis
ORDER BY ok.created_at DESC, su.ad, su.soyad, ok.oneri_id;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bm_oneri_durumu_v1(uuid,timestamptz,timestamptz) TO service_role;

COMMIT;

-- Kurulum sonrası doğrulama — içinde bulunulan ay, tüm aktif BM'ler.
-- Her satırda toplam eşitliği true ve kapsam_disi_utt sıfır olmalıdır.
WITH
aralik AS (
  SELECT
    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')
      AT TIME ZONE 'Europe/Istanbul' AS baslangic,
    CURRENT_TIMESTAMP AS bitis
),
bmler AS (
  SELECT kullanici_id, ad, soyad, firma_id, takim_id, bolge_id
  FROM kullanicilar
  WHERE rol = 'bm'
    AND aktif_mi = true
),
detay AS (
  SELECT b.kullanici_id AS bm_id, d.*
  FROM bmler b
  CROSS JOIN aralik a
  CROSS JOIN LATERAL get_bm_oneri_durumu_v1(b.kullanici_id, a.baslangic, a.bitis) d
),
kapsam AS (
  SELECT
    d.bm_id,
    COUNT(*) FILTER (
      WHERE b.firma_id IS DISTINCT FROM u.firma_id
         OR b.takim_id IS DISTINCT FROM u.takim_id
         OR b.bolge_id IS DISTINCT FROM u.bolge_id
         OR u.aktif_mi IS DISTINCT FROM true
         OR u.rol NOT IN ('utt', 'kd_utt')
    )::int AS kapsam_disi_utt
  FROM detay d
  JOIN bmler b ON b.kullanici_id = d.bm_id
  JOIN kullanicilar u ON u.kullanici_id = d.kullanici_id
  GROUP BY d.bm_id
)
SELECT
  b.kullanici_id AS bm_id,
  concat_ws(' ', b.ad, b.soyad) AS bm_adi,
  COUNT(d.oneri_id)::int AS toplam,
  COUNT(d.oneri_id) FILTER (WHERE d.durum = 'tamamlanan')::int AS tamamlanan,
  COUNT(d.oneri_id) FILTER (WHERE d.durum = 'bekleyen')::int AS bekleyen,
  COUNT(d.oneri_id) FILTER (WHERE d.durum = 'suresi_gecmis')::int AS suresi_gecmis,
  COUNT(d.oneri_id) =
    COUNT(d.oneri_id) FILTER (WHERE d.durum = 'tamamlanan')
    + COUNT(d.oneri_id) FILTER (WHERE d.durum = 'bekleyen')
    + COUNT(d.oneri_id) FILTER (WHERE d.durum = 'suresi_gecmis') AS toplam_esit,
  COALESCE(k.kapsam_disi_utt, 0) AS kapsam_disi_utt
FROM bmler b
LEFT JOIN detay d ON d.bm_id = b.kullanici_id
LEFT JOIN kapsam k ON k.bm_id = b.kullanici_id
GROUP BY b.kullanici_id, b.ad, b.soyad, k.kapsam_disi_utt
ORDER BY b.ad, b.soyad;
