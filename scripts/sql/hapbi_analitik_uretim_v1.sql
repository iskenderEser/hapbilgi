-- HapBi üretim/yayın analitik kaynağı.
-- Talep, üretim görevi ve yayın olaylarını aynı yetki kontrollü veri kümesinde
-- sunar. PM ailesi takımını; diğer üretici ve yönetici roller firmayı görür.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_hapbi_uretim_analitik_v1(
  p_isteyen_id uuid,
  p_baslangic timestamptz,
  p_bitis_haric timestamptz
)
RETURNS TABLE(
  olay_id uuid, olay_turu text, olay_tarihi timestamptz,
  talep_id uuid, talep_adi text,
  firma_id uuid, firma_adi text,
  takim_id uuid, takim_adi text,
  kullanici_id uuid, kullanici_adi text, kullanici_rol text,
  urun_id uuid, urun_adi text,
  kategori text, arac_turu text,
  yayin_id uuid, yayin_adi text,
  durum text, uretim_varyanti text,
  talep_sayisi integer, gorev_sayisi integer, yayin_sayisi integer
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
  WHERE k.kullanici_id = p_isteyen_id
    AND k.aktif_mi = true
    AND f.aktif = true
    AND lower(k.rol) IN (
      'pm','jr_pm','kd_pm','med_md','egt_md','egt_yrd_md','egt_yon','egt_uz',
      'ik_drk','ik_md','ik_yrd_md','ik_uz','ik_per',
      'gm','gm_yrd','drk','paz_md','blm_md','grp_pm','sm'
    )
),
kapsamdaki_talepler AS (
  SELECT t.*
  FROM public.talepler t
  CROSS JOIN isteyen i
  WHERE t.firma_id = i.firma_id
    AND CASE
      WHEN i.rol IN ('pm','jr_pm','kd_pm') THEN t.takim_id = i.takim_id
      ELSE true
    END
),
olaylar AS (
  SELECT
    t.talep_id AS olay_id,
    'talep'::text AS olay_turu,
    t.created_at AS olay_tarihi,
    t.talep_id,
    t.uretici_id AS kullanici_id,
    NULL::uuid AS yayin_id,
    'talep_olusturuldu'::text AS durum,
    1::integer AS talep_sayisi,
    0::integer AS gorev_sayisi,
    0::integer AS yayin_sayisi
  FROM kapsamdaki_talepler t
  WHERE t.created_at >= p_baslangic AND t.created_at < p_bitis_haric

  UNION ALL

  SELECT
    g.gorev_id,
    'gorev'::text,
    g.created_at,
    g.talep_id,
    COALESCE(g.atanan_iu_id, t.uretici_id),
    NULL::uuid,
    g.durum::text,
    0::integer,
    1::integer,
    0::integer
  FROM public.uretim_gorevleri g
  JOIN kapsamdaki_talepler t ON t.talep_id = g.talep_id
  WHERE g.created_at >= p_baslangic AND g.created_at < p_bitis_haric

  UNION ALL

  SELECT
    y.yayin_id,
    'yayin'::text,
    COALESCE(y.yayin_tarihi, y.created_at),
    t.talep_id,
    t.uretici_id,
    y.yayin_id,
    y.durum::text,
    0::integer,
    0::integer,
    1::integer
  FROM public.yayin_yonetimi y
  JOIN public.v_yayin_kunye ky ON ky.yayin_id = y.yayin_id
  JOIN kapsamdaki_talepler t ON t.talep_id = ky.talep_id
  WHERE COALESCE(y.yayin_tarihi, y.created_at) >= p_baslangic
    AND COALESCE(y.yayin_tarihi, y.created_at) < p_bitis_haric
)
SELECT
  o.olay_id,
  o.olay_turu,
  o.olay_tarihi,
  t.talep_id,
  COALESCE(t.talep_no_goster, t.talep_no::text)::text,
  t.firma_id,
  f.firma_adi::text,
  t.takim_id,
  tk.takim_adi::text,
  o.kullanici_id,
  concat_ws(' ', k.ad, k.soyad)::text,
  lower(k.rol)::text,
  t.urun_id,
  COALESCE(u.urun_adi, t.urun_adi)::text,
  t.egitim_turu::text,
  t.ogrenme_araci_turu::text,
  o.yayin_id,
  COALESCE(u.urun_adi, t.urun_adi, tek.teknik_adi, t.teknik_adi, t.talep_no_goster, t.talep_no::text)::text,
  o.durum,
  CASE
    WHEN COALESCE(t.hazir_video, false) AND COALESCE(t.hazir_soru_seti, false) THEN 'hazir_arac_ve_soru_seti'
    WHEN COALESCE(t.hazir_video, false) THEN 'hazir_ogrenme_araci'
    WHEN COALESCE(t.hazir_soru_seti, false) THEN 'hazir_soru_seti'
    ELSE 'tam_uretim'
  END::text,
  o.talep_sayisi,
  o.gorev_sayisi,
  o.yayin_sayisi
FROM olaylar o
JOIN kapsamdaki_talepler t ON t.talep_id = o.talep_id
LEFT JOIN public.firmalar f ON f.firma_id = t.firma_id
LEFT JOIN public.takimlar tk ON tk.takim_id = t.takim_id AND tk.firma_id = t.firma_id
LEFT JOIN public.kullanicilar k ON k.kullanici_id = o.kullanici_id
LEFT JOIN public.urunler u ON u.urun_id = t.urun_id
LEFT JOIN public.teknikler tek ON tek.teknik_id = t.teknik_id
ORDER BY o.olay_tarihi, o.olay_id;
$function$;

REVOKE ALL ON FUNCTION public.get_hapbi_uretim_analitik_v1(uuid,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hapbi_uretim_analitik_v1(uuid,timestamptz,timestamptz)
  TO service_role;

COMMIT;

SELECT to_regprocedure(
  'public.get_hapbi_uretim_analitik_v1(uuid,timestamp with time zone,timestamp with time zone)'
) IS NOT NULL AS hapbi_uretim_analitik_kaynagi_kuruldu;
