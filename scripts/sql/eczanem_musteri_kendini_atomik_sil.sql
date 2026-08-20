-- Eczanem müşterisinin KENDİ hesabını eksiksiz ve atomik silmesi.
-- Eczacının listeden silme RPC'sinden ayrıdır; bu akış hiçbir uygulama
-- silme günlüğü bırakmaz. Herhangi bir adım hata verirse tamamı geri alınır.
--
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.

BEGIN;

CREATE OR REPLACE FUNCTION public.eczanem_musteri_kendini_tam_sil(
  p_musteri_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri uuid;
  v_auth_silinen integer := 0;
BEGIN
  -- İstemcinin verdiği bir kimliğe güvenilmez; route yalnız oturumdan çözdüğü
  -- iki kimliği gönderir ve fonksiyon bunların aynı müşteri satırına ait
  -- olduğunu kilit altında yeniden doğrular.
  SELECT m.musteri_id
  INTO v_musteri
  FROM public.eczanem_musteriler m
  WHERE m.musteri_id = p_musteri_id
    AND m.auth_user_id = p_auth_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Müşteri ve giriş hesabı bağı doğrulanamadı.' USING ERRCODE = 'P0002';
  END IF;

  -- Harcama tablosunda musteri_id bulunmadığı için iki kaynak bağı üzerinden
  -- önce temizlenir. OR kullanımı aynı satırı yalnız bir kez siler.
  DELETE FROM public.eczanem_harcama_kayitlari hk
  WHERE hk.siparis_id IN (
      SELECT s.siparis_id
      FROM public.eczanem_siparisler s
      WHERE s.musteri_id = p_musteri_id
    )
     OR hk.kaynak_kayit_id IN (
      SELECT pk.kayit_id
      FROM public.eczanem_puan_kayitlari pk
      WHERE pk.musteri_id = p_musteri_id
    );

  -- FK sırası: puan → izleme → sipariş/gönderim → üyelik → müşteri.
  DELETE FROM public.eczanem_puan_kayitlari
  WHERE musteri_id = p_musteri_id;

  DELETE FROM public.eczanem_izleme_kayitlari
  WHERE musteri_id = p_musteri_id;

  DELETE FROM public.eczanem_siparisler
  WHERE musteri_id = p_musteri_id;

  DELETE FROM public.eczanem_gonderimler
  WHERE musteri_id = p_musteri_id;

  DELETE FROM public.eczanem_uyelikler
  WHERE musteri_id = p_musteri_id;

  -- Daha önce bir eczacının listeden silmiş olabileceği tarihsel kayıt da
  -- müşterinin kendi tam silme talebinde kalmaz.
  DELETE FROM public.eczanem_silinen_musteriler
  WHERE musteri_id = p_musteri_id;

  DELETE FROM public.push_gonderim_kayitlari
  WHERE auth_user_id = p_auth_user_id;

  DELETE FROM public.push_abonelikleri
  WHERE auth_user_id = p_auth_user_id;

  DELETE FROM public.eczanem_musteriler
  WHERE musteri_id = p_musteri_id
    AND auth_user_id = p_auth_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Müşteri hesabı silinemedi.' USING ERRCODE = 'P0001';
  END IF;

  -- Auth kimliği aynı transaction'ın son adımıdır. Silinemezse yukarıdaki
  -- bütün uygulama silmeleri de PostgreSQL tarafından geri alınır.
  DELETE FROM auth.users
  WHERE id = p_auth_user_id;
  GET DIAGNOSTICS v_auth_silinen = ROW_COUNT;

  IF v_auth_silinen <> 1 THEN
    RAISE EXCEPTION 'Giriş hesabı silinemedi.' USING ERRCODE = 'P0001';
  END IF;

  RETURN true;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_musteri_kendini_tam_sil(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_musteri_kendini_tam_sil(uuid, uuid)
  TO service_role;

COMMIT;
