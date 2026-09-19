-- scripts/sql/firma_header_logo_migration.sql
--
-- B2B Kurumsal Header Co-Branding için firmalar tablosuna
-- logo_url ve ogrenme_platformu_aktif kolonları eklenir.

ALTER TABLE public.firmalar
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS ogrenme_platformu_aktif boolean DEFAULT false NOT NULL;

-- Test firması Hepifarma için varsayılan logo ve aktiflik tanımlanır
UPDATE public.firmalar
SET logo_url = '/hepifarma_logo_dark.png',
    ogrenme_platformu_aktif = true
WHERE firma_adi ILIKE '%hepi%'
   OR firma_adi ILIKE '%hepifarma%';
