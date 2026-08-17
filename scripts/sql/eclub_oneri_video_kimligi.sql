-- E-Club önerilerinde kalıcı video kimliği.
-- Aynı yayın farklı yayin_id ile yeniden açıldığında da aynı gerçek videonun
-- tekrar gönderim kuralını güvenilir biçimde uygulamak için kullanılır.

BEGIN;

ALTER TABLE public.eclub_oneri_kayitlari
  ADD COLUMN IF NOT EXISTS video_id uuid;

UPDATE public.eclub_oneri_kayitlari o
SET video_id = vd.video_id
FROM public.yayin_yonetimi ym
JOIN public.soru_seti_durumu ssd
  ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
JOIN public.soru_setleri ss
  ON ss.soru_seti_id = ssd.soru_seti_id
JOIN public.video_durumu vd
  ON vd.video_durum_id = ss.video_durum_id
WHERE ym.yayin_id = o.yayin_id
  AND o.video_id IS NULL;

DO $kontrol$
DECLARE
  v_eksik bigint;
  v_uyumsuz bigint;
BEGIN
  SELECT count(*) INTO v_eksik
  FROM public.eclub_oneri_kayitlari
  WHERE video_id IS NULL;

  IF v_eksik > 0 THEN
    RAISE EXCEPTION 'E-Club önerilerinde video_id doldurulamayan % kayıt var; işlem geri alındı.', v_eksik;
  END IF;

  SELECT count(*) INTO v_uyumsuz
  FROM public.eclub_oneri_kayitlari o
  JOIN public.yayin_yonetimi ym
    ON ym.yayin_id = o.yayin_id
  JOIN public.soru_seti_durumu ssd
    ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
  JOIN public.soru_setleri ss
    ON ss.soru_seti_id = ssd.soru_seti_id
  JOIN public.video_durumu vd
    ON vd.video_durum_id = ss.video_durum_id
  WHERE o.video_id IS DISTINCT FROM vd.video_id;

  IF v_uyumsuz > 0 THEN
    RAISE EXCEPTION 'E-Club önerilerinde yayın/video ilişkisiyle uyuşmayan % kayıt var; işlem geri alındı.', v_uyumsuz;
  END IF;
END;
$kontrol$;

ALTER TABLE public.eclub_oneri_kayitlari
  ALTER COLUMN video_id SET NOT NULL;

DO $kisit$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eclub_oneri_kayitlari_video_id_fkey'
      AND conrelid = 'public.eclub_oneri_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.eclub_oneri_kayitlari
      ADD CONSTRAINT eclub_oneri_kayitlari_video_id_fkey
      FOREIGN KEY (video_id)
      REFERENCES public.videolar(video_id);
  END IF;
END;
$kisit$;

CREATE INDEX IF NOT EXISTS idx_eclub_oneri_tekrar_kontrol
  ON public.eclub_oneri_kayitlari
  (oneren_id, kisi_id, video_id, oneri_bitis DESC);

COMMIT;

SELECT
  count(*)::bigint AS toplam_oneri,
  count(*) FILTER (WHERE video_id IS NULL)::bigint AS eksik_video_id,
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eclub_oneri_kayitlari_video_id_fkey'
      AND conrelid = 'public.eclub_oneri_kayitlari'::regclass
  ) AS fk_var,
  to_regclass('public.idx_eclub_oneri_tekrar_kontrol') IS NOT NULL AS indeks_var
FROM public.eclub_oneri_kayitlari;
