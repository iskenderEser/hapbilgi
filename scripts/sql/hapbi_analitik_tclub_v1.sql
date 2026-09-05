-- HapBi kanonik T-Club analitik okuma kaynağı.
-- Kişi × yayın düzeyindeki olguları döndürür; üst toplamlar uygulamadaki
-- sürümlü analitik sözleşmeyle, kimlikler korunarak oluşturulur.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_hapbi_tclub_analitik_v1(
  p_isteyen_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  kullanici_id uuid,
  kullanici_adi text,
  kullanici_rol text,
  firma_id uuid,
  firma_adi text,
  takim_id uuid,
  takim_adi text,
  bolge_id uuid,
  bolge_adi text,
  bm_id uuid,
  bm_adi text,
  bm_eslesme_durumu text,
  urun_id uuid,
  urun_adi text,
  kategori text,
  arac_turu text,
  yayin_id uuid,
  yayin_adi text,
  tamamlama_sayisi integer,
  benzersiz_yayin_sayisi integer,
  izleme_puani integer,
  cevaplama_puani integer,
  oneri_puani integer,
  extra_puan integer,
  ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer,
  oneri_kaybi integer,
  challenge_puani integer,
  challenge_kaybi integer,
  kazanilan_puan integer,
  kaybedilen_puan integer,
  net_puan integer,
  cevap_sayisi integer,
  dogru_cevap_sayisi integer,
  yanlis_cevap_sayisi integer,
  gonderim_sayisi integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
WITH isteyen AS (
  SELECT k.kullanici_id, lower(k.rol)::text AS rol, k.firma_id, k.takim_id, k.bolge_id
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_isteyen_id
    AND k.aktif_mi = true
    AND lower(k.rol) IN (
      'utt','kd_utt','bm','tm',
      'pm','jr_pm','kd_pm','med_md',
      'egt_md','egt_yrd_md','egt_yon','egt_uz',
      'ik_drk','ik_md','ik_yrd_md','ik_uz','ik_per',
      'gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm'
    )
),
kapsamdaki_utt AS (
  SELECT u.kullanici_id, lower(u.rol)::text AS kullanici_rol,
    u.ad::text, u.soyad::text, u.firma_id, u.takim_id, u.bolge_id
  FROM public.kullanicilar u
  CROSS JOIN isteyen i
  WHERE u.aktif_mi = true
    AND lower(u.rol) IN ('utt','kd_utt')
    AND u.firma_id = i.firma_id
    AND CASE
      WHEN i.rol IN ('utt','kd_utt') THEN u.kullanici_id = i.kullanici_id
      WHEN i.rol = 'bm' THEN u.takim_id = i.takim_id AND u.bolge_id = i.bolge_id
      WHEN i.rol IN ('tm','pm','jr_pm','kd_pm') THEN u.takim_id = i.takim_id
      ELSE true
    END
),
bm_adaylari AS (
  SELECT bm.firma_id, bm.takim_id, bm.bolge_id,
    count(*)::integer AS bm_sayisi,
    min(bm.kullanici_id::text)::uuid AS bm_id
  FROM public.kullanicilar bm
  WHERE bm.aktif_mi = true AND lower(bm.rol) = 'bm'
  GROUP BY bm.firma_id, bm.takim_id, bm.bolge_id
),
tamamlama AS (
  SELECT i.kullanici_id, i.yayin_id, count(*)::integer AS adet
  FROM public.izleme_kayitlari i
  JOIN kapsamdaki_utt u ON u.kullanici_id = i.kullanici_id
  WHERE i.tamamlandi_mi = true
    AND i.gercek_oynatma_mi = true
    AND coalesce(i.izleme_bitis, i.created_at, i.izleme_baslangic) >= p_baslangic
    AND coalesce(i.izleme_bitis, i.created_at, i.izleme_baslangic) <= p_bitis
  GROUP BY i.kullanici_id, i.yayin_id
),
kazanim AS (
  SELECT p.kullanici_id, p.yayin_id,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu = 'izleme'), 0)::integer AS izleme,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu = 'cevaplama'), 0)::integer AS cevaplama,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu = 'oneri'), 0)::integer AS oneri,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu = 'extra'), 0)::integer AS extra
  FROM public.kazanilan_puanlar p
  JOIN kapsamdaki_utt u ON u.kullanici_id = p.kullanici_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis
  GROUP BY p.kullanici_id, p.yayin_id
),
ileri_sarma AS (
  SELECT p.kullanici_id, p.yayin_id, sum(p.kaybedilen_puan)::integer AS puan
  FROM public.ileri_sarma_kayitlari p
  JOIN kapsamdaki_utt u ON u.kullanici_id = p.kullanici_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis
  GROUP BY p.kullanici_id, p.yayin_id
),
yanlis_cevap_kaybi AS (
  SELECT p.kullanici_id, p.yayin_id, sum(p.kaybedilen_puan)::integer AS puan
  FROM public.yanlis_cevap_kayitlari p
  JOIN kapsamdaki_utt u ON u.kullanici_id = p.kullanici_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis
  GROUP BY p.kullanici_id, p.yayin_id
),
oneri_kaybi AS (
  SELECT p.kullanici_id, p.yayin_id, sum(p.kaybedilen_puan)::integer AS puan
  FROM public.oneri_kayip_kayitlari p
  JOIN kapsamdaki_utt u ON u.kullanici_id = p.kullanici_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis
  GROUP BY p.kullanici_id, p.yayin_id
),
cevaplar AS (
  SELECT c.kullanici_id, i.yayin_id, count(*)::integer AS toplam,
    count(*) FILTER (WHERE c.dogru_mu = true)::integer AS dogru,
    count(*) FILTER (WHERE c.dogru_mu = false)::integer AS yanlis
  FROM public.soru_cevaplari c
  JOIN public.izleme_kayitlari i ON i.izleme_id = c.izleme_id
  JOIN kapsamdaki_utt u ON u.kullanici_id = c.kullanici_id
  WHERE c.created_at >= p_baslangic AND c.created_at <= p_bitis
  GROUP BY c.kullanici_id, i.yayin_id
),
oneriler AS (
  SELECT o.kullanici_id, o.yayin_id, count(*)::integer AS adet
  FROM public.oneri_kayitlari o
  JOIN kapsamdaki_utt u ON u.kullanici_id = o.kullanici_id
  WHERE coalesce(o.created_at, o.oneri_baslangic) >= p_baslangic
    AND coalesce(o.created_at, o.oneri_baslangic) <= p_bitis
  GROUP BY o.kullanici_id, o.yayin_id
),
anahtarlar AS (
  SELECT kullanici_id, yayin_id FROM tamamlama
  UNION SELECT kullanici_id, yayin_id FROM kazanim
  UNION SELECT kullanici_id, yayin_id FROM ileri_sarma
  UNION SELECT kullanici_id, yayin_id FROM yanlis_cevap_kaybi
  UNION SELECT kullanici_id, yayin_id FROM oneri_kaybi
  UNION SELECT kullanici_id, yayin_id FROM cevaplar
  UNION SELECT kullanici_id, yayin_id FROM oneriler
)
SELECT
  u.kullanici_id,
  concat_ws(' ', u.ad, u.soyad)::text AS kullanici_adi,
  u.kullanici_rol,
  u.firma_id,
  f.firma_adi::text,
  u.takim_id,
  t.takim_adi::text,
  u.bolge_id,
  b.bolge_adi::text,
  CASE WHEN ba.bm_sayisi = 1 THEN ba.bm_id END,
  CASE WHEN ba.bm_sayisi = 1 THEN concat_ws(' ', bm.ad, bm.soyad)::text END,
  CASE WHEN coalesce(ba.bm_sayisi, 0) = 0 THEN 'yok'
       WHEN ba.bm_sayisi = 1 THEN 'tek'
       ELSE 'coklu' END::text,
  ky.urun_id,
  ur.urun_adi::text,
  ky.icerik_turu::text,
  coalesce(vyd.arac_turu, 'video')::text,
  a.yayin_id,
  coalesce(ur.urun_adi::text, vyd.urun_adi::text, ky.talep_no::text, a.yayin_id::text),
  coalesce(tm.adet, 0),
  CASE WHEN coalesce(tm.adet, 0) > 0 THEN 1 ELSE 0 END::integer,
  coalesce(k.izleme, 0),
  coalesce(k.cevaplama, 0),
  coalesce(k.oneri, 0),
  coalesce(k.extra, 0),
  coalesce(isr.puan, 0),
  coalesce(yck.puan, 0),
  coalesce(okp.puan, 0),
  0::integer,
  0::integer,
  (coalesce(k.izleme, 0) + coalesce(k.cevaplama, 0) + coalesce(k.oneri, 0) + coalesce(k.extra, 0))::integer,
  (coalesce(isr.puan, 0) + coalesce(yck.puan, 0) + coalesce(okp.puan, 0))::integer,
  (coalesce(k.izleme, 0) + coalesce(k.cevaplama, 0) + coalesce(k.oneri, 0) + coalesce(k.extra, 0)
    - coalesce(isr.puan, 0) - coalesce(yck.puan, 0) - coalesce(okp.puan, 0))::integer,
  coalesce(cv.toplam, 0),
  coalesce(cv.dogru, 0),
  coalesce(cv.yanlis, 0),
  coalesce(oner.adet, 0)
