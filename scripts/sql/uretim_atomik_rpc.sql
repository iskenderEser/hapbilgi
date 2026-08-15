-- İçerik üretim hattı — Paket B/2
-- Senaryo, video ve soru seti teslimini; üretici kararını ve sıradaki görevin
-- doğmasını tek PostgreSQL transaction'ında tamamlar.
-- İskender tarafından B/1 başarıyla kurulduktan sonra çalıştırılır.

BEGIN;

CREATE OR REPLACE FUNCTION public.uretim_soru_seti_dogrula(
  p_talep_id uuid,
  p_sorular jsonb
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_boyut integer;
  v_secenek_sayisi integer;
  v_soru jsonb;
  v_sira integer := 0;
  v_dogru_sayisi integer;
BEGIN
  SELECT t.soru_seti_buyuklugu, t.secenek_sayisi
    INTO v_boyut, v_secenek_sayisi
  FROM public.talepler t
  WHERE t.talep_id = p_talep_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  IF jsonb_typeof(p_sorular) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Sorular bir dizi olmalıdır.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_sorular) IS DISTINCT FROM v_boyut THEN
    RAISE EXCEPTION 'Soru sayısı % olmalıdır; gelen: %.', v_boyut, jsonb_array_length(p_sorular)
      USING ERRCODE = '23514';
  END IF;

  FOR v_soru IN SELECT value FROM jsonb_array_elements(p_sorular)
  LOOP
    v_sira := v_sira + 1;
    IF jsonb_typeof(v_soru) IS DISTINCT FROM 'object'
       OR nullif(btrim(v_soru->>'soru_metni'), '') IS NULL THEN
      RAISE EXCEPTION '%. sorunun soru metni zorunludur.', v_sira USING ERRCODE = '23514';
    END IF;
    IF jsonb_typeof(v_soru->'secenekler') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION '%. sorunun seçenekleri bir dizi olmalıdır.', v_sira USING ERRCODE = '23514';
    END IF;
    IF jsonb_array_length(v_soru->'secenekler') IS DISTINCT FROM v_secenek_sayisi THEN
      RAISE EXCEPTION '%. soruda tam % seçenek bulunmalıdır.', v_sira, v_secenek_sayisi USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_soru->'secenekler') AS secenek(value)
      WHERE jsonb_typeof(secenek.value) IS DISTINCT FROM 'object'
         OR nullif(btrim(secenek.value->>'harf'), '') IS NULL
         OR nullif(btrim(secenek.value->>'metin'), '') IS NULL
         OR jsonb_typeof(secenek.value->'dogru') IS DISTINCT FROM 'boolean'
    ) THEN
      RAISE EXCEPTION '%. sorunun seçenekleri harf, metin ve doğru bilgisi taşımalıdır.', v_sira USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_soru->'secenekler') WITH ORDINALITY AS secenek(value, sira)
      WHERE upper(secenek.value->>'harf') <> chr(64 + secenek.sira::integer)
    ) THEN
      RAISE EXCEPTION '%. sorunun seçenek harfleri A''dan başlayarak sıralı olmalıdır.', v_sira USING ERRCODE = '23514';
    END IF;

    SELECT count(*)::integer INTO v_dogru_sayisi
    FROM jsonb_array_elements(v_soru->'secenekler') AS secenek(value)
    WHERE (secenek.value->>'dogru')::boolean IS TRUE;
    IF v_dogru_sayisi <> 1 THEN
      RAISE EXCEPTION '%. soruda yalnız bir doğru seçenek bulunmalıdır.', v_sira USING ERRCODE = '23514';
    END IF;
  END LOOP;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.uretim_senaryo_teslim_et(
  p_gorev_id uuid,
  p_iu_id uuid,
  p_senaryo_metni text,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_senaryo_id uuid;
  v_durum_id uuid;
  v_onceki jsonb;
  v_sonuc jsonb;
BEGIN
  IF p_islem_anahtari IS NULL THEN RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(p_senaryo_metni), '') IS NULL THEN RAISE EXCEPTION 'Senaryo metni zorunludur.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));

  SELECT i.sonuc INTO v_onceki FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'senaryo_teslim';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_gorev FROM public.uretim_gorevleri g
  WHERE g.gorev_id = p_gorev_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üretim görevi bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_gorev.asama <> 'senaryo' THEN RAISE EXCEPTION 'Görev senaryo aşamasında değil.' USING ERRCODE = '23514'; END IF;
  IF v_gorev.atanan_iu_id IS DISTINCT FROM p_iu_id THEN RAISE EXCEPTION 'Bu görev seçilen IU''ya ait değil.' USING ERRCODE = '42501'; END IF;
  IF v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor') THEN
    RAISE EXCEPTION 'Görev mevcut durumda teslim edilemez: %.', v_gorev.durum USING ERRCODE = '23514';
  END IF;

  IF v_gorev.senaryo_id IS NULL THEN
    INSERT INTO public.senaryolar (talep_id, iu_id, senaryo_metni)
    VALUES (v_gorev.talep_id, p_iu_id, btrim(p_senaryo_metni))
    RETURNING senaryo_id INTO v_senaryo_id;
  ELSE
    v_senaryo_id := v_gorev.senaryo_id;
    UPDATE public.senaryolar s
       SET senaryo_metni = btrim(p_senaryo_metni), iu_id = p_iu_id
     WHERE s.senaryo_id = v_senaryo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Göreve bağlı senaryo bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  END IF;

  INSERT INTO public.senaryo_durumu (senaryo_id, durum, degistiren_id, notlar)
  VALUES (v_senaryo_id, 'inceleme bekleniyor', p_iu_id, NULL)
  RETURNING senaryo_durum_id INTO v_durum_id;

  UPDATE public.uretim_gorevleri g
     SET senaryo_id = v_senaryo_id,
         durum = 'inceleme_bekliyor',
         inceleme_tarihi = now(),
         baslama_tarihi = COALESCE(g.baslama_tarihi, now()),
         son_islem_anahtari = p_islem_anahtari,
         surum = g.surum + 1
   WHERE g.gorev_id = p_gorev_id;

  v_sonuc := jsonb_build_object(
    'gorev_id', p_gorev_id, 'talep_id', v_gorev.talep_id,
    'asama', 'senaryo', 'senaryo_id', v_senaryo_id,
    'durum_id', v_durum_id, 'durum', 'inceleme_bekliyor'
  );
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'senaryo_teslim', p_gorev_id, v_gorev.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.uretim_video_teslim_et(
  p_gorev_id uuid,
  p_iu_id uuid,
  p_video_url text,
  p_thumbnail_url text,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_durum_id uuid;
  v_onceki jsonb;
  v_sonuc jsonb;
BEGIN
  IF p_islem_anahtari IS NULL THEN RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(p_video_url), '') IS NULL THEN RAISE EXCEPTION 'Video adresi zorunludur.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));

  SELECT i.sonuc INTO v_onceki FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'video_teslim';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_gorev FROM public.uretim_gorevleri g
  WHERE g.gorev_id = p_gorev_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üretim görevi bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_gorev.asama <> 'video' OR v_gorev.video_id IS NULL THEN RAISE EXCEPTION 'Görev geçerli bir video aşaması değil.' USING ERRCODE = '23514'; END IF;
  IF v_gorev.atanan_iu_id IS DISTINCT FROM p_iu_id THEN RAISE EXCEPTION 'Bu görev seçilen IU''ya ait değil.' USING ERRCODE = '42501'; END IF;
  IF v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor') THEN
    RAISE EXCEPTION 'Görev mevcut durumda teslim edilemez: %.', v_gorev.durum USING ERRCODE = '23514';
  END IF;

  UPDATE public.videolar v
     SET video_url = btrim(p_video_url),
         thumbnail_url = nullif(btrim(p_thumbnail_url), ''),
         iu_id = p_iu_id
   WHERE v.video_id = v_gorev.video_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Göreve bağlı video bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.video_durumu (video_id, durum, degistiren_id, notlar)
  VALUES (v_gorev.video_id, 'inceleme bekleniyor', p_iu_id, NULL)
  RETURNING video_durum_id INTO v_durum_id;

  UPDATE public.uretim_gorevleri g
     SET durum = 'inceleme_bekliyor',
         inceleme_tarihi = now(),
         baslama_tarihi = COALESCE(g.baslama_tarihi, now()),
         son_islem_anahtari = p_islem_anahtari,
         surum = g.surum + 1
   WHERE g.gorev_id = p_gorev_id;

  v_sonuc := jsonb_build_object(
    'gorev_id', p_gorev_id, 'talep_id', v_gorev.talep_id,
    'asama', 'video', 'video_id', v_gorev.video_id,
    'durum_id', v_durum_id, 'durum', 'inceleme_bekliyor'
  );
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'video_teslim', p_gorev_id, v_gorev.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.uretim_soru_seti_teslim_et(
  p_gorev_id uuid,
  p_iu_id uuid,
  p_sorular jsonb,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_durum_id uuid;
  v_onceki jsonb;
  v_sonuc jsonb;
BEGIN
  IF p_islem_anahtari IS NULL THEN RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));

  SELECT i.sonuc INTO v_onceki FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'soru_seti_teslim';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_gorev FROM public.uretim_gorevleri g
  WHERE g.gorev_id = p_gorev_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üretim görevi bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_gorev.asama <> 'soru_seti' OR v_gorev.soru_seti_id IS NULL THEN RAISE EXCEPTION 'Görev geçerli bir soru seti aşaması değil.' USING ERRCODE = '23514'; END IF;
  IF v_gorev.atanan_iu_id IS DISTINCT FROM p_iu_id THEN RAISE EXCEPTION 'Bu görev seçilen IU''ya ait değil.' USING ERRCODE = '42501'; END IF;
  IF v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor') THEN
    RAISE EXCEPTION 'Görev mevcut durumda teslim edilemez: %.', v_gorev.durum USING ERRCODE = '23514';
  END IF;

  PERFORM public.uretim_soru_seti_dogrula(v_gorev.talep_id, p_sorular);

  UPDATE public.soru_setleri s
     SET sorular = p_sorular, iu_id = p_iu_id
   WHERE s.soru_seti_id = v_gorev.soru_seti_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Göreve bağlı soru seti bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.soru_seti_durumu (soru_seti_id, durum, degistiren_id, notlar)
  VALUES (v_gorev.soru_seti_id, 'inceleme bekleniyor', p_iu_id, NULL)
  RETURNING soru_seti_durum_id INTO v_durum_id;

  UPDATE public.uretim_gorevleri g
     SET durum = 'inceleme_bekliyor',
         inceleme_tarihi = now(),
         baslama_tarihi = COALESCE(g.baslama_tarihi, now()),
         son_islem_anahtari = p_islem_anahtari,
         surum = g.surum + 1
   WHERE g.gorev_id = p_gorev_id;

  v_sonuc := jsonb_build_object(
    'gorev_id', p_gorev_id, 'talep_id', v_gorev.talep_id,
    'asama', 'soru_seti', 'soru_seti_id', v_gorev.soru_seti_id,
    'durum_id', v_durum_id, 'durum', 'inceleme_bekliyor'
  );
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'soru_seti_teslim', p_gorev_id, v_gorev.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Üreticinin onay/revizyon/iptal kararı. Durum geçmişi, mevcut görevin kapanışı,
-- sıradaki içerik kabuğu ve sıradaki IU görevi aynı transaction'da yazılır.
CREATE OR REPLACE FUNCTION public.uretim_uretici_karar_ver(
  p_gorev_id uuid,
  p_uretici_id uuid,
  p_karar text,
  p_notlar text,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_talep public.talepler%ROWTYPE;
  v_onceki jsonb;
  v_sonuc jsonb;
  v_sonraki jsonb := NULL;
  v_durum_id uuid;
  v_video_id uuid;
  v_soru_seti_id uuid;
  v_revizyon_sayisi integer;
  v_gorev_durumu text;
BEGIN
  IF p_islem_anahtari IS NULL THEN RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023'; END IF;
  IF p_karar NOT IN ('onaylandi', 'revizyon bekleniyor', 'Iptal Edildi') THEN RAISE EXCEPTION 'Geçersiz üretici kararı.' USING ERRCODE = '22023'; END IF;
  IF p_karar = 'revizyon bekleniyor' AND nullif(btrim(p_notlar), '') IS NULL THEN
    RAISE EXCEPTION 'Revizyon notu zorunludur.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));

  SELECT i.sonuc INTO v_onceki FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'uretici_karari';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_gorev FROM public.uretim_gorevleri g
  WHERE g.gorev_id = p_gorev_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üretim görevi bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_gorev.durum <> 'inceleme_bekliyor' THEN
    RAISE EXCEPTION 'Yalnız inceleme bekleyen görev hakkında karar verilebilir.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_talep FROM public.talepler t WHERE t.talep_id = v_gorev.talep_id FOR UPDATE;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN
    RAISE EXCEPTION 'Kararı yalnız talebi açan üretici verebilir.' USING ERRCODE = '42501';
  END IF;

  IF p_karar = 'revizyon bekleniyor' THEN
    IF v_gorev.asama = 'senaryo' THEN
      SELECT count(*)::integer INTO v_revizyon_sayisi FROM public.senaryo_durumu d
      WHERE d.senaryo_id = v_gorev.senaryo_id AND d.durum = 'revizyon bekleniyor';
    ELSIF v_gorev.asama = 'video' THEN
      SELECT count(*)::integer INTO v_revizyon_sayisi FROM public.video_durumu d
      WHERE d.video_id = v_gorev.video_id AND d.durum = 'revizyon bekleniyor';
    ELSE
      SELECT count(*)::integer INTO v_revizyon_sayisi FROM public.soru_seti_durumu d
      WHERE d.soru_seti_id = v_gorev.soru_seti_id AND d.durum = 'revizyon bekleniyor';
    END IF;
    IF v_revizyon_sayisi >= 2 THEN
      RAISE EXCEPTION 'Maksimum revizyon hakkı (2) kullanıldı.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_gorev.asama = 'senaryo' THEN
    INSERT INTO public.senaryo_durumu (senaryo_id, durum, degistiren_id, notlar)
    VALUES (v_gorev.senaryo_id, p_karar, p_uretici_id, nullif(btrim(p_notlar), ''))
    RETURNING senaryo_durum_id INTO v_durum_id;
  ELSIF v_gorev.asama = 'video' THEN
    INSERT INTO public.video_durumu (video_id, durum, degistiren_id, notlar)
    VALUES (v_gorev.video_id, p_karar, p_uretici_id, nullif(btrim(p_notlar), ''))
    RETURNING video_durum_id INTO v_durum_id;
  ELSE
    INSERT INTO public.soru_seti_durumu (soru_seti_id, durum, degistiren_id, notlar)
    VALUES (v_gorev.soru_seti_id, p_karar, p_uretici_id, nullif(btrim(p_notlar), ''))
    RETURNING soru_seti_durum_id INTO v_durum_id;
  END IF;

  v_gorev_durumu := CASE p_karar
    WHEN 'onaylandi' THEN 'tamamlandi'
    WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor'
    ELSE 'iptal'
  END;

  UPDATE public.uretim_gorevleri g
     SET durum = v_gorev_durumu,
         tamamlanma_tarihi = CASE WHEN p_karar = 'onaylandi' THEN now() ELSE g.tamamlanma_tarihi END,
         iptal_tarihi = CASE WHEN p_karar = 'Iptal Edildi' THEN now() ELSE g.iptal_tarihi END,
         son_islem_anahtari = p_islem_anahtari,
         surum = g.surum + 1
   WHERE g.gorev_id = p_gorev_id;

  IF p_karar = 'onaylandi' AND v_gorev.asama = 'senaryo' THEN
    INSERT INTO public.videolar (senaryo_durum_id, talep_id, kaynak, iu_id, video_url)
    VALUES (v_durum_id, v_gorev.talep_id, 'iu', NULL, '')
    RETURNING video_id INTO v_video_id;

    v_sonraki := public.uretim_gorev_ac(
      v_gorev.talep_id, 'video', p_uretici_id, v_gorev.atanan_iu_id,
      'otomatik', NULL, v_video_id, NULL
    );
  ELSIF p_karar = 'onaylandi' AND v_gorev.asama = 'video' THEN
    IF v_talep.hazir_soru_seti IS TRUE THEN
      PERFORM public.uretim_soru_seti_dogrula(v_gorev.talep_id, v_talep.hazir_soru_seti_verisi);
      INSERT INTO public.soru_setleri (talep_id, video_durum_id, kaynak, iu_id, sorular)
      VALUES (v_gorev.talep_id, v_durum_id, 'hazir', NULL, v_talep.hazir_soru_seti_verisi)
      RETURNING soru_seti_id INTO v_soru_seti_id;
      INSERT INTO public.soru_seti_durumu (soru_seti_id, durum, degistiren_id, notlar)
      VALUES (v_soru_seti_id, 'onaylandi', p_uretici_id, 'Hazır soru seti — otomatik onay');
      v_sonraki := jsonb_build_object(
        'gorev_acildi', false, 'soru_seti_id', v_soru_seti_id, 'hazir_soru_seti_islendi', true
      );
    ELSE
      INSERT INTO public.soru_setleri (talep_id, video_durum_id, kaynak, iu_id, sorular)
      VALUES (v_gorev.talep_id, v_durum_id, 'iu', NULL, '[]'::jsonb)
      RETURNING soru_seti_id INTO v_soru_seti_id;
      v_sonraki := public.uretim_gorev_ac(
        v_gorev.talep_id, 'soru_seti', p_uretici_id, v_gorev.atanan_iu_id,
        'otomatik', NULL, NULL, v_soru_seti_id
      );
    END IF;
  END IF;

  v_sonuc := jsonb_build_object(
    'gorev_id', p_gorev_id,
    'talep_id', v_gorev.talep_id,
    'asama', v_gorev.asama,
    'karar', p_karar,
    'durum', v_gorev_durumu,
    'durum_id', v_durum_id,
    'sonraki', v_sonraki
  );
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'uretici_karari', p_gorev_id, v_gorev.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Hazır video üretici tarafından Bunny'ye yüklendikten sonra URL, onaylı video
-- durumu ve gerekiyorsa IU soru-seti görevi tek transaction'da kurulur.
CREATE OR REPLACE FUNCTION public.uretim_hazir_video_kaydet(
  p_talep_id uuid,
  p_uretici_id uuid,
  p_video_url text,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE;
  v_onceki jsonb;
  v_sonuc jsonb;
  v_sonraki jsonb := NULL;
  v_video_id uuid;
  v_video_durum_id uuid;
  v_soru_seti_id uuid;
BEGIN
  IF p_islem_anahtari IS NULL THEN RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(p_video_url), '') IS NULL THEN RAISE EXCEPTION 'Video adresi zorunludur.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));

  SELECT i.sonuc INTO v_onceki FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'hazir_video_kaydet';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_talep FROM public.talepler t WHERE t.talep_id = p_talep_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN RAISE EXCEPTION 'Hazır videoyu yalnız talebin üreticisi kaydedebilir.' USING ERRCODE = '42501'; END IF;
  IF v_talep.hazir_video IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Bu talep hazır video talebi değil.' USING ERRCODE = '23514'; END IF;

  UPDATE public.talepler SET hazir_video_url = btrim(p_video_url) WHERE talep_id = p_talep_id;

  SELECT v.video_id INTO v_video_id
  FROM public.videolar v
  WHERE v.talep_id = p_talep_id AND v.kaynak = 'hazir'
  ORDER BY v.created_at ASC
  LIMIT 1;
  IF v_video_id IS NULL THEN
    INSERT INTO public.videolar (talep_id, senaryo_durum_id, kaynak, iu_id, video_url, thumbnail_url)
    VALUES (p_talep_id, NULL, 'hazir', NULL, btrim(p_video_url), NULL)
    RETURNING video_id INTO v_video_id;
  ELSE
    UPDATE public.videolar SET video_url = btrim(p_video_url) WHERE video_id = v_video_id;
  END IF;

  SELECT d.video_durum_id INTO v_video_durum_id
  FROM public.video_durumu d
  WHERE d.video_id = v_video_id AND d.durum = 'onaylandi'
  ORDER BY d.created_at ASC
  LIMIT 1;
  IF v_video_durum_id IS NULL THEN
    INSERT INTO public.video_durumu (video_id, durum, degistiren_id, notlar)
    VALUES (v_video_id, 'onaylandi', p_uretici_id, 'Hazır video — otomatik onay')
    RETURNING video_durum_id INTO v_video_durum_id;
  END IF;

  SELECT s.soru_seti_id INTO v_soru_seti_id
  FROM public.soru_setleri s
  WHERE s.video_durum_id = v_video_durum_id
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF v_talep.hazir_soru_seti IS TRUE THEN
    PERFORM public.uretim_soru_seti_dogrula(p_talep_id, v_talep.hazir_soru_seti_verisi);
    IF v_soru_seti_id IS NULL THEN
      INSERT INTO public.soru_setleri (talep_id, video_durum_id, kaynak, iu_id, sorular)
      VALUES (p_talep_id, v_video_durum_id, 'hazir', NULL, v_talep.hazir_soru_seti_verisi)
      RETURNING soru_seti_id INTO v_soru_seti_id;
    ELSE
      UPDATE public.soru_setleri s
         SET sorular = v_talep.hazir_soru_seti_verisi
       WHERE s.soru_seti_id = v_soru_seti_id AND s.kaynak = 'hazir';
      IF NOT FOUND THEN RAISE EXCEPTION 'Hazır video zincirinde IU soru seti zaten mevcut.' USING ERRCODE = '23514'; END IF;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.soru_seti_durumu d
      WHERE d.soru_seti_id = v_soru_seti_id AND d.durum = 'onaylandi'
    ) THEN
      INSERT INTO public.soru_seti_durumu (soru_seti_id, durum, degistiren_id, notlar)
      VALUES (v_soru_seti_id, 'onaylandi', p_uretici_id, 'Hazır soru seti — otomatik onay');
    END IF;
    v_sonraki := jsonb_build_object('gorev_acildi', false, 'hazir_soru_seti_islendi', true);
  ELSE
    IF v_soru_seti_id IS NULL THEN
      INSERT INTO public.soru_setleri (talep_id, video_durum_id, kaynak, iu_id, sorular)
      VALUES (p_talep_id, v_video_durum_id, 'iu', NULL, '[]'::jsonb)
      RETURNING soru_seti_id INTO v_soru_seti_id;
    END IF;
    v_sonraki := public.uretim_gorev_ac(
      p_talep_id, 'soru_seti', p_uretici_id, NULL,
      'otomatik', NULL, NULL, v_soru_seti_id
    );
  END IF;

  v_sonuc := jsonb_build_object(
    'talep_id', p_talep_id,
    'video_id', v_video_id,
    'video_durum_id', v_video_durum_id,
    'soru_seti_id', v_soru_seti_id,
    'sonraki', v_sonraki
  );
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (
    p_islem_anahtari, 'hazir_video_kaydet',
    NULLIF(v_sonraki->>'gorev_id', '')::uuid,
    p_talep_id, v_sonuc
  );
  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_soru_seti_dogrula(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_senaryo_teslim_et(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_video_teslim_et(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_soru_seti_teslim_et(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_uretici_karar_ver(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_hazir_video_kaydet(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.uretim_soru_seti_dogrula(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_senaryo_teslim_et(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_video_teslim_et(uuid, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_soru_seti_teslim_et(uuid, uuid, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_uretici_karar_ver(uuid, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_hazir_video_kaydet(uuid, uuid, text, uuid) TO service_role;

COMMIT;

WITH beklenen(imza) AS (
  VALUES
    ('public.uretim_soru_seti_dogrula(uuid,jsonb)'),
    ('public.uretim_senaryo_teslim_et(uuid,uuid,text,uuid)'),
    ('public.uretim_video_teslim_et(uuid,uuid,text,text,uuid)'),
    ('public.uretim_soru_seti_teslim_et(uuid,uuid,jsonb,uuid)'),
    ('public.uretim_uretici_karar_ver(uuid,uuid,text,text,uuid)'),
    ('public.uretim_hazir_video_kaydet(uuid,uuid,text,uuid)')
)
SELECT imza, to_regprocedure(imza) IS NOT NULL AS kuruldu_mu
FROM beklenen
ORDER BY imza;
