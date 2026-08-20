-- Eczanem bütünlük paketi:
--  1) E-Club ↔ Eczanem telefon kimliğini iki yönde ve yarışa dayanıklı korur.
--  2) Auth dış kaynağı sonrasındaki kimlik+bağ yazımlarını atomik RPC yapar.
--  3) Auth telafisi için PII içermeyen provizyon durum günlüğü kurar.
--  4) Aynı müşteri+eczane+ürün için tek bekleyen siparişi yapısal kılar.
--  5) Eczane müşteri listesindeki Auth Admin N+1 çağrısını tek view'a indirir.
--
-- Bu dosyayı İskender, ön kontrol boş döndükten sonra Supabase SQL Editor'da çalıştırır.

BEGIN;

CREATE OR REPLACE FUNCTION public.hapbilgi_telefon_normalize(p_telefon text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fonksiyon$
  WITH d AS (
    SELECT regexp_replace(coalesce(p_telefon, ''), '\D', '', 'g') AS rakam
  )
  SELECT CASE
    WHEN rakam ~ '^905[0-9]{9}$' THEN substr(rakam, 3)
    WHEN rakam ~ '^05[0-9]{9}$' THEN substr(rakam, 2)
    WHEN rakam ~ '^5[0-9]{9}$' THEN rakam
    ELSE NULL
  END
  FROM d;
$fonksiyon$;

-- Mevcut çakışma varsa tetikleyicileri devreye almadan migration'ı durdurur.
DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.eclub_kisiler ek
    JOIN public.eczanem_musteriler em
      ON public.hapbilgi_telefon_normalize(ek.telefon)
       = public.hapbilgi_telefon_normalize(em.telefon)
    WHERE public.hapbilgi_telefon_normalize(ek.telefon) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'E-Club ve Eczanem arasında telefon çakışması var; migration uygulanmadı.';
  END IF;
END;
$kontrol$;

CREATE OR REPLACE FUNCTION public.hapbilgi_kimlik_telefon_ayir_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_telefon text;
BEGIN
  v_telefon := public.hapbilgi_telefon_normalize(NEW.telefon);
  IF v_telefon IS NULL THEN
    RAISE EXCEPTION 'Geçerli bir cep telefonu zorunludur.' USING ERRCODE = '22023';
  END IF;

  -- İki tabloya eşzamanlı yazımlar aynı kanonik telefon için sıraya girer.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_telefon, 0));

  IF TG_TABLE_NAME = 'eclub_kisiler' THEN
    IF EXISTS (
      SELECT 1 FROM public.eczanem_musteriler m
      WHERE public.hapbilgi_telefon_normalize(m.telefon) = v_telefon
    ) THEN
      RAISE EXCEPTION 'Bu kişi HapBilgi''de Eczanem müşterisi olduğu için E-Club üyesi olarak kaydedilemez.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'eczanem_musteriler' THEN
    IF EXISTS (
      SELECT 1 FROM public.eclub_kisiler k
      WHERE public.hapbilgi_telefon_normalize(k.telefon) = v_telefon
    ) THEN
      RAISE EXCEPTION 'HapBilgi''de E-Club üyesi olduğunuz için müşteri olarak kayıt olmazsınız'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS trg_eclub_kisiler_telefon_ayir ON public.eclub_kisiler;
CREATE TRIGGER trg_eclub_kisiler_telefon_ayir
BEFORE INSERT OR UPDATE OF telefon ON public.eclub_kisiler
FOR EACH ROW EXECUTE FUNCTION public.hapbilgi_kimlik_telefon_ayir_trg();

DROP TRIGGER IF EXISTS trg_eczanem_musteriler_telefon_ayir ON public.eczanem_musteriler;
CREATE TRIGGER trg_eczanem_musteriler_telefon_ayir
BEFORE INSERT OR UPDATE OF telefon ON public.eczanem_musteriler
FOR EACH ROW EXECUTE FUNCTION public.hapbilgi_kimlik_telefon_ayir_trg();

