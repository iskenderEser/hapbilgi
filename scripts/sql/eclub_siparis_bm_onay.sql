-- Supabase SQL Editor'da proje sahibi tarafından çalıştırılır.
-- Önkoşul: eclub_siparis_utt_takip.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.eclub_siparis_bm_onaylari (
  talep_id uuid PRIMARY KEY REFERENCES public.eclub_siparis_utt_onaylari(talep_id) ON DELETE CASCADE,
  bm_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  onay_tarihi timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eclub_siparis_bm_onaylari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eclub_siparis_bm_onaylari FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.eclub_siparis_bm_onaylari TO service_role;

CREATE OR REPLACE FUNCTION public.eclub_siparis_bm_onayla(p_bm_id uuid, p_talep_id uuid)
RETURNS TABLE(ok boolean, hata text, onay_tarihi timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_talep public.eclub_store_cek_talepleri%rowtype;
  v_onay timestamptz;
BEGIN
  SELECT t.* INTO v_talep
  FROM public.eclub_store_cek_talepleri t
  JOIN public.kullanicilar utt ON utt.kullanici_id = t.utt_id
  JOIN public.kullanicilar bm ON bm.kullanici_id = p_bm_id
    AND bm.firma_id = t.firma_id AND bm.firma_id = utt.firma_id
    AND bm.takim_id = utt.takim_id AND bm.bolge_id = utt.bolge_id
  JOIN public.firmalar f ON f.firma_id = bm.firma_id
  WHERE t.talep_id = p_talep_id
    AND lower(bm.rol) = 'bm' AND bm.aktif_mi = true
    AND lower(utt.rol) IN ('utt', 'kd_utt') AND utt.aktif_mi = true
    AND f.aktif = true AND f.eclub_aktif = true AND f.eclub_store_aktif = true
  FOR UPDATE OF t;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Sipariş BM kapsamınızda değil.'::text, NULL::timestamptz; RETURN;
  END IF;
  IF NOT v_talep.siparis_verildi_mi OR v_talep.siparis_tipi = 'siparissiz_cek' OR v_talep.durum = 'iptal' THEN
    RETURN QUERY SELECT false, 'Bu talep için sipariş onayı verilemez.'::text, NULL::timestamptz; RETURN;
  END IF;
  PERFORM 1 FROM public.eclub_siparis_utt_onaylari s
    WHERE s.talep_id = p_talep_id AND s.utt_id = v_talep.utt_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Önce UTT sipariş onayı gerekli.'::text, NULL::timestamptz; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.eclub_siparis_bm_onaylari s WHERE s.talep_id = p_talep_id) THEN
    RETURN QUERY SELECT false, 'Sipariş zaten BM tarafından onaylanmış.'::text, NULL::timestamptz; RETURN;
  END IF;
  INSERT INTO public.eclub_siparis_bm_onaylari(talep_id, bm_id)
    VALUES (p_talep_id, p_bm_id)
    RETURNING eclub_siparis_bm_onaylari.onay_tarihi INTO v_onay;
  RETURN QUERY SELECT true, NULL::text, v_onay;
END $f$;
REVOKE ALL ON FUNCTION public.eclub_siparis_bm_onayla(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_siparis_bm_onayla(uuid, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
