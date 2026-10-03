-- Yalnız beş sabit mutabakat görünüm test kaydının ürün adını ve görünen
-- İndirim ID'sini Test Ürün A_99_000001 biçimine getirir.
-- Gerçek indirim onaylarına ve genel ID üretim kuralına dokunmaz.
-- Supabase SQL Editor'de kullanıcı çalıştırır.
BEGIN;

LOCK TABLE public.eczanem_indirim_onaylari IN ACCESS EXCLUSIVE MODE;

DO $kontrol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.eczanem_indirim_onaylari'::regclass
      AND tgname = 'trg_eczanem_indirim_gorunen_id'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'İndirim ID koruma tetikleyicisi bulunamadı; test kayıtları değiştirilmedi.';
  END IF;
END;
$kontrol$;

-- Aynı transaction içinde yalnız bu tetikleyici geçici kaldırılır;
-- hata olursa PostgreSQL tüm işlemi, tetikleyici değişikliği dâhil geri alır.
DROP TRIGGER trg_eczanem_indirim_gorunen_id ON public.eczanem_indirim_onaylari;

WITH hedef (onay_id, eski_ad, yeni_ad, yeni_indirim_id) AS (
  VALUES
    ('a73682fb-521c-4313-bd38-44245b65336b'::uuid, 'TEST Mutabakat Ürünü A', 'Test Ürün A', 'Test Ürün A_99_000001'),
    ('9c894492-0d2d-4c0e-8117-0e16f8fb8255'::uuid, 'TEST Mutabakat Ürünü B', 'Test Ürün B', 'Test Ürün B_99_000002'),
    ('d622ad69-7b73-43a7-9a07-8eb61a8e5e0f'::uuid, 'TEST Mutabakat Ürünü C', 'Test Ürün C', 'Test Ürün C_99_000003'),
    ('b64148ef-bab4-499f-8aa6-7d6122a61990'::uuid, 'TEST Mutabakat Ürünü D', 'Test Ürün D', 'Test Ürün D_99_000004'),
    ('49be3a03-806e-4f76-af40-d2d22ec79b7c'::uuid, 'TEST Mutabakat Ürünü E', 'Test Ürün E', 'Test Ürün E_99_000005')
)
UPDATE public.eczanem_indirim_onaylari o
SET urun_adi = h.yeni_ad,
    gorunen_indirim_id = h.yeni_indirim_id
FROM hedef h
WHERE o.eczanem_indirim_onay_id = h.onay_id
  AND o.urun_adi IN (h.eski_ad, h.yeni_ad)
  AND (o.urun_adi IS DISTINCT FROM h.yeni_ad
    OR o.gorunen_indirim_id IS DISTINCT FROM h.yeni_indirim_id);

CREATE TRIGGER trg_eczanem_indirim_gorunen_id
BEFORE INSERT OR UPDATE ON public.eczanem_indirim_onaylari
FOR EACH ROW EXECUTE FUNCTION public.eczanem_indirim_gorunen_id_ata();

COMMIT;

SELECT o.urun_adi, o.gorunen_indirim_id
FROM public.eczanem_indirim_onaylari o
WHERE o.eczanem_indirim_onay_id IN (
  'a73682fb-521c-4313-bd38-44245b65336b'::uuid,
  '9c894492-0d2d-4c0e-8117-0e16f8fb8255'::uuid,
  'd622ad69-7b73-43a7-9a07-8eb61a8e5e0f'::uuid,
  'b64148ef-bab4-499f-8aa6-7d6122a61990'::uuid,
  '49be3a03-806e-4f76-af40-d2d22ec79b7c'::uuid
)
ORDER BY o.indirim_sira;
