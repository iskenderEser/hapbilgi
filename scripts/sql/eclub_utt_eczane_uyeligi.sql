-- Eczane-firma kurumsal bağını UTT'nin kişisel E-Club liste üyeliğinden ayırır.
-- Mevcut baglayan_utt_id verisini kayıpsız geri doldurur ve ekleme/çıkarma
-- işlemlerini eşzamanlı isteklere karşı atomik RPC'lere taşır.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-utt-eczane-uyeligi-v1', 1));

CREATE TABLE IF NOT EXISTS public.eclub_utt_eczane (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eczane_firma_id uuid NOT NULL
    REFERENCES public.eclub_eczane_firma(id) ON DELETE CASCADE,
  utt_id uuid NOT NULL
    REFERENCES public.kullanicilar(kullanici_id),
  aktif_mi boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  bitis_tarihi timestamp with time zone,
  CONSTRAINT eclub_utt_eczane_bag_uq UNIQUE (eczane_firma_id, utt_id)
);

CREATE INDEX IF NOT EXISTS idx_eclub_utt_eczane_aktif_utt
  ON public.eclub_utt_eczane (utt_id, eczane_firma_id)
  WHERE aktif_mi = true;

ALTER TABLE public.eclub_utt_eczane ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eclub_utt_eczane FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eclub_utt_eczane TO service_role;

INSERT INTO public.eclub_utt_eczane (
  eczane_firma_id,
  utt_id,
  aktif_mi,
  created_at,
  bitis_tarihi
)
SELECT
  ef.id,
  ef.baglayan_utt_id,
  ef.aktif_mi,
  COALESCE(ef.created_at, now()),
  CASE WHEN ef.aktif_mi THEN NULL ELSE now() END
FROM public.eclub_eczane_firma ef
ON CONFLICT (eczane_firma_id, utt_id) DO UPDATE
SET aktif_mi = EXCLUDED.aktif_mi,
    bitis_tarihi = EXCLUDED.bitis_tarihi;

