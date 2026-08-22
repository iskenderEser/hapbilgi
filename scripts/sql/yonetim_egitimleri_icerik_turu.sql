-- Yönetim Eğitimleri içerik türü — DB sözleşmesi.
-- İskender tarafından Supabase SQL Editor'da çalıştırılır.

BEGIN;

ALTER TABLE public.talepler
  DROP CONSTRAINT IF EXISTS talepler_icerik_turu_check;

ALTER TABLE public.talepler
  ADD CONSTRAINT talepler_icerik_turu_check
  CHECK (icerik_turu IN ('ik', 'medikal', 'egitim', 'yonetim', 'urun', 'urun_medikal'));

ALTER TABLE public.iu_genel_atamalari
  DROP CONSTRAINT IF EXISTS iu_genel_atamalari_tur_ck;

ALTER TABLE public.iu_genel_atamalari
  ADD CONSTRAINT iu_genel_atamalari_tur_ck
  CHECK (egitim_turu IN (
    'urun_egitimi',
    'satis_teknikleri',
    'yonetim_egitimi',
    'medikal_egitim',
    'urun_medikal_egitim',
    'ik_egitimi'
  ));

CREATE OR REPLACE FUNCTION public.iu_genel_atamasi_ayarla(
  p_iu_id uuid,
  p_egitim_turu text,
  p_aktif_mi boolean,
  p_islemi_yapan_id uuid,
  p_aciklama text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_atama_id uuid;
BEGIN
  IF p_egitim_turu NOT IN (
    'urun_egitimi',
    'satis_teknikleri',
    'yonetim_egitimi',
    'medikal_egitim',
    'urun_medikal_egitim',
    'ik_egitimi'
  ) THEN
    RAISE EXCEPTION 'Geçersiz eğitim türü.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.kullanicilar k
    WHERE k.kullanici_id = p_islemi_yapan_id
      AND lower(k.rol::text) = 'admin'
      AND k.aktif_mi IS TRUE
  ) THEN
    RAISE EXCEPTION 'IU adaylığını yalnız admin yönetebilir.' USING ERRCODE = '42501';
  END IF;

  IF p_aktif_mi THEN
    SELECT a.atama_id
      INTO v_atama_id
    FROM public.iu_genel_atamalari a
    WHERE a.iu_id = p_iu_id
      AND a.egitim_turu = p_egitim_turu
      AND a.aktif_mi IS TRUE;

    IF FOUND THEN RETURN v_atama_id; END IF;

    INSERT INTO public.iu_genel_atamalari (iu_id, egitim_turu, atayan_id, aciklama)
    VALUES (p_iu_id, p_egitim_turu, p_islemi_yapan_id, nullif(btrim(p_aciklama), ''))
    RETURNING atama_id INTO v_atama_id;
  ELSE
    UPDATE public.iu_genel_atamalari a
       SET aktif_mi = false,
           bitis_tarihi = now(),
           pasife_alan_id = p_islemi_yapan_id,
           aciklama = COALESCE(nullif(btrim(p_aciklama), ''), a.aciklama)
     WHERE a.iu_id = p_iu_id
       AND a.egitim_turu = p_egitim_turu
       AND a.aktif_mi IS TRUE
    RETURNING a.atama_id INTO v_atama_id;
  END IF;

  RETURN v_atama_id;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.iu_genel_atamasi_ayarla(uuid, text, boolean, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.iu_genel_atamasi_ayarla(uuid, text, boolean, uuid, text)
  TO service_role;

COMMIT;

SELECT
  c.conname AS kisit,
  pg_get_constraintdef(c.oid) AS tanim
FROM pg_constraint c
WHERE c.conname IN ('talepler_icerik_turu_check', 'iu_genel_atamalari_tur_ck')
ORDER BY c.conname;
