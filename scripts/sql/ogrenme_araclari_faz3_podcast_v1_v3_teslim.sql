-- Faz 3 — V1/V3 İÜ podcast teslim kapısı ve opsiyonel AI transkript.
-- Tekrar çalıştırılabilir. Bu dosya uygulama tarafından otomatik çalıştırılmaz.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-faz3-podcast-v1-v3-teslim-v1', 1));

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
  v_transkript jsonb;
  v_transkript_istendi boolean;
  v_transkript_durumu text;
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
  IF NOT FOUND OR v_talep.ogrenme_araci_turu <> 'podcast' THEN RAISE EXCEPTION 'Talep podcast türünde değil.' USING ERRCODE = '23514'; END IF;
  IF v_arac.dosya_yolu IS NULL OR v_arac.metadata_dogrulandi IS NOT TRUE THEN
    RAISE EXCEPTION 'Ses dosyası doğrulanmadan podcast tamamlanamaz.' USING ERRCODE = '23514';
  END IF;

  IF COALESCE((v_arac.metadata->>'kapak_iptal_edildi')::boolean, false) IS NOT TRUE
     AND (COALESCE((v_arac.metadata->>'kapak_bekleniyor')::boolean, false) IS TRUE
          OR nullif(v_arac.metadata->'bekleyen_destek_yollari'->>'kapak', '') IS NOT NULL)
     AND (v_arac.kapak_yolu IS NULL OR COALESCE((v_arac.metadata->>'kapak_dogrulandi')::boolean, false) IS NOT TRUE) THEN
    RAISE EXCEPTION 'Bekleyen yayın görseli yüklemesi tamamlanmadan podcast tamamlanamaz.' USING ERRCODE = '23514';
  END IF;
  IF v_arac.kapak_yolu IS NOT NULL AND COALESCE((v_arac.metadata->>'kapak_dogrulandi')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Yüklenen yayın görseli doğrulanmadan podcast tamamlanamaz.' USING ERRCODE = '23514';
  END IF;

  v_transkript := COALESCE(v_arac.metadata->'transkript', '{}'::jsonb);
  v_transkript_durumu := COALESCE(v_transkript->>'durum', 'yok');
  IF v_arac.kaynak = 'iu' THEN
    IF p_gorev_id IS NULL THEN RAISE EXCEPTION 'İÜ podcast görevi zorunludur.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;
    IF NOT FOUND OR v_gorev.talep_id <> v_arac.talep_id OR v_gorev.asama <> 'video'
       OR v_gorev.atanan_iu_id IS DISTINCT FROM p_kullanici_id
       OR (v_gorev.arac_id IS NOT NULL AND v_gorev.arac_id <> p_arac_id)
       OR v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor') THEN
      RAISE EXCEPTION 'Podcast üretim görevi geçersiz.' USING ERRCODE = '42501';
    END IF;

    v_transkript_istendi := COALESCE(
      CASE WHEN jsonb_typeof(v_talep.ogrenme_araci_tercihleri->'transkript_istendi') = 'boolean'
        THEN (v_talep.ogrenme_araci_tercihleri->>'transkript_istendi')::boolean END,
      true
    );
    IF v_transkript_istendi THEN
      IF v_transkript_durumu <> 'onaylandi'
         OR COALESCE(v_transkript->>'kaynak', '') <> 'ai'
         OR nullif(btrim(COALESCE(v_transkript->>'onaylanan_metin', '')), '') IS NULL
         OR COALESCE((v_arac.metadata->>'transkript_metni_dogrulandi')::boolean, false) IS NOT TRUE
         OR v_transkript->>'onaylayan_kullanici_id' IS DISTINCT FROM p_kullanici_id::text
         OR (v_arac.checksum_sha256 IS NOT NULL AND nullif(v_transkript->>'bagli_ses_checksum', '') IS NOT NULL
             AND v_transkript->>'bagli_ses_checksum' <> v_arac.checksum_sha256) THEN
        RAISE EXCEPTION 'Talep edilen AI transkripti tamamlanıp İÜ tarafından onaylanmadan podcast teslim edilemez.' USING ERRCODE = '23514';
      END IF;
    ELSIF v_transkript_durumu IN ('ai_bekliyor', 'ai_isleniyor', 'ai_taslak', 'manuel_taslak', 'hata') THEN
      RAISE EXCEPTION 'Başlatılmış transkript işlemi tamamlanmadan podcast teslim edilemez.' USING ERRCODE = '23514';
    END IF;

    UPDATE public.uretim_gorevleri
    SET arac_id = p_arac_id, durum = 'inceleme_bekliyor', inceleme_tarihi = now(),
        son_islem_anahtari = p_islem_anahtari, surum = surum + 1
    WHERE gorev_id = p_gorev_id;
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (p_arac_id, 'inceleme bekleniyor', p_kullanici_id, 'Podcast üretici incelemesine gönderildi')
    RETURNING arac_durum_id INTO v_durum_id;
  ELSE
    -- Hazır podcast (V2/V4): Transkript opsiyoneldir; varsa mevcut doğrulama kuralı korunur.
    IF v_talep.uretici_id IS DISTINCT FROM p_kullanici_id OR v_talep.hazir_video IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Hazır podcasti yalnız talebin üreticisi tamamlayabilir.' USING ERRCODE = '42501';
    END IF;
    IF (v_arac.transkript_yolu IS NOT NULL OR nullif(v_transkript->>'onaylanan_metin', '') IS NOT NULL)
       AND COALESCE((v_arac.metadata->>'transkript_dogrulandi')::boolean, false) IS NOT TRUE
       AND v_transkript_durumu <> 'onaylandi' THEN
      RAISE EXCEPTION 'Eklenen transkript doğrulanmadan podcast tamamlanamaz.' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (p_arac_id, 'onaylandi', p_kullanici_id, 'Hazır podcast — otomatik onay')
    RETURNING arac_durum_id INTO v_durum_id;
    IF v_transkript_durumu NOT IN ('ai_bekliyor', 'ai_isleniyor', 'ai_taslak') THEN
      v_sonraki := public.uretim_podcast_soru_zinciri_ac(v_arac.talep_id, v_durum_id, p_kullanici_id, NULL);
    END IF;
  END IF;

  UPDATE public.ogrenme_araclari
  SET sure_saniye = p_sure_saniye,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('sure_dogrulandi', true)
  WHERE arac_id = p_arac_id;

  v_sonuc := jsonb_build_object('arac_id', p_arac_id, 'talep_id', v_arac.talep_id, 'arac_durum_id', v_durum_id, 'sonraki', v_sonraki);
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'podcast_dogrula', p_gorev_id, v_arac.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_podcast_dogrula(uuid,uuid,uuid,integer,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_podcast_dogrula(uuid,uuid,uuid,integer,uuid) TO service_role;
COMMIT;

SELECT to_regprocedure('public.uretim_podcast_dogrula(uuid,uuid,uuid,integer,uuid)') IS NOT NULL AS podcast_v1_v3_teslim_kapisi_kuruldu;
