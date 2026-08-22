-- Süresi geçmiş ve tamamlanmamış Challenge kayıtlarının kaybını bir kez yazar.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.

BEGIN;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.challenge_kayip_kayitlari
    GROUP BY challenge_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Aynı challenge için mükerrer kayıp kayıtları var; paket kurulmadı.';
  END IF;
END;
$kontrol$;

CREATE UNIQUE INDEX IF NOT EXISTS challenge_kayip_challenge_uq
  ON public.challenge_kayip_kayitlari (challenge_id);

CREATE OR REPLACE FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $tetikleyici$
BEGIN
  IF NEW.izlendi_mi = true AND OLD.izlendi_mi = false THEN
    UPDATE public.bildirimler b
    SET goruldu_mu = true
    WHERE b.kayit_turu = 'challenge'
      AND b.kayit_id = NEW.challenge_id
      AND b.alici_id = NEW.alan_id
      AND b.gonderen_id IS NOT NULL
      AND b.goruldu_mu = false;
  END IF;
  RETURN NEW;
END;
$tetikleyici$;

DROP TRIGGER IF EXISTS trg_cc_challenge_tamamlaninca_bildirim_kapat
  ON public.challenge_kayitlari;
CREATE TRIGGER trg_cc_challenge_tamamlaninca_bildirim_kapat
AFTER UPDATE OF izlendi_mi ON public.challenge_kayitlari
FOR EACH ROW
EXECUTE FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat();

REVOKE ALL ON FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat()
  TO service_role;

CREATE OR REPLACE FUNCTION public.challenge_kaybi_tara()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $fonksiyon$
DECLARE
  v_challenge record;
  v_eklendi uuid;
  v_islenen integer := 0;
BEGIN
  FOR v_challenge IN
    SELECT
      ck.challenge_id,
      ck.alan_id,
      ck.yayin_id,
      ky.urun_id,
      COALESCE(vyd.video_puani, 0)::integer AS kaybedilen_puan,
      COALESCE(vyd.urun_adi, vyd.teknik_adi, 'Video') AS video_adi
    FROM public.challenge_kayitlari ck
    LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = ck.yayin_id
    LEFT JOIN public.v_yayin_kunye ky ON ky.yayin_id = ck.yayin_id
    WHERE ck.izlendi_mi = false
      AND ck.son_tarih < clock_timestamp()
      AND NOT EXISTS (
        SELECT 1
        FROM public.challenge_kayip_kayitlari ckk
        WHERE ckk.challenge_id = ck.challenge_id
      )
    FOR UPDATE OF ck SKIP LOCKED
  LOOP
    v_eklendi := NULL;

    INSERT INTO public.challenge_kayip_kayitlari
      (kullanici_id, yayin_id, challenge_id, urun_id, kaybedilen_puan)
    VALUES
      (v_challenge.alan_id, v_challenge.yayin_id, v_challenge.challenge_id,
       v_challenge.urun_id, v_challenge.kaybedilen_puan)
    ON CONFLICT (challenge_id) DO NOTHING
    RETURNING challenge_id INTO v_eklendi;

    IF v_eklendi IS NOT NULL THEN
      INSERT INTO public.bildirimler
        (alici_id, gonderen_id, kayit_turu, kayit_id, mesaj, goruldu_mu)
      VALUES
        (v_challenge.alan_id, NULL, 'challenge', v_challenge.challenge_id,
         v_challenge.video_adi || ' challenge''ını süresi içinde izlemedin. '
           || v_challenge.kaybedilen_puan || ' puan kaybettin.', false);

      v_islenen := v_islenen + 1;
    END IF;
  END LOOP;

  -- Süresi dolan challenge'ın eski "geldi" bildirimi artık eylem beklemez.
  UPDATE public.bildirimler b
  SET goruldu_mu = true
  WHERE b.kayit_turu = 'challenge'
    AND b.goruldu_mu = false
    AND b.gonderen_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.challenge_kayip_kayitlari ckk
      WHERE ckk.challenge_id = b.kayit_id
        AND ckk.kullanici_id = b.alici_id
    );

  RETURN v_islenen;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.challenge_kaybi_tara()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_kaybi_tara() TO service_role;

-- Mevcut tarama işi varsa korunur; yoksa 15 dakikada bir çalışacak iş kurulur.
DO $cron$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'pg_cron etkin değil; Challenge süre aşımı işi kurulamadı.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE command ILIKE '%challenge_kaybi_tara%'
  ) THEN
    PERFORM cron.schedule(
      'challenge_kaybi_tarama',
      '*/15 * * * *',
      'SELECT public.challenge_kaybi_tara();'
    );
  END IF;
END;
$cron$;

COMMIT;
