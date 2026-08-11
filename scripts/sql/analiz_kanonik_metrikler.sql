-- Analiz modülü kanonik metrikleri — üretim + tüketim, dört rol kolu.
--
-- İş kuralları:
--   * Üretim, yayına alma aksiyonuyla ve v_yayin_kunye üzerinden ölçülür.
--   * Yalnız gerçek ve tamamlanmış oynatmalar izleme sayılır.
--   * İzlenmemiş güncel yayın bir ceza değil, kalan fırsattır.
--   * Toplam kayıp yalnız gerçekleşmiş ceza defterlerinden oluşur.
--   * Mevcut rol RPC adları ve dönüş kolonları geriye uyumluluk için korunur.
--
-- Exit: Bu dosya uygulanmadan önce canlı pg_get_functiondef çıktıları alındı.
-- Geri dönüşte ortak iki fonksiyon DROP edilir ve saklanan eski dört tüketim +
-- iki üretim fonksiyonu yeniden çalıştırılır.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_analiz_uretim_kanonik(
  p_firma_id uuid,
  p_scope_takim_id uuid DEFAULT NULL,
  p_baslangic timestamptz DEFAULT NULL,
  p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL,
  p_egitim_turu text DEFAULT NULL,
  p_takim_id uuid DEFAULT NULL
)
RETURNS TABLE(
  urun_sayisi bigint,
  video_sayisi bigint,
  soru_sayisi bigint,
  ileri_sarma_izinli_video_sayisi bigint,
  potansiyel_video_izleme_puani bigint,
  potansiyel_dogru_cevap_puani bigint
)
LANGUAGE sql
STABLE
AS $function$
WITH yayinlar AS (
  SELECT DISTINCT
    ym.yayin_id,
    ky.urun_id,
    ss.video_durum_id,
    ssd.soru_seti_durum_id,
    ss.sorular
  FROM yayin_yonetimi ym
  JOIN v_yayin_kunye ky ON ky.yayin_id = ym.yayin_id
  JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
  JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  WHERE ky.firma_id = p_firma_id
    AND (p_scope_takim_id IS NULL OR ky.takim_id = p_scope_takim_id)
    AND (p_takim_id IS NULL OR ky.takim_id = p_takim_id)
    AND (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR COALESCE(ym.created_at, ym.yayin_tarihi) >= p_baslangic)
    AND (p_bitis IS NULL OR COALESCE(ym.created_at, ym.yayin_tarihi) <= p_bitis)
),
metrikler AS (
  SELECT
    COUNT(DISTINCT urun_id)::bigint AS urun_sayisi,
    COUNT(DISTINCT yayin_id)::bigint AS video_sayisi,
    COALESCE(SUM(jsonb_array_length(sorular)), 0)::bigint AS soru_sayisi
  FROM yayinlar
),
video_puani AS (
  SELECT COALESCE(SUM(vp.video_puani), 0)::bigint AS puan
  FROM yayinlar y
  LEFT JOIN video_puanlari vp ON vp.video_durum_id = y.video_durum_id
),
soru_puani AS (
  SELECT COALESCE(SUM(ssp.soru_puani), 0)::bigint AS puan
  FROM yayinlar y
  LEFT JOIN soru_seti_puanlari ssp ON ssp.soru_seti_durum_id = y.soru_seti_durum_id
)
SELECT
  m.urun_sayisi,
  m.video_sayisi,
  m.soru_sayisi,
  0::bigint AS ileri_sarma_izinli_video_sayisi,
  vp.puan,
  sp.puan
FROM metrikler m, video_puani vp, soru_puani sp;
$function$;

