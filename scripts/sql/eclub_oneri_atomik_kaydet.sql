-- E-Club önerisini aynı UTT + alıcı + gerçek video ekseninde atomik kaydeder.
-- Advisory transaction lock, eşzamanlı isteklerin tekrar kuralını birlikte geçmesini önler.

CREATE OR REPLACE FUNCTION public.eclub_oneri_atomik_kaydet(
  p_yayin_id uuid,
  p_oneren_id uuid,
  p_kisi_id uuid,
  p_video_id uuid,
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
BEGIN
  IF p_yayin_id IS NULL OR p_oneren_id IS NULL OR p_kisi_id IS NULL OR p_video_id IS NULL THEN
    RAISE EXCEPTION 'Yayın, öneren, kişi ve video kimlikleri zorunludur.' USING ERRCODE = '22023';
  END IF;
  IF p_oneri_baslangic IS NULL OR p_oneri_bitis IS NULL OR p_oneri_bitis <= p_oneri_baslangic THEN
    RAISE EXCEPTION 'Öneri tarih aralığı geçersizdir.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.yayin_yonetimi ym
    JOIN public.soru_seti_durumu ssd
      ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
    JOIN public.soru_setleri ss
      ON ss.soru_seti_id = ssd.soru_seti_id
    JOIN public.video_durumu vd
      ON vd.video_durum_id = ss.video_durum_id
    WHERE ym.yayin_id = p_yayin_id
      AND vd.video_id = p_video_id
  ) THEN
    RAISE EXCEPTION 'Yayın ile video kimliği birbiriyle uyuşmuyor.' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      concat_ws(':', 'eclub-oneri', p_oneren_id::text, p_kisi_id::text, p_video_id::text),
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
    AND o.video_id = p_video_id;

  IF v_tekrar_acilis IS NOT NULL AND p_oneri_baslangic < v_tekrar_acilis THEN
    RETURN QUERY SELECT NULL::uuid, false, 'tekrar'::text, v_tekrar_acilis;
    RETURN;
  END IF;

  INSERT INTO public.eclub_oneri_kayitlari (
    yayin_id,
    oneren_id,
    kisi_id,
    video_id,
    oneri_baslangic,
    oneri_bitis,
    izlendi_mi
  )
  VALUES (
    p_yayin_id,
    p_oneren_id,
    p_kisi_id,
    p_video_id,
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

SELECT
  to_regprocedure(
    'public.eclub_oneri_atomik_kaydet(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'
  ) IS NOT NULL AS fonksiyon_var,
  has_function_privilege(
    'service_role',
    'public.eclub_oneri_atomik_kaydet(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ) AS service_role_calistirabilir,
  NOT has_function_privilege(
    'authenticated',
    'public.eclub_oneri_atomik_kaydet(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ) AS authenticated_calistiramaz;
