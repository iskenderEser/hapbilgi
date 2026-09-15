-- ============================================================================

BEGIN;
-- Faz 5: Podcast AI başlatmada doğrulanmış ses ve güncel checksum bağı.
-- ============================================================================
-- Bu migration dosyası, podcast_transkript_ai_baslat_atomik fonksiyonunu
-- hem hazır podcast (V2/V4 üretici) hem de İÜ podcast (V1/V3 görev) akışlarını
-- destekleyecek şekilde genişletir.
--
-- Canlı veritabanında otomatik çalıştırılmaz; kullanıcı tarafından çalıştırılmalıdır.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.podcast_transkript_ai_baslat_atomik(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_girisim_id uuid,
  p_model text,
  p_gorev_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_talep public.talepler%ROWTYPE;
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_metadata jsonb;
  v_mevcut_transkript jsonb;
  v_mevcut_durum text;
  v_yeni_transkript jsonb;
  v_transkript_istendi boolean;
BEGIN
  IF p_girisim_id IS NULL OR p_model IS NULL OR btrim(p_model) = '' THEN
    RAISE EXCEPTION 'Girişim kimliği ve model zorunludur.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Podcast bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_arac.talep_id;
  IF NOT FOUND OR v_talep.ogrenme_araci_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  -- Yetki kontrolü: hazır podcast (üretici) vs İÜ podcast (içerik üreticisi)
  IF v_arac.kaynak = 'hazir' THEN
    IF v_talep.uretici_id IS DISTINCT FROM p_kullanici_id OR v_talep.hazir_video IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Yalnızca talebin üreticisi AI transkripti başlatabilir.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_arac.kaynak = 'iu' THEN
    IF p_gorev_id IS NULL THEN
      RAISE EXCEPTION 'İçerik üreticisi podcast işlemi için görev kimliği zorunludur.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;

    IF NOT FOUND OR v_gorev.atanan_iu_id IS DISTINCT FROM p_kullanici_id THEN
      RAISE EXCEPTION 'Bu podcast üretim görevi kullanıcıya atanmamış.' USING ERRCODE = '42501';
    END IF;

    IF v_gorev.talep_id IS DISTINCT FROM v_arac.talep_id OR v_gorev.asama IS DISTINCT FROM 'video' THEN
      RAISE EXCEPTION 'Görev, talep ve podcast eşleşmesi geçersiz.' USING ERRCODE = '23514';
    END IF;

    IF v_gorev.arac_id IS NOT NULL AND v_gorev.arac_id IS DISTINCT FROM p_arac_id THEN
      RAISE EXCEPTION 'Görev ve araç eşleşmesi geçersiz.' USING ERRCODE = '23514';
    END IF;

    IF v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor') THEN
      RAISE EXCEPTION 'Görev durumu işlem için uygun değil.' USING ERRCODE = '23514';
    END IF;

    IF v_gorev.arac_id IS NULL THEN
      UPDATE public.uretim_gorevleri SET arac_id = p_arac_id WHERE gorev_id = p_gorev_id;
    END IF;

    -- Talepte transkript istenmiş olmalı
    v_transkript_istendi := COALESCE((v_talep.ogrenme_araci_tercihleri->>'transkript_istendi')::boolean, true);
    IF v_transkript_istendi IS NOT TRUE THEN
      RAISE EXCEPTION 'Bu podcast için transkript talep edilmemiş.' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Geçersiz araç kaynağı.' USING ERRCODE = '23514';
  END IF;

  IF v_arac.dosya_yolu IS NULL OR v_arac.metadata_dogrulandi IS NOT TRUE OR COALESCE(v_arac.sure_saniye, 0) <= 0 THEN
    RAISE EXCEPTION 'Ses dosyası doğrulanmadan AI transkripti başlatılamaz.' USING ERRCODE = '23514';
  END IF;

  v_metadata := COALESCE(v_arac.metadata, '{}'::jsonb);
  v_mevcut_transkript := COALESCE(v_metadata->'transkript', '{}'::jsonb);
  v_mevcut_durum := COALESCE(v_mevcut_transkript->>'durum', '');

  -- Çift tıklama koruması: işlem devam ediyorsa ve lease geçerliyse mevcut girişimi döndür
  IF v_mevcut_durum IN ('ai_bekliyor', 'ai_isleniyor')
     AND (v_mevcut_transkript->>'ai_girisim_id') IS NOT NULL
     AND (
       v_mevcut_durum = 'ai_bekliyor'
       OR (v_mevcut_transkript->>'lease_bitis') IS NULL
       OR (v_mevcut_transkript->>'lease_bitis')::timestamptz > now()
     ) THEN
    RETURN jsonb_build_object(
      'baslatildi', false,
      'durum', v_mevcut_durum,
      'ai_girisim_id', v_mevcut_transkript->>'ai_girisim_id',
      'mukerrer_engellendi', true
    );
  END IF;

  -- Bu araç için önceki açık kuyruk kayıtlarını iptal et
  UPDATE public.ogrenme_araci_transkript_kuyrugu
  SET durum = 'iptal', updated_at = now()
  WHERE arac_id = p_arac_id AND durum IN ('bekliyor', 'isleniyor');

  -- Kalıcı kuyruğa ekle
  INSERT INTO public.ogrenme_araci_transkript_kuyrugu (
    arac_id,
    ai_girisim_id,
    durum,
    model,
    deneme_sayisi,
    max_deneme,
    sonraki_deneme_tarihi
  ) VALUES (
    p_arac_id,
    p_girisim_id,
    'bekliyor',
    p_model,
    0,
    3,
    now()
  );

  v_yeni_transkript := jsonb_build_object(
    'durum', 'ai_bekliyor',
    'kaynak', 'ai',
    'ai_girisim_id', p_girisim_id,
    'kullanilan_model', p_model,
    'taslak_metin', NULL,
    'onaylanan_metin', NULL,
    'onaylayan_kullanici_id', NULL,
    'onay_tarihi', NULL,
    'hata_kodu', NULL,
    'lease_bitis', NULL,
    'son_duzenleme_tarihi', now(),
    'surum', COALESCE((v_mevcut_transkript->>'surum')::integer, 0) + 1,
    'bagli_ses_checksum', COALESCE(v_arac.checksum_sha256, v_mevcut_transkript->>'bagli_ses_checksum')
  );

  v_metadata := jsonb_set(v_metadata, '{transkript}', v_yeni_transkript, true);
  v_metadata := jsonb_set(v_metadata, '{transkript_dogrulandi}', 'false'::jsonb, true);
  v_metadata := jsonb_set(v_metadata, '{transkript_metni_dogrulandi}', 'false'::jsonb, true);
  v_metadata := v_metadata - 'transkript_metni';
  v_metadata := v_metadata - 'transkript_onaylandi';

  UPDATE public.ogrenme_araclari
  SET metadata = v_metadata
  WHERE arac_id = p_arac_id;

  RETURN jsonb_build_object(
    'baslatildi', true,
    'durum', 'ai_bekliyor',
    'ai_girisim_id', p_girisim_id,
    'mukerrer_engellendi', false
  );
END;
$fonksiyon$;

-- Geriye dönük uyumluluk: 4 parametreli çağrı için wrapper
CREATE OR REPLACE FUNCTION public.podcast_transkript_ai_baslat_atomik(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_girisim_id uuid,
  p_model text
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT public.podcast_transkript_ai_baslat_atomik(p_arac_id, p_kullanici_id, p_girisim_id, p_model, NULL::uuid);
$$;

REVOKE ALL ON FUNCTION public.podcast_transkript_ai_baslat_atomik(uuid,uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_baslat_atomik(uuid,uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.podcast_transkript_ai_baslat_atomik(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_baslat_atomik(uuid,uuid,uuid,text) TO service_role;

COMMIT;

SELECT to_regprocedure('public.podcast_transkript_ai_baslat_atomik(uuid,uuid,uuid,text,uuid)') IS NOT NULL
  AS podcast_ai_ses_guvenlik_kapisi_kuruldu;
