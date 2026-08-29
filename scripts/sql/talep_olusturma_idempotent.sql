-- Talep oluşturma ile ilk üretim adımını tek transaction içinde ve aynı
-- istemci işlem anahtarıyla güvenli biçimde çalıştırır.
BEGIN;

ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS olusturma_islem_anahtari uuid,
  ADD COLUMN IF NOT EXISTS olusturma_istek_ozeti text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_talepler_uretici_olusturma_islemi
  ON public.talepler (uretici_id, olusturma_islem_anahtari)
  WHERE olusturma_islem_anahtari IS NOT NULL;

CREATE OR REPLACE FUNCTION public.talep_atomik_olustur(
  p_uretici_id uuid,
  p_islem_anahtari uuid,
  p_talep jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep_id uuid;
  v_mevcut_ozet text;
  v_istek_ozeti text;
  v_ilk_gorev jsonb;
BEGIN
  IF p_uretici_id IS NULL OR p_islem_anahtari IS NULL OR p_talep IS NULL THEN
    RAISE EXCEPTION 'Üretici, işlem anahtarı ve talep verisi zorunludur.'
      USING ERRCODE = '22023';
  END IF;

  v_istek_ozeti := md5(p_talep::text);
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_uretici_id::text || ':' || p_islem_anahtari::text, 17)
  );

  SELECT t.talep_id, t.olusturma_istek_ozeti
    INTO v_talep_id, v_mevcut_ozet
  FROM public.talepler t
  WHERE t.uretici_id = p_uretici_id
    AND t.olusturma_islem_anahtari = p_islem_anahtari
  FOR UPDATE;

  IF FOUND THEN
    IF v_mevcut_ozet IS DISTINCT FROM v_istek_ozeti THEN
      RAISE EXCEPTION 'İşlem anahtarı farklı bir talep verisiyle yeniden kullanılamaz.'
        USING ERRCODE = '23505';
    END IF;

    SELECT i.sonuc INTO v_ilk_gorev
    FROM public.uretim_islem_kayitlari i
    WHERE i.islem_anahtari = p_islem_anahtari
      AND i.islem_turu = 'talep_ilk_gorev';

    RETURN jsonb_build_object(
      'talep_id', v_talep_id,
      'mevcut', true,
      'ilk_gorev', v_ilk_gorev
    );
  END IF;

  INSERT INTO public.talepler (
    uretici_id,
    firma_id,
    takim_id,
    egitim_turu,
    hedef_roller,
    icerik_turu,
    ogrenme_araci_turu,
    ogrenme_araci_tercihleri,
    urun_id,
    teknik_id,
    urun_adi,
    aciklama,
    hazir_video,
    hazir_soru_seti,
    hazir_soru_seti_verisi,
    soru_seti_buyuklugu,
    secenek_sayisi,
    video_basi_soru_sayisi,
    olusturma_islem_anahtari,
    olusturma_istek_ozeti
  ) VALUES (
    p_uretici_id,
    (p_talep->>'firma_id')::uuid,
    NULLIF(p_talep->>'takim_id', '')::uuid,
    p_talep->>'egitim_turu',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_talep->'hedef_roller', '[]'::jsonb))),
    p_talep->>'icerik_turu',
    p_talep->>'ogrenme_araci_turu',
    COALESCE(p_talep->'ogrenme_araci_tercihleri', '{}'::jsonb),
    NULLIF(p_talep->>'urun_id', '')::uuid,
    NULLIF(p_talep->>'teknik_id', '')::uuid,
    NULLIF(p_talep->>'urun_adi', ''),
    NULLIF(p_talep->>'aciklama', ''),
    COALESCE((p_talep->>'hazir_video')::boolean, false),
    COALESCE((p_talep->>'hazir_soru_seti')::boolean, false),
    CASE
      WHEN p_talep->'hazir_soru_seti_verisi' IS NULL
        OR jsonb_typeof(p_talep->'hazir_soru_seti_verisi') = 'null'
      THEN NULL
      ELSE p_talep->'hazir_soru_seti_verisi'
    END,
    (p_talep->>'soru_seti_buyuklugu')::integer,
    (p_talep->>'secenek_sayisi')::integer,
    (p_talep->>'video_basi_soru_sayisi')::integer,
    p_islem_anahtari,
    v_istek_ozeti
  )
  RETURNING talep_id INTO v_talep_id;

  v_ilk_gorev := public.uretim_talep_ilk_gorevini_ac(
    v_talep_id,
    p_uretici_id,
    p_islem_anahtari
  );

  RETURN jsonb_build_object(
    'talep_id', v_talep_id,
    'mevcut', false,
    'ilk_gorev', v_ilk_gorev
  );
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.talep_atomik_olustur(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talep_atomik_olustur(uuid, uuid, jsonb)
  TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.talep_atomik_olustur(uuid,uuid,jsonb)') IS NOT NULL
    AS talep_atomik_olusturma_kuruldu,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_talepler_uretici_olusturma_islemi'
  ) AS talep_idempotency_kapisi_kuruldu;
