-- scripts/sql/eczanem_musteri_ad_soyad_ayrimi.sql
--
-- Eczanem müşterilerinde ad/soyad ayrımı:
-- 1. eczanem_musteriler tablosuna ad ve soyad sütunları eklenir.
-- 2. Mevcut kayıtlar adSoyadBicimle kuralına uygun biçimde ad ve soyad'a ayrıştırılır.
-- 3. v_auth_kimlik ve v_auth_kimlik_admin view'ları m.ad ve m.soyad'ı doğrudan okuyacak şekilde güncellenir.
-- 4. Yeni müşteri provizyon RPC'si (eczanem_yeni_musteri_provizyonu_izli) ad ve soyad sütunlarını yazacak şekilde güncellenir.

BEGIN;

-- 1. Kolonları ekle
ALTER TABLE public.eczanem_musteriler ADD COLUMN IF NOT EXISTS ad varchar;
ALTER TABLE public.eczanem_musteriler ADD COLUMN IF NOT EXISTS soyad varchar;

-- 2. Mevcut kayıtları doldur
UPDATE public.eczanem_musteriler
SET
  ad = CASE
    WHEN position(' ' in trim(regexp_replace(ad_soyad, '\s+', ' ', 'g'))) > 0 THEN
      split_part(trim(regexp_replace(ad_soyad, '\s+', ' ', 'g')), ' ', 1)
    ELSE trim(ad_soyad)
  END,
  soyad = CASE
    WHEN position(' ' in trim(regexp_replace(ad_soyad, '\s+', ' ', 'g'))) > 0 THEN
      substr(
        trim(regexp_replace(ad_soyad, '\s+', ' ', 'g')),
        length(split_part(trim(regexp_replace(ad_soyad, '\s+', ' ', 'g')), ' ', 1)) + 2
      )
    ELSE ''
  END
WHERE ad IS NULL OR soyad IS NULL;

-- 3. Kolonları zorunlu yap
ALTER TABLE public.eczanem_musteriler ALTER COLUMN ad SET NOT NULL;
ALTER TABLE public.eczanem_musteriler ALTER COLUMN soyad SET NOT NULL;

-- 4. Senkronizasyon tetikleyicisi (ad, soyad ve ad_soyad çift yönlü uyumu)
CREATE OR REPLACE FUNCTION public.hapbilgi_eczanem_musteri_ad_soyad_senk_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $trg$
BEGIN
  IF (NEW.ad IS NOT NULL OR NEW.soyad IS NOT NULL) THEN
    NEW.ad_soyad := trim(concat_ws(' ', NEW.ad, NEW.soyad));
  ELSIF (NEW.ad IS NULL AND NEW.ad_soyad IS NOT NULL) THEN
    NEW.ad := split_part(trim(NEW.ad_soyad), ' ', 1);
    NEW.soyad := substr(trim(NEW.ad_soyad), length(split_part(trim(NEW.ad_soyad), ' ', 1)) + 2);
  END IF;
  RETURN NEW;
END;
$trg$;

DROP TRIGGER IF EXISTS trg_eczanem_musteriler_ad_soyad_senk ON public.eczanem_musteriler;
CREATE TRIGGER trg_eczanem_musteriler_ad_soyad_senk
BEFORE INSERT OR UPDATE OF ad, soyad, ad_soyad ON public.eczanem_musteriler
FOR EACH ROW
EXECUTE FUNCTION public.hapbilgi_eczanem_musteri_ad_soyad_senk_trg();

-- 5. v_auth_kimlik view'ı
CREATE OR REPLACE VIEW public.v_auth_kimlik AS
SELECT k.kullanici_id AS auth_id,
  'kullanici'::text AS kimlik_turu,
  k.kullanici_id AS kimlik_id,
  k.ad,
  k.soyad,
  k.eposta,
  NULL::character varying AS telefon,
  k.rol,
  k.aktif_mi,
  k.firma_id,
  k.takim_id,
  k.bolge_id,
  k.fotograf_url,
  k.created_at
 FROM kullanicilar k
WHERE (k.kullanici_id = auth.uid())
UNION ALL
SELECT ek.auth_user_id AS auth_id,
  'eclub_kisi'::text AS kimlik_turu,
  ek.kisi_id AS kimlik_id,
  ek.ad,
  ek.soyad,
  ek.eposta,
  ek.telefon,
  ek.rol,
  true AS aktif_mi,
  NULL::uuid AS firma_id,
  NULL::uuid AS takim_id,
  NULL::uuid AS bolge_id,
  NULL::character varying AS fotograf_url,
  ek.created_at
 FROM eclub_kisiler ek
WHERE (ek.auth_user_id = auth.uid())
UNION ALL
SELECT m.auth_user_id AS auth_id,
  'musteri'::text AS kimlik_turu,
  m.musteri_id AS kimlik_id,
  m.ad,
  m.soyad,
  NULL::character varying AS eposta,
  m.telefon,
  'musteri'::character varying AS rol,
  m.aktif_mi,
  NULL::uuid AS firma_id,
  NULL::uuid AS takim_id,
  NULL::uuid AS bolge_id,
  NULL::character varying AS fotograf_url,
  m.created_at
 FROM eczanem_musteriler m
