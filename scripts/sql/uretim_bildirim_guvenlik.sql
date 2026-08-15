-- Çoklu İçerik Üreticisi — Paket C/1
-- Üretim bildiriminin kanonik talep/görev bağı, tekil okunmamış kayıt ve
-- görev geçişiyle aynı transaction'da in-app bildirim yazımı.
-- İskender tarafından Supabase SQL Editor'da çalıştırılır.

BEGIN;

ALTER TABLE public.bildirimler
  ADD COLUMN IF NOT EXISTS talep_id uuid,
  ADD COLUMN IF NOT EXISTS gorev_id uuid;

DO $blok$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bildirimler_talep_id_fkey'
      AND conrelid = 'public.bildirimler'::regclass
  ) THEN
    ALTER TABLE public.bildirimler
      ADD CONSTRAINT bildirimler_talep_id_fkey
      FOREIGN KEY (talep_id) REFERENCES public.talepler(talep_id)
      ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bildirimler_gorev_id_fkey'
      AND conrelid = 'public.bildirimler'::regclass
  ) THEN
    ALTER TABLE public.bildirimler
      ADD CONSTRAINT bildirimler_gorev_id_fkey
      FOREIGN KEY (gorev_id) REFERENCES public.uretim_gorevleri(gorev_id)
      ON DELETE CASCADE;
  END IF;
END;
$blok$;

-- Eski üretim bildirimlerini silmeden kanonik talebe bağlar. "talep" türünde
-- artifact kimliği yazılmış eski kayıtlar da senaryo/video/set üzerinden çözülür.
UPDATE public.bildirimler b
SET talep_id = COALESCE(
  (SELECT t.talep_id FROM public.talepler t WHERE t.talep_id = b.kayit_id LIMIT 1),
  (SELECT s.talep_id FROM public.senaryolar s WHERE s.senaryo_id = b.kayit_id LIMIT 1),
  (SELECT v.talep_id FROM public.videolar v WHERE v.video_id = b.kayit_id LIMIT 1),
  (SELECT ss.talep_id FROM public.soru_setleri ss WHERE ss.soru_seti_id = b.kayit_id LIMIT 1)
)
WHERE b.talep_id IS NULL
  AND b.kayit_turu IN ('talep', 'senaryo', 'video', 'soru_seti');

UPDATE public.bildirimler b
SET gorev_id = (
  SELECT g.gorev_id
  FROM public.uretim_gorevleri g
  WHERE g.talep_id = b.talep_id
    AND (
      g.gorev_id = b.kayit_id
      OR g.senaryo_id = b.kayit_id
      OR g.video_id = b.kayit_id
      OR g.soru_seti_id = b.kayit_id
    )
  ORDER BY g.created_at DESC
  LIMIT 1
)
WHERE b.gorev_id IS NULL
  AND b.talep_id IS NOT NULL
  AND b.kayit_turu IN ('senaryo', 'video', 'soru_seti');

-- Üretici Talepler listesi talep_id ile çalışır. Eski yanlış artifact kimlikleri
-- bu türde kanonik talep kimliğine çevrilir; rozet ve satır artık aynı anahtardır.
UPDATE public.bildirimler
SET kayit_id = talep_id
WHERE kayit_turu = 'talep'
  AND talep_id IS NOT NULL
  AND kayit_id IS DISTINCT FROM talep_id;

-- Aynı alıcı/talep için geçmişten birden çok okunmamış kayıt varsa en yenisi
-- korunur, diğerleri silinmeden görülmüş yapılır.
WITH sirali AS (
  SELECT
    b.bildirim_id,
    row_number() OVER (
      PARTITION BY b.alici_id, b.talep_id
      ORDER BY b.created_at DESC NULLS LAST, b.bildirim_id DESC
    ) AS sira
  FROM public.bildirimler b
  WHERE b.goruldu_mu IS FALSE
    AND b.talep_id IS NOT NULL
)
UPDATE public.bildirimler b
SET goruldu_mu = true
FROM sirali s
WHERE s.bildirim_id = b.bildirim_id
  AND s.sira > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bildirimler_alici_talep_okunmamis
  ON public.bildirimler (alici_id, talep_id)
  WHERE goruldu_mu IS FALSE AND talep_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_bildirimler_alici_gorev
  ON public.bildirimler (alici_id, gorev_id, created_at DESC)
  WHERE gorev_id IS NOT NULL;

-- Yeni üretim API'leri tabloyu yalnız service_role üzerinden kullanır. Eski
-- veya geniş RLS politikaları bulunsa bile tablo ayrıcalığı tarayıcıya verilmez.
ALTER TABLE public.bildirimler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uretim_gorevleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uretim_gorev_atama_gecmisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iu_urun_atamalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iu_genel_atamalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uretim_islem_kayitlari ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bildirimler FROM anon, authenticated;
REVOKE ALL ON public.uretim_gorevleri FROM anon, authenticated;
REVOKE ALL ON public.uretim_gorev_atama_gecmisi FROM anon, authenticated;
REVOKE ALL ON public.iu_urun_atamalari FROM anon, authenticated;
REVOKE ALL ON public.iu_genel_atamalari FROM anon, authenticated;
REVOKE ALL ON public.uretim_islem_kayitlari FROM anon, authenticated;

GRANT ALL ON public.bildirimler TO service_role;
GRANT ALL ON public.uretim_gorevleri TO service_role;
GRANT ALL ON public.uretim_gorev_atama_gecmisi TO service_role;
GRANT ALL ON public.iu_urun_atamalari TO service_role;
GRANT ALL ON public.iu_genel_atamalari TO service_role;
GRANT ALL ON public.uretim_islem_kayitlari TO service_role;

