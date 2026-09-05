-- HapBi kanonik C-Club analitik okuma kaynağı.
-- BM'nin kişisel C-Club olgularını kişi × yayın düzeyinde, isteyenin rol ve
-- organizasyon kapsamını sunucuda çözerek döndürür.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_hapbi_cclub_analitik_v1(
  p_isteyen_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  kullanici_id uuid, kullanici_adi text, kullanici_rol text,
  firma_id uuid, firma_adi text, takim_id uuid, takim_adi text,
  bolge_id uuid, bolge_adi text, bm_id uuid, bm_adi text, bm_eslesme_durumu text,
  urun_id uuid, urun_adi text, kategori text, arac_turu text,
  yayin_id uuid, yayin_adi text,
  tamamlama_sayisi integer, benzersiz_yayin_sayisi integer,
  izleme_puani integer, cevaplama_puani integer, oneri_puani integer, extra_puan integer,
  ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, oneri_kaybi integer,
  challenge_puani integer, challenge_kaybi integer,
  kazanilan_puan integer, kaybedilen_puan integer, net_puan integer,
  cevap_sayisi integer, dogru_cevap_sayisi integer, yanlis_cevap_sayisi integer,
  gonderim_sayisi integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
WITH isteyen AS (
  SELECT k.kullanici_id, lower(k.rol)::text AS rol, k.firma_id, k.takim_id
  FROM public.kullanicilar k
  JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE k.kullanici_id = p_isteyen_id AND k.aktif_mi = true AND f.aktif = true AND f.cc_aktif = true
    AND lower(k.rol) IN (
      'bm','tm','pm','jr_pm','kd_pm','med_md','egt_md','egt_yrd_md','egt_yon','egt_uz',
      'ik_drk','ik_md','ik_yrd_md','ik_uz','ik_per','gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm'
    )
),
kapsamdaki_bm AS (
  SELECT bm.kullanici_id, bm.ad::text, bm.soyad::text, bm.firma_id, bm.takim_id, bm.bolge_id
  FROM public.kullanicilar bm CROSS JOIN isteyen i
  WHERE bm.aktif_mi = true AND lower(bm.rol) = 'bm' AND bm.firma_id = i.firma_id
    AND CASE
      WHEN i.rol = 'bm' THEN bm.kullanici_id = i.kullanici_id
      WHEN i.rol IN ('tm','pm','jr_pm','kd_pm') THEN bm.takim_id = i.takim_id
      ELSE true
    END
),
tamamlama AS (
  SELECT x.bm_id, x.yayin_id, count(*)::integer AS adet
  FROM public.cc_izleme_kayitlari x JOIN kapsamdaki_bm bm ON bm.kullanici_id = x.bm_id
  WHERE x.tamamlandi_mi = true
    AND coalesce(x.izleme_bitis, x.created_at, x.izleme_baslangic) >= p_baslangic
    AND coalesce(x.izleme_bitis, x.created_at, x.izleme_baslangic) <= p_bitis
  GROUP BY x.bm_id, x.yayin_id
),
kazanim AS (
  SELECT p.bm_id, p.yayin_id,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu = 'izleme'), 0)::integer AS izleme,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu = 'cevaplama'), 0)::integer AS cevaplama,
    count(*) FILTER (WHERE p.puan_turu = 'cevaplama')::integer AS dogru_adet,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu = 'extra'), 0)::integer AS extra,
    coalesce(sum(p.puan) FILTER (WHERE p.puan_turu IN ('cc_gonderme','cc_referral')), 0)::integer AS challenge
  FROM public.cc_kazanilan_puanlar p JOIN kapsamdaki_bm bm ON bm.kullanici_id = p.bm_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis
  GROUP BY p.bm_id, p.yayin_id
),
ileri_sarma AS (
  SELECT p.bm_id, p.yayin_id, sum(p.kaybedilen_puan)::integer AS puan
  FROM public.cc_ileri_sarma_kayitlari p JOIN kapsamdaki_bm bm ON bm.kullanici_id = p.bm_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis GROUP BY p.bm_id, p.yayin_id
),
yanlis AS (
  SELECT p.bm_id, p.yayin_id, sum(p.kaybedilen_puan)::integer AS puan, count(*)::integer AS adet
  FROM public.cc_yanlis_cevap_kayitlari p JOIN kapsamdaki_bm bm ON bm.kullanici_id = p.bm_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis GROUP BY p.bm_id, p.yayin_id
),
challenge_kaybi AS (
  SELECT p.kullanici_id AS bm_id, p.yayin_id, sum(p.kaybedilen_puan)::integer AS puan
  FROM public.challenge_kayip_kayitlari p JOIN kapsamdaki_bm bm ON bm.kullanici_id = p.kullanici_id
  WHERE p.created_at >= p_baslangic AND p.created_at <= p_bitis GROUP BY p.kullanici_id, p.yayin_id
),
gonderim AS (
  SELECT c.gonderen_id AS bm_id, c.yayin_id, count(*)::integer AS adet
  FROM public.challenge_kayitlari c JOIN kapsamdaki_bm bm ON bm.kullanici_id = c.gonderen_id
  WHERE c.created_at >= p_baslangic AND c.created_at <= p_bitis GROUP BY c.gonderen_id, c.yayin_id
),
anahtarlar AS (
  SELECT bm_id, yayin_id FROM tamamlama UNION SELECT bm_id, yayin_id FROM kazanim
  UNION SELECT bm_id, yayin_id FROM ileri_sarma UNION SELECT bm_id, yayin_id FROM yanlis
  UNION SELECT bm_id, yayin_id FROM challenge_kaybi UNION SELECT bm_id, yayin_id FROM gonderim
)
SELECT
  bm.kullanici_id, concat_ws(' ', bm.ad, bm.soyad)::text, 'bm'::text,
  bm.firma_id, f.firma_adi::text, bm.takim_id, t.takim_adi::text,
  bm.bolge_id, b.bolge_adi::text, bm.kullanici_id, concat_ws(' ', bm.ad, bm.soyad)::text, 'tek'::text,
  ky.urun_id, ur.urun_adi::text, ky.icerik_turu::text, coalesce(vyd.arac_turu, 'video')::text,
  a.yayin_id, coalesce(ur.urun_adi::text, vyd.urun_adi::text, ky.talep_no::text, a.yayin_id::text),
  coalesce(tm.adet, 0), CASE WHEN coalesce(tm.adet, 0) > 0 THEN 1 ELSE 0 END::integer,
  coalesce(k.izleme, 0), coalesce(k.cevaplama, 0), 0::integer, coalesce(k.extra, 0),
  coalesce(isr.puan, 0), coalesce(y.puan, 0), 0::integer,
  coalesce(k.challenge, 0), coalesce(ck.puan, 0),
  (coalesce(k.izleme, 0) + coalesce(k.cevaplama, 0) + coalesce(k.extra, 0) + coalesce(k.challenge, 0))::integer,
  (coalesce(isr.puan, 0) + coalesce(y.puan, 0) + coalesce(ck.puan, 0))::integer,
  (coalesce(k.izleme, 0) + coalesce(k.cevaplama, 0) + coalesce(k.extra, 0) + coalesce(k.challenge, 0)
    - coalesce(isr.puan, 0) - coalesce(y.puan, 0) - coalesce(ck.puan, 0))::integer,
  (coalesce(k.dogru_adet, 0) + coalesce(y.adet, 0))::integer,
  coalesce(k.dogru_adet, 0),
  coalesce(y.adet, 0), coalesce(g.adet, 0)
