-- Faz 3B: E-posta outbox işini güvenli sahiplenme, tamamlama ve yeniden deneme RPC'leri.
BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-cek-eposta-worker-faz-3b', 1));

CREATE OR REPLACE FUNCTION public.eclub_cek_eposta_isi_al(p_lease_saniye integer DEFAULT 120)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_is public.eclub_cek_teslimat_outbox%rowtype;
BEGIN
  SELECT * INTO v_is
  FROM public.eclub_cek_teslimat_outbox
  WHERE kanal = 'eposta'
    AND deneme_sayisi < max_deneme
    AND sonraki_deneme_at <= now()
    AND (
      durum = 'bekliyor'
      OR durum = 'basarisiz'
      OR (durum = 'isleniyor' AND lease_bitis < now())
    )
  ORDER BY created_at, outbox_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.eclub_cek_teslimat_outbox
  SET durum = 'isleniyor',
      deneme_sayisi = deneme_sayisi + 1,
      lease_bitis = now() + make_interval(secs => greatest(30, p_lease_saniye)),
      son_hata_kodu = NULL,
      guncellenme_at = now()
  WHERE outbox_id = v_is.outbox_id;

  RETURN jsonb_build_object(
    'outbox_id', v_is.outbox_id,
    'talep_id', v_is.talep_id,
    'alici_eposta', v_is.alici_eposta,
    'alici_adi', v_is.payload ->> 'alici_adi',
    'cek_kodu', v_is.payload ->> 'cek_kodu',
    'cek_tutari_tl', v_is.payload ->> 'cek_tutari_tl'
  );
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_cek_teslimat_tamamla(p_outbox_id uuid, p_kanal text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_talep_id uuid;
BEGIN
  UPDATE public.eclub_cek_teslimat_outbox
  SET durum = 'tamamlandi',
      lease_bitis = NULL,
      son_hata_kodu = NULL,
      tamamlanma_at = now(),
      guncellenme_at = now()
  WHERE outbox_id = p_outbox_id
    AND kanal = p_kanal
    AND durum = 'isleniyor'
  RETURNING talep_id INTO v_talep_id;

  IF v_talep_id IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.eclub_cek_teslimat_outbox
    WHERE talep_id = v_talep_id AND durum <> 'tamamlandi'
  ) THEN
    UPDATE public.eclub_store_cek_talepleri
    SET durum = 'cek_kodlari_gonderildi',
        cek_gonderim_tarihi = now(),
        guncellenme_at = now()
    WHERE talep_id = v_talep_id AND durum = 'teslimat_bekliyor';
  END IF;

  RETURN true;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_cek_teslimat_hata(
  p_outbox_id uuid,
  p_kanal text,
  p_hata_kodu text
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_guncellendi uuid;
BEGIN
  UPDATE public.eclub_cek_teslimat_outbox
  SET durum = 'basarisiz',
      lease_bitis = NULL,
      son_hata_kodu = left(coalesce(nullif(btrim(p_hata_kodu), ''), 'TESLIMAT_HATASI'), 80),
      sonraki_deneme_at = now() + make_interval(
        secs => least(3600, (60 * power(2, greatest(deneme_sayisi - 1, 0)))::integer)
      ),
      guncellenme_at = now()
  WHERE outbox_id = p_outbox_id
    AND kanal = p_kanal
    AND durum = 'isleniyor'
  RETURNING outbox_id INTO v_guncellendi;
  RETURN v_guncellendi IS NOT NULL;
END $f$;

DROP FUNCTION IF EXISTS public.eclub_store_cek_eposta_tamamla(uuid);
DROP FUNCTION IF EXISTS public.eclub_store_cek_eposta_hata(uuid, text);
DROP FUNCTION IF EXISTS public.eclub_store_cek_eposta_isi_al(integer);

REVOKE ALL ON FUNCTION public.eclub_cek_eposta_isi_al(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_cek_teslimat_tamamla(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_cek_teslimat_hata(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_cek_eposta_isi_al(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_cek_teslimat_tamamla(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_cek_teslimat_hata(uuid, text, text) TO service_role;

COMMIT;
