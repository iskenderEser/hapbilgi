-- E-Club önerilerini ortak öğrenme aracı kimliğine geçirir.
-- Önkoşul: ogrenme_araclari_faz2_ortak_omurga.sql ve
-- ogrenme_araclari_faz2_yayin_gorunumu.sql uygulanmış olmalıdır.
-- Mevcut video_id alanı yalnız geriye uyumluluk için nullable olarak korunur;
-- yeni sözleşmenin kimliği yayin_id + arac_id + arac_turu alanlarıdır.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-ortak-arac-kimligi-v1', 1));

ALTER TABLE public.eclub_oneri_kayitlari
  ADD COLUMN IF NOT EXISTS arac_id uuid,
  ADD COLUMN IF NOT EXISTS arac_turu text;

UPDATE public.eclub_oneri_kayitlari o
SET arac_id = vyd.arac_id,
    arac_turu = vyd.arac_turu
FROM public.v_yayin_detay vyd
WHERE vyd.yayin_id = o.yayin_id
  AND (o.arac_id IS NULL OR o.arac_turu IS NULL);

DO $kontrol$
DECLARE
  v_eksik bigint;
  v_uyumsuz bigint;
BEGIN
  SELECT count(*) INTO v_eksik
  FROM public.eclub_oneri_kayitlari
  WHERE arac_id IS NULL OR arac_turu IS NULL;

  IF v_eksik > 0 THEN
    RAISE EXCEPTION 'E-Club önerilerinde ortak araç kimliği doldurulamayan % kayıt var; işlem geri alındı.', v_eksik;
  END IF;

  SELECT count(*) INTO v_uyumsuz
  FROM public.eclub_oneri_kayitlari o
  JOIN public.v_yayin_detay vyd ON vyd.yayin_id = o.yayin_id
  WHERE o.arac_id IS DISTINCT FROM vyd.arac_id
     OR o.arac_turu IS DISTINCT FROM vyd.arac_turu;

  IF v_uyumsuz > 0 THEN
    RAISE EXCEPTION 'E-Club önerilerinde yayın/öğrenme aracı bağıyla uyuşmayan % kayıt var; işlem geri alındı.', v_uyumsuz;
  END IF;
END;
$kontrol$;

ALTER TABLE public.eclub_oneri_kayitlari
  ALTER COLUMN arac_id SET NOT NULL,
  ALTER COLUMN arac_turu SET NOT NULL,
  ALTER COLUMN video_id DROP NOT NULL;

