BEGIN;

CREATE OR REPLACE FUNCTION public.podcast_kapak_yukleme_baslat_atomik(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_girisim_id uuid,
  p_dosya_yolu text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_uretici_id uuid;
  v_son_durum text;
  v_metadata jsonb;
  v_onceki_girisim jsonb;
  v_onceki_yol text;
BEGIN
  IF p_girisim_id IS NULL OR p_dosya_yolu IS NULL OR btrim(p_dosya_yolu) = '' THEN
    RAISE EXCEPTION 'Yayın görseli yükleme girişimi eksik.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Podcast bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  SELECT uretici_id INTO v_uretici_id FROM public.talepler WHERE talep_id = v_arac.talep_id;
  IF NOT ((v_arac.kaynak = 'hazir' AND v_uretici_id = p_kullanici_id)
       OR (v_arac.kaynak = 'iu' AND v_arac.iu_id = p_kullanici_id)) THEN
    RAISE EXCEPTION 'Yayın görseli yüklemesi bu kullanıcıya ait değil.' USING ERRCODE = '42501';
  END IF;
  SELECT durum INTO v_son_durum FROM public.ogrenme_araci_durumu
  WHERE arac_id = p_arac_id ORDER BY created_at DESC LIMIT 1;
  IF v_son_durum NOT IN ('yukleme_bekliyor', 'dogrulama_bekliyor', 'revizyon_bekliyor', 'revizyon bekleniyor') THEN
    RAISE EXCEPTION 'Podcast yayın görseli yüklemesine açık değil.' USING ERRCODE = '23514';
  END IF;

  v_metadata := COALESCE(v_arac.metadata, '{}'::jsonb);
  v_onceki_girisim := v_metadata->'kapak_yukleme_girisimi';
  v_onceki_yol := v_onceki_girisim->>'dosya_yolu';
  IF v_onceki_yol IS NOT NULL AND v_onceki_yol <> p_dosya_yolu
     AND COALESCE(v_onceki_girisim->>'durum', '') = 'bekliyor' THEN
    INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu
      (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
    VALUES (p_arac_id, v_onceki_yol, 'kapak', 'yerine_yeni_kapak_yukleme_girisimi_baslatildi', 'bekliyor')
    ON CONFLICT DO NOTHING;
  END IF;

  v_metadata := jsonb_set(
    v_metadata,
    '{bekleyen_destek_yollari}',
    COALESCE(v_metadata->'bekleyen_destek_yollari', '{}'::jsonb) || jsonb_build_object('kapak', p_dosya_yolu),
    true
  );
  v_metadata := jsonb_set(v_metadata, '{kapak_bekleniyor}', 'true'::jsonb, true);
  v_metadata := v_metadata - 'kapak_iptal_edildi';
  v_metadata := jsonb_set(v_metadata, '{kapak_yukleme_girisimi}', jsonb_build_object(
    'id', p_girisim_id,
    'dosya_yolu', p_dosya_yolu,
    'durum', 'bekliyor',
    'onceki_kapak_yolu', v_arac.kapak_yolu,
    'onceki_kapak_dogrulandi', COALESCE((v_metadata->>'kapak_dogrulandi')::boolean, false),
    'baslatma_tarihi', now()
  ), true);

  UPDATE public.ogrenme_araclari SET metadata = v_metadata, updated_at = now() WHERE arac_id = p_arac_id;
  RETURN jsonb_build_object('arac_id', p_arac_id, 'giris_id', p_girisim_id);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.podcast_kapak_yukleme_tamamla_atomik(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_girisim_id uuid,
  p_dosya_yolu text,
  p_dogrulama jsonb
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_uretici_id uuid;
  v_son_durum text;
  v_metadata jsonb;
  v_girisim jsonb;
  v_onceki_kapak text;
BEGIN
  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Podcast bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  SELECT uretici_id INTO v_uretici_id FROM public.talepler WHERE talep_id = v_arac.talep_id;
  IF NOT ((v_arac.kaynak = 'hazir' AND v_uretici_id = p_kullanici_id)
       OR (v_arac.kaynak = 'iu' AND v_arac.iu_id = p_kullanici_id)) THEN
    RAISE EXCEPTION 'Yayın görseli yüklemesi bu kullanıcıya ait değil.' USING ERRCODE = '42501';
  END IF;
  SELECT durum INTO v_son_durum FROM public.ogrenme_araci_durumu
  WHERE arac_id = p_arac_id ORDER BY created_at DESC LIMIT 1;
  IF v_son_durum NOT IN ('yukleme_bekliyor', 'dogrulama_bekliyor', 'revizyon_bekliyor', 'revizyon bekleniyor') THEN
    RAISE EXCEPTION 'Podcast yayın görseli yüklemesine açık değil.' USING ERRCODE = '23514';
  END IF;

  v_metadata := COALESCE(v_arac.metadata, '{}'::jsonb);
  v_girisim := v_metadata->'kapak_yukleme_girisimi';
  IF v_girisim IS NULL
     OR v_girisim->>'id' IS DISTINCT FROM p_girisim_id::text
     OR v_girisim->>'dosya_yolu' IS DISTINCT FROM p_dosya_yolu
     OR v_girisim->>'durum' IS DISTINCT FROM 'bekliyor'
     OR COALESCE((v_metadata->>'kapak_iptal_edildi')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'Yayın görseli yükleme girişimi artık geçerli değil.' USING ERRCODE = '23514';
  END IF;

  v_onceki_kapak := v_girisim->>'onceki_kapak_yolu';
  IF v_onceki_kapak IS NOT NULL AND v_onceki_kapak <> p_dosya_yolu THEN
    INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu
      (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
    VALUES (p_arac_id, v_onceki_kapak, 'kapak', 'yeni_kapak_yuklemesi_tamamlandi', 'bekliyor')
    ON CONFLICT DO NOTHING;
  END IF;

  v_metadata := jsonb_set(v_metadata, '{kapak_yukleme_girisimi,durum}', '"tamamlandi"'::jsonb, false);
  v_metadata := jsonb_set(v_metadata, '{kapak_yukleme_girisimi,tamamlama_tarihi}', to_jsonb(now()), true);
  v_metadata := jsonb_set(v_metadata, '{kapak_bekleniyor}', 'false'::jsonb, true);
  v_metadata := jsonb_set(v_metadata, '{kapak_dogrulandi}', 'true'::jsonb, true);
  v_metadata := jsonb_set(
    v_metadata,
    '{podcast_destek_dogrulamasi}',
    COALESCE(v_metadata->'podcast_destek_dogrulamasi', '{}'::jsonb) || COALESCE(p_dogrulama, '{}'::jsonb),
    true
  );
  v_metadata := jsonb_set(
    v_metadata,
    '{bekleyen_destek_yollari}',
    COALESCE(v_metadata->'bekleyen_destek_yollari', '{}'::jsonb) - 'kapak',
    true
  );
  v_metadata := v_metadata - 'kapak_iptal_edildi';

  UPDATE public.ogrenme_araclari
  SET kapak_yolu = p_dosya_yolu, metadata = v_metadata, updated_at = now()
  WHERE arac_id = p_arac_id;
  RETURN jsonb_build_object('arac_id', p_arac_id, 'giris_id', p_girisim_id, 'tamamlandi', true);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.podcast_kapak_yukleme_iptal_atomik(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_girisim_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_uretici_id uuid;
  v_son_durum text;
  v_metadata jsonb;
  v_girisim jsonb;
  v_girisim_id text;
  v_girisim_yolu text;
  v_onceki_kapak text;
  v_onceki_dogrulandi boolean;
  v_yollar jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Podcast bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  SELECT uretici_id INTO v_uretici_id FROM public.talepler WHERE talep_id = v_arac.talep_id;
  IF NOT ((v_arac.kaynak = 'hazir' AND v_uretici_id = p_kullanici_id)
       OR (v_arac.kaynak = 'iu' AND v_arac.iu_id = p_kullanici_id)) THEN
    RAISE EXCEPTION 'Yayın görseli yüklemesi bu kullanıcıya ait değil.' USING ERRCODE = '42501';
  END IF;
  SELECT durum INTO v_son_durum FROM public.ogrenme_araci_durumu
  WHERE arac_id = p_arac_id ORDER BY created_at DESC LIMIT 1;
  IF v_son_durum NOT IN ('yukleme_bekliyor', 'dogrulama_bekliyor', 'revizyon_bekliyor', 'revizyon bekleniyor') THEN
    RAISE EXCEPTION 'Yalnız tamamlanmamış podcast yüklemesinde görselsiz devam edilebilir.' USING ERRCODE = '23514';
  END IF;

  v_metadata := COALESCE(v_arac.metadata, '{}'::jsonb);
  v_girisim := v_metadata->'kapak_yukleme_girisimi';
  v_girisim_id := v_girisim->>'id';
  IF COALESCE((v_metadata->>'kapak_iptal_edildi')::boolean, false) IS TRUE
     AND COALESCE(v_girisim->>'durum', '') = 'iptal' THEN
    RETURN jsonb_build_object('arac_id', p_arac_id, 'zaten_iptal', true, 'temizlenecek_yollar', '[]'::jsonb);
  END IF;
  IF v_girisim_id IS NOT NULL AND (p_girisim_id IS NULL OR v_girisim_id IS DISTINCT FROM p_girisim_id::text) THEN
    RAISE EXCEPTION 'Yayın görseli yükleme girişimi güncel değil.' USING ERRCODE = '23514';
  END IF;

  v_girisim_yolu := COALESCE(v_girisim->>'dosya_yolu', v_metadata->'bekleyen_destek_yollari'->>'kapak');
  v_onceki_kapak := v_girisim->>'onceki_kapak_yolu';
  v_onceki_dogrulandi := COALESCE((v_girisim->>'onceki_kapak_dogrulandi')::boolean, false);
  IF v_girisim_yolu IS NOT NULL THEN
    INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu
      (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
    VALUES (p_arac_id, v_girisim_yolu, 'kapak', 'kullanici_gorselsiz_devam_karari', 'bekliyor')
    ON CONFLICT DO NOTHING;
    v_yollar := v_yollar || jsonb_build_array(v_girisim_yolu);
  END IF;

  IF v_girisim IS NOT NULL THEN
    v_metadata := jsonb_set(v_metadata, '{kapak_yukleme_girisimi,durum}', '"iptal"'::jsonb, false);
    v_metadata := jsonb_set(v_metadata, '{kapak_yukleme_girisimi,iptal_tarihi}', to_jsonb(now()), true);
  END IF;
  v_metadata := jsonb_set(v_metadata, '{kapak_bekleniyor}', 'false'::jsonb, true);
  v_metadata := jsonb_set(v_metadata, '{kapak_iptal_edildi}', 'true'::jsonb, true);
  v_metadata := jsonb_set(
    v_metadata,
    '{bekleyen_destek_yollari}',
    COALESCE(v_metadata->'bekleyen_destek_yollari', '{}'::jsonb) - 'kapak',
    true
  );
  IF v_onceki_dogrulandi AND v_onceki_kapak IS NOT NULL THEN
    v_metadata := jsonb_set(v_metadata, '{kapak_dogrulandi}', 'true'::jsonb, true);
  ELSE
    v_metadata := v_metadata - 'kapak_dogrulandi';
  END IF;

  UPDATE public.ogrenme_araclari
  SET kapak_yolu = CASE WHEN v_onceki_dogrulandi THEN v_onceki_kapak ELSE NULL END,
      metadata = v_metadata,
      updated_at = now()
  WHERE arac_id = p_arac_id;
  RETURN jsonb_build_object('arac_id', p_arac_id, 'giris_id', v_girisim_id, 'temizlenecek_yollar', v_yollar);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.podcast_kapak_yukleme_baslat_atomik(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.podcast_kapak_yukleme_tamamla_atomik(uuid,uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.podcast_kapak_yukleme_iptal_atomik(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_kapak_yukleme_baslat_atomik(uuid,uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.podcast_kapak_yukleme_tamamla_atomik(uuid,uuid,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.podcast_kapak_yukleme_iptal_atomik(uuid,uuid,uuid) TO service_role;

COMMIT;