FROM anahtarlar a
JOIN kapsamdaki_utt u ON u.kullanici_id = a.kullanici_id
JOIN public.v_yayin_kunye ky ON ky.yayin_id = a.yayin_id
LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = a.yayin_id
LEFT JOIN public.firmalar f ON f.firma_id = u.firma_id
LEFT JOIN public.takimlar t ON t.takim_id = u.takim_id AND t.firma_id = u.firma_id
LEFT JOIN public.bolgeler b ON b.bolge_id = u.bolge_id AND b.takim_id = u.takim_id
LEFT JOIN bm_adaylari ba ON ba.firma_id = u.firma_id AND ba.takim_id = u.takim_id AND ba.bolge_id = u.bolge_id
LEFT JOIN public.kullanicilar bm ON bm.kullanici_id = ba.bm_id AND ba.bm_sayisi = 1
LEFT JOIN public.urunler ur ON ur.urun_id = ky.urun_id
LEFT JOIN tamamlama tm ON tm.kullanici_id = a.kullanici_id AND tm.yayin_id = a.yayin_id
LEFT JOIN kazanim k ON k.kullanici_id = a.kullanici_id AND k.yayin_id = a.yayin_id
LEFT JOIN ileri_sarma isr ON isr.kullanici_id = a.kullanici_id AND isr.yayin_id = a.yayin_id
LEFT JOIN yanlis_cevap_kaybi yck ON yck.kullanici_id = a.kullanici_id AND yck.yayin_id = a.yayin_id
LEFT JOIN oneri_kaybi okp ON okp.kullanici_id = a.kullanici_id AND okp.yayin_id = a.yayin_id
LEFT JOIN cevaplar cv ON cv.kullanici_id = a.kullanici_id AND cv.yayin_id = a.yayin_id
LEFT JOIN oneriler oner ON oner.kullanici_id = a.kullanici_id AND oner.yayin_id = a.yayin_id
ORDER BY u.kullanici_id, a.yayin_id;
$function$;

REVOKE ALL ON FUNCTION public.get_hapbi_tclub_analitik_v1(uuid,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hapbi_tclub_analitik_v1(uuid,timestamptz,timestamptz)
  TO service_role;

COMMIT;

SELECT to_regprocedure(
  'public.get_hapbi_tclub_analitik_v1(uuid,timestamp with time zone,timestamp with time zone)'
) IS NOT NULL AS hapbi_tclub_analitik_kaynagi_kuruldu;
