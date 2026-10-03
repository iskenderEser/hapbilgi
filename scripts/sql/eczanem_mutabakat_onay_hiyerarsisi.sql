-- Eczanem mutabakatı UTT -> BM -> TM onay hiyerarşisi.
-- eczanem_utt_mutabakat_kayit.sql ve eczanem_utt_mutabakat_rpc.sql sonrasında
-- yalnız İskender tarafından Supabase SQL Editor'de çalıştırılır.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eczanem-mutabakat-onay-hiyerarsisi', 1));

ALTER TABLE public.eczanem_utt_mutabakatlar
  ADD COLUMN IF NOT EXISTS onay_durumu text NOT NULL DEFAULT 'utt_hazirliginda',
  ADD COLUMN IF NOT EXISTS bm_id uuid REFERENCES public.kullanicilar(kullanici_id),
  ADD COLUMN IF NOT EXISTS utt_gonderim_tarihi timestamptz,
  ADD COLUMN IF NOT EXISTS bm_karar text,
  ADD COLUMN IF NOT EXISTS bm_karar_veren_id uuid REFERENCES public.kullanicilar(kullanici_id),
  ADD COLUMN IF NOT EXISTS bm_karar_tarihi timestamptz,
  ADD COLUMN IF NOT EXISTS bm_karar_surumu integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bm_onay_tarihi timestamptz,
  ADD COLUMN IF NOT EXISTS tm_id uuid REFERENCES public.kullanicilar(kullanici_id),
  ADD COLUMN IF NOT EXISTS tm_karar text,
  ADD COLUMN IF NOT EXISTS tm_karar_veren_id uuid REFERENCES public.kullanicilar(kullanici_id),
  ADD COLUMN IF NOT EXISTS tm_karar_tarihi timestamptz,
  ADD COLUMN IF NOT EXISTS tm_karar_surumu integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tm_onay_tarihi timestamptz;

ALTER TABLE public.eczanem_utt_mutabakatlar
  DROP CONSTRAINT IF EXISTS eczanem_utt_mutabakatlar_onay_durumu_check;
ALTER TABLE public.eczanem_utt_mutabakatlar
  ADD CONSTRAINT eczanem_utt_mutabakatlar_onay_durumu_check
  CHECK (onay_durumu IN ('utt_hazirliginda','bm_onayinda','tm_onayinda','onaylandi','tm_reddetti'));

ALTER TABLE public.eczanem_utt_mutabakatlar
  DROP CONSTRAINT IF EXISTS eczanem_utt_mutabakatlar_bm_karar_check;
ALTER TABLE public.eczanem_utt_mutabakatlar
  ADD CONSTRAINT eczanem_utt_mutabakatlar_bm_karar_check
  CHECK (
    bm_karar_surumu >= 0
    AND (bm_karar IS NULL OR bm_karar IN ('onay', 'beklet', 'ret'))
    AND ((bm_karar IS NULL AND bm_karar_veren_id IS NULL AND bm_karar_tarihi IS NULL)
      OR (bm_karar IS NOT NULL AND bm_karar_veren_id IS NOT NULL AND bm_karar_tarihi IS NOT NULL))
  );

ALTER TABLE public.eczanem_utt_mutabakatlar
  DROP CONSTRAINT IF EXISTS eczanem_utt_mutabakatlar_tm_karar_check;
ALTER TABLE public.eczanem_utt_mutabakatlar
  ADD CONSTRAINT eczanem_utt_mutabakatlar_tm_karar_check
  CHECK (
    tm_karar_surumu >= 0
    AND (tm_karar IS NULL OR tm_karar IN ('onay', 'beklet', 'ret'))
    AND ((tm_karar IS NULL AND tm_karar_veren_id IS NULL AND tm_karar_tarihi IS NULL)
      OR (tm_karar IS NOT NULL AND tm_karar_veren_id IS NOT NULL AND tm_karar_tarihi IS NOT NULL))
  );

CREATE TABLE IF NOT EXISTS public.eczanem_bm_mutabakat_kararlari (
  karar_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mutabakat_id uuid NOT NULL REFERENCES public.eczanem_utt_mutabakatlar(mutabakat_id) ON DELETE RESTRICT,
  surum integer NOT NULL CHECK (surum > 0),
  karar text NOT NULL CHECK (karar IN ('onay', 'beklet', 'ret')),
  karar_veren_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  karar_tarihi timestamptz NOT NULL,
  UNIQUE (mutabakat_id, surum)
);