FROM anahtarlar a
JOIN kapsamdaki_bm bm ON bm.kullanici_id = a.bm_id
JOIN public.v_yayin_kunye ky ON ky.yayin_id = a.yayin_id
LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = a.yayin_id
LEFT JOIN public.firmalar f ON f.firma_id = bm.firma_id
LEFT JOIN public.takimlar t ON t.takim_id = bm.takim_id AND t.firma_id = bm.firma_id
LEFT JOIN public.bolgeler b ON b.bolge_id = bm.bolge_id AND b.takim_id = bm.takim_id
LEFT JOIN public.urunler ur ON ur.urun_id = ky.urun_id
LEFT JOIN tamamlama tm ON tm.bm_id = a.bm_id AND tm.yayin_id = a.yayin_id
LEFT JOIN kazanim k ON k.bm_id = a.bm_id AND k.yayin_id = a.yayin_id
LEFT JOIN ileri_sarma isr ON isr.bm_id = a.bm_id AND isr.yayin_id = a.yayin_id
LEFT JOIN yanlis y ON y.bm_id = a.bm_id AND y.yayin_id = a.yayin_id
LEFT JOIN challenge_kaybi ck ON ck.bm_id = a.bm_id AND ck.yayin_id = a.yayin_id
LEFT JOIN gonderim g ON g.bm_id = a.bm_id AND g.yayin_id = a.yayin_id
ORDER BY bm.kullanici_id, a.yayin_id;
$function$;

REVOKE ALL ON FUNCTION public.get_hapbi_cclub_analitik_v1(uuid,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hapbi_cclub_analitik_v1(uuid,timestamptz,timestamptz)
  TO service_role;

COMMIT;

SELECT to_regprocedure(
  'public.get_hapbi_cclub_analitik_v1(uuid,timestamp with time zone,timestamp with time zone)'
) IS NOT NULL AS hapbi_cclub_analitik_kaynagi_kuruldu;
