-- Yönetici raporu v2 — firma genelinde üretim ve saha tüketiminin kanonik özeti.
--
-- İş kuralları:
-- - Kapsam istemciden değil, oturum sahibinin firma_id değerinden çözülür.
-- - Üretim, dört üretim varyantından bağımsız olarak yayına alma aksiyonudur.
-- - İzleme yalnız gerçek ve tamamlanmış oturumdur.
-- - Puan, gerçekleşmiş kazanım ve kayıtlı kayıp defterlerinden hesaplanır.
-- - Güncel tur fırsatı canlı yayın × aktif UTT kümesidir.
--
-- Exit: Uygulama bu fonksiyonlara geçirilmeden mevcut yönetici raporu değişmez.
-- Geri alım:
--   DROP FUNCTION public.get_yonetici_rapor_ana_ozet_v2(uuid,timestamptz,timestamptz);
--   DROP FUNCTION public.get_yonetici_hiyerarsi_v2(uuid,timestamptz,timestamptz,text,uuid);
--   DROP FUNCTION public.get_yonetici_icerik_etkisi_v2(uuid,timestamptz,timestamptz);

BEGIN;

CREATE OR REPLACE FUNCTION public.get_yonetici_rapor_ana_ozet_v2(
  p_yonetici_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  toplam_takim integer,
  toplam_bolge integer,
  toplam_utt integer,
  aktif_utt integer,
  donem_tamamlanan_izleme integer,
  donem_benzersiz_utt_yayin integer,
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
  toplam_yayina_alma integer,
  donemde_yayina_alinan integer,
  su_an_yayinda integer,
  donem_urun_egitimi integer,
  donem_genel_egitim integer,
  donem_medikal_egitim integer,
  donem_ik_egitimi integer,
  donem_normal_uretim integer,
  donem_hazir_video integer,
  donem_hazir_soru_seti integer,
  donem_hazir_video_ve_soru_seti integer,
  guncel_tur_toplam_firsat integer,
  guncel_tur_tamamlanan integer,
  guncel_tur_kalan integer,
  guncel_tur_izlenme_orani integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
yonetici_scope AS (
  SELECT k.firma_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_yonetici_id
    AND k.aktif_mi = true
    AND k.rol IN ('gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm')
),
scope_users AS (
  SELECT k.kullanici_id, k.takim_id, k.bolge_id
  FROM kullanicilar k
  JOIN yonetici_scope ys ON ys.firma_id = k.firma_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt','kd_utt')
),
scope_yayinlari AS (
  SELECT DISTINCT
    yy.yayin_id,
    LOWER(COALESCE(yy.durum, '')) AS durum,
    yy.yayin_tarihi,
    yy.created_at,
    yy.hedef_roller,
    ky.icerik_turu,
    t.hazir_video,
    t.hazir_soru_seti
  FROM yayin_yonetimi yy
  JOIN v_yayin_kunye ky ON ky.yayin_id = yy.yayin_id
  JOIN talepler t ON t.talep_id = ky.talep_id
  JOIN yonetici_scope ys ON ys.firma_id = ky.firma_id
),
canli_yayinlar AS (
  SELECT
    sy.yayin_id,
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
    AND COALESCE(sy.hedef_roller, ARRAY['utt']::text[])
      && ARRAY['utt','kd_utt']::text[]
),
guncel_tur_firsatlari AS (
  SELECT cy.yayin_id, su.kullanici_id, cy.guncel_tur_baslangici
  FROM canli_yayinlar cy
  CROSS JOIN scope_users su
),
guncel_tur_tamamlananlar AS (
  SELECT DISTINCT gf.yayin_id, gf.kullanici_id
  FROM guncel_tur_firsatlari gf
  JOIN izleme_kayitlari ik
    ON ik.yayin_id = gf.yayin_id
   AND ik.kullanici_id = gf.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic)
      >= gf.guncel_tur_baslangici
),
donem_izleme AS (
  SELECT ik.izleme_id, ik.kullanici_id, ik.yayin_id
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
),
kazanim AS (
  SELECT
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM kazanilan_puanlar kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
),
ileri_sarma AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM ileri_sarma_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
yanlis_cevap AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM yanlis_cevap_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
oneri_kaybi AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM oneri_kayip_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
challenge_kaybi AS (
  SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::int AS puan
  FROM challenge_kayip_kayitlari x
  JOIN scope_users su ON su.kullanici_id = x.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
),
sayilar AS (
  SELECT
    (SELECT COUNT(DISTINCT takim_id) FROM scope_users WHERE takim_id IS NOT NULL)::int AS takim,
    (SELECT COUNT(DISTINCT bolge_id) FROM scope_users WHERE bolge_id IS NOT NULL)::int AS bolge,
    (SELECT COUNT(*) FROM scope_users)::int AS utt,
    (SELECT COUNT(DISTINCT kullanici_id) FROM donem_izleme)::int AS aktif,
    (SELECT COUNT(DISTINCT izleme_id) FROM donem_izleme)::int AS donem_izleme,
    (SELECT COUNT(DISTINCT (kullanici_id, yayin_id)) FROM donem_izleme)::int AS donem_cift,
    (SELECT COUNT(*) FROM scope_yayinlari)::int AS tum_yayin,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis)::int AS donem_yayin,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE durum = 'yayinda')::int AS canli,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'urun')::int AS urun,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'egitim')::int AS egitim,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu IN ('medikal','urun_medikal'))::int AS medikal,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND icerik_turu = 'ik')::int AS ik,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = false AND hazir_soru_seti = false)::int AS normal,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = true AND hazir_soru_seti = false)::int AS hazir_video,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = false AND hazir_soru_seti = true)::int AS hazir_set,
    (SELECT COUNT(*) FROM scope_yayinlari WHERE created_at >= p_baslangic AND created_at <= p_bitis AND hazir_video = true AND hazir_soru_seti = true)::int AS hazir_ikisi,
    (SELECT COUNT(*) FROM guncel_tur_firsatlari)::int AS firsat,
    (SELECT COUNT(*) FROM guncel_tur_tamamlananlar)::int AS tamamlanan
)
SELECT
  s.takim,
  s.bolge,
  s.utt,
  s.aktif,
  s.donem_izleme,
  s.donem_cift,
  k.izleme,
  k.cevaplama,
  k.oneri,
  k.extra,
  isk.puan,
  yc.puan,
  oky.puan,
  ch.puan,
  (k.izleme + k.cevaplama + k.oneri + k.extra)::int,
  (isk.puan + yc.puan + oky.puan + ch.puan)::int,
  (k.izleme + k.cevaplama + k.oneri + k.extra - isk.puan - yc.puan - oky.puan - ch.puan)::int,
  s.tum_yayin,
  s.donem_yayin,
  s.canli,
  s.urun,
  s.egitim,
  s.medikal,
  s.ik,
  s.normal,
  s.hazir_video,
  s.hazir_set,
  s.hazir_ikisi,
  s.firsat,
  s.tamamlanan,
  GREATEST(0, s.firsat - s.tamamlanan)::int,
  CASE WHEN s.firsat = 0 THEN 0
    ELSE ROUND(100.0 * s.tamamlanan / s.firsat)::int END