CREATE TABLE IF NOT EXISTS public.eczanem_tm_mutabakat_kararlari (
  karar_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mutabakat_id uuid NOT NULL REFERENCES public.eczanem_utt_mutabakatlar(mutabakat_id) ON DELETE RESTRICT,
  surum integer NOT NULL CHECK (surum > 0),
  karar text NOT NULL CHECK (karar IN ('onay', 'beklet', 'ret')),
  karar_veren_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  karar_tarihi timestamptz NOT NULL,
  UNIQUE (mutabakat_id, surum)
);

ALTER TABLE public.eczanem_bm_mutabakat_kararlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eczanem_tm_mutabakat_kararlari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eczanem_bm_mutabakat_kararlari FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.eczanem_tm_mutabakat_kararlari FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_eczanem_utt_mutabakatlar_onay_durumu
  ON public.eczanem_utt_mutabakatlar (onay_durumu, bm_id, tm_id);
CREATE INDEX IF NOT EXISTS idx_eczanem_bm_mutabakat_kararlari_islem
  ON public.eczanem_bm_mutabakat_kararlari (mutabakat_id, surum DESC);
CREATE INDEX IF NOT EXISTS idx_eczanem_tm_mutabakat_kararlari_islem
  ON public.eczanem_tm_mutabakat_kararlari (mutabakat_id, surum DESC);