CREATE OR REPLACE FUNCTION public.uretim_bildirim_yaz(
  p_alici_id uuid,
  p_gonderen_id uuid,
  p_kayit_turu text,
  p_kayit_id uuid,
  p_talep_id uuid,
  p_gorev_id uuid,
  p_mesaj text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  IF p_alici_id IS NULL THEN RETURN; END IF;

  UPDATE public.bildirimler b
     SET goruldu_mu = true
   WHERE b.alici_id = p_alici_id
     AND b.talep_id = p_talep_id
     AND b.goruldu_mu IS FALSE;

  INSERT INTO public.bildirimler (
    alici_id, gonderen_id, kayit_turu, kayit_id,
    talep_id, gorev_id, mesaj, goruldu_mu
  ) VALUES (
    p_alici_id, p_gonderen_id, p_kayit_turu, p_kayit_id,
    p_talep_id, p_gorev_id, p_mesaj, false
  );
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.uretim_gorev_bildirimi_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_uretici_id uuid;
  v_icerik_adi text;
  v_asama_adi text;
BEGIN
  SELECT
    t.uretici_id,
    COALESCE(nullif(u.urun_adi, ''), nullif(t.urun_adi, ''), replace(t.egitim_turu, '_', ' '))
    INTO v_uretici_id, v_icerik_adi
  FROM public.talepler t
  LEFT JOIN public.urunler u ON u.urun_id = t.urun_id
  WHERE t.talep_id = NEW.talep_id;

  v_asama_adi := CASE NEW.asama
    WHEN 'senaryo' THEN 'Senaryo'
    WHEN 'video' THEN 'Video'
    ELSE 'Soru seti'
  END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.atanan_iu_id IS NOT NULL THEN
      PERFORM public.uretim_bildirim_yaz(
        NEW.atanan_iu_id,
        NEW.atayan_id,
        NEW.asama,
        NEW.gorev_id,
        NEW.talep_id,
        NEW.gorev_id,
        v_asama_adi || ' görevi atandı: ' || COALESCE(v_icerik_adi, '-')
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Görev devri veya atama bekleyen işe manuel IU verilmesi.
  IF OLD.atanan_iu_id IS DISTINCT FROM NEW.atanan_iu_id THEN
    IF OLD.atanan_iu_id IS NOT NULL THEN
      UPDATE public.bildirimler b
         SET goruldu_mu = true
       WHERE b.alici_id = OLD.atanan_iu_id
         AND b.gorev_id = NEW.gorev_id
         AND b.goruldu_mu IS FALSE;
    END IF;
    IF NEW.atanan_iu_id IS NOT NULL THEN
      PERFORM public.uretim_bildirim_yaz(
        NEW.atanan_iu_id,
        NEW.atayan_id,
        NEW.asama,
        NEW.gorev_id,
        NEW.talep_id,
        NEW.gorev_id,
        v_asama_adi || ' görevi size devredildi: ' || COALESCE(v_icerik_adi, '-')
      );
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.durum IS DISTINCT FROM NEW.durum THEN
    IF NEW.durum = 'inceleme_bekliyor' THEN
      UPDATE public.bildirimler b
         SET goruldu_mu = true
       WHERE b.alici_id = NEW.atanan_iu_id
         AND b.gorev_id = NEW.gorev_id
         AND b.goruldu_mu IS FALSE;

      PERFORM public.uretim_bildirim_yaz(
        v_uretici_id,
        NEW.atanan_iu_id,
        'talep',
        NEW.talep_id,
        NEW.talep_id,
        NEW.gorev_id,
        v_asama_adi || ' inceleme bekliyor: ' || COALESCE(v_icerik_adi, '-')
      );
    ELSIF NEW.durum = 'revizyon_bekliyor' THEN
      UPDATE public.bildirimler b
         SET goruldu_mu = true
       WHERE b.alici_id = v_uretici_id
         AND b.talep_id = NEW.talep_id
         AND b.goruldu_mu IS FALSE;

      PERFORM public.uretim_bildirim_yaz(
        NEW.atanan_iu_id,
        v_uretici_id,
        NEW.asama,
        NEW.gorev_id,
        NEW.talep_id,
        NEW.gorev_id,
        v_asama_adi || ' revizyonu istendi: ' || COALESCE(v_icerik_adi, '-')
      );
    ELSIF NEW.durum IN ('tamamlandi', 'iptal') THEN
      UPDATE public.bildirimler b
         SET goruldu_mu = true
       WHERE b.alici_id = v_uretici_id
         AND b.talep_id = NEW.talep_id
         AND b.goruldu_mu IS FALSE;
    END IF;
  END IF;

  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS uretim_gorev_bildirimi_trg ON public.uretim_gorevleri;
CREATE TRIGGER uretim_gorev_bildirimi_trg
AFTER INSERT OR UPDATE OF atanan_iu_id, durum ON public.uretim_gorevleri
FOR EACH ROW
EXECUTE FUNCTION public.uretim_gorev_bildirimi_trg();

REVOKE ALL ON FUNCTION public.uretim_bildirim_yaz(uuid, uuid, text, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_gorev_bildirimi_trg()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_bildirim_yaz(uuid, uuid, text, uuid, uuid, uuid, text)
  TO service_role;

COMMIT;

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bildirimler' AND column_name = 'talep_id'
  ) AS talep_bagi_var,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bildirimler' AND column_name = 'gorev_id'
  ) AS gorev_bagi_var,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'uretim_gorev_bildirimi_trg' AND NOT tgisinternal
  ) AS bildirim_trigger_var,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ux_bildirimler_alici_talep_okunmamis'
  ) AS tekil_okunmamis_var,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.bildirimler'::regclass) AS bildirim_rls_acik;