WHERE ((m.auth_user_id = auth.uid()) AND (m.aktif_mi = true));

-- 6. v_auth_kimlik_admin view'ı
CREATE OR REPLACE VIEW public.v_auth_kimlik_admin AS
SELECT k.kullanici_id AS auth_id,
  'kullanici'::text AS kimlik_turu,
  k.kullanici_id AS kimlik_id,
  k.ad,
  k.soyad,
  k.eposta,
  NULL::character varying AS telefon,
  k.rol,
  k.aktif_mi,
  k.firma_id,
  k.takim_id,
  k.bolge_id,
  k.fotograf_url,
  k.created_at
 FROM kullanicilar k
UNION ALL
SELECT ek.auth_user_id AS auth_id,
  'eclub_kisi'::text AS kimlik_turu,
  ek.kisi_id AS kimlik_id,
  ek.ad,
  ek.soyad,
  ek.eposta,
  ek.telefon,
  ek.rol,
  true AS aktif_mi,
  NULL::uuid AS firma_id,
  NULL::uuid AS takim_id,
  NULL::uuid AS bolge_id,
  NULL::character varying AS fotograf_url,
  ek.created_at
 FROM eclub_kisiler ek
UNION ALL
SELECT m.auth_user_id AS auth_id,
  'musteri'::text AS kimlik_turu,
  m.musteri_id AS kimlik_id,
  m.ad,
  m.soyad,
  NULL::character varying AS eposta,
  m.telefon,
  'musteri'::character varying AS rol,
  m.aktif_mi,
  NULL::uuid AS firma_id,
  NULL::uuid AS takim_id,
  NULL::uuid AS bolge_id,
  NULL::character varying AS fotograf_url,
  m.created_at
 FROM eczanem_musteriler m
WHERE (m.aktif_mi = true);

GRANT SELECT ON public.v_auth_kimlik TO authenticated, service_role;
REVOKE ALL ON public.v_auth_kimlik_admin FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_auth_kimlik_admin TO service_role;

-- 7. Müşteri provizyon RPC'si
CREATE OR REPLACE FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(
  p_telefon text,
  p_ad_soyad text,
  p_auth_user_id uuid,
  p_eczane_id uuid,
  p_islem_yapan_kisi_id uuid,
  p_ad text DEFAULT NULL,
  p_soyad text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri_id uuid;
  v_uyelik_id uuid;
  v_ad text;
  v_soyad text;
  v_ad_soyad text;
BEGIN
  IF NOT public.eczanem_personel_eczane_yetkili_mi(p_islem_yapan_kisi_id, p_eczane_id) THEN
    RAISE EXCEPTION 'Bu eczanede aktif işlem yetkiniz yok.' USING ERRCODE = 'P0001';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Müşteri Auth kimliği olmadan aktifleştirilemez.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users au
    WHERE au.id = p_auth_user_id
  ) THEN
    RAISE EXCEPTION 'Müşteri Auth hesabı bulunamadı.' USING ERRCODE = 'P0001';
  END IF;

  v_ad := COALESCE(NULLIF(trim(p_ad), ''), split_part(trim(p_ad_soyad), ' ', 1));
  v_soyad := COALESCE(NULLIF(trim(p_soyad), ''), substr(trim(p_ad_soyad), length(split_part(trim(p_ad_soyad), ' ', 1)) + 2));
  v_ad_soyad := COALESCE(NULLIF(trim(p_ad_soyad), ''), trim(concat_ws(' ', v_ad, v_soyad)));

  INSERT INTO public.eczanem_musteriler (
    telefon, ad, soyad, ad_soyad, kvkk_onay_tarihi, aktif_mi, auth_user_id
  ) VALUES (
    p_telefon, v_ad, v_soyad, v_ad_soyad, now(), true, p_auth_user_id
  ) RETURNING musteri_id INTO v_musteri_id;

  INSERT INTO public.eczanem_uyelikler (
    musteri_id, eczane_id, aktif_mi, son_islem_yapan_kisi_id, son_islem_tarihi
  ) VALUES (
    v_musteri_id, p_eczane_id, true, p_islem_yapan_kisi_id, now()
  ) RETURNING uyelik_id INTO v_uyelik_id;

  INSERT INTO public.eczanem_personel_islemleri (
    eczane_id, kisi_id, islem_turu, hedef_turu, hedef_id,
    detay
  ) VALUES (
    p_eczane_id, p_islem_yapan_kisi_id, 'musteri_olusturuldu', 'musteri', v_musteri_id,
    jsonb_build_object('uyelik_id', v_uyelik_id)
  );

  RETURN v_musteri_id;
END;
$fonksiyon$;

DROP FUNCTION IF EXISTS public.eczanem_yeni_musteri_provizyonu_izli(text, text, uuid, uuid, uuid);
REVOKE ALL ON FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(text, text, uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(text, text, uuid, uuid, uuid, text, text)
  TO service_role;

COMMIT;