CREATE TABLE IF NOT EXISTS public.kimlik_provizyon_islemleri (
  islem_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hedef text NOT NULL CHECK (hedef IN ('eclub_kisi', 'eczanem_musteri')),
  durum text NOT NULL CHECK (durum IN (
    'baslatildi', 'auth_olustu', 'tamamlandi', 'basarisiz', 'geri_alindi', 'mudahale_gerekli'
  )),
  auth_user_id uuid NULL,
  hedef_kayit_id uuid NULL,
  hata text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  tamamlandi_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_kimlik_provizyon_acik
ON public.kimlik_provizyon_islemleri (durum, created_at)
WHERE durum IN ('baslatildi', 'auth_olustu', 'mudahale_gerekli');

REVOKE ALL ON TABLE public.kimlik_provizyon_islemleri FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kimlik_provizyon_islemleri TO service_role;

CREATE OR REPLACE FUNCTION public.eclub_yeni_kisi_provizyonu(
  p_rol text,
  p_ad text,
  p_soyad text,
  p_eposta text,
  p_telefon text,
  p_auth_user_id uuid,
  p_eczane_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_kisi_id uuid;
BEGIN
  INSERT INTO public.eclub_kisiler (rol, ad, soyad, eposta, telefon, auth_user_id)
  VALUES (p_rol, p_ad, p_soyad, p_eposta, p_telefon, p_auth_user_id)
  RETURNING kisi_id INTO v_kisi_id;

  INSERT INTO public.eclub_kisi_eczane (kisi_id, eczane_id, aktif_mi)
  VALUES (v_kisi_id, p_eczane_id, true);

  RETURN v_kisi_id;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eclub_mevcut_kisi_provizyonu(
  p_kisi_id uuid,
  p_auth_user_id uuid,
  p_eczane_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  UPDATE public.eclub_kisiler
  SET auth_user_id = p_auth_user_id
  WHERE kisi_id = p_kisi_id AND auth_user_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kişinin Auth bağı eşzamanlı olarak değişti.' USING ERRCODE = 'P0001';
  END IF;

  -- Kişi satırındaki UPDATE kilidi aynı kişi için yarışan provizyonları sıraya
  -- koyar. Eski pasif bağ varsa açılır; yoksa yeni bağ kurulur.
  UPDATE public.eclub_kisi_eczane
  SET aktif_mi = true, bitis_tarihi = NULL
  WHERE kisi_id = p_kisi_id AND eczane_id = p_eczane_id;
  IF NOT FOUND THEN
    INSERT INTO public.eclub_kisi_eczane (kisi_id, eczane_id, aktif_mi, bitis_tarihi)
    VALUES (p_kisi_id, p_eczane_id, true, NULL);
  END IF;

  RETURN p_kisi_id;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_yeni_musteri_provizyonu(
  p_telefon text,
  p_ad_soyad text,
  p_auth_user_id uuid,
  p_eczane_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri_id uuid;
BEGIN
  INSERT INTO public.eczanem_musteriler (
    telefon, ad_soyad, kvkk_onay_tarihi, aktif_mi, auth_user_id
  ) VALUES (
    p_telefon, p_ad_soyad, now(), true, p_auth_user_id
  )
  RETURNING musteri_id INTO v_musteri_id;

  INSERT INTO public.eczanem_uyelikler (musteri_id, eczane_id, aktif_mi)
  VALUES (v_musteri_id, p_eczane_id, true);

  RETURN v_musteri_id;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.hapbilgi_telefon_normalize(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_yeni_kisi_provizyonu(text, text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_mevcut_kisi_provizyonu(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_yeni_musteri_provizyonu(text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hapbilgi_telefon_normalize(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_yeni_kisi_provizyonu(text, text, text, text, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_mevcut_kisi_provizyonu(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_yeni_musteri_provizyonu(text, text, uuid, uuid) TO service_role;

-- Ön kontrol boşsa koşullu teklik yarışan siparişlerden yalnız birini kabul eder.
CREATE UNIQUE INDEX IF NOT EXISTS ux_eczanem_siparis_tek_bekleyen
ON public.eczanem_siparisler (musteri_id, eczane_id, urun_id)
WHERE durum = 'bekliyor' AND musteri_id IS NOT NULL;

CREATE OR REPLACE VIEW public.v_eczanem_musteri_liste_admin
WITH (security_barrier = true)
AS
SELECT
  u.eczane_id,
  u.musteri_id,
  m.ad_soyad,
  m.telefon,
  au.email::text AS eposta,
  u.aktif_mi,
  u.created_at
FROM public.eczanem_uyelikler u
JOIN public.eczanem_musteriler m ON m.musteri_id = u.musteri_id
LEFT JOIN auth.users au ON au.id = m.auth_user_id;

REVOKE ALL ON TABLE public.v_eczanem_musteri_liste_admin FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_eczanem_musteri_liste_admin TO service_role;

COMMIT;