CREATE OR REPLACE FUNCTION public.eclub_utt_eczaneye_bagla(
  p_utt_id uuid,
  p_gln text
)
RETURNS TABLE(
  ok boolean,
  sebep text,
  eczane_id uuid,
  eczane_firma_id uuid,
  utt_eczane_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_firma_id uuid;
  v_eczane_id uuid;
  v_eczane_firma_id uuid;
  v_utt_eczane_id uuid;
  v_uyelik_aktif boolean;
BEGIN
  IF p_utt_id IS NULL OR p_gln IS NULL OR p_gln !~ '^[0-9]{13}$' THEN
    RETURN QUERY SELECT false, 'gecersiz_girdi', NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT k.firma_id
  INTO v_firma_id
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_utt_id
    AND lower(k.rol) IN ('utt', 'kd_utt')
    AND k.aktif_mi = true;

  IF NOT FOUND OR v_firma_id IS NULL THEN
    RETURN QUERY SELECT false, 'utt_yetkisiz', NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.eclub_eczane_master em
    WHERE em.gln = p_gln
      AND em.onay_durumu = 'onayli'
  ) THEN
    RETURN QUERY SELECT false, 'eczane_onaysiz', NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('eclub-utt-eczane:' || v_firma_id::text || ':' || p_gln, 0)
  );

  SELECT e.eczane_id
  INTO v_eczane_id
  FROM public.eclub_eczaneler e
  WHERE e.gln = p_gln
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.eclub_eczaneler (gln)
    VALUES (p_gln)
    RETURNING eclub_eczaneler.eczane_id INTO v_eczane_id;
  END IF;

  SELECT ef.id
  INTO v_eczane_firma_id
  FROM public.eclub_eczane_firma ef
  WHERE ef.eczane_id = v_eczane_id
    AND ef.firma_id = v_firma_id
  ORDER BY ef.aktif_mi DESC, ef.created_at DESC NULLS LAST, ef.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.eclub_eczane_firma (
      eczane_id,
      firma_id,
      baglayan_utt_id,
      aktif_mi
    )
    VALUES (
      v_eczane_id,
      v_firma_id,
      p_utt_id,
      true
    )
    RETURNING id INTO v_eczane_firma_id;
  ELSE
    UPDATE public.eclub_eczane_firma
    SET aktif_mi = true
    WHERE id = v_eczane_firma_id
      AND aktif_mi = false;
  END IF;

  SELECT ue.id, ue.aktif_mi
  INTO v_utt_eczane_id, v_uyelik_aktif
  FROM public.eclub_utt_eczane ue
  WHERE ue.eczane_firma_id = v_eczane_firma_id
    AND ue.utt_id = p_utt_id
  FOR UPDATE;

  IF FOUND AND v_uyelik_aktif THEN
    RETURN QUERY SELECT false, 'tekrar', v_eczane_id, v_eczane_firma_id, v_utt_eczane_id;
    RETURN;
  ELSIF FOUND THEN
    UPDATE public.eclub_utt_eczane
    SET aktif_mi = true,
        created_at = now(),
        bitis_tarihi = NULL
    WHERE id = v_utt_eczane_id;
  ELSE
    INSERT INTO public.eclub_utt_eczane (eczane_firma_id, utt_id)
    VALUES (v_eczane_firma_id, p_utt_id)
    RETURNING id INTO v_utt_eczane_id;
  END IF;

  RETURN QUERY SELECT true, 'kaydedildi', v_eczane_id, v_eczane_firma_id, v_utt_eczane_id;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eclub_utt_eczaneden_cikar(
  p_utt_id uuid,
  p_eczane_id uuid
)
RETURNS TABLE(
  ok boolean,
  sebep text,
  kalan_aktif_utt integer,
  admin_sinyali boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_firma_id uuid;
  v_eczane_firma_id uuid;
  v_utt_eczane_id uuid;
  v_kalan integer;
  v_pasif_utt integer;
BEGIN
  SELECT k.firma_id
  INTO v_firma_id
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_utt_id
    AND lower(k.rol) IN ('utt', 'kd_utt')
    AND k.aktif_mi = true;

  IF NOT FOUND OR v_firma_id IS NULL THEN
    RETURN QUERY SELECT false, 'utt_yetkisiz', 0, false;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('eclub-utt-eczane:' || v_firma_id::text || ':' || p_eczane_id::text, 0)
  );

  SELECT ef.id, ue.id
  INTO v_eczane_firma_id, v_utt_eczane_id
  FROM public.eclub_eczane_firma ef
  JOIN public.eclub_utt_eczane ue ON ue.eczane_firma_id = ef.id
  WHERE ef.eczane_id = p_eczane_id
    AND ef.firma_id = v_firma_id
    AND ef.aktif_mi = true
    AND ue.utt_id = p_utt_id
    AND ue.aktif_mi = true
  FOR UPDATE OF ef, ue;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'uyelik_yok', 0, false;
    RETURN;
  END IF;

  UPDATE public.eclub_utt_eczane
  SET aktif_mi = false,
      bitis_tarihi = now()
  WHERE id = v_utt_eczane_id;

  SELECT count(*)::integer
  INTO v_kalan
  FROM public.eclub_utt_eczane ue
  WHERE ue.eczane_firma_id = v_eczane_firma_id
    AND ue.aktif_mi = true;

  IF v_kalan = 0 THEN
    UPDATE public.eclub_eczane_firma
    SET aktif_mi = false
    WHERE id = v_eczane_firma_id;
  END IF;

  SELECT count(DISTINCT ue.utt_id)::integer
  INTO v_pasif_utt
  FROM public.eclub_utt_eczane ue
  WHERE ue.eczane_firma_id = v_eczane_firma_id
    AND ue.aktif_mi = false;

  RETURN QUERY SELECT true, 'pasife_alindi', v_kalan, v_pasif_utt >= 5;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eclub_utt_eczaneye_bagla(uuid, text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_utt_eczaneden_cikar(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_utt_eczaneye_bagla(uuid, text)
TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_utt_eczaneden_cikar(uuid, uuid)
TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  (SELECT count(*) FROM public.eclub_eczane_firma) AS toplam_firma_bagi,
  (SELECT count(*) FROM public.eclub_utt_eczane) AS toplam_utt_uyeligi,
  (SELECT count(*)
   FROM public.eclub_eczane_firma ef
   LEFT JOIN public.eclub_utt_eczane ue
     ON ue.eczane_firma_id = ef.id
    AND ue.utt_id = ef.baglayan_utt_id
   WHERE ue.id IS NULL) AS geri_doldurulmayan,
  to_regprocedure('public.eclub_utt_eczaneye_bagla(uuid,text)') IS NOT NULL AS ekleme_rpc_var,
  to_regprocedure('public.eclub_utt_eczaneden_cikar(uuid,uuid)') IS NOT NULL AS cikarma_rpc_var;
