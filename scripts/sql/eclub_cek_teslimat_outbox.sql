-- Faz 3A: Çek kodu kaydı ile e-posta/push teslimat işlerini tek transaction'da oluşturur.
BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-cek-teslimat-outbox-faz-3a', 1));

CREATE TABLE IF NOT EXISTS public.eclub_cek_teslimat_outbox (
  outbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  olay_id uuid NOT NULL,
  talep_id uuid NOT NULL REFERENCES public.eclub_store_cek_talepleri(talep_id) ON DELETE CASCADE,
  olay_turu text NOT NULL DEFAULT 'eclub_cek_teslim',
  kanal text NOT NULL CHECK (kanal IN ('eposta','push')),
  alici_kisi_id uuid NOT NULL REFERENCES public.eclub_kisiler(kisi_id),
  alici_eposta text,
  payload jsonb NOT NULL,
  durum text NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','isleniyor','tamamlandi','basarisiz')),
  deneme_sayisi integer NOT NULL DEFAULT 0 CHECK (deneme_sayisi >= 0),
  max_deneme integer NOT NULL DEFAULT 5 CHECK (max_deneme > 0),
  sonraki_deneme_at timestamptz NOT NULL DEFAULT now(),
  lease_bitis timestamptz,
  son_hata_kodu text,
  tamamlanma_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  guncellenme_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eclub_cek_teslimat_outbox_alici_check CHECK (
    (kanal = 'eposta' AND nullif(btrim(alici_eposta), '') IS NOT NULL)
    OR (kanal = 'push' AND alici_eposta IS NULL)
  ),
  UNIQUE (talep_id, kanal, alici_kisi_id)
);

CREATE INDEX IF NOT EXISTS eclub_cek_teslimat_outbox_is_idx
  ON public.eclub_cek_teslimat_outbox (kanal, durum, sonraki_deneme_at, created_at);
CREATE INDEX IF NOT EXISTS eclub_cek_teslimat_outbox_talep_idx
  ON public.eclub_cek_teslimat_outbox (talep_id, kanal);

ALTER TABLE public.eclub_cek_teslimat_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eclub_cek_teslimat_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.eclub_cek_teslimat_outbox TO service_role;

ALTER TABLE public.eclub_store_cek_talepleri
  DROP CONSTRAINT IF EXISTS eclub_store_cek_talepleri_durum_check;
ALTER TABLE public.eclub_store_cek_talepleri
  ADD CONSTRAINT eclub_store_cek_talepleri_durum_check
  CHECK (durum IN ('beklemede','bm_onayinda','tm_onayinda','onaylandi','teslimat_bekliyor','cek_kodlari_gonderildi','iptal'));

CREATE OR REPLACE FUNCTION public.eclub_store_admin_kod_teslim(
  p_admin_id uuid,
  p_talep_id uuid,
  p_cek_kodu text
)
RETURNS TABLE(ok boolean, hata text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_t public.eclub_store_cek_talepleri%rowtype;
  v_eczaci_idleri uuid[];
  v_eczaci_epostalari text[];
  v_eczaci_adlari text[];
  v_olay_id uuid := gen_random_uuid();
  v_payload jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar
    WHERE kullanici_id = p_admin_id AND lower(rol) = 'admin' AND aktif_mi = true
  ) THEN
    RETURN QUERY SELECT false, 'Admin yetkisi doğrulanamadı.';
    RETURN;
  END IF;
  IF p_cek_kodu IS NULL OR length(btrim(p_cek_kodu)) < 3 OR length(btrim(p_cek_kodu)) > 200 THEN
    RETURN QUERY SELECT false, 'Çek kodu geçersiz.';
    RETURN;
  END IF;

  SELECT * INTO v_t
  FROM public.eclub_store_cek_talepleri
  WHERE talep_id = p_talep_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Talep bulunamadı.';
    RETURN;
  END IF;

  IF v_t.durum IN ('teslimat_bekliyor','cek_kodlari_gonderildi') THEN
    IF v_t.cek_kodu = btrim(p_cek_kodu) THEN
      RETURN QUERY SELECT true, NULL::text;
    ELSE
      RETURN QUERY SELECT false, 'Talebe daha önce farklı bir çek kodu kaydedilmiş.';
    END IF;
    RETURN;
  END IF;

  IF v_t.durum <> 'onaylandi' OR v_t.tm_id IS NULL OR v_t.tm_onay_tarihi IS NULL THEN
    RETURN QUERY SELECT false, 'Talep TM tarafından onaylanmış değil.';
    RETURN;
  END IF;

  SELECT
    array_agg(k.kisi_id ORDER BY k.kisi_id),
    array_agg(btrim(k.eposta) ORDER BY k.kisi_id),
    array_agg(btrim(k.ad || ' ' || k.soyad) ORDER BY k.kisi_id)
  INTO v_eczaci_idleri, v_eczaci_epostalari, v_eczaci_adlari
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
  WHERE ke.eczane_id = v_t.eczane_id
    AND ke.aktif_mi = true
    AND lower(k.rol) = 'eczaci'
    AND k.auth_user_id IS NOT NULL
    AND nullif(btrim(k.eposta), '') IS NOT NULL;

  IF cardinality(v_eczaci_idleri) IS DISTINCT FROM 1 THEN
    RETURN QUERY SELECT false, 'Eczanenin tek bir aktif ana eczacı hesabı bulunmalıdır.';
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'talep_id', v_t.talep_id,
    'eczane_id', v_t.eczane_id,
    'cek_kodu', btrim(p_cek_kodu),
    'cek_tutari_tl', v_t.talep_edilen_cek_tl
  );

  UPDATE public.eclub_store_cek_talepleri
  SET durum = 'teslimat_bekliyor',
      cek_kodu = btrim(p_cek_kodu),
      cek_gonderim_tarihi = NULL,
      guncellenme_at = now()
  WHERE talep_id = p_talep_id;

  INSERT INTO public.eclub_cek_teslimat_outbox(
    olay_id, talep_id, kanal, alici_kisi_id, alici_eposta, payload
  ) VALUES (
    v_olay_id, p_talep_id, 'eposta', v_eczaci_idleri[1], v_eczaci_epostalari[1],
    v_payload || jsonb_build_object('alici_adi', v_eczaci_adlari[1])
  ) ON CONFLICT (talep_id, kanal, alici_kisi_id) DO NOTHING;

  INSERT INTO public.eclub_cek_teslimat_outbox(
    olay_id, talep_id, kanal, alici_kisi_id, alici_eposta, payload
  )
  SELECT v_olay_id, p_talep_id, 'push', k.kisi_id, NULL, v_payload
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
  WHERE ke.eczane_id = v_t.eczane_id
    AND ke.aktif_mi = true
    AND k.auth_user_id IS NOT NULL
  ON CONFLICT (talep_id, kanal, alici_kisi_id) DO NOTHING;

  RETURN QUERY SELECT true, NULL::text;
END $f$;

REVOKE ALL ON FUNCTION public.eclub_store_admin_kod_teslim(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_admin_kod_teslim(uuid, uuid, text)
  TO service_role;

COMMIT;
