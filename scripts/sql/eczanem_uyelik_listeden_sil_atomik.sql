-- Eczacının müşteriyi kendi listesinden silmesi:
-- üyelik bağını kaldırma + silme günlüğünü TEK transaction içinde yapar.
-- İki adımdan biri hata verirse PostgreSQL işlemin tamamını geri alır.
--
-- Bu dosyayı İskender Supabase SQL Editor'da çalıştırır.

CREATE OR REPLACE FUNCTION public.eczanem_uyelik_listeden_sil(
  p_musteri_id uuid,
  p_eczane_id uuid,
  p_silen_kisi_id uuid,
  p_eposta text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_ad_soyad text;
  v_telefon text;
  v_silinen_uyelik uuid;
BEGIN
  SELECT m.ad_soyad, m.telefon
  INTO v_ad_soyad, v_telefon
  FROM public.eczanem_musteriler m
  WHERE m.musteri_id = p_musteri_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Müşteri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.eczanem_uyelikler
  WHERE musteri_id = p_musteri_id
    AND eczane_id = p_eczane_id
  RETURNING uyelik_id INTO v_silinen_uyelik;

  IF v_silinen_uyelik IS NULL THEN
    RAISE EXCEPTION 'Müşteri bu eczanenin listesinde değil.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.eczanem_silinen_musteriler (
    musteri_id,
    ad_soyad,
    telefon,
    eposta,
    eczane_id,
    silen_kisi_id
  ) VALUES (
    p_musteri_id,
    v_ad_soyad,
    v_telefon,
    p_eposta,
    p_eczane_id,
    p_silen_kisi_id
  );

  RETURN true;
END;
$fonk$;

REVOKE ALL ON FUNCTION public.eczanem_uyelik_listeden_sil(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eczanem_uyelik_listeden_sil(uuid, uuid, uuid, text) TO service_role;