CREATE OR REPLACE FUNCTION public.get_analiz_tuketim_kanonik(
  p_firma_id uuid,
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
  izlenen_video_sayisi bigint,
  kazanilan_izleme_puani bigint,
  cevaplanan_soru_sayisi bigint,
  kazanilan_cevaplama_puani bigint,
  onerilen_video_sayisi bigint,
  kazanilan_oneri_izleme_puani bigint,
  extra_izleme_olan_video_sayisi bigint,
  kazanilan_extra_izleme_puani bigint,
  izlenmeyen_video_sayisi bigint,
  kaybedilen_video_puani bigint,
  yanlis_cevaplanan_soru_sayisi bigint,
  kaybedilen_cevaplama_puani bigint,
  izlenmeyen_oneri_video_sayisi bigint,
  kaybedilen_oneri_video_puani bigint,
  ileri_sarilan_video_sayisi bigint,
  kaybedilen_ileri_sarma_puani bigint,
  kazanilan_toplam_puan bigint,
  kaybedilen_toplam_puan bigint,
  net_puan bigint
)
LANGUAGE sql
STABLE
AS $function$
WITH scope_users AS (
  SELECT k.kullanici_id, k.rol, k.takim_id, k.bolge_id
  FROM kullanicilar k
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt', 'kd_utt')
    AND k.firma_id = p_firma_id
    AND (p_scope_takim_id IS NULL OR k.takim_id = p_scope_takim_id)
    AND (p_scope_bolge_id IS NULL OR k.bolge_id = p_scope_bolge_id)
    AND (p_takim_id IS NULL OR k.takim_id = p_takim_id)
    AND (p_bolge_id IS NULL OR k.bolge_id = p_bolge_id)
    AND (p_utt_id IS NULL OR k.kullanici_id = p_utt_id)
),
kazanim AS (
  SELECT
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::bigint AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::bigint AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::bigint AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::bigint AS extra
  FROM kazanilan_puanlar kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  JOIN v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR kp.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR kp.created_at <= p_bitis)
),
izleme AS (
  SELECT
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'kendi_kendine')::bigint AS kendi,
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'oneri')::bigint AS oneri,
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'extra')::bigint AS extra
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  JOIN v_yayin_kunye ky ON ky.yayin_id = ik.yayin_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR COALESCE(ik.izleme_bitis, ik.created_at) >= p_baslangic)
    AND (p_bitis IS NULL OR COALESCE(ik.izleme_bitis, ik.created_at) <= p_bitis)
),
cevap AS (
  SELECT
    COUNT(*)::bigint AS toplam,
    COUNT(*) FILTER (WHERE sc.dogru_mu = false)::bigint AS yanlis
  FROM soru_cevaplari sc
  JOIN scope_users su ON su.kullanici_id = sc.kullanici_id
  JOIN izleme_kayitlari ik ON ik.izleme_id = sc.izleme_id
  JOIN v_yayin_kunye ky ON ky.yayin_id = ik.yayin_id
  WHERE ik.gercek_oynatma_mi = true
    AND (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR sc.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR sc.created_at <= p_bitis)
),
yanlis_kaybi AS (
  SELECT COALESCE(SUM(y.kaybedilen_puan), 0)::bigint AS puan
  FROM yanlis_cevap_kayitlari y
  JOIN scope_users su ON su.kullanici_id = y.kullanici_id
  JOIN v_yayin_kunye ky ON ky.yayin_id = y.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR y.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR y.created_at <= p_bitis)
),
ileri_sarma AS (
  SELECT COUNT(DISTINCT i.kayit_id)::bigint AS adet,
    COALESCE(SUM(i.kaybedilen_puan), 0)::bigint AS puan
  FROM ileri_sarma_kayitlari i
  JOIN scope_users su ON su.kullanici_id = i.kullanici_id
  JOIN v_yayin_kunye ky ON ky.yayin_id = i.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR i.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR i.created_at <= p_bitis)
),
oneri_kaybi AS (
  SELECT COUNT(*)::bigint AS adet,
    COALESCE(SUM(o.kaybedilen_puan), 0)::bigint AS puan
  FROM oneri_kayip_kayitlari o
  JOIN scope_users su ON su.kullanici_id = o.kullanici_id
  JOIN v_yayin_kunye ky ON ky.yayin_id = o.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR o.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR o.created_at <= p_bitis)
),
challenge_kaybi AS (
  SELECT COALESCE(SUM(c.kaybedilen_puan), 0)::bigint AS puan
  FROM challenge_kayip_kayitlari c
  JOIN scope_users su ON su.kullanici_id = c.kullanici_id
  JOIN v_yayin_kunye ky ON ky.yayin_id = c.yayin_id
  WHERE (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR c.created_at >= p_baslangic)
    AND (p_bitis IS NULL OR c.created_at <= p_bitis)
),
kalan_firsat AS (
  SELECT COUNT(*)::bigint AS adet,
    COALESCE(SUM(vp.video_puani), 0)::bigint AS puan
  FROM yayin_yonetimi ym
  JOIN v_yayin_kunye ky ON ky.yayin_id = ym.yayin_id
  JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
  JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  LEFT JOIN video_puanlari vp ON vp.video_durum_id = ss.video_durum_id
  CROSS JOIN scope_users su
  WHERE ym.durum = 'yayinda'
    AND su.rol = ANY(ym.hedef_roller)
    AND NOT EXISTS (
      SELECT 1
      FROM izleme_kayitlari ik
      WHERE ik.yayin_id = ym.yayin_id
        AND ik.kullanici_id = su.kullanici_id
        AND ik.tamamlandi_mi = true
        AND ik.gercek_oynatma_mi = true
    )
    AND (p_urun_id IS NULL OR ky.urun_id = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic IS NULL OR COALESCE(ym.created_at, ym.yayin_tarihi) >= p_baslangic)
    AND (p_bitis IS NULL OR COALESCE(ym.created_at, ym.yayin_tarihi) <= p_bitis)
),
toplam AS (
  SELECT
    (k.izleme + k.cevaplama + k.oneri + k.extra)::bigint AS kazanim,
    (yk.puan + isr.puan + ok.puan + ck.puan)::bigint AS kayip
  FROM kazanim k, yanlis_kaybi yk, ileri_sarma isr, oneri_kaybi ok, challenge_kaybi ck
)
SELECT
  i.kendi,
  k.izleme,
  c.toplam,
  k.cevaplama,
  i.oneri,
  k.oneri,
  i.extra,
  k.extra,
  f.adet,
  f.puan,
  c.yanlis,
  yk.puan,
  ok.adet,
  ok.puan,
  isr.adet,
  isr.puan,
  t.kazanim,
  t.kayip,
  (t.kazanim - t.kayip)::bigint
