-- Analiz Karar ve Gelişim Merkezi — hiyerarşik puan dağılımı.
--
-- Güvenlik:
--   * Firma/takım/bölge kapsamı bu fonksiyona yalnız sunucu API'sinden gelir.
--   * authenticated doğrudan çağıramaz; yalnız service_role EXECUTE sahibidir.
--
-- Mutabakat:
--   * kazanilan_toplam = izleme + cevaplama + oneri + extra
--   * kaybedilen_toplam = ileri_sarma + yanlis_cevap + oneri_kaybi + challenge
--   * kalan izleme fırsatları bu fonksiyona ve kayıp toplamına dahil değildir.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_analiz_puan_dagilimi_kanonik(
  p_firma_id uuid,
  p_seviye text,
  p_scope_takim_id uuid DEFAULT NULL,
  p_scope_bolge_id uuid DEFAULT NULL,
  p_baslangic timestamptz DEFAULT NULL,
  p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL,
  p_egitim_turu text DEFAULT NULL,
  p_takim_id uuid DEFAULT NULL,
  p_bolge_id uuid DEFAULT NULL,
  p_utt_id uuid DEFAULT NULL
)
RETURNS TABLE(
  birim_id uuid,
  birim_adi text,
  seviye text,
  takim_id uuid,
  takim_adi text,
  bolge_id uuid,
  bolge_adi text,
  toplam_utt bigint,
  aktif_utt bigint,
  izleme_puani bigint,
  cevaplama_puani bigint,
  oneri_puani bigint,
  extra_puani bigint,
  ileri_sarma_kaybi bigint,
  yanlis_cevap_kaybi bigint,
  oneri_kaybi bigint,
  challenge_kaybi bigint,
  kazanilan_toplam bigint,
  kaybedilen_toplam bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
WITH scope_users AS (
  SELECT
    k.kullanici_id,
    concat_ws(' ', k.ad, k.soyad)::text AS kullanici_adi,
    k.takim_id,
    t.takim_adi::text,
    k.bolge_id,
    b.bolge_adi::text
  FROM public.kullanicilar k
  LEFT JOIN public.takimlar t ON t.takim_id = k.takim_id
  LEFT JOIN public.bolgeler b ON b.bolge_id = k.bolge_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt', 'kd_utt')
    AND k.firma_id = p_firma_id
    AND (p_scope_takim_id IS NULL OR k.takim_id = p_scope_takim_id)
    AND (p_scope_bolge_id IS NULL OR k.bolge_id = p_scope_bolge_id)
    AND (p_takim_id IS NULL OR k.takim_id = p_takim_id)
    AND (p_bolge_id IS NULL OR k.bolge_id = p_bolge_id)
    AND (p_utt_id IS NULL OR k.kullanici_id = p_utt_id)
),
puan_hareketleri AS (
  SELECT
    kp.kullanici_id,
    CASE WHEN kp.puan_turu = 'izleme' THEN kp.puan ELSE 0 END::bigint AS izleme,
    CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END::bigint AS cevaplama,
    CASE WHEN kp.puan_turu = 'oneri' THEN kp.puan ELSE 0 END::bigint AS oneri,
    CASE WHEN kp.puan_turu = 'extra' THEN kp.puan ELSE 0 END::bigint AS extra,
    0::bigint AS ileri_sarma,
    0::bigint AS yanlis_cevap,
    0::bigint AS oneri_kaybi,
    0::bigint AS challenge
  FROM public.kazanilan_puanlar kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  JOIN public.v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR kp.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR kp.created_at <= p_bitis)

  UNION ALL

  SELECT i.kullanici_id, 0, 0, 0, 0, i.kaybedilen_puan::bigint, 0, 0, 0
  FROM public.ileri_sarma_kayitlari i
  JOIN scope_users su ON su.kullanici_id = i.kullanici_id
  JOIN public.v_yayin_kunye ky ON ky.yayin_id = i.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR i.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR i.created_at <= p_bitis)

  UNION ALL

  SELECT y.kullanici_id, 0, 0, 0, 0, 0, y.kaybedilen_puan::bigint, 0, 0
  FROM public.yanlis_cevap_kayitlari y
  JOIN scope_users su ON su.kullanici_id = y.kullanici_id
  JOIN public.v_yayin_kunye ky ON ky.yayin_id = y.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR y.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR y.created_at <= p_bitis)

  UNION ALL

  SELECT o.kullanici_id, 0, 0, 0, 0, 0, 0, o.kaybedilen_puan::bigint, 0
  FROM public.oneri_kayip_kayitlari o
  JOIN scope_users su ON su.kullanici_id = o.kullanici_id
  JOIN public.v_yayin_kunye ky ON ky.yayin_id = o.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR o.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR o.created_at <= p_bitis)

  UNION ALL

  SELECT c.kullanici_id, 0, 0, 0, 0, 0, 0, 0, c.kaybedilen_puan::bigint
  FROM public.challenge_kayip_kayitlari c
  JOIN scope_users su ON su.kullanici_id = c.kullanici_id
  JOIN public.v_yayin_kunye ky ON ky.yayin_id = c.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR c.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR c.created_at <= p_bitis)
),
kullanici_toplamlari AS (
  SELECT
    su.kullanici_id,
    su.kullanici_adi,
    su.takim_id,
    su.takim_adi,
    su.bolge_id,
    su.bolge_adi,
    COALESCE(SUM(ph.izleme), 0)::bigint AS izleme,
    COALESCE(SUM(ph.cevaplama), 0)::bigint AS cevaplama,
    COALESCE(SUM(ph.oneri), 0)::bigint AS oneri,
    COALESCE(SUM(ph.extra), 0)::bigint AS extra,
    COALESCE(SUM(ph.ileri_sarma), 0)::bigint AS ileri_sarma,
    COALESCE(SUM(ph.yanlis_cevap), 0)::bigint AS yanlis_cevap,
    COALESCE(SUM(ph.oneri_kaybi), 0)::bigint AS oneri_kaybi,
    COALESCE(SUM(ph.challenge), 0)::bigint AS challenge
  FROM scope_users su
  LEFT JOIN puan_hareketleri ph ON ph.kullanici_id = su.kullanici_id
  GROUP BY su.kullanici_id, su.kullanici_adi, su.takim_id, su.takim_adi, su.bolge_id, su.bolge_adi
),
gruplar AS (
  SELECT
    CASE p_seviye
      WHEN 'takim' THEN kt.takim_id
      WHEN 'bolge' THEN kt.bolge_id
      WHEN 'utt' THEN kt.kullanici_id
    END AS birim_id,
    CASE p_seviye
      WHEN 'takim' THEN COALESCE(kt.takim_adi, 'Atanmamış Takım')
      WHEN 'bolge' THEN COALESCE(kt.bolge_adi, 'Atanmamış Bölge')
      WHEN 'utt' THEN kt.kullanici_adi
    END::text AS birim_adi,
    p_seviye::text AS seviye,
    CASE WHEN p_seviye IN ('bolge', 'utt') THEN kt.takim_id END AS takim_id,
    CASE WHEN p_seviye IN ('bolge', 'utt') THEN kt.takim_adi END::text AS takim_adi,
    CASE WHEN p_seviye = 'utt' THEN kt.bolge_id END AS bolge_id,
    CASE WHEN p_seviye = 'utt' THEN kt.bolge_adi END::text AS bolge_adi,
    COUNT(*)::bigint AS toplam_utt,
    COUNT(*) FILTER (WHERE
      kt.izleme + kt.cevaplama + kt.oneri + kt.extra
      + kt.ileri_sarma + kt.yanlis_cevap + kt.oneri_kaybi + kt.challenge > 0
    )::bigint AS aktif_utt,
    SUM(kt.izleme)::bigint AS izleme_puani,
    SUM(kt.cevaplama)::bigint AS cevaplama_puani,
    SUM(kt.oneri)::bigint AS oneri_puani,
    SUM(kt.extra)::bigint AS extra_puani,
    SUM(kt.ileri_sarma)::bigint AS ileri_sarma_kaybi,
    SUM(kt.yanlis_cevap)::bigint AS yanlis_cevap_kaybi,
    SUM(kt.oneri_kaybi)::bigint AS oneri_kaybi,
    SUM(kt.challenge)::bigint AS challenge_kaybi
  FROM kullanici_toplamlari kt
  WHERE p_seviye IN ('takim', 'bolge', 'utt')
  GROUP BY 1, 2, 3, 4, 5, 6, 7
)
SELECT
  g.birim_id,
  g.birim_adi,
  g.seviye,
  g.takim_id,
  g.takim_adi,
  g.bolge_id,
  g.bolge_adi,
  g.toplam_utt,
  g.aktif_utt,
  g.izleme_puani,
  g.cevaplama_puani,
  g.oneri_puani,
  g.extra_puani,
  g.ileri_sarma_kaybi,
  g.yanlis_cevap_kaybi,
  g.oneri_kaybi,
  g.challenge_kaybi,
  (g.izleme_puani + g.cevaplama_puani + g.oneri_puani + g.extra_puani)::bigint AS kazanilan_toplam,
  (g.ileri_sarma_kaybi + g.yanlis_cevap_kaybi + g.oneri_kaybi + g.challenge_kaybi)::bigint AS kaybedilen_toplam
FROM gruplar g
ORDER BY
  (g.izleme_puani + g.cevaplama_puani + g.oneri_puani + g.extra_puani
   + g.ileri_sarma_kaybi + g.yanlis_cevap_kaybi + g.oneri_kaybi + g.challenge_kaybi) DESC,
  g.birim_adi;
$function$;

COMMENT ON FUNCTION public.get_analiz_puan_dagilimi_kanonik IS
  'Analiz kazanım/kayıp bileşenlerini takım, bölge veya UTT seviyesinde kanonik olarak dağıtır; kalan fırsatlar dahil değildir.';

REVOKE ALL ON FUNCTION public.get_analiz_puan_dagilimi_kanonik(
  uuid, text, uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, uuid, uuid
) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.get_analiz_puan_dagilimi_kanonik(
  uuid, text, uuid, uuid, timestamptz, timestamptz, uuid, text, uuid, uuid, uuid
) TO service_role;

COMMIT;
