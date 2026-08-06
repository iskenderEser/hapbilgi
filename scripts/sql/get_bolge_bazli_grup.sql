-- scripts/sql/get_bolge_bazli_grup.sql
--
-- Bölge bazlı rapor grubu — bölge toplamları + bölge içi ürün dağılımı.
-- get_urun_bazli_bolge_grup bunun üzerine kuruludur.
--
-- GÜNCELLEME (05.08.2026 — künye geçişi): Ürün kırılımını üreten dört CTE
-- (urun_kazanim / urun_ileri_sarma / urun_yanlis_cevap / urun_oneri_kayip)
-- ürün kimliğini puan defterindeki kopyadan okuyordu. Artık yayın künyesinden
-- (`v_yayin_kunye`) okunuyor — tek kaynak.
--
-- Bölge TOPLAMLARINI üreten CTE'ler (kazanim / ileri_sarma / yanlis_cevap /
-- oneri_kayip) ürüne hiç bakmıyor; onlara dokunulmadı. Bu bilinçli: toplam,
-- ürünsüz içeriğin (medikal, İK) puanını da kapsar. Ürün dağılımı ise
-- `JOIN urunler` INNER olduğu için yalnız ürünlü içeriği gösterir.
-- Dolayısıyla bölge toplamı ile ürün dağılımı toplamı eşit olmayabilir —
-- aradaki fark ürünsüz eğitimlerin payıdır.
--
-- Dönüş sözleşmesi, parametreler ve hesap mantığı AYNEN korunmuştur.
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE FUNCTION public.get_bolge_bazli_grup(
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone,
  p_takim_id uuid DEFAULT NULL::uuid,
  p_firma_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  bolge_id uuid, bolge_adi text, takim_id uuid, takim_adi text, bm_adi text,
  toplam_utt integer, aktif_utt integer, hic_izlemeyen_utt integer,
  video_puani integer, soru_puani integer, oneri_puani integer, extra_puan integer,
  ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer,
  toplam_net_puan integer, urun_dagilimi jsonb
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
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan,
      COUNT(DISTINCT kp.kullanici_id) FILTER (WHERE kp.puan_turu = 'izleme')::int AS aktif_utt
    FROM kazanilan_puanlar kp
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
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan
    FROM kazanilan_puanlar kp
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
          'ileri_sarma_kaybi', COALESCE(uis.toplam_kayip, 0),
          'yanlis_cevap_kaybi', COALESCE(uyc.toplam_kayip, 0),
          'oneri_kaybi', COALESCE(uok.toplam_kayip, 0),
          'toplam_net_puan',
            COALESCE(uk.video_puani, 0) + COALESCE(uk.soru_puani, 0)
            + COALESCE(uk.oneri_puani, 0) + COALESCE(uk.extra_puan, 0)
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
      + COALESCE(k.oneri_puani, 0) + COALESCE(k.extra_puan, 0)
      - COALESCE(isk.toplam_kayip, 0) - COALESCE(yc.toplam_kayip, 0)
      - COALESCE(ok.toplam_kayip, 0))::int,
    COALESCE(ud.urun_dagilimi, '[]'::jsonb)
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
