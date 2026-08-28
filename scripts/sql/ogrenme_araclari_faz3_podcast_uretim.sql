-- Öğrenme Araçları Genişletmesi — Faz 3 / Podcast üretim, onay ve soru zinciri.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-faz3-podcast-uretim-v1', 1));

ALTER TABLE public.ogrenme_araclari
  ADD COLUMN IF NOT EXISTS transkript_yolu text;

CREATE OR REPLACE FUNCTION public.uretim_podcast_soru_zinciri_ac(
  p_talep_id uuid,
  p_arac_durum_id uuid,
  p_uretici_id uuid,
  p_oncelikli_iu_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE;
  v_soru_seti_id uuid;
  v_sonraki jsonb;
BEGIN
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = p_talep_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  SELECT soru_seti_id INTO v_soru_seti_id
  FROM public.soru_setleri
  WHERE talep_id = p_talep_id AND arac_durum_id = p_arac_durum_id
  ORDER BY created_at LIMIT 1;

  IF v_soru_seti_id IS NULL THEN
    INSERT INTO public.soru_setleri (talep_id, arac_durum_id, kaynak, iu_id, sorular)
    VALUES (
      p_talep_id, p_arac_durum_id,
      CASE WHEN v_talep.hazir_soru_seti THEN 'hazir' ELSE 'iu' END,
      NULL,
      CASE WHEN v_talep.hazir_soru_seti THEN v_talep.hazir_soru_seti_verisi ELSE '[]'::jsonb END
    ) RETURNING soru_seti_id INTO v_soru_seti_id;
  END IF;

  IF v_talep.hazir_soru_seti THEN
    PERFORM public.uretim_soru_seti_dogrula(p_talep_id, v_talep.hazir_soru_seti_verisi);
    IF NOT EXISTS (SELECT 1 FROM public.soru_seti_durumu WHERE soru_seti_id = v_soru_seti_id AND durum = 'onaylandi') THEN
      INSERT INTO public.soru_seti_durumu (soru_seti_id, durum, degistiren_id, notlar)
      VALUES (v_soru_seti_id, 'onaylandi', p_uretici_id, 'Hazır soru seti — otomatik onay');
    END IF;
    v_sonraki := jsonb_build_object('gorev_acildi', false, 'soru_seti_id', v_soru_seti_id, 'hazir_soru_seti_islendi', true);
  ELSE
    v_sonraki := public.uretim_gorev_ac(
      p_talep_id, 'soru_seti', p_uretici_id, p_oncelikli_iu_id,
      'otomatik', NULL, NULL, v_soru_seti_id
    );
  END IF;
  RETURN v_sonraki;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.uretim_podcast_dogrula(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_gorev_id uuid,
  p_sure_saniye integer,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_talep public.talepler%ROWTYPE;
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_durum_id uuid;
  v_sonraki jsonb := NULL;
  v_sonuc jsonb;
  v_onceki jsonb;
BEGIN
  IF p_islem_anahtari IS NULL OR p_sure_saniye IS NULL OR p_sure_saniye <= 0 THEN
    RAISE EXCEPTION 'İşlem anahtarı ve pozitif podcast süresi zorunludur.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));
  SELECT sonuc INTO v_onceki FROM public.uretim_islem_kayitlari
  WHERE islem_anahtari = p_islem_anahtari AND islem_turu = 'podcast_dogrula';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari WHERE islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'podcast' THEN RAISE EXCEPTION 'Podcast bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_arac.talep_id FOR UPDATE;
  IF v_talep.ogrenme_araci_turu <> 'podcast' THEN RAISE EXCEPTION 'Talep podcast türünde değil.' USING ERRCODE = '23514'; END IF;
  IF v_arac.dosya_yolu IS NULL OR v_arac.kapak_yolu IS NULL OR v_arac.transkript_yolu IS NULL
     OR COALESCE((v_arac.metadata->>'kapak_dogrulandi')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata->>'transkript_dogrulandi')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Ses, kapak ve transkript doğrulanmadan podcast tamamlanamaz.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.ogrenme_araclari
  SET sure_saniye = p_sure_saniye, metadata_dogrulandi = true,
      metadata = metadata || jsonb_build_object('sure_dogrulandi', true)
  WHERE arac_id = p_arac_id;

  IF v_arac.kaynak = 'iu' THEN
    IF p_gorev_id IS NULL THEN RAISE EXCEPTION 'IU podcast görevi zorunludur.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;
    IF NOT FOUND OR v_gorev.talep_id <> v_arac.talep_id OR v_gorev.asama <> 'video'
       OR v_gorev.atanan_iu_id IS DISTINCT FROM p_kullanici_id
       OR v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor') THEN
      RAISE EXCEPTION 'Podcast üretim görevi geçersiz.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.uretim_gorevleri
    SET arac_id = p_arac_id, durum = 'inceleme_bekliyor', inceleme_tarihi = now(),
        son_islem_anahtari = p_islem_anahtari, surum = surum + 1
    WHERE gorev_id = p_gorev_id;
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (p_arac_id, 'inceleme bekleniyor', p_kullanici_id, 'Podcast üretici incelemesine gönderildi')
    RETURNING arac_durum_id INTO v_durum_id;
  ELSE
    IF v_talep.uretici_id IS DISTINCT FROM p_kullanici_id OR v_talep.hazir_video IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Hazır podcasti yalnız talebin üreticisi tamamlayabilir.' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (p_arac_id, 'onaylandi', p_kullanici_id, 'Hazır podcast — otomatik onay')
    RETURNING arac_durum_id INTO v_durum_id;
    v_sonraki := public.uretim_podcast_soru_zinciri_ac(v_arac.talep_id, v_durum_id, p_kullanici_id, NULL);
  END IF;

  v_sonuc := jsonb_build_object('arac_id', p_arac_id, 'talep_id', v_arac.talep_id, 'arac_durum_id', v_durum_id, 'sonraki', v_sonraki);
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'podcast_dogrula', p_gorev_id, v_arac.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.uretim_podcast_uretici_karar_ver(
  p_gorev_id uuid, p_uretici_id uuid, p_karar text, p_notlar text, p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_talep public.talepler%ROWTYPE;
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_durum_id uuid;
  v_revizyon integer;
  v_sonraki jsonb := NULL;
  v_sonuc jsonb;
  v_onceki jsonb;
BEGIN
  IF p_islem_anahtari IS NULL OR p_karar NOT IN ('onaylandi', 'revizyon bekleniyor', 'Iptal Edildi') THEN RAISE EXCEPTION 'Geçersiz karar.' USING ERRCODE = '22023'; END IF;
  IF p_karar = 'revizyon bekleniyor' AND nullif(btrim(p_notlar), '') IS NULL THEN RAISE EXCEPTION 'Revizyon notu zorunludur.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));
  SELECT sonuc INTO v_onceki FROM public.uretim_islem_kayitlari WHERE islem_anahtari = p_islem_anahtari AND islem_turu = 'podcast_uretici_karari';
  IF FOUND THEN RETURN v_onceki; END IF;
  SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;
  IF NOT FOUND OR v_gorev.durum <> 'inceleme_bekliyor' THEN RAISE EXCEPTION 'İnceleme bekleyen görev bulunamadı.' USING ERRCODE = '23514'; END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_gorev.talep_id FOR UPDATE;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id OR v_talep.ogrenme_araci_turu <> 'podcast' THEN RAISE EXCEPTION 'Podcast karar yetkisi yok.' USING ERRCODE = '42501'; END IF;

  IF v_gorev.asama = 'senaryo' THEN
    IF p_karar = 'revizyon bekleniyor' THEN
      SELECT count(*)::integer INTO v_revizyon FROM public.senaryo_durumu
      WHERE senaryo_id = v_gorev.senaryo_id AND durum = 'revizyon bekleniyor';
      IF v_revizyon >= 2 THEN RAISE EXCEPTION 'Maksimum revizyon hakkı (2) kullanıldı.' USING ERRCODE = '23514'; END IF;
    END IF;
    INSERT INTO public.senaryo_durumu (senaryo_id, durum, degistiren_id, notlar)
    VALUES (v_gorev.senaryo_id, p_karar, p_uretici_id, nullif(btrim(p_notlar), '')) RETURNING senaryo_durum_id INTO v_durum_id;
    IF p_karar = 'onaylandi' THEN
      v_sonraki := public.uretim_gorev_ac(v_gorev.talep_id, 'video', p_uretici_id, v_gorev.atanan_iu_id, 'otomatik', NULL, NULL, NULL);
    END IF;
  ELSIF v_gorev.asama = 'video' THEN
    SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = v_gorev.arac_id FOR UPDATE;
    IF NOT FOUND OR v_arac.arac_turu <> 'podcast' OR v_arac.metadata_dogrulandi IS NOT TRUE OR v_arac.sure_saniye <= 0 THEN
      RAISE EXCEPTION 'Doğrulanmış podcast bulunamadı.' USING ERRCODE = '23514';
    END IF;
    IF p_karar = 'revizyon bekleniyor' THEN
      SELECT count(*)::integer INTO v_revizyon FROM public.ogrenme_araci_durumu WHERE arac_id = v_arac.arac_id AND durum = 'revizyon bekleniyor';
      IF v_revizyon >= 2 THEN RAISE EXCEPTION 'Maksimum revizyon hakkı (2) kullanıldı.' USING ERRCODE = '23514'; END IF;
    END IF;
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (v_arac.arac_id, p_karar, p_uretici_id, nullif(btrim(p_notlar), '')) RETURNING arac_durum_id INTO v_durum_id;
    IF p_karar = 'onaylandi' THEN
      v_sonraki := public.uretim_podcast_soru_zinciri_ac(v_gorev.talep_id, v_durum_id, p_uretici_id, v_gorev.atanan_iu_id);
    END IF;
  ELSE
    RAISE EXCEPTION 'Bu RPC yalnız podcast senaryo ve podcast üretim aşamasını işler.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.uretim_gorevleri SET
    durum = CASE p_karar WHEN 'onaylandi' THEN 'tamamlandi' WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor' ELSE 'iptal' END,
    tamamlanma_tarihi = CASE WHEN p_karar = 'onaylandi' THEN now() ELSE tamamlanma_tarihi END,
    iptal_tarihi = CASE WHEN p_karar = 'Iptal Edildi' THEN now() ELSE iptal_tarihi END,
    son_islem_anahtari = p_islem_anahtari, surum = surum + 1
  WHERE gorev_id = p_gorev_id;

  v_sonuc := jsonb_build_object('gorev_id', p_gorev_id, 'talep_id', v_gorev.talep_id, 'asama', v_gorev.asama, 'karar', p_karar, 'durum_id', v_durum_id, 'sonraki', v_sonraki);
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'podcast_uretici_karari', p_gorev_id, v_gorev.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_podcast_soru_zinciri_ac(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_podcast_dogrula(uuid,uuid,uuid,integer,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_podcast_uretici_karar_ver(uuid,uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_podcast_soru_zinciri_ac(uuid,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_podcast_dogrula(uuid,uuid,uuid,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_podcast_uretici_karar_ver(uuid,uuid,text,text,uuid) TO service_role;

COMMIT;

SELECT to_regprocedure('public.uretim_podcast_dogrula(uuid,uuid,uuid,integer,uuid)') IS NOT NULL AS podcast_dogrulama_kuruldu;
