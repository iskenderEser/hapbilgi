-- Podcast transkript ve E-Club çek e-postası kuyruklarını Vercel Cron'dan
-- Supabase Cron'a taşır.
--
-- ÖN KOŞULLAR
-- 1. Vault'ta `hapbilgi_cron_base_url` adıyla uygulama kök adresi bulunmalı.
--    Örnek değer: https://hapbilgi.vercel.app
-- 2. Vault'ta `hapbilgi_cron_secret` adıyla Vercel Production ortamındaki
--    CRON_SECRET ile aynı değer bulunmalı.
-- 3. pg_cron, pg_net ve Vault uzantıları etkin olmalı.
--
-- Bu dosya gizli değer içermez. Yeniden çalıştırılabilir; aynı adlı işleri
-- önce kaldırır, sonra tek kopya olarak yeniden kurar.

BEGIN;

DO $kontrol$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron etkin değil.';
  END IF;

  IF to_regnamespace('net') IS NULL THEN
    RAISE EXCEPTION 'pg_net etkin değil.';
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Supabase Vault etkin değil.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'hapbilgi_cron_base_url'
      AND nullif(trim(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Vault içinde hapbilgi_cron_base_url bulunamadı.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'hapbilgi_cron_secret'
      AND nullif(trim(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Vault içinde hapbilgi_cron_secret bulunamadı.';
  END IF;
END;
$kontrol$;

DO $temizlik$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'hapbilgi_podcast_transkript_kuyrugu',
      'hapbilgi_eclub_cek_eposta_kuyrugu'
    )
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$temizlik$;

SELECT cron.schedule(
  'hapbilgi_podcast_transkript_kuyrugu',
  '* * * * *',
  $is$
    SELECT net.http_post(
      url := rtrim((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'hapbilgi_cron_base_url' LIMIT 1
      ), '/') || '/api/cron/transkript-kuyruk',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'hapbilgi_cron_secret' LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $is$
);

SELECT cron.schedule(
  'hapbilgi_eclub_cek_eposta_kuyrugu',
  '*/5 * * * *',
  $is$
    SELECT net.http_post(
      url := rtrim((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'hapbilgi_cron_base_url' LIMIT 1
      ), '/') || '/api/cron/eclub-cek-eposta',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'hapbilgi_cron_secret' LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $is$
);

COMMIT;

-- Kurulum doğrulaması:
-- SELECT jobid, jobname, schedule, active
-- FROM cron.job
-- WHERE jobname IN (
--   'hapbilgi_podcast_transkript_kuyrugu',
--   'hapbilgi_eclub_cek_eposta_kuyrugu'
-- )
-- ORDER BY jobname;
