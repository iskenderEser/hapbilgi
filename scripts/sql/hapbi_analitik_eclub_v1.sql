-- HapBi E-Club yönetim analitik kaynağı.
-- Mevcut UTT rapor sözleşmesini sunucuda çözülen bütün yetkili UTT kapsamı için
-- tek RPC çağrısında çalıştırır; uygulamadaki seri ağ çağrısını kaldırır.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_hapbi_eclub_analitik_v1(
  p_isteyen_id uuid,
  p_baslangic timestamptz,
  p_bitis_haric timestamptz
)
RETURNS TABLE(
  utt_id uuid, utt_adi text,
  firma_id uuid, firma_adi text,
  takim_id uuid, takim_adi text,
  bolge_id uuid, bolge_adi text,
  bm_id uuid, bm_adi text, bm_eslesme_durumu text,
  eczane_id uuid, gln text, eczane_adi text,
  kisi_id uuid, kisi_adi text, kisi_rol text,
  icerik_anahtari text, icerik_adi text,
  urun_id uuid, urun_adi text,
  gonderim_sayisi integer, tamamlama_sayisi integer,
  dogru_cevap_sayisi integer, yanlis_cevap_sayisi integer,
  izleme_puani integer, cevaplama_puani integer,
  ileri_sarma_kaybi integer,
  kazanilan_puan integer, kaybedilen_puan integer, net_puan integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
WITH isteyen AS (
  SELECT k.kullanici_id, lower(k.rol)::text AS rol, k.firma_id, k.takim_id, k.bolge_id
  FROM public.kullanicilar k JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE k.kullanici_id = p_isteyen_id AND k.aktif_mi = true AND f.aktif = true AND f.eclub_aktif = true
    AND lower(k.rol) IN (
      'utt','kd_utt','bm','tm','pm','jr_pm','kd_pm','med_md','egt_md','egt_yrd_md','egt_yon','egt_uz',
      'ik_drk','ik_md','ik_yrd_md','ik_uz','ik_per','gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm'
    )
),
kapsamdaki_utt AS (
  SELECT u.kullanici_id AS utt_id, concat_ws(' ', u.ad, u.soyad)::text AS utt_adi,
    u.firma_id, u.takim_id, u.bolge_id
  FROM public.kullanicilar u CROSS JOIN isteyen i
  WHERE u.aktif_mi = true AND lower(u.rol) IN ('utt','kd_utt') AND u.firma_id = i.firma_id
    AND CASE
      WHEN i.rol IN ('utt','kd_utt') THEN u.kullanici_id = i.kullanici_id
      WHEN i.rol = 'bm' THEN u.takim_id = i.takim_id AND u.bolge_id = i.bolge_id
      WHEN i.rol IN ('tm','pm','jr_pm','kd_pm') THEN u.takim_id = i.takim_id
      ELSE true
    END
),
bm_adaylari AS (
  SELECT bm.firma_id, bm.takim_id, bm.bolge_id, count(*)::integer AS bm_sayisi,
    min(bm.kullanici_id::text)::uuid AS bm_id
  FROM public.kullanicilar bm
  WHERE bm.aktif_mi = true AND lower(bm.rol) = 'bm'
  GROUP BY bm.firma_id, bm.takim_id, bm.bolge_id
),
rapor AS (
  SELECT
    u.utt_id, u.utt_adi, u.firma_id, u.takim_id, u.bolge_id,
    r.eczane_id, r.gln, r.eczane_adi,
    r.kisi_id, r.kisi_ad, r.kisi_soyad, r.kisi_rol,
    r.icerik_anahtari, r.icerik_adi,
    r.gonderilen_sayisi, r.tamamlanan_izleme,
    r.dogru_cevap, r.yanlis_cevap,
    r.izleme_puani, r.cevaplama_puani
  FROM kapsamdaki_utt u
  CROSS JOIN LATERAL public.get_eclub_utt_rapor(
    u.utt_id,
    p_baslangic,
    p_bitis_haric
  ) r
),
kisi_bilgi AS (
  SELECT DISTINCT ON (r.utt_id, r.kisi_id)
    r.utt_id, r.kisi_id, r.eczane_id, r.gln, r.eczane_adi,
    r.kisi_ad, r.kisi_soyad, r.kisi_rol
  FROM rapor r
  WHERE r.kisi_id IS NOT NULL
  ORDER BY r.utt_id, r.kisi_id, r.eczane_id
),
kayip AS (
  SELECT
    u.utt_id,
    l.kisi_id,
    COALESCE(ky.urun_id::text, ky.teknik_id::text, l.yayin_id::text) AS icerik_anahtari,
    COALESCE(vd.urun_adi, vd.teknik_adi, 'Diğer')::text AS icerik_adi,
    COALESCE(SUM(l.kaybedilen_puan), 0)::bigint AS ileri_sarma_kaybi
  FROM kapsamdaki_utt u
  JOIN public.eclub_oneri_kayitlari o ON o.oneren_id = u.utt_id
  JOIN public.eclub_izleme_kayitlari iz ON iz.oneri_id = o.oneri_id
  JOIN public.eclub_ileri_sarma_kayitlari l ON l.izleme_id = iz.izleme_id
  LEFT JOIN public.v_yayin_kunye ky ON ky.yayin_id = l.yayin_id
  LEFT JOIN public.v_yayin_detay vd ON vd.yayin_id = l.yayin_id
  WHERE l.created_at >= p_baslangic
    AND l.created_at < p_bitis_haric
  GROUP BY
    u.utt_id, l.kisi_id,
    COALESCE(ky.urun_id::text, ky.teknik_id::text, l.yayin_id::text),
    COALESCE(vd.urun_adi, vd.teknik_adi, 'Diğer')::text
),
anahtar AS (
  SELECT r.utt_id, r.kisi_id, r.icerik_anahtari, r.icerik_adi
  FROM rapor r
  WHERE r.kisi_id IS NOT NULL AND r.icerik_anahtari IS NOT NULL
  UNION
  SELECT k.utt_id, k.kisi_id, k.icerik_anahtari, k.icerik_adi
  FROM kayip k
)
SELECT
  u.utt_id, u.utt_adi, u.firma_id, f.firma_adi::text, u.takim_id, t.takim_adi::text,
  u.bolge_id, b.bolge_adi::text,
  CASE WHEN ba.bm_sayisi = 1 THEN ba.bm_id END,
  CASE WHEN ba.bm_sayisi = 1 THEN concat_ws(' ', bm.ad, bm.soyad)::text END,
  CASE WHEN coalesce(ba.bm_sayisi, 0) = 0 THEN 'yok' WHEN ba.bm_sayisi = 1 THEN 'tek' ELSE 'coklu' END::text,
  kb.eczane_id, kb.gln::text, kb.eczane_adi::text,
  a.kisi_id, concat_ws(' ', kb.kisi_ad, kb.kisi_soyad)::text, kb.kisi_rol::text,
  a.icerik_anahtari, a.icerik_adi,
  ur.urun_id, ur.urun_adi::text,
  coalesce(r.gonderilen_sayisi, 0)::integer, coalesce(r.tamamlanan_izleme, 0)::integer,
  coalesce(r.dogru_cevap, 0)::integer, coalesce(r.yanlis_cevap, 0)::integer,
  coalesce(r.izleme_puani, 0)::integer, coalesce(r.cevaplama_puani, 0)::integer,
  coalesce(k.ileri_sarma_kaybi, 0)::integer,
  (coalesce(r.izleme_puani, 0) + coalesce(r.cevaplama_puani, 0))::integer,
  coalesce(k.ileri_sarma_kaybi, 0)::integer,
  (
    coalesce(r.izleme_puani, 0)
    + coalesce(r.cevaplama_puani, 0)
    - coalesce(k.ileri_sarma_kaybi, 0)
  )::integer
FROM kapsamdaki_utt u
JOIN anahtar a ON a.utt_id = u.utt_id
LEFT JOIN rapor r
  ON r.utt_id = a.utt_id
 AND r.kisi_id = a.kisi_id
 AND r.icerik_anahtari = a.icerik_anahtari
LEFT JOIN kayip k
  ON k.utt_id = a.utt_id
 AND k.kisi_id = a.kisi_id
 AND k.icerik_anahtari = a.icerik_anahtari
LEFT JOIN kisi_bilgi kb ON kb.utt_id = a.utt_id AND kb.kisi_id = a.kisi_id
LEFT JOIN public.firmalar f ON f.firma_id = u.firma_id
LEFT JOIN public.takimlar t ON t.takim_id = u.takim_id AND t.firma_id = u.firma_id
LEFT JOIN public.bolgeler b ON b.bolge_id = u.bolge_id AND b.takim_id = u.takim_id
LEFT JOIN bm_adaylari ba ON ba.firma_id = u.firma_id AND ba.takim_id = u.takim_id AND ba.bolge_id = u.bolge_id
LEFT JOIN public.kullanicilar bm ON bm.kullanici_id = ba.bm_id AND ba.bm_sayisi = 1
LEFT JOIN public.urunler ur ON ur.urun_id::text = a.icerik_anahtari
ORDER BY u.utt_id, kb.eczane_id, a.kisi_id, a.icerik_anahtari;
$function$;

REVOKE ALL ON FUNCTION public.get_hapbi_eclub_analitik_v1(uuid,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hapbi_eclub_analitik_v1(uuid,timestamptz,timestamptz)
  TO service_role;

COMMIT;

SELECT to_regprocedure(
  'public.get_hapbi_eclub_analitik_v1(uuid,timestamp with time zone,timestamp with time zone)'
) IS NOT NULL AS hapbi_eclub_analitik_kaynagi_kuruldu;