FROM sayilar s
CROSS JOIN kazanim k
CROSS JOIN ileri_sarma isk
CROSS JOIN yanlis_cevap yc
CROSS JOIN oneri_kaybi oky
CROSS JOIN challenge_kaybi ch;
$function$;

CREATE OR REPLACE FUNCTION public.get_yonetici_hiyerarsi_v2(
  p_yonetici_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz,
  p_seviye text,
  p_ust_birim_id uuid DEFAULT NULL
)
RETURNS TABLE(
  birim_id uuid,
  birim_adi text,
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
  challenge_kaybi integer,
  kazanilan_toplam integer,
  kaybedilen_toplam integer,
  net_puan integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
yonetici_scope AS (
  SELECT k.firma_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_yonetici_id
    AND k.aktif_mi = true
    AND k.rol IN ('gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm')
),
scope_users AS (
  SELECT
    k.kullanici_id,
    k.ad::text,
    k.soyad::text,
    k.takim_id,
    t.takim_adi::text,
    k.bolge_id,
    b.bolge_adi::text
  FROM kullanicilar k
  JOIN yonetici_scope ys ON ys.firma_id = k.firma_id
  LEFT JOIN takimlar t ON t.takim_id = k.takim_id AND t.firma_id = ys.firma_id
  LEFT JOIN bolgeler b ON b.bolge_id = k.bolge_id AND b.takim_id = k.takim_id
  WHERE k.aktif_mi = true
    AND k.rol IN ('utt','kd_utt')
    AND (
      (p_seviye = 'takim' AND p_ust_birim_id IS NULL)
      OR (p_seviye = 'bolge' AND k.takim_id = p_ust_birim_id)
      OR (p_seviye = 'utt' AND k.bolge_id = p_ust_birim_id)
    )
),
varliklar AS (
  SELECT
    CASE p_seviye
      WHEN 'takim' THEN su.takim_id
      WHEN 'bolge' THEN su.bolge_id
      WHEN 'utt' THEN su.kullanici_id
    END AS id,
    CASE p_seviye
      WHEN 'takim' THEN COALESCE(su.takim_adi, 'Takımsız')
      WHEN 'bolge' THEN COALESCE(su.bolge_adi, 'Bölgesiz')
      WHEN 'utt' THEN CONCAT(su.ad, ' ', su.soyad)
    END::text AS ad,
    su.kullanici_id
  FROM scope_users su
),
kapsam AS (
  SELECT id, ad, COUNT(DISTINCT kullanici_id)::int AS toplam
  FROM varliklar
  WHERE id IS NOT NULL
  GROUP BY id, ad
),
izleme AS (
  SELECT
    v.id,
    COUNT(DISTINCT ik.kullanici_id)::int AS aktif,
    COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
    COUNT(DISTINCT (ik.kullanici_id, ik.yayin_id))::int AS benzersiz
  FROM varliklar v
  JOIN izleme_kayitlari ik ON ik.kullanici_id = v.kullanici_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
  GROUP BY v.id
),
kazanim AS (
  SELECT
    v.id,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM varliklar v
  JOIN kazanilan_puanlar kp ON kp.kullanici_id = v.kullanici_id
  WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
  GROUP BY v.id
),
ileri_sarma AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN ileri_sarma_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
),
yanlis_cevap AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN yanlis_cevap_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
),
oneri_kaybi AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN oneri_kayip_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
),
challenge_kaybi AS (
  SELECT v.id, SUM(x.kaybedilen_puan)::int AS puan
  FROM varliklar v
  JOIN challenge_kayip_kayitlari x ON x.kullanici_id = v.kullanici_id
  WHERE x.created_at >= p_baslangic AND x.created_at <= p_bitis
  GROUP BY v.id
)
SELECT
  kp.id,
  kp.ad,
  kp.toplam,
  COALESCE(i.aktif, 0),
  COALESCE(i.tamamlanan, 0),
  COALESCE(i.benzersiz, 0),
  COALESCE(k.izleme, 0),
  COALESCE(k.cevaplama, 0),
  COALESCE(k.oneri, 0),
  COALESCE(k.extra, 0),
  COALESCE(isk.puan, 0),
  COALESCE(yc.puan, 0),
  COALESCE(oky.puan, 0),
  COALESCE(ch.puan, 0),
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0))::int,
  (COALESCE(isk.puan, 0) + COALESCE(yc.puan, 0) + COALESCE(oky.puan, 0) + COALESCE(ch.puan, 0))::int,
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0)
   - COALESCE(isk.puan, 0) - COALESCE(yc.puan, 0) - COALESCE(oky.puan, 0) - COALESCE(ch.puan, 0))::int
