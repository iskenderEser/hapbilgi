-- Üretici raporu ana metrikleri — V1/V2/V3/V4 uyumlu v2 sözleşmesi.
--
-- Neden yeni fonksiyon:
-- - Eski get_pm_uretim_ozet yalnız tam senaryo zincirini izlediği için hazır
--   üretim kollarını dışarıda bırakıyordu.
-- - Durum değerlerini yanlış büyük/küçük harfle karşılaştırıyordu.
-- - Dönem içi hareketlerle anlık stokları aynı ad altında topluyordu.
-- - İzlenme oranının payı ve paydası farklı kapsam/zaman kümelerindendi.
--
-- Exit: Uygulama bu RPC'ye geçirilmeden mevcut davranış değişmez. Geri alım için
-- yalnız DROP FUNCTION public.get_uretici_rapor_ana_ozet_v2(...) yeterlidir.

CREATE OR REPLACE FUNCTION public.get_uretici_rapor_ana_ozet_v2(
  p_uretici_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz,
  p_takim_id uuid DEFAULT NULL,
  p_firma_id uuid DEFAULT NULL
)
RETURNS TABLE(
  donemde_yayina_alinan integer,
  su_an_yayinda integer,
  planlanan integer,
  durdurulan_ve_iptal integer,
  devam_eden_talep integer,
  senaryo_onayi_bekleyen integer,
  video_onayi_bekleyen integer,
  soru_seti_onayi_bekleyen integer,
  senaryo_revizyon_olayi integer,
  senaryo_revizyonlu_talep integer,
  video_revizyon_olayi integer,
  video_revizyonlu_talep integer,
  soru_seti_revizyon_olayi integer,
  soru_seti_revizyonlu_talep integer,
  ortalama_uretim_suresi_saat numeric,
  scope_toplam_yayin integer,
  scope_toplam_utt integer,
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
AS $function$
WITH
uretici_talepleri AS (
  SELECT t.talep_id, t.created_at
  FROM talepler t
  WHERE t.uretici_id = p_uretici_id
),
talep_son_durumlari AS (
  SELECT
    ut.talep_id,
    sy.durum AS senaryo_durum,
    vy.durum AS video_durum,
    ssdy.durum AS soru_seti_durum,
    ty.yayin_id,
    ty.yayin_durum
  FROM uretici_talepleri ut
  LEFT JOIN LATERAL (
    SELECT sd.durum
    FROM senaryolar s
    JOIN senaryo_durumu sd ON sd.senaryo_id = s.senaryo_id
    WHERE s.talep_id = ut.talep_id
    ORDER BY sd.created_at DESC, sd.senaryo_durum_id DESC
    LIMIT 1
  ) sy ON true
  LEFT JOIN LATERAL (
    SELECT vd.durum
    FROM videolar v
    JOIN video_durumu vd ON vd.video_id = v.video_id
    WHERE v.talep_id = ut.talep_id
    ORDER BY vd.created_at DESC, vd.video_durum_id DESC
    LIMIT 1
  ) vy ON true
  LEFT JOIN LATERAL (
    SELECT ssd.durum
    FROM soru_setleri ss
    JOIN soru_seti_durumu ssd ON ssd.soru_seti_id = ss.soru_seti_id
    WHERE ss.talep_id = ut.talep_id
    ORDER BY ssd.created_at DESC, ssd.soru_seti_durum_id DESC
    LIMIT 1
  ) ssdy ON true
  LEFT JOIN LATERAL (
    SELECT yy.yayin_id, yy.durum AS yayin_durum
    FROM soru_setleri ss
    JOIN soru_seti_durumu ssd ON ssd.soru_seti_id = ss.soru_seti_id
    JOIN yayin_yonetimi yy ON yy.soru_seti_durum_id = ssd.soru_seti_durum_id
    WHERE ss.talep_id = ut.talep_id
    ORDER BY yy.created_at DESC NULLS LAST, yy.yayin_id DESC
    LIMIT 1
  ) ty ON true
),
donem_yayinlari AS (
  SELECT DISTINCT yy.yayin_id, ss.talep_id, yy.created_at AS yayina_alma_tarihi
  FROM yayin_yonetimi yy
  JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = yy.soru_seti_durum_id
  JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  WHERE yy.uretici_id = p_uretici_id
    AND yy.created_at >= p_baslangic
    AND yy.created_at <= p_bitis
),
donem_talepleri AS (
  SELECT DISTINCT talep_id FROM donem_yayinlari
),
senaryo_revizyonlari AS (
  SELECT
    COUNT(*)::int AS olay,
    COUNT(DISTINCT s.talep_id)::int AS talep
  FROM senaryolar s
  JOIN senaryo_durumu sd ON sd.senaryo_id = s.senaryo_id
  WHERE s.talep_id IN (SELECT talep_id FROM donem_talepleri)
    AND sd.durum = 'revizyon bekleniyor'
),
video_revizyonlari AS (
  SELECT
    COUNT(*)::int AS olay,
    COUNT(DISTINCT v.talep_id)::int AS talep
  FROM videolar v
  JOIN video_durumu vd ON vd.video_id = v.video_id
  WHERE v.talep_id IN (SELECT talep_id FROM donem_talepleri)
    AND vd.durum = 'revizyon bekleniyor'
),
soru_seti_revizyonlari AS (
  SELECT
    COUNT(*)::int AS olay,
    COUNT(DISTINCT ss.talep_id)::int AS talep
  FROM soru_setleri ss
  JOIN soru_seti_durumu ssd ON ssd.soru_seti_id = ss.soru_seti_id
  WHERE ss.talep_id IN (SELECT talep_id FROM donem_talepleri)
    AND ssd.durum = 'revizyon bekleniyor'
),
scoped_users AS (
  SELECT k.kullanici_id, k.rol, k.takim_id, k.firma_id
  FROM kullanicilar k
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt', 'kd_utt')
    AND (p_takim_id IS NULL OR k.takim_id = p_takim_id)
    AND (p_firma_id IS NULL OR k.firma_id = p_firma_id)
),
scope_yayinlari AS (
  SELECT DISTINCT
    yy.yayin_id,
    yy.durum,
    yy.hedef_roller,
    yy.yayin_tarihi,
    yy.created_at,
    t.takim_id,
    t.firma_id
  FROM yayin_yonetimi yy
  JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = yy.soru_seti_durum_id
  JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  JOIN talepler t ON t.talep_id = ss.talep_id
  WHERE yy.hedef_roller && ARRAY['utt', 'kd_utt']
    AND (p_takim_id IS NULL OR t.takim_id = p_takim_id)
    AND (p_firma_id IS NULL OR t.firma_id = p_firma_id)
),
canli_scope_yayinlari AS (
  SELECT
    sy.*,
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
  SELECT csy.yayin_id, su.kullanici_id, csy.guncel_tur_baslangici
  FROM canli_scope_yayinlari csy
  JOIN scoped_users su
    ON su.firma_id = csy.firma_id
   AND (csy.takim_id IS NULL OR su.takim_id = csy.takim_id)
),
guncel_tur_tamamlananlar AS (
  SELECT DISTINCT gf.yayin_id, gf.kullanici_id
  FROM guncel_tur_firsatlari gf
  JOIN izleme_kayitlari ik
    ON ik.yayin_id = gf.yayin_id
   AND ik.kullanici_id = gf.kullanici_id
  WHERE ik.gercek_oynatma_mi = true
    AND ik.tamamlandi_mi = true
    AND ik.izleme_baslangic >= gf.guncel_tur_baslangici
),
donem_izlemeleri AS (
  SELECT ik.kullanici_id, ik.yayin_id
  FROM izleme_kayitlari ik
  JOIN scoped_users su ON su.kullanici_id = ik.kullanici_id
  JOIN scope_yayinlari sy
    ON sy.yayin_id = ik.yayin_id
   AND sy.firma_id = su.firma_id
   AND (sy.takim_id IS NULL OR sy.takim_id = su.takim_id)
  WHERE ik.gercek_oynatma_mi = true
    AND ik.tamamlandi_mi = true
    AND ik.izleme_baslangic >= p_baslangic
    AND ik.izleme_baslangic <= p_bitis
),
sayilar AS (
  SELECT
    (SELECT COUNT(*) FROM donem_yayinlari)::int AS donemde_yayina_alinan,
    (SELECT COUNT(*) FROM yayin_yonetimi WHERE uretici_id = p_uretici_id AND durum = 'yayinda')::int AS su_an_yayinda,
    (SELECT COUNT(*) FROM yayin_yonetimi WHERE uretici_id = p_uretici_id AND durum = 'planlandi')::int AS planlanan,
    (
      (SELECT COUNT(*) FROM yayin_yonetimi WHERE uretici_id = p_uretici_id AND durum = 'Durduruldu')
      +
      (SELECT COUNT(*) FROM talep_son_durumlari
       WHERE yayin_id IS NULL
         AND (senaryo_durum = 'Iptal Edildi' OR video_durum = 'Iptal Edildi' OR soru_seti_durum = 'Iptal Edildi'))
    )::int AS durdurulan_ve_iptal,
    (SELECT COUNT(*) FROM talep_son_durumlari
     WHERE yayin_id IS NULL
       AND COALESCE(senaryo_durum, '') <> 'Iptal Edildi'
       AND COALESCE(video_durum, '') <> 'Iptal Edildi'
       AND COALESCE(soru_seti_durum, '') <> 'Iptal Edildi')::int AS devam_eden_talep,
    (SELECT COUNT(*) FROM talep_son_durumlari WHERE senaryo_durum = 'inceleme bekleniyor')::int AS senaryo_onayi_bekleyen,
    (SELECT COUNT(*) FROM talep_son_durumlari WHERE video_durum = 'inceleme bekleniyor')::int AS video_onayi_bekleyen,
    (SELECT COUNT(*) FROM talep_son_durumlari WHERE soru_seti_durum = 'inceleme bekleniyor')::int AS soru_seti_onayi_bekleyen,
    COALESCE((SELECT AVG(EXTRACT(EPOCH FROM (dy.yayina_alma_tarihi - ut.created_at)) / 3600.0)
              FROM donem_yayinlari dy
              JOIN uretici_talepleri ut ON ut.talep_id = dy.talep_id), 0)::numeric(10,2) AS ortalama_uretim_suresi_saat,
    (SELECT COUNT(*) FROM canli_scope_yayinlari)::int AS scope_toplam_yayin,
    (SELECT COUNT(*) FROM scoped_users)::int AS scope_toplam_utt,
    (SELECT COUNT(*) FROM guncel_tur_firsatlari)::int AS guncel_tur_toplam_firsat,
    (SELECT COUNT(*) FROM guncel_tur_tamamlananlar)::int AS guncel_tur_tamamlanan,
    (SELECT COUNT(*) FROM donem_izlemeleri)::int AS donem_tamamlanan_izleme,
    (SELECT COUNT(DISTINCT (kullanici_id, yayin_id)) FROM donem_izlemeleri)::int AS donem_benzersiz_utt_yayin,
    (SELECT COUNT(DISTINCT kullanici_id) FROM donem_izlemeleri)::int AS donem_aktif_utt
)
SELECT
  s.donemde_yayina_alinan,
  s.su_an_yayinda,
  s.planlanan,
  s.durdurulan_ve_iptal,
  s.devam_eden_talep,
  s.senaryo_onayi_bekleyen,
  s.video_onayi_bekleyen,
  s.soru_seti_onayi_bekleyen,
  sr.olay,
  sr.talep,
  vr.olay,
  vr.talep,
  ssr.olay,
  ssr.talep,
  s.ortalama_uretim_suresi_saat,
  s.scope_toplam_yayin,
  s.scope_toplam_utt,
  s.guncel_tur_toplam_firsat,
  s.guncel_tur_tamamlanan,
  GREATEST(0, s.guncel_tur_toplam_firsat - s.guncel_tur_tamamlanan)::int,
  CASE WHEN s.guncel_tur_toplam_firsat = 0 THEN 0
       ELSE ROUND(100.0 * s.guncel_tur_tamamlanan / s.guncel_tur_toplam_firsat)::int END,
  s.donem_tamamlanan_izleme,
  s.donem_benzersiz_utt_yayin,
  s.donem_aktif_utt
FROM sayilar s
CROSS JOIN senaryo_revizyonlari sr
CROSS JOIN video_revizyonlari vr
CROSS JOIN soru_seti_revizyonlari ssr;
$function$;

GRANT EXECUTE ON FUNCTION public.get_uretici_rapor_ana_ozet_v2(
  uuid, timestamptz, timestamptz, uuid, uuid
) TO service_role;
