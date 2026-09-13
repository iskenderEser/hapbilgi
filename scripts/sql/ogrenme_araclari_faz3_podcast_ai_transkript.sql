-- ============================================================================
-- Podcast Aşama 3: Gemini AI Transkript Altyapısı, Kalıcı Kuyruk ve Lease Mekanizması
-- ============================================================================

-- 0. Kalıcı AI Transkript Kuyruk Tablosu
CREATE TABLE IF NOT EXISTS public.ogrenme_araci_transkript_kuyrugu (
  is_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arac_id uuid NOT NULL REFERENCES public.ogrenme_araclari(arac_id) ON DELETE CASCADE,
  ai_girisim_id uuid NOT NULL,
  durum text NOT NULL DEFAULT 'bekliyor'
    CHECK (durum IN ('bekliyor', 'isleniyor', 'tamamlandi', 'hata', 'iptal')),
  deneme_sayisi integer NOT NULL DEFAULT 0 CHECK (deneme_sayisi >= 0),
  max_deneme integer NOT NULL DEFAULT 3,
  lease_bitis timestamptz,
  sonraki_deneme_tarihi timestamptz DEFAULT now(),
  hata_kodu text,
  son_hata text,
  model text NOT NULL DEFAULT 'gemini-3.5-transcribe',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ogrenme_araci_transkript_kuyruk_durum
  ON public.ogrenme_araci_transkript_kuyrugu (durum, sonraki_deneme_tarihi, lease_bitis, created_at);

CREATE INDEX IF NOT EXISTS idx_ogrenme_araci_transkript_kuyruk_arac_girisim
  ON public.ogrenme_araci_transkript_kuyrugu (arac_id, ai_girisim_id);

ALTER TABLE public.ogrenme_araci_transkript_kuyrugu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ogrenme_araci_transkript_kuyrugu FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ogrenme_araci_transkript_kuyrugu TO service_role;

-- 1. AI Girişimi Başlatma (Atomik & Çift Tıklama Korumalı)
CREATE OR REPLACE FUNCTION public.podcast_transkript_ai_baslat_atomik(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_girisim_id uuid,
  p_model text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_talep public.talepler%ROWTYPE;
  v_metadata jsonb;
  v_mevcut_transkript jsonb;
  v_mevcut_durum text;
  v_yeni_transkript jsonb;
BEGIN
  IF p_girisim_id IS NULL OR p_model IS NULL OR btrim(p_model) = '' THEN
    RAISE EXCEPTION 'Girişim kimliği ve model zorunludur.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Podcast bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF v_arac.kaynak <> 'hazir' THEN
    RAISE EXCEPTION 'AI transkripti yalnızca hazır podcast akışında başlatılabilir.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_arac.talep_id;
  IF v_talep.uretici_id IS DISTINCT FROM p_kullanici_id OR v_talep.hazir_video IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Yalnızca talebin üreticisi AI transkripti başlatabilir.' USING ERRCODE = '42501';
  END IF;

  IF v_arac.dosya_yolu IS NULL THEN
    RAISE EXCEPTION 'Ses dosyası yüklenmeden AI transkripti başlatılamaz.' USING ERRCODE = '23514';
  END IF;

  v_metadata := COALESCE(v_arac.metadata, '{}'::jsonb);
  v_mevcut_transkript := COALESCE(v_metadata->'transkript', '{}'::jsonb);
  v_mevcut_durum := COALESCE(v_mevcut_transkript->>'durum', '');

  -- Çift tıklama koruması: eğer işlem devam ediyorsa ve lease'i geçerliyse mevcut girişimi döndür
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
    'bagli_ses_checksum', COALESCE(v_metadata->>'checksum_sha256', v_mevcut_transkript->>'bagli_ses_checksum')
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
    'ai_girisim_id', p_girisim_id
  );
END;
$fonksiyon$;

-- 2. Kuyruktan İş Alma (Atomik Lease / Zaman Damgası / Devralma Mekanizması)
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

-- 3. Geçici Hata ve Kalıcı Yeniden Deneme (Artan Aralık / Lease Temizleme)
CREATE OR REPLACE FUNCTION public.podcast_transkript_ai_gecici_hata_atomik(
  p_is_id uuid,
  p_hata_kodu text,
  p_bekleme_saniye integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_kuyruk public.ogrenme_araci_transkript_kuyrugu%ROWTYPE;
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_transkript jsonb;
BEGIN
  SELECT * INTO v_kuyruk FROM public.ogrenme_araci_transkript_kuyrugu WHERE is_id = p_is_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = v_kuyruk.arac_id FOR UPDATE;

  -- Maksimum deneme sayısına ulaşıldıysa kalıcı hata yap
  IF v_kuyruk.deneme_sayisi >= v_kuyruk.max_deneme THEN
    UPDATE public.ogrenme_araci_transkript_kuyrugu
    SET durum = 'hata',
        hata_kodu = p_hata_kodu,
        lease_bitis = NULL,
        updated_at = now()
    WHERE is_id = p_is_id;

    IF FOUND AND v_arac.arac_id IS NOT NULL THEN
      v_transkript := COALESCE(v_arac.metadata->'transkript', '{}'::jsonb);
      IF (v_transkript->>'ai_girisim_id') = v_kuyruk.ai_girisim_id::text
         AND (v_transkript->>'durum') NOT IN ('iptal', 'onaylandi') THEN
        v_transkript := jsonb_set(v_transkript, '{durum}', '"hata"'::jsonb, true);
        v_transkript := jsonb_set(v_transkript, '{hata_kodu}', to_jsonb(p_hata_kodu), true);
        v_transkript := jsonb_set(v_transkript, '{lease_bitis}', 'null'::jsonb, true);
        v_transkript := jsonb_set(v_transkript, '{son_duzenleme_tarihi}', to_jsonb(now()), true);
        UPDATE public.ogrenme_araclari SET metadata = jsonb_set(metadata, '{transkript}', v_transkript, true)
        WHERE arac_id = v_arac.arac_id;
      END IF;
    END IF;
    RETURN false;
  END IF;

  -- Geçici hata: tekrar 'bekliyor' yap, sonraki_deneme_tarihi artan aralıkla ayarla, lease temizle
  UPDATE public.ogrenme_araci_transkript_kuyrugu
  SET durum = 'bekliyor',
      lease_bitis = NULL,
      sonraki_deneme_tarihi = now() + (p_bekleme_saniye || ' seconds')::interval,
      hata_kodu = p_hata_kodu,
      updated_at = now()
  WHERE is_id = p_is_id;

  IF v_arac.arac_id IS NOT NULL THEN
    v_transkript := COALESCE(v_arac.metadata->'transkript', '{}'::jsonb);
    IF (v_transkript->>'ai_girisim_id') = v_kuyruk.ai_girisim_id::text
       AND (v_transkript->>'durum') NOT IN ('iptal', 'onaylandi') THEN
      v_transkript := jsonb_set(v_transkript, '{durum}', '"ai_bekliyor"'::jsonb, true);
      v_transkript := jsonb_set(v_transkript, '{lease_bitis}', 'null'::jsonb, true);
      v_transkript := jsonb_set(v_transkript, '{son_duzenleme_tarihi}', to_jsonb(now()), true);
      UPDATE public.ogrenme_araclari SET metadata = jsonb_set(metadata, '{transkript}', v_transkript, true)
      WHERE arac_id = v_arac.arac_id;
    END IF;
  END IF;

  RETURN true;
END;
$fonksiyon$;

-- 4. AI Taslağını Kaydetme (Atomik - Yarış Korumalı)
CREATE OR REPLACE FUNCTION public.podcast_transkript_ai_tamamla_atomik(
  p_arac_id uuid,
  p_girisim_id uuid,
  p_metin text
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_transkript jsonb;
BEGIN
  IF p_metin IS NULL OR length(btrim(p_metin)) < 10 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_transkript := COALESCE(v_arac.metadata->'transkript', '{}'::jsonb);

  -- Yarış koruması: girişim kimliği güncel olmalıdır
  IF (v_transkript->>'ai_girisim_id') <> p_girisim_id::text THEN
    RETURN false;
  END IF;

  -- İptal veya onay verilmişse gecikmiş AI sonucunu kabul etme
  IF (v_transkript->>'durum') IN ('iptal', 'onaylandi') THEN
    RETURN false;
  END IF;

  v_transkript := jsonb_set(v_transkript, '{durum}', '"ai_taslak"'::jsonb, true);
  v_transkript := jsonb_set(v_transkript, '{taslak_metin}', to_jsonb(btrim(p_metin)), true);
  v_transkript := jsonb_set(v_transkript, '{onaylanan_metin}', 'null'::jsonb, true);
  v_transkript := jsonb_set(v_transkript, '{lease_bitis}', 'null'::jsonb, true);
  v_transkript := jsonb_set(v_transkript, '{son_duzenleme_tarihi}', to_jsonb(now()), true);

  UPDATE public.ogrenme_araclari
  SET metadata = jsonb_set(
    jsonb_set(metadata, '{transkript}', v_transkript, true),
    '{transkript_metni}', to_jsonb(btrim(p_metin)), true
  )
  WHERE arac_id = p_arac_id;

  UPDATE public.ogrenme_araci_transkript_kuyrugu
  SET durum = 'tamamlandi', lease_bitis = NULL, updated_at = now()
  WHERE arac_id = p_arac_id AND ai_girisim_id = p_girisim_id;

  RETURN true;
END;
$fonksiyon$;

-- 5. AI Kalıcı Hata Durumunu Kaydetme (Atomik)
CREATE OR REPLACE FUNCTION public.podcast_transkript_ai_hata_atomik(
  p_arac_id uuid,
  p_girisim_id uuid,
  p_hata_kodu text
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_transkript jsonb;
BEGIN
  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_transkript := COALESCE(v_arac.metadata->'transkript', '{}'::jsonb);
  IF (v_transkript->>'ai_girisim_id') <> p_girisim_id::text THEN
    RETURN false;
  END IF;

  IF (v_transkript->>'durum') IN ('iptal', 'onaylandi') THEN
    RETURN false;
  END IF;

  v_transkript := jsonb_set(v_transkript, '{durum}', '"hata"'::jsonb, true);
  v_transkript := jsonb_set(v_transkript, '{hata_kodu}', to_jsonb(COALESCE(p_hata_kodu, 'GEMINI_HATA')), true);
  v_transkript := jsonb_set(v_transkript, '{lease_bitis}', 'null'::jsonb, true);
  v_transkript := jsonb_set(v_transkript, '{son_duzenleme_tarihi}', to_jsonb(now()), true);

  UPDATE public.ogrenme_araclari
  SET metadata = jsonb_set(metadata, '{transkript}', v_transkript, true)
  WHERE arac_id = p_arac_id;

  UPDATE public.ogrenme_araci_transkript_kuyrugu
  SET durum = 'hata', hata_kodu = COALESCE(p_hata_kodu, 'GEMINI_HATA'), lease_bitis = NULL, updated_at = now()
  WHERE arac_id = p_arac_id AND ai_girisim_id = p_girisim_id;

  RETURN true;
END;
$fonksiyon$;

-- 6. Kullanıcı Onayı veya İptalinde V2/V4 Zincirini Açma (Atomik)
CREATE OR REPLACE FUNCTION public.podcast_transkript_zincir_ac_atomik(
  p_arac_id uuid,
  p_kullanici_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_durum_id uuid;
  v_sonraki jsonb := NULL;
BEGIN
  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Podcast bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  SELECT arac_durum_id INTO v_durum_id
  FROM public.ogrenme_araci_durumu
  WHERE arac_id = p_arac_id AND durum = 'onaylandi'
  ORDER BY created_at DESC LIMIT 1;

  IF v_durum_id IS NOT NULL AND v_arac.kaynak = 'hazir' THEN
    v_sonraki := public.uretim_podcast_soru_zinciri_ac(v_arac.talep_id, v_durum_id, p_kullanici_id, NULL);
  END IF;

  RETURN jsonb_build_object('arac_id', p_arac_id, 'zincir_acildi', v_sonraki IS NOT NULL, 'sonraki', v_sonraki);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.podcast_transkript_ai_baslat_atomik(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_baslat_atomik(uuid,uuid,uuid,text) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_transkript_ai_isi_al_atomik(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_isi_al_atomik(integer) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_transkript_ai_gecici_hata_atomik(uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_gecici_hata_atomik(uuid,text,integer) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_transkript_ai_tamamla_atomik(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_tamamla_atomik(uuid,uuid,text) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_transkript_ai_hata_atomik(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_ai_hata_atomik(uuid,uuid,text) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_transkript_zincir_ac_atomik(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_transkript_zincir_ac_atomik(uuid,uuid) TO service_role;
