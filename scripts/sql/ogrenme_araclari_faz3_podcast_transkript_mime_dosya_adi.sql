-- scripts/sql/ogrenme_araclari_faz3_podcast_transkript_mime_dosya_adi.sql
--
-- podcast_transkript_ai_isi_al_atomik RPC'sine ses dosyasının doğrulanmış
-- gerçek MIME türünü ve orijinal dosya adını ekler.
-- Worker'ın sabit audio/mp4 ve .m4a yerine gerçek dosya bilgilerini kullanmasını sağlar.

CREATE OR REPLACE FUNCTION public.podcast_transkript_ai_isi_al_atomik(
  p_lease_saniye integer DEFAULT 180
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_kuyruk public.ogrenme_araci_transkript_kuyrugu%ROWTYPE;
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_transkript jsonb;
  v_yeni_lease timestamptz;
  v_mime_type text;
  v_dosya_adi text;
  v_uzanti text;
BEGIN
  -- Bekleyen (sonraki_deneme_tarihi gelmiş) veya zaman aşımına uğramış işi kilitleyerek seç
  SELECT * INTO v_kuyruk
  FROM public.ogrenme_araci_transkript_kuyrugu
  WHERE (
    (durum = 'bekliyor' AND (sonraki_deneme_tarihi IS NULL OR sonraki_deneme_tarihi <= now()))
    OR (durum = 'isleniyor' AND lease_bitis < now())
  )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_arac
  FROM public.ogrenme_araclari
  WHERE arac_id = v_kuyruk.arac_id
  FOR UPDATE;

  IF NOT FOUND OR v_arac.dosya_yolu IS NULL THEN
    UPDATE public.ogrenme_araci_transkript_kuyrugu
    SET durum = 'hata', hata_kodu = 'SES_DOSYASI_YOK', lease_bitis = NULL, updated_at = now()
    WHERE is_id = v_kuyruk.is_id;
    RETURN NULL;
  END IF;

  v_transkript := COALESCE(v_arac.metadata->'transkript', '{}'::jsonb);

  -- İptal edilmiş veya başka bir girişim başlatılmışsa bu kuyruk kaydını iptal et
  IF (v_transkript->>'durum') IN ('iptal', 'onaylandi')
     OR ((v_transkript->>'ai_girisim_id') IS NOT NULL AND (v_transkript->>'ai_girisim_id') <> v_kuyruk.ai_girisim_id::text) THEN
    UPDATE public.ogrenme_araci_transkript_kuyrugu
    SET durum = 'iptal', lease_bitis = NULL, updated_at = now()
    WHERE is_id = v_kuyruk.is_id;
    RETURN NULL;
  END IF;

  v_yeni_lease := now() + (p_lease_saniye || ' seconds')::interval;

  UPDATE public.ogrenme_araci_transkript_kuyrugu
  SET durum = 'isleniyor',
      deneme_sayisi = deneme_sayisi + 1,
      lease_bitis = v_yeni_lease,
      updated_at = now()
  WHERE is_id = v_kuyruk.is_id;

  v_transkript := jsonb_set(v_transkript, '{durum}', '"ai_isleniyor"'::jsonb, true);
  v_transkript := jsonb_set(v_transkript, '{lease_bitis}', to_jsonb(v_yeni_lease), true);
  v_transkript := jsonb_set(v_transkript, '{son_duzenleme_tarihi}', to_jsonb(now()), true);

  UPDATE public.ogrenme_araclari
  SET metadata = jsonb_set(metadata, '{transkript}', v_transkript, true)
  WHERE arac_id = v_arac.arac_id;

  -- Gerçek MIME türünü ve orijinal dosya adını sunucuda doğrulanmış metadata üzerinden belirle
  v_mime_type := COALESCE(
    v_arac.mime_type,
    v_arac.metadata->'depolama_dogrulamasi'->'mime_turu'->>'beyan',
    v_arac.metadata->'yukleme_beyani'->>'mime_type'
  );

  v_dosya_adi := COALESCE(
    v_arac.metadata->'yukleme_beyani'->>'dosya_adi',
    v_arac.metadata->>'dosya_adi'
  );

  v_uzanti := lower(substring(v_arac.dosya_yolu from '\.([a-zA-Z0-9]+)$'));

  IF v_mime_type IS NULL OR v_mime_type = '' THEN
    IF v_uzanti = 'mp3' THEN
      v_mime_type := 'audio/mpeg';
    ELSIF v_uzanti = 'm4a' THEN
      v_mime_type := 'audio/mp4';
    ELSIF v_uzanti = 'wav' THEN
      v_mime_type := 'audio/wav';
    ELSIF v_uzanti = 'aac' THEN
      v_mime_type := 'audio/aac';
    ELSIF v_uzanti = 'ogg' THEN
      v_mime_type := 'audio/ogg';
    ELSE
      v_mime_type := 'audio/mp4';
    END IF;
  END IF;

  IF v_dosya_adi IS NULL OR v_dosya_adi = '' THEN
    IF v_uzanti IS NOT NULL AND v_uzanti <> '' THEN
      v_dosya_adi := v_arac.arac_id || '.' || v_uzanti;
    ELSE
      v_dosya_adi := v_arac.arac_id || '.mp4';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_id', v_kuyruk.is_id,
    'arac_id', v_arac.arac_id,
    'talep_id', v_arac.talep_id,
    'dosya_yolu', v_arac.dosya_yolu,
    'ai_girisim_id', v_kuyruk.ai_girisim_id,
    'model', v_kuyruk.model,
    'mime_type', v_mime_type,
    'dosya_adi', v_dosya_adi,
    'deneme_sayisi', v_kuyruk.deneme_sayisi + 1,
    'max_deneme', v_kuyruk.max_deneme,
    'lease_bitis', v_yeni_lease
  );
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.podcast_transkript_ai_isi_al_atomik(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_isi_al_atomik(integer) TO service_role;
