-- Eczanem müşteri provizyonunda aktif müşteri ile Auth hesabı arasındaki bağı zorunlu kılar.
CREATE OR REPLACE FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(
  p_telefon text,
  p_ad_soyad text,
  p_auth_user_id uuid,
  p_eczane_id uuid,
  p_islem_yapan_kisi_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri_id uuid;
  v_uyelik_id uuid;
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

  INSERT INTO public.eczanem_musteriler (
    telefon, ad_soyad, kvkk_onay_tarihi, aktif_mi, auth_user_id
  ) VALUES (
    p_telefon, p_ad_soyad, now(), true, p_auth_user_id
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

REVOKE ALL ON FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(text, text, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(text, text, uuid, uuid, uuid)
  TO service_role;
