-- scripts/sql/get_kullanici_urun_dagilimi.sql
--
-- Kullanıcı × ürün dağılımı — ürün bazlı raporun çekirdeği.
-- get_urun_bazli_grup ve get_urun_bazli_bolge_grup bunun üzerine kuruludur.
--
-- GÜNCELLEME (05.08.2026 — künye geçişi):
--   1. Ürün kimliği artık puan defterindeki kopyadan (`kp.urun_id`) değil,
--      yayın künyesinden (`v_yayin_kunye`) okunuyor. Dört defterin dördü de
--      künyeye bağlandı. Kopya kolon yerinde duruyor; bu adımda yalnız okuma
--      kaynağı tekleşti (kolon düşürme en sona bırakıldı — tek yönlü kapı).
--   2. Teknik dağılımı zinciri düzeltildi. Eski hâli yayından talebe SENARYO
--      üzerinden gidiyordu; hazır video kolunda senaryo hiç yazılmadığı için
--      o içeriğin tekniği raporda hiç görünmüyordu (Arıza 1'in ikinci yeri).
--      Artık künyeden okunuyor.
--
-- DAVRANIŞ NOTU: Son SELECT'teki `JOIN urunler` bilinçli olarak INNER'dır —
-- ürünsüz içerik (medikal, İK) ürün raporuna girmez. O içeriğin kırılımı
-- içerik türü ekseninde ayrıca ele alınacaktır.
--
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE FUNCTION public.get_kullanici_urun_dagilimi(
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone,
  p_kullanici_id uuid DEFAULT NULL::uuid,
  p_bolge_id uuid DEFAULT NULL::uuid,
  p_takim_id uuid DEFAULT NULL::uuid,
  p_firma_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  kullanici_id uuid, ad text, soyad text, urun_id uuid, urun_adi text,
  izlenme_sayisi integer, video_puani integer, soru_puani integer,
  oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_net_puan integer,
  teknik_dagilimi jsonb
)
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
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan,
      COUNT(*) FILTER (WHERE kp.puan_turu = 'izleme')::int AS izlenme_sayisi
    FROM kazanilan_puanlar kp
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
      + COALESCE(k.oneri_puani, 0) + COALESCE(k.extra_puan, 0)
      - COALESCE(isk.toplam_kayip, 0) - COALESCE(yc.toplam_kayip, 0)
      - COALESCE(ok.toplam_kayip, 0))::int,
    COALESCE(td.dagilim, '[]'::jsonb)
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