CREATE OR REPLACE FUNCTION public.eczanem_mutabakat_onay_durumlari(
  p_utt_id uuid,
  p_mutabakat_idler uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE v_sonuc jsonb;
BEGIN
  IF p_utt_id IS NULL OR p_mutabakat_idler IS NULL OR cardinality(p_mutabakat_idler) > 100 THEN
    RAISE EXCEPTION 'Geçersiz mutabakat onay durumu isteği.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mutabakat_id', m.mutabakat_id,
    'onay_durumu', m.onay_durumu,
    'bm_id', m.bm_id,
    'utt_gonderim_tarihi', m.utt_gonderim_tarihi,
    'bm_karar', m.bm_karar,
    'bm_karar_tarihi', m.bm_karar_tarihi,
    'bm_karar_surumu', m.bm_karar_surumu,
    'bm_onay_tarihi', m.bm_onay_tarihi,
    'tm_id', m.tm_id,
    'tm_karar', m.tm_karar,
    'tm_karar_tarihi', m.tm_karar_tarihi,
    'tm_karar_surumu', m.tm_karar_surumu,
    'tm_onay_tarihi', m.tm_onay_tarihi
  )), '[]'::jsonb)
  INTO v_sonuc
  FROM public.eczanem_utt_mutabakatlar m
  JOIN public.eczanem_indirim_onaylari o ON o.eczanem_indirim_onay_id = m.mutabakat_id
  WHERE m.mutabakat_id = ANY(p_mutabakat_idler)
    AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id);

  RETURN v_sonuc;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_utt_mutabakat_karar_ver(
  p_utt_id uuid,
  p_mutabakat_id uuid,
  p_karar text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_onay public.eczanem_indirim_onaylari%ROWTYPE;
  v_mutabakat public.eczanem_utt_mutabakatlar%ROWTYPE;
  v_simdi timestamptz := clock_timestamp();
  v_simdi_tr timestamp;
  v_ay_basi_tr timestamp;
BEGIN
  IF p_karar IS NULL OR p_karar NOT IN ('onay', 'beklet', 'ret') OR p_mutabakat_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz UTT mutabakat kararı.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_mutabakat FROM public.eczanem_utt_mutabakatlar
  WHERE mutabakat_id = p_mutabakat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mutabakat bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_mutabakat.onay_durumu <> 'utt_hazirliginda' THEN
    RAISE EXCEPTION 'BM onayına gönderilen mutabakat kararı değiştirilemez.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_onay FROM public.eczanem_indirim_onaylari
  WHERE eczanem_indirim_onay_id = p_mutabakat_id;
  IF NOT public.eczanem_utt_mutabakat_yetkili_mi(
    p_utt_id, v_onay.firma_id, v_onay.takim_id, v_onay.eczane_id
  ) THEN
    RAISE EXCEPTION 'Bu mutabakat işleminde UTT yetkiniz yok.' USING ERRCODE = '42501';
  END IF;

  v_simdi_tr := timezone('Europe/Istanbul', v_simdi);
  v_ay_basi_tr := date_trunc('month', v_simdi_tr);
  IF v_simdi_tr >= v_ay_basi_tr + INTERVAL '7 days'
     OR timezone('Europe/Istanbul', v_onay.onay_tarihi) < v_ay_basi_tr - INTERVAL '1 month'
     OR timezone('Europe/Istanbul', v_onay.onay_tarihi) >= v_ay_basi_tr THEN
    RAISE EXCEPTION 'Karar yalnız önceki ay işlemleri için ayın ilk yedi günü verilebilir.' USING ERRCODE = 'P0001';
  END IF;

  IF v_mutabakat.utt_karar IS NOT DISTINCT FROM p_karar THEN
    RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
      'karar_tarihi', v_mutabakat.utt_karar_tarihi, 'surum', v_mutabakat.karar_surumu);
  END IF;

  UPDATE public.eczanem_utt_mutabakatlar
  SET utt_karar = p_karar, utt_karar_veren_id = p_utt_id, utt_karar_tarihi = v_simdi,
      karar_surumu = karar_surumu + 1
  WHERE mutabakat_id = p_mutabakat_id
  RETURNING * INTO v_mutabakat;

  INSERT INTO public.eczanem_utt_mutabakat_kararlari
    (mutabakat_id, surum, karar, karar_veren_id, karar_tarihi)
  VALUES (p_mutabakat_id, v_mutabakat.karar_surumu, p_karar, p_utt_id, v_simdi);

  RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
    'karar_tarihi', v_simdi, 'surum', v_mutabakat.karar_surumu);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_mutabakat_bm_onayina_gonder(
  p_utt_id uuid,
  p_mutabakat_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_onay public.eczanem_indirim_onaylari%ROWTYPE;
  v_mutabakat public.eczanem_utt_mutabakatlar%ROWTYPE;
  v_bm_idler uuid[];
  v_simdi timestamptz := clock_timestamp();
  v_simdi_tr timestamp;
  v_ay_basi_tr timestamp;
BEGIN
  SELECT * INTO v_mutabakat FROM public.eczanem_utt_mutabakatlar
  WHERE mutabakat_id = p_mutabakat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mutabakat bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_onay FROM public.eczanem_indirim_onaylari
  WHERE eczanem_indirim_onay_id = p_mutabakat_id;
  IF NOT public.eczanem_utt_mutabakat_yetkili_mi(
    p_utt_id, v_onay.firma_id, v_onay.takim_id, v_onay.eczane_id
  ) THEN RAISE EXCEPTION 'Bu mutabakat işleminde UTT yetkiniz yok.' USING ERRCODE = '42501'; END IF;
  IF v_mutabakat.onay_durumu <> 'utt_hazirliginda' OR v_mutabakat.utt_karar <> 'onay' THEN
    RAISE EXCEPTION 'Yalnız UTT tarafından onaylanmış mutabakat BM onayına gönderilebilir.' USING ERRCODE = 'P0001';
  END IF;

  v_simdi_tr := timezone('Europe/Istanbul', v_simdi);
  v_ay_basi_tr := date_trunc('month', v_simdi_tr);
  IF v_simdi_tr >= v_ay_basi_tr + INTERVAL '7 days'
     OR timezone('Europe/Istanbul', v_onay.onay_tarihi) < v_ay_basi_tr - INTERVAL '1 month'
     OR timezone('Europe/Istanbul', v_onay.onay_tarihi) >= v_ay_basi_tr THEN
    RAISE EXCEPTION 'Mutabakat yalnız önceki ay işlemleri için ayın ilk yedi günü BM onayına gönderilebilir.' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(bm.kullanici_id ORDER BY bm.kullanici_id) INTO v_bm_idler
  FROM public.kullanicilar utt
  JOIN public.kullanicilar bm
    ON bm.firma_id = utt.firma_id
   AND bm.takim_id IS NOT DISTINCT FROM utt.takim_id
   AND bm.bolge_id IS NOT DISTINCT FROM utt.bolge_id
   AND lower(bm.rol) = 'bm' AND bm.aktif_mi = true
  WHERE utt.kullanici_id = p_utt_id AND utt.aktif_mi = true;
  IF cardinality(v_bm_idler) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Bölge için tek bir aktif BM atanmalıdır.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.eczanem_utt_mutabakatlar
  SET onay_durumu = 'bm_onayinda', bm_id = v_bm_idler[1], utt_gonderim_tarihi = v_simdi,
      bm_karar = NULL, bm_karar_veren_id = NULL, bm_karar_tarihi = NULL,
      bm_onay_tarihi = NULL, tm_id = NULL,
      tm_karar = NULL, tm_karar_veren_id = NULL, tm_karar_tarihi = NULL,
      tm_onay_tarihi = NULL
  WHERE mutabakat_id = p_mutabakat_id;

  RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'onay_durumu', 'bm_onayinda',
    'bm_id', v_bm_idler[1], 'utt_gonderim_tarihi', v_simdi);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_mutabakat_bm_karar_ver(
  p_bm_id uuid,
  p_mutabakat_id uuid,
  p_karar text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_mutabakat public.eczanem_utt_mutabakatlar%ROWTYPE;
  v_simdi timestamptz := clock_timestamp();
  v_sonraki_surum integer;
BEGIN
  IF p_karar IS NULL OR p_karar NOT IN ('onay', 'beklet', 'ret') OR p_mutabakat_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz BM mutabakat kararı.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kullanicilar
    WHERE kullanici_id = p_bm_id AND aktif_mi = true AND lower(rol) = 'bm') THEN
    RAISE EXCEPTION 'BM yetkisi doğrulanamadı.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mutabakat FROM public.eczanem_utt_mutabakatlar
  WHERE mutabakat_id = p_mutabakat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mutabakat bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_mutabakat.bm_id IS DISTINCT FROM p_bm_id THEN
    RAISE EXCEPTION 'Bu mutabakat BM kapsamınızda değildir.' USING ERRCODE = '42501';
  END IF;
  IF v_mutabakat.onay_durumu <> 'bm_onayinda' THEN
    RAISE EXCEPTION 'TM onayına gönderilen BM kararı değiştirilemez.' USING ERRCODE = 'P0001';
  END IF;

  IF v_mutabakat.bm_karar IS NOT DISTINCT FROM p_karar THEN
    RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
      'karar_tarihi', v_mutabakat.bm_karar_tarihi, 'surum', v_mutabakat.bm_karar_surumu);
  END IF;

  SELECT GREATEST(
    v_mutabakat.bm_karar_surumu,
    COALESCE(MAX(k.surum), 0)
  ) + 1
  INTO v_sonraki_surum
  FROM public.eczanem_bm_mutabakat_kararlari k
  WHERE k.mutabakat_id = p_mutabakat_id;

  UPDATE public.eczanem_utt_mutabakatlar
  SET bm_karar = p_karar, bm_karar_veren_id = p_bm_id, bm_karar_tarihi = v_simdi,
      bm_karar_surumu = v_sonraki_surum
  WHERE mutabakat_id = p_mutabakat_id
  RETURNING * INTO v_mutabakat;

  INSERT INTO public.eczanem_bm_mutabakat_kararlari
    (mutabakat_id, surum, karar, karar_veren_id, karar_tarihi)
  VALUES (p_mutabakat_id, v_sonraki_surum, p_karar, p_bm_id, v_simdi);

  RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
    'karar_tarihi', v_simdi, 'surum', v_mutabakat.bm_karar_surumu);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_mutabakat_tm_onayina_gonder(
  p_bm_id uuid,
  p_mutabakat_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_mutabakat public.eczanem_utt_mutabakatlar%ROWTYPE;
  v_bm public.kullanicilar%ROWTYPE;
  v_tm_idler uuid[];
  v_simdi timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_bm FROM public.kullanicilar
  WHERE kullanici_id = p_bm_id AND aktif_mi = true AND lower(rol) = 'bm';
  IF NOT FOUND THEN RAISE EXCEPTION 'BM yetkisi doğrulanamadı.' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_mutabakat FROM public.eczanem_utt_mutabakatlar
  WHERE mutabakat_id = p_mutabakat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mutabakat bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_mutabakat.bm_id IS DISTINCT FROM p_bm_id THEN
    RAISE EXCEPTION 'Bu mutabakat BM kapsamınızda değildir.' USING ERRCODE = '42501';
  END IF;
  IF v_mutabakat.onay_durumu <> 'bm_onayinda' THEN
    RAISE EXCEPTION 'Mutabakat BM onayı beklemiyor.' USING ERRCODE = 'P0001';
  END IF;
  IF v_mutabakat.bm_karar IS DISTINCT FROM 'onay' THEN
    RAISE EXCEPTION 'Mutabakat TM onayına gönderilmeden önce BM tarafından onaylanmalıdır.' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(tm.kullanici_id ORDER BY tm.kullanici_id) INTO v_tm_idler
  FROM public.kullanicilar tm
  WHERE tm.firma_id = v_bm.firma_id
    AND tm.takim_id IS NOT DISTINCT FROM v_bm.takim_id
    AND lower(tm.rol) = 'tm' AND tm.aktif_mi = true;
  IF cardinality(v_tm_idler) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Takım için tek bir aktif TM atanmalıdır.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.eczanem_utt_mutabakatlar
  SET onay_durumu = 'tm_onayinda', tm_id = v_tm_idler[1], bm_onay_tarihi = v_simdi,
      tm_karar = NULL, tm_karar_veren_id = NULL, tm_karar_tarihi = NULL,
      tm_onay_tarihi = NULL
  WHERE mutabakat_id = p_mutabakat_id;

  RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'onay_durumu', 'tm_onayinda',
    'tm_id', v_tm_idler[1], 'bm_onay_tarihi', v_simdi);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_mutabakat_tm_karar_ver(
  p_tm_id uuid,
  p_mutabakat_id uuid,
  p_karar text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_mutabakat public.eczanem_utt_mutabakatlar%ROWTYPE;
  v_simdi timestamptz := clock_timestamp();
  v_sonraki_durum text;
  v_onay_tarihi timestamptz;
  v_sonraki_surum integer;
BEGIN
  IF p_karar IS NULL OR p_karar NOT IN ('onay', 'beklet', 'ret') OR p_mutabakat_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz TM mutabakat kararı.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kullanicilar
    WHERE kullanici_id = p_tm_id AND aktif_mi = true AND lower(rol) = 'tm') THEN
    RAISE EXCEPTION 'TM yetkisi doğrulanamadı.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mutabakat FROM public.eczanem_utt_mutabakatlar
  WHERE mutabakat_id = p_mutabakat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mutabakat bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_mutabakat.tm_id IS DISTINCT FROM p_tm_id THEN
    RAISE EXCEPTION 'Bu mutabakat TM kapsamınızda değildir.' USING ERRCODE = '42501';
  END IF;

  IF v_mutabakat.onay_durumu IN ('onaylandi', 'tm_reddetti')
     AND v_mutabakat.tm_karar IS NOT DISTINCT FROM p_karar THEN
    RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
      'karar_tarihi', v_mutabakat.tm_karar_tarihi, 'surum', v_mutabakat.tm_karar_surumu,
      'onay_durumu', v_mutabakat.onay_durumu, 'tm_onay_tarihi', v_mutabakat.tm_onay_tarihi);
  END IF;
  IF v_mutabakat.onay_durumu <> 'tm_onayinda' THEN
    RAISE EXCEPTION 'Nihai TM kararı değiştirilemez.' USING ERRCODE = 'P0001';
  END IF;

  IF v_mutabakat.tm_karar IS NOT DISTINCT FROM p_karar THEN
    RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
      'karar_tarihi', v_mutabakat.tm_karar_tarihi, 'surum', v_mutabakat.tm_karar_surumu,
      'onay_durumu', v_mutabakat.onay_durumu, 'tm_onay_tarihi', v_mutabakat.tm_onay_tarihi);
  END IF;

  v_sonraki_durum := CASE p_karar WHEN 'onay' THEN 'onaylandi' WHEN 'ret' THEN 'tm_reddetti' ELSE 'tm_onayinda' END;
  v_onay_tarihi := CASE WHEN p_karar = 'onay' THEN v_simdi ELSE NULL END;

  SELECT GREATEST(
    v_mutabakat.tm_karar_surumu,
    COALESCE(MAX(k.surum), 0)
  ) + 1
  INTO v_sonraki_surum
  FROM public.eczanem_tm_mutabakat_kararlari k
  WHERE k.mutabakat_id = p_mutabakat_id;

  UPDATE public.eczanem_utt_mutabakatlar
  SET tm_karar = p_karar, tm_karar_veren_id = p_tm_id, tm_karar_tarihi = v_simdi,
      tm_karar_surumu = v_sonraki_surum, onay_durumu = v_sonraki_durum,
      tm_onay_tarihi = v_onay_tarihi
  WHERE mutabakat_id = p_mutabakat_id
  RETURNING * INTO v_mutabakat;

  INSERT INTO public.eczanem_tm_mutabakat_kararlari
    (mutabakat_id, surum, karar, karar_veren_id, karar_tarihi)
  VALUES (p_mutabakat_id, v_sonraki_surum, p_karar, p_tm_id, v_simdi);

  RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
    'karar_tarihi', v_simdi, 'surum', v_mutabakat.tm_karar_surumu,
    'onay_durumu', v_sonraki_durum, 'tm_onay_tarihi', v_onay_tarihi);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_mutabakat_tm_onayla(
  p_tm_id uuid,
  p_mutabakat_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_mutabakat public.eczanem_utt_mutabakatlar%ROWTYPE;
  v_simdi timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kullanicilar
    WHERE kullanici_id = p_tm_id AND aktif_mi = true AND lower(rol) = 'tm') THEN
    RAISE EXCEPTION 'TM yetkisi doğrulanamadı.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_mutabakat FROM public.eczanem_utt_mutabakatlar
  WHERE mutabakat_id = p_mutabakat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mutabakat bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_mutabakat.tm_id IS DISTINCT FROM p_tm_id THEN
    RAISE EXCEPTION 'Bu mutabakat TM kapsamınızda değildir.' USING ERRCODE = '42501';
  END IF;
  IF v_mutabakat.onay_durumu <> 'tm_onayinda' THEN
    RAISE EXCEPTION 'Mutabakat TM onayı beklemiyor.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.eczanem_utt_mutabakatlar
  SET onay_durumu = 'onaylandi', tm_onay_tarihi = v_simdi
  WHERE mutabakat_id = p_mutabakat_id;

  RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'onay_durumu', 'onaylandi',
    'tm_onay_tarihi', v_simdi);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_mutabakat_onay_durumlari(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_mutabakat_bm_onayina_gonder(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_mutabakat_bm_karar_ver(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_mutabakat_tm_onayina_gonder(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_mutabakat_tm_karar_ver(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_mutabakat_tm_onayla(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.eczanem_mutabakat_onay_durumlari(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_mutabakat_bm_onayina_gonder(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_mutabakat_bm_karar_ver(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_mutabakat_tm_onayina_gonder(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_mutabakat_tm_karar_ver(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_mutabakat_tm_onayla(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT
  to_regprocedure('public.eczanem_mutabakat_onay_durumlari(uuid,uuid[])') IS NOT NULL AS durum_rpc_hazir,
  to_regprocedure('public.eczanem_mutabakat_bm_onayina_gonder(uuid,uuid)') IS NOT NULL AS utt_rpc_hazir,
  to_regprocedure('public.eczanem_mutabakat_bm_karar_ver(uuid,uuid,text)') IS NOT NULL AS bm_karar_rpc_hazir,
  to_regprocedure('public.eczanem_mutabakat_tm_onayina_gonder(uuid,uuid)') IS NOT NULL AS bm_gonder_rpc_hazir,
  to_regprocedure('public.eczanem_mutabakat_tm_karar_ver(uuid,uuid,text)') IS NOT NULL AS tm_karar_rpc_hazir,
  to_regprocedure('public.eczanem_mutabakat_tm_onayla(uuid,uuid)') IS NOT NULL AS tm_rpc_hazir;