FROM kazanim k, izleme i, cevap c, yanlis_kaybi yk, ileri_sarma isr,
  oneri_kaybi ok, kalan_firsat f, toplam t;
$function$;

CREATE OR REPLACE FUNCTION public.get_analiz_uretici_uretim(
  p_kullanici_id uuid,
  p_baslangic timestamptz DEFAULT NULL,
  p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL,
  p_egitim_turu text DEFAULT NULL
)
RETURNS TABLE(
  urun_sayisi bigint, video_sayisi bigint, soru_sayisi bigint,
  ileri_sarma_izinli_video_sayisi bigint,
  potansiyel_video_izleme_puani bigint, potansiyel_dogru_cevap_puani bigint
)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE v_firma_id uuid; v_takim_id uuid;
BEGIN
  SELECT firma_id, takim_id INTO v_firma_id, v_takim_id
  FROM kullanicilar WHERE kullanici_id = p_kullanici_id;
  IF v_firma_id IS NULL THEN RAISE EXCEPTION 'Kullanıcı veya firma bulunamadı'; END IF;
  RETURN QUERY SELECT * FROM get_analiz_uretim_kanonik(
    v_firma_id, v_takim_id, p_baslangic, p_bitis, p_urun_id, p_egitim_turu, NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_analiz_yonetici_uretim(
  p_kullanici_id uuid,
  p_baslangic timestamptz DEFAULT NULL,
  p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL,
  p_egitim_turu text DEFAULT NULL,
  p_takim_id uuid DEFAULT NULL
)
RETURNS TABLE(
  urun_sayisi bigint, video_sayisi bigint, soru_sayisi bigint,
  ileri_sarma_izinli_video_sayisi bigint,
  potansiyel_video_izleme_puani bigint, potansiyel_dogru_cevap_puani bigint
)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE v_firma_id uuid;
BEGIN
  SELECT firma_id INTO v_firma_id FROM kullanicilar WHERE kullanici_id = p_kullanici_id;
  IF v_firma_id IS NULL THEN RAISE EXCEPTION 'Kullanıcı veya firma bulunamadı'; END IF;
  RETURN QUERY SELECT * FROM get_analiz_uretim_kanonik(
    v_firma_id, NULL, p_baslangic, p_bitis, p_urun_id, p_egitim_turu, p_takim_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_analiz_uretici_tuketim(
  p_kullanici_id uuid, p_baslangic timestamptz DEFAULT NULL, p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL, p_egitim_turu text DEFAULT NULL, p_takim_id uuid DEFAULT NULL,
  p_bolge_id uuid DEFAULT NULL, p_utt_id uuid DEFAULT NULL
)
RETURNS TABLE(
  izlenen_video_sayisi bigint, kazanilan_izleme_puani bigint,
  cevaplanan_soru_sayisi bigint, kazanilan_cevaplama_puani bigint,
  onerilen_video_sayisi bigint, kazanilan_oneri_izleme_puani bigint,
  extra_izleme_olan_video_sayisi bigint, kazanilan_extra_izleme_puani bigint,
  izlenmeyen_video_sayisi bigint, kaybedilen_video_puani bigint,
  yanlis_cevaplanan_soru_sayisi bigint, kaybedilen_cevaplama_puani bigint,
  izlenmeyen_oneri_video_sayisi bigint, kaybedilen_oneri_video_puani bigint,
  ileri_sarilan_video_sayisi bigint, kaybedilen_ileri_sarma_puani bigint,
  kazanilan_toplam_puan bigint, kaybedilen_toplam_puan bigint, net_puan bigint
)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE v_firma_id uuid; v_takim_id uuid;
BEGIN
  SELECT firma_id, takim_id INTO v_firma_id, v_takim_id FROM kullanicilar WHERE kullanici_id = p_kullanici_id;
  IF v_firma_id IS NULL THEN RAISE EXCEPTION 'Kullanıcı veya firma bulunamadı'; END IF;
  RETURN QUERY SELECT * FROM get_analiz_tuketim_kanonik(
    v_firma_id, v_takim_id, NULL, p_baslangic, p_bitis, p_urun_id, p_egitim_turu,
    p_takim_id, p_bolge_id, p_utt_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_analiz_yonetici_tuketim(
  p_kullanici_id uuid, p_baslangic timestamptz DEFAULT NULL, p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL, p_egitim_turu text DEFAULT NULL, p_takim_id uuid DEFAULT NULL,
  p_bolge_id uuid DEFAULT NULL, p_utt_id uuid DEFAULT NULL
)
RETURNS TABLE(
  izlenen_video_sayisi bigint, kazanilan_izleme_puani bigint,
  cevaplanan_soru_sayisi bigint, kazanilan_cevaplama_puani bigint,
  onerilen_video_sayisi bigint, kazanilan_oneri_izleme_puani bigint,
  extra_izleme_olan_video_sayisi bigint, kazanilan_extra_izleme_puani bigint,
  izlenmeyen_video_sayisi bigint, kaybedilen_video_puani bigint,
  yanlis_cevaplanan_soru_sayisi bigint, kaybedilen_cevaplama_puani bigint,
  izlenmeyen_oneri_video_sayisi bigint, kaybedilen_oneri_video_puani bigint,
  ileri_sarilan_video_sayisi bigint, kaybedilen_ileri_sarma_puani bigint,
  kazanilan_toplam_puan bigint, kaybedilen_toplam_puan bigint, net_puan bigint
)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE v_firma_id uuid;
BEGIN
  SELECT firma_id INTO v_firma_id FROM kullanicilar WHERE kullanici_id = p_kullanici_id;
  IF v_firma_id IS NULL THEN RAISE EXCEPTION 'Kullanıcı veya firma bulunamadı'; END IF;
  RETURN QUERY SELECT * FROM get_analiz_tuketim_kanonik(
    v_firma_id, NULL, NULL, p_baslangic, p_bitis, p_urun_id, p_egitim_turu,
    p_takim_id, p_bolge_id, p_utt_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_analiz_tm_tuketim(
  p_kullanici_id uuid, p_baslangic timestamptz DEFAULT NULL, p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL, p_egitim_turu text DEFAULT NULL,
  p_bolge_id uuid DEFAULT NULL, p_utt_id uuid DEFAULT NULL
)
RETURNS TABLE(
  izlenen_video_sayisi bigint, kazanilan_izleme_puani bigint,
  cevaplanan_soru_sayisi bigint, kazanilan_cevaplama_puani bigint,
  onerilen_video_sayisi bigint, kazanilan_oneri_izleme_puani bigint,
  extra_izleme_olan_video_sayisi bigint, kazanilan_extra_izleme_puani bigint,
  izlenmeyen_video_sayisi bigint, kaybedilen_video_puani bigint,
  yanlis_cevaplanan_soru_sayisi bigint, kaybedilen_cevaplama_puani bigint,
  izlenmeyen_oneri_video_sayisi bigint, kaybedilen_oneri_video_puani bigint,
  ileri_sarilan_video_sayisi bigint, kaybedilen_ileri_sarma_puani bigint,
  kazanilan_toplam_puan bigint, kaybedilen_toplam_puan bigint, net_puan bigint
)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE v_firma_id uuid; v_takim_id uuid;
BEGIN
  SELECT firma_id, takim_id INTO v_firma_id, v_takim_id FROM kullanicilar WHERE kullanici_id = p_kullanici_id;
  IF v_firma_id IS NULL OR v_takim_id IS NULL THEN RAISE EXCEPTION 'TM kapsamı bulunamadı'; END IF;
  RETURN QUERY SELECT * FROM get_analiz_tuketim_kanonik(
    v_firma_id, v_takim_id, NULL, p_baslangic, p_bitis, p_urun_id, p_egitim_turu,
    NULL, p_bolge_id, p_utt_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_analiz_bm_tuketim(
  p_kullanici_id uuid, p_baslangic timestamptz DEFAULT NULL, p_bitis timestamptz DEFAULT NULL,
  p_urun_id uuid DEFAULT NULL, p_egitim_turu text DEFAULT NULL, p_utt_id uuid DEFAULT NULL
)
RETURNS TABLE(
  izlenen_video_sayisi bigint, kazanilan_izleme_puani bigint,
  cevaplanan_soru_sayisi bigint, kazanilan_cevaplama_puani bigint,
  onerilen_video_sayisi bigint, kazanilan_oneri_izleme_puani bigint,
  extra_izleme_olan_video_sayisi bigint, kazanilan_extra_izleme_puani bigint,
  izlenmeyen_video_sayisi bigint, kaybedilen_video_puani bigint,
  yanlis_cevaplanan_soru_sayisi bigint, kaybedilen_cevaplama_puani bigint,
  izlenmeyen_oneri_video_sayisi bigint, kaybedilen_oneri_video_puani bigint,
  ileri_sarilan_video_sayisi bigint, kaybedilen_ileri_sarma_puani bigint,
  kazanilan_toplam_puan bigint, kaybedilen_toplam_puan bigint, net_puan bigint
)
LANGUAGE plpgsql STABLE
AS $function$
DECLARE v_firma_id uuid; v_takim_id uuid; v_bolge_id uuid;
BEGIN
  SELECT firma_id, takim_id, bolge_id INTO v_firma_id, v_takim_id, v_bolge_id
  FROM kullanicilar WHERE kullanici_id = p_kullanici_id;
  IF v_firma_id IS NULL OR v_takim_id IS NULL OR v_bolge_id IS NULL THEN
    RAISE EXCEPTION 'BM kapsamı bulunamadı';
  END IF;
  RETURN QUERY SELECT * FROM get_analiz_tuketim_kanonik(
    v_firma_id, v_takim_id, v_bolge_id, p_baslangic, p_bitis, p_urun_id,
    p_egitim_turu, NULL, NULL, p_utt_id
  );
END;
$function$;

COMMENT ON FUNCTION public.get_analiz_tuketim_kanonik IS
  'Analiz tüketim tek kaynağı. İzlenmeyen güncel yayın ceza değil kalan fırsattır.';

UPDATE public.analiz_tuketim_degiskenleri
SET ad = CASE degisken_id
  WHEN 'izlenmeyen_video_sayisi' THEN 'Kalan İzleme Fırsatı'
  WHEN 'kaybedilen_video_puani' THEN 'Kalan Potansiyel İzleme Puanı'
  ELSE ad
END
WHERE degisken_id IN ('izlenmeyen_video_sayisi', 'kaybedilen_video_puani');

COMMIT;
