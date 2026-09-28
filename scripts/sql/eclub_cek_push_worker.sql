-- Faz 3C: Push outbox işini güvenli sahiplenir ve yeni olay türünü etkinleştirir.
BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-cek-push-worker-faz-3c', 1));

CREATE OR REPLACE FUNCTION public.eclub_cek_push_isi_al(p_lease_saniye integer DEFAULT 120)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_is public.eclub_cek_teslimat_outbox%rowtype;
  v_auth_user_id uuid;
BEGIN
  SELECT * INTO v_is
  FROM public.eclub_cek_teslimat_outbox
  WHERE kanal = 'push'
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

  SELECT k.auth_user_id INTO v_auth_user_id
  FROM public.eclub_kisiler k
  JOIN public.eclub_kisi_eczane ke
    ON ke.kisi_id = k.kisi_id
   AND ke.aktif_mi = true
  WHERE k.kisi_id = v_is.alici_kisi_id
    AND ke.eczane_id = (v_is.payload ->> 'eczane_id')::uuid
  LIMIT 1;

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
    'alici_auth_user_id', v_auth_user_id
  );
END $f$;

INSERT INTO public.sistem_ayarlari (anahtar, deger, aciklama)
VALUES (
  'push_olay_aktif',
  '{"eclub_cek_teslim": true}'::jsonb,
  'Olay bazlı web push aç/kapa.'
)
ON CONFLICT (anahtar) DO UPDATE
SET deger = coalesce(sistem_ayarlari.deger, '{}'::jsonb)
  || '{"eclub_cek_teslim": true}'::jsonb;

REVOKE ALL ON FUNCTION public.eclub_cek_push_isi_al(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_cek_push_isi_al(integer) TO service_role;

COMMIT;
