-- E-Club sipariş takibi: çek talebinden bağımsız UTT sipariş inceleme/onayı.
-- Bu dosya yalnız proje sahibi tarafından Supabase SQL Editor'da çalıştırılır.
-- Önkoşul: eclub_store_cek_talepleri ve eclub_depo_tercihleri.sql uygulanmış olmalıdır.
BEGIN;

CREATE TABLE IF NOT EXISTS public.eclub_siparis_utt_onaylari (
  talep_id uuid PRIMARY KEY REFERENCES public.eclub_store_cek_talepleri(talep_id),
  utt_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  onay_tarihi timestamptz NOT NULL DEFAULT now(),
  depo_tercihleri_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT eclub_siparis_utt_onaylari_depo_snapshot_array
    CHECK (jsonb_typeof(depo_tercihleri_snapshot) = 'array')
);

CREATE INDEX IF NOT EXISTS eclub_siparis_utt_onaylari_utt_tarih_idx
  ON public.eclub_siparis_utt_onaylari (utt_id, onay_tarihi DESC);

ALTER TABLE public.eclub_siparis_utt_onaylari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eclub_siparis_utt_onaylari FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.eclub_siparis_utt_onaylari TO service_role;

CREATE OR REPLACE FUNCTION public.eclub_siparis_utt_onayla(p_utt_id uuid, p_talep_id uuid)
RETURNS TABLE(ok boolean, hata text, onay_tarihi timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_talep public.eclub_store_cek_talepleri%rowtype;
  v_snapshot jsonb;
  v_onay timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar k
    JOIN public.firmalar f ON f.firma_id = k.firma_id
    WHERE k.kullanici_id = p_utt_id AND k.aktif_mi = true
      AND lower(k.rol) IN ('utt', 'kd_utt')
      AND f.aktif = true AND f.eclub_aktif = true AND f.eclub_store_aktif = true
  ) THEN
    RETURN QUERY SELECT false, 'UTT yetkisi doğrulanamadı.'::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT t.* INTO v_talep
  FROM public.eclub_store_cek_talepleri t
  JOIN public.kullanicilar k ON k.kullanici_id = p_utt_id AND k.firma_id = t.firma_id
  WHERE t.talep_id = p_talep_id AND t.utt_id = p_utt_id
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Sipariş UTT kapsamınızda değil.'::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT v_talep.siparis_verildi_mi OR v_talep.siparis_tipi = 'siparissiz_cek' THEN
    RETURN QUERY SELECT false, 'Bu talepte ürün siparişi bulunmuyor.'::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_talep.durum = 'iptal' THEN
    RETURN QUERY SELECT false, 'İptal edilmiş talep onaylanamaz.'::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.eclub_siparis_utt_onaylari WHERE talep_id = p_talep_id) THEN
    RETURN QUERY SELECT false, 'Sipariş zaten onaylanmış.'::text, NULL::timestamptz;
    RETURN;
  END IF;
  -- Depo tercihi düzenleme RPC'si de eczane satırını kilitler. Onay anlık
  -- görüntüsü doğrulanan tercihlerle aynı transaction'da sabitlenir.
  PERFORM 1 FROM public.eclub_eczaneler WHERE eczane_id = v_talep.eczane_id FOR UPDATE;
  IF NOT public.eclub_eczane_depolari_hazir(v_talep.eczane_id) THEN
    RETURN QUERY SELECT false, 'Eczanenin kullanılabilir depo tercihi bulunmuyor.'::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('depo_sube_id', d.depo_sube_id)
    ORDER BY d.depo_sube_id), '[]'::jsonb)
  INTO v_snapshot
  FROM public.eclub_eczane_depo_tercihleri d
  WHERE d.eczane_id = v_talep.eczane_id;

  INSERT INTO public.eclub_siparis_utt_onaylari (talep_id, utt_id, depo_tercihleri_snapshot)
  VALUES (p_talep_id, p_utt_id, v_snapshot)
  RETURNING eclub_siparis_utt_onaylari.onay_tarihi INTO v_onay;

  RETURN QUERY SELECT true, NULL::text, v_onay;
END $f$;

REVOKE ALL ON FUNCTION public.eclub_siparis_utt_onayla(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_siparis_utt_onayla(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