DO $kisit$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eclub_oneri_kayitlari_arac_id_fkey'
      AND conrelid = 'public.eclub_oneri_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.eclub_oneri_kayitlari
      ADD CONSTRAINT eclub_oneri_kayitlari_arac_id_fkey
      FOREIGN KEY (arac_id)
      REFERENCES public.ogrenme_araclari(arac_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eclub_oneri_kayitlari_arac_turu_ck'
      AND conrelid = 'public.eclub_oneri_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.eclub_oneri_kayitlari
      ADD CONSTRAINT eclub_oneri_kayitlari_arac_turu_ck
      CHECK (arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf'));
  END IF;
END;
$kisit$;

DROP INDEX IF EXISTS public.idx_eclub_oneri_tekrar_kontrol;
CREATE INDEX idx_eclub_oneri_tekrar_kontrol
  ON public.eclub_oneri_kayitlari
  (oneren_id, kisi_id, arac_id, oneri_bitis DESC);

-- Parametre tipi değişmediği için p_video_id -> p_arac_id adını güvenle
-- değiştirmek üzere eski imza önce kaldırılır, sonra ortak sözleşmeyle kurulur.
DROP FUNCTION IF EXISTS public.eclub_oneri_atomik_kaydet(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz
);

CREATE FUNCTION public.eclub_oneri_atomik_kaydet(
  p_yayin_id uuid,
  p_oneren_id uuid,
  p_kisi_id uuid,
  p_arac_id uuid,
  p_oneri_baslangic timestamptz,
  p_oneri_bitis timestamptz
)
RETURNS TABLE (
  oneri_id uuid,
  kaydedildi boolean,
  sebep text,
  yeniden_gonderilebilir_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $fonksiyon$
DECLARE
  v_bekleme_gun integer := 21;
  v_tekrar_acilis timestamptz;
  v_oneri_id uuid;
  v_arac_turu text;
  v_legacy_video_id uuid;
BEGIN
  IF p_yayin_id IS NULL OR p_oneren_id IS NULL OR p_kisi_id IS NULL OR p_arac_id IS NULL THEN
    RAISE EXCEPTION 'Yayın, öneren, kişi ve öğrenme aracı kimlikleri zorunludur.' USING ERRCODE = '22023';
  END IF;
  IF p_oneri_baslangic IS NULL OR p_oneri_bitis IS NULL OR p_oneri_bitis <= p_oneri_baslangic THEN
    RAISE EXCEPTION 'Öneri tarih aralığı geçersizdir.' USING ERRCODE = '22023';
  END IF;

  SELECT vyd.arac_turu, oa.legacy_video_id
  INTO v_arac_turu, v_legacy_video_id
  FROM public.v_yayin_detay vyd
  JOIN public.ogrenme_araclari oa ON oa.arac_id = vyd.arac_id
  WHERE vyd.yayin_id = p_yayin_id
    AND vyd.arac_id = p_arac_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın ile öğrenme aracı kimliği birbiriyle uyuşmuyor.' USING ERRCODE = '23514';
  END IF;
  IF v_arac_turu NOT IN ('video', 'podcast', 'gorsel', 'flip_pdf') THEN
    RAISE EXCEPTION 'Öğrenme aracı türü geçersiz.' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', 'eclub-oneri', p_oneren_id::text, p_kisi_id::text, p_arac_id::text),
      0
    )
  );

  SELECT CASE
           WHEN jsonb_typeof(sa.deger) = 'number'
            AND (sa.deger #>> '{}')::integer > 0
             THEN (sa.deger #>> '{}')::integer
           ELSE 21
         END
  INTO v_bekleme_gun
  FROM public.sistem_ayarlari sa
  WHERE sa.anahtar = 'eclub_ayni_video_tekrar_bekleme_gun';
  v_bekleme_gun := COALESCE(v_bekleme_gun, 21);

  SELECT max(o.oneri_bitis) + make_interval(days => v_bekleme_gun)
  INTO v_tekrar_acilis
  FROM public.eclub_oneri_kayitlari o
  WHERE o.oneren_id = p_oneren_id
    AND o.kisi_id = p_kisi_id
    AND o.arac_id = p_arac_id;

  IF v_tekrar_acilis IS NOT NULL AND p_oneri_baslangic < v_tekrar_acilis THEN
    RETURN QUERY SELECT NULL::uuid, false, 'tekrar'::text, v_tekrar_acilis;
    RETURN;
  END IF;

  INSERT INTO public.eclub_oneri_kayitlari (
    yayin_id,
    oneren_id,
    kisi_id,
    arac_id,
    arac_turu,
    video_id,
    oneri_baslangic,
    oneri_bitis,
    izlendi_mi
  )
  VALUES (
    p_yayin_id,
    p_oneren_id,
    p_kisi_id,
    p_arac_id,
    v_arac_turu,
    v_legacy_video_id,
    p_oneri_baslangic,
    p_oneri_bitis,
    false
  )
  RETURNING eclub_oneri_kayitlari.oneri_id INTO v_oneri_id;

  RETURN QUERY SELECT v_oneri_id, true, NULL::text, NULL::timestamptz;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eclub_oneri_atomik_kaydet(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_oneri_atomik_kaydet(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz
) TO service_role;

COMMIT;

SELECT
  count(*)::bigint AS toplam_oneri,
  count(*) FILTER (WHERE arac_id IS NULL OR arac_turu IS NULL)::bigint AS eksik_ortak_kimlik,
  count(*) FILTER (WHERE arac_turu <> 'video' AND video_id IS NOT NULL)::bigint AS yeni_aracta_legacy_video_bagi,
  to_regclass('public.idx_eclub_oneri_tekrar_kontrol') IS NOT NULL AS tekrar_indeksi_var,
  to_regprocedure(
    'public.eclub_oneri_atomik_kaydet(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NOT NULL AS atomik_rpc_var
FROM public.eclub_oneri_kayitlari;
