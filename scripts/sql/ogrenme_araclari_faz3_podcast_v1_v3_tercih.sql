-- ============================================================================
-- HapBilgi — Öğrenme Araçları Faz 3: Podcast V1 / V3 Transkript Tercihi Sözleşmesi
-- ============================================================================
-- Amaç: V1 ve V3 (İçerik Üreticisi akışı) podcast talepleri için transkript tercihinin
-- (transkript_istendi: boolean) mevcut 'talepler.ogrenme_araci_tercihleri' JSONB alanında
-- saklanmasını teyit eden idempotent doğrulama betiğidir.
-- Kural: Yeni tablo kolonu eklenmez; mevcut JSONB yapısı kullanılır.
-- ============================================================================

BEGIN;

-- 1. ogrenme_araci_tercihleri kolonunun varlığını ve tipini doğrula (zaten faz3'te eklendi)
ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS ogrenme_araci_tercihleri jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. JSONB nesne kısıtını doğrula
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'talepler_ogrenme_araci_tercihleri_nesne_ck'
      AND conrelid = 'public.talepler'::regclass
  ) THEN
    ALTER TABLE public.talepler
      ADD CONSTRAINT talepler_ogrenme_araci_tercihleri_nesne_ck
      CHECK (jsonb_typeof(ogrenme_araci_tercihleri) = 'object');
  END IF;
END;
$constraint$;

-- 3. Tercih alanı dokümantasyon yorumunu ekle
COMMENT ON COLUMN public.talepler.ogrenme_araci_tercihleri IS
  'Öğrenme aracına özgü ek tercihler. Podcast için: {"transkript_istendi": boolean}. Eski V1/V3 taleplerinde alan yoksa kod tarafında varsayılan olarak true çözümlenir.';

COMMIT;