FROM kapsam kp
LEFT JOIN izleme i ON i.id = kp.id
LEFT JOIN kazanim k ON k.id = kp.id
LEFT JOIN ileri_sarma isk ON isk.id = kp.id
LEFT JOIN yanlis_cevap yc ON yc.id = kp.id
LEFT JOIN oneri_kaybi oky ON oky.id = kp.id
LEFT JOIN challenge_kaybi ch ON ch.id = kp.id
ORDER BY 17 DESC, 2;
$function$;

CREATE OR REPLACE FUNCTION public.get_yonetici_icerik_etkisi_v2(
  p_yonetici_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  icerik_id text,
  icerik_adi text,
  donemde_yayina_alinan integer,
  tamamlanan_izleme integer,
  izleme_puani integer,
  cevaplama_puani integer,
  oneri_puani integer,
  extra_puan integer,
  ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer,
  oneri_kaybi integer,
  challenge_kaybi integer,
  kazanilan_toplam integer,
  kaybedilen_toplam integer,
  net_puan integer,
  begeni_sayisi integer,
  favori_sayisi integer,
  extra_izleme_sayisi integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
WITH
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
    COALESCE(ky.urun_id::text, 'urun-disi') AS grup_id,
    COALESCE(u.urun_adi, 'Ürün Dışı Eğitimler')::text AS grup_adi
  FROM yayin_yonetimi yy
  JOIN v_yayin_kunye ky ON ky.yayin_id = yy.yayin_id
  JOIN yonetici_scope ys ON ys.firma_id = ky.firma_id
  LEFT JOIN urunler u ON u.urun_id = ky.urun_id
),
uretim AS (
  SELECT sy.grup_id, sy.grup_adi, COUNT(DISTINCT sy.yayin_id)::int AS adet
  FROM scope_yayinlari sy
  WHERE sy.yayina_alma_tarihi >= p_baslangic
    AND sy.yayina_alma_tarihi <= p_bitis
  GROUP BY sy.grup_id, sy.grup_adi
),
izleme AS (
  SELECT
    sy.grup_id,
    sy.grup_adi,
    COUNT(DISTINCT ik.izleme_id)::int AS tamamlanan,
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'extra')::int AS extra
  FROM izleme_kayitlari ik
  JOIN scope_users su ON su.kullanici_id = ik.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = ik.yayin_id
  WHERE ik.tamamlandi_mi = true
    AND ik.gercek_oynatma_mi = true
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) >= p_baslangic
    AND COALESCE(ik.izleme_bitis, ik.created_at, ik.izleme_baslangic) <= p_bitis
  GROUP BY sy.grup_id, sy.grup_adi
),
kazanim AS (
  SELECT
    sy.grup_id,
    sy.grup_adi,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::int AS izleme,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::int AS cevaplama,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'), 0)::int AS extra
  FROM kazanilan_puanlar kp
  JOIN scope_users su ON su.kullanici_id = kp.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = kp.yayin_id
  WHERE kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
  GROUP BY sy.grup_id, sy.grup_adi
),
kayip_hareketleri AS (
  SELECT x.kullanici_id, x.yayin_id, x.kaybedilen_puan, 'ileri'::text AS tur, x.created_at
  FROM ileri_sarma_kayitlari x
  UNION ALL
  SELECT x.kullanici_id, x.yayin_id, x.kaybedilen_puan, 'yanlis', x.created_at
  FROM yanlis_cevap_kayitlari x
  UNION ALL
  SELECT x.kullanici_id, x.yayin_id, x.kaybedilen_puan, 'oneri', x.created_at
  FROM oneri_kayip_kayitlari x
  UNION ALL
  SELECT x.kullanici_id, x.yayin_id, x.kaybedilen_puan, 'challenge', x.created_at
  FROM challenge_kayip_kayitlari x
),
kayip AS (
  SELECT
    sy.grup_id,
    sy.grup_adi,
    COALESCE(SUM(kh.kaybedilen_puan) FILTER (WHERE kh.tur = 'ileri'), 0)::int AS ileri,
    COALESCE(SUM(kh.kaybedilen_puan) FILTER (WHERE kh.tur = 'yanlis'), 0)::int AS yanlis,
    COALESCE(SUM(kh.kaybedilen_puan) FILTER (WHERE kh.tur = 'oneri'), 0)::int AS oneri,
    COALESCE(SUM(kh.kaybedilen_puan) FILTER (WHERE kh.tur = 'challenge'), 0)::int AS challenge
  FROM kayip_hareketleri kh
  JOIN scope_users su ON su.kullanici_id = kh.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = kh.yayin_id
  WHERE kh.created_at >= p_baslangic AND kh.created_at <= p_bitis
  GROUP BY sy.grup_id, sy.grup_adi
),
begeni AS (
  SELECT sy.grup_id, sy.grup_adi, COUNT(*)::int AS adet
  FROM video_begeniler vb
  JOIN scope_users su ON su.kullanici_id = vb.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = vb.yayin_id
  WHERE vb.created_at >= p_baslangic AND vb.created_at <= p_bitis
  GROUP BY sy.grup_id, sy.grup_adi
),
favori AS (
  SELECT sy.grup_id, sy.grup_adi, COUNT(*)::int AS adet
  FROM video_favoriler vf
  JOIN scope_users su ON su.kullanici_id = vf.kullanici_id
  JOIN scope_yayinlari sy ON sy.yayin_id = vf.yayin_id
  WHERE vf.created_at >= p_baslangic AND vf.created_at <= p_bitis
  GROUP BY sy.grup_id, sy.grup_adi
),
gruplar AS (
  SELECT grup_id, grup_adi FROM uretim
  UNION SELECT grup_id, grup_adi FROM izleme
  UNION SELECT grup_id, grup_adi FROM kazanim
  UNION SELECT grup_id, grup_adi FROM kayip
  UNION SELECT grup_id, grup_adi FROM begeni
  UNION SELECT grup_id, grup_adi FROM favori
)
SELECT
  g.grup_id,
  g.grup_adi,
  COALESCE(u.adet, 0),
  COALESCE(i.tamamlanan, 0),
  COALESCE(k.izleme, 0),
  COALESCE(k.cevaplama, 0),
  COALESCE(k.oneri, 0),
  COALESCE(k.extra, 0),
  COALESCE(ky.ileri, 0),
  COALESCE(ky.yanlis, 0),
  COALESCE(ky.oneri, 0),
  COALESCE(ky.challenge, 0),
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0))::int,
  (COALESCE(ky.ileri, 0) + COALESCE(ky.yanlis, 0) + COALESCE(ky.oneri, 0) + COALESCE(ky.challenge, 0))::int,
  (COALESCE(k.izleme, 0) + COALESCE(k.cevaplama, 0) + COALESCE(k.oneri, 0) + COALESCE(k.extra, 0)
   - COALESCE(ky.ileri, 0) - COALESCE(ky.yanlis, 0) - COALESCE(ky.oneri, 0) - COALESCE(ky.challenge, 0))::int,
  COALESCE(b.adet, 0),
  COALESCE(f.adet, 0),
  COALESCE(i.extra, 0)
FROM gruplar g
LEFT JOIN uretim u ON u.grup_id = g.grup_id
LEFT JOIN izleme i ON i.grup_id = g.grup_id
LEFT JOIN kazanim k ON k.grup_id = g.grup_id
LEFT JOIN kayip ky ON ky.grup_id = g.grup_id
LEFT JOIN begeni b ON b.grup_id = g.grup_id
LEFT JOIN favori f ON f.grup_id = g.grup_id
ORDER BY 15 DESC, 3 DESC, 2;
$function$;

GRANT EXECUTE ON FUNCTION public.get_yonetici_rapor_ana_ozet_v2(uuid,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_yonetici_hiyerarsi_v2(uuid,timestamptz,timestamptz,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_yonetici_icerik_etkisi_v2(uuid,timestamptz,timestamptz) TO service_role;

COMMIT;
