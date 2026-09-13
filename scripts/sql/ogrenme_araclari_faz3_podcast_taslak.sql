-- scripts/sql/ogrenme_araclari_faz3_podcast_taslak.sql
--
-- Öğrenme Araçları — Faz 3 Hazır Podcast V2/V4 Kalıcı Taslak Altyapısı
-- Kullanıcı "AI ile Transkript Oluştur" dediğinde eksiksiz talep gönderimi
-- yapılmadan kalıcı, tekrar güvenli taslak oluşturulmasını sağlar.
-- Taslak talep aktif operasyonlara girmez, üretim görevi oluşturmaz ve
-- kesinleştirme anına kadar yayın zincirini tetiklemez.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-podcast-taslak-faz3', 1));

-- 1. talepler tablosuna taslak sütunları
ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS taslak_mi boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS taslak_oturum_anahtari uuid;

CREATE INDEX IF NOT EXISTS ix_talepler_taslak_mi
  ON public.talepler(taslak_mi)
  WHERE taslak_mi = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_talepler_uretici_taslak_oturumu
  ON public.talepler (uretici_id, taslak_oturum_anahtari)
  WHERE taslak_oturum_anahtari IS NOT NULL;

-- 2. ogrenme_araclari tablosuna taslak sütunu
ALTER TABLE public.ogrenme_araclari
  ADD COLUMN IF NOT EXISTS taslak_mi boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_ogrenme_araclari_taslak_mi
  ON public.ogrenme_araclari(taslak_mi)
  WHERE taslak_mi = true;

-- 2.1. ogrenme_araci_depolama_temizleme_kuyrugu tablosunun arac_id kısıtını ON DELETE SET NULL yap
-- Bu sayede taslak iptal edildiğinde veya zaman aşımına uğradığında ogrenme_araclari kaydı
-- silinse dahi Bunny depolama temizleme kuyruğu kayıtları ON DELETE CASCADE ile silinmez, korunur.
ALTER TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu
  ALTER COLUMN arac_id DROP NOT NULL;

DO $$
DECLARE
  v_con text;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.ogrenme_araci_depolama_temizleme_kuyrugu'::regclass
      AND contype = 'f'
      AND confrelid = 'public.ogrenme_araclari'::regclass
      AND confdeltype <> 'n'
  LOOP
    EXECUTE 'ALTER TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu DROP CONSTRAINT ' || quote_ident(v_con);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ogrenme_araci_depolama_temizleme_kuyrugu'::regclass
      AND contype = 'f'
      AND confrelid = 'public.ogrenme_araclari'::regclass
  ) THEN
    ALTER TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu
      ADD CONSTRAINT fk_ogrenme_araci_depolama_temizleme_arac
      FOREIGN KEY (arac_id)
      REFERENCES public.ogrenme_araclari(arac_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Atomik taslak oluşturma RPC'si
CREATE OR REPLACE FUNCTION public.podcast_taslak_atomik_olustur(
  p_uretici_id uuid,
  p_oturum_anahtari uuid,
  p_talep jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep_id uuid;
  v_arac_id uuid;
  v_ogrenme_araci_turu text;
  v_hazir_video boolean;
BEGIN
  IF p_uretici_id IS NULL OR p_oturum_anahtari IS NULL OR p_talep IS NULL THEN
    RAISE EXCEPTION 'Üretici, oturum anahtarı ve talep verisi zorunludur.'
      USING ERRCODE = '22023';
  END IF;

  v_ogrenme_araci_turu := p_talep->>'ogrenme_araci_turu';
  v_hazir_video := COALESCE((p_talep->>'hazir_video')::boolean, false);

  IF v_ogrenme_araci_turu IS DISTINCT FROM 'podcast' THEN
    RAISE EXCEPTION 'Taslak oluşturma yalnızca podcast türü için geçerlidir.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT v_hazir_video THEN
    RAISE EXCEPTION 'Yalnızca hazır V2/V4 podcast akışı için taslak oluşturulabilir (V1/V3 kapsam dışıdır).'
      USING ERRCODE = '22023';
  END IF;

  -- Aynı üretici ve aynı oturum için kilit
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_uretici_id::text || ':taslak:' || p_oturum_anahtari::text, 42)
  );

  -- Mevcut taslak var mı kontrol et
  SELECT t.talep_id, a.arac_id
    INTO v_talep_id, v_arac_id
  FROM public.talepler t
  LEFT JOIN public.ogrenme_araclari a
    ON a.talep_id = t.talep_id
   AND a.arac_turu = 'podcast'
  WHERE t.uretici_id = p_uretici_id
    AND t.taslak_oturum_anahtari = p_oturum_anahtari
    AND t.taslak_mi = true
  ORDER BY a.created_at ASC
  LIMIT 1
  FOR UPDATE OF t;

  IF FOUND THEN
    -- Eğer araç kaydı yoksa oluştur
    IF v_arac_id IS NULL THEN
      INSERT INTO public.ogrenme_araclari (
        talep_id,
        arac_turu,
        kaynak,
        taslak_mi
      ) VALUES (
        v_talep_id,
        'podcast',
        'hazir',
        true
      )
      RETURNING arac_id INTO v_arac_id;

      INSERT INTO public.ogrenme_araci_durumu (
        arac_id,
        durum,
        degistiren_id,
        notlar
      ) VALUES (
        v_arac_id,
        'yukleme_bekliyor',
        p_uretici_id,
        'Kalıcı podcast taslağı oluşturuldu'
      );
    END IF;

    RETURN jsonb_build_object(
      'talep_id', v_talep_id,
      'arac_id', v_arac_id,
      'mevcut', true,
      'taslak_mi', true
    );
  END IF;

  -- Yeni taslak talep oluştur (üretim görevi ve yayın zinciri BAŞLATILMAZ)
  INSERT INTO public.talepler (
    uretici_id,
    firma_id,
    takim_id,
    egitim_turu,
    hedef_roller,
    icerik_turu,
    ogrenme_araci_turu,
    ogrenme_araci_tercihleri,
    urun_id,
    teknik_id,
    urun_adi,
    aciklama,
    hazir_video,
    hazir_soru_seti,
    hazir_soru_seti_verisi,
    soru_seti_buyuklugu,
    secenek_sayisi,
    video_basi_soru_sayisi,
    taslak_mi,
    taslak_oturum_anahtari
  ) VALUES (
    p_uretici_id,
    (p_talep->>'firma_id')::uuid,
    NULLIF(p_talep->>'takim_id', '')::uuid,
    COALESCE(p_talep->>'egitim_turu', 'standart_icerik'),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_talep->'hedef_roller', '[]'::jsonb))),
    p_talep->>'icerik_turu',
    'podcast',
    COALESCE(p_talep->'ogrenme_araci_tercihleri', '{}'::jsonb),
    NULLIF(p_talep->>'urun_id', '')::uuid,
    NULLIF(p_talep->>'teknik_id', '')::uuid,
    NULLIF(p_talep->>'urun_adi', ''),
    NULLIF(p_talep->>'aciklama', ''),
    true, -- hazir_video = true (hazır podcast)
    COALESCE((p_talep->>'hazir_soru_seti')::boolean, false),
    CASE
      WHEN p_talep->'hazir_soru_seti_verisi' IS NULL
        OR jsonb_typeof(p_talep->'hazir_soru_seti_verisi') = 'null'
      THEN NULL
      ELSE p_talep->'hazir_soru_seti_verisi'
    END,
    COALESCE((p_talep->>'soru_seti_buyuklugu')::integer, 25),
    COALESCE((p_talep->>'secenek_sayisi')::integer, 4),
    COALESCE((p_talep->>'video_basi_soru_sayisi')::integer, 2),
    true, -- taslak_mi = true
    p_oturum_anahtari
  )
  RETURNING talep_id INTO v_talep_id;

  -- İlişkili taslak podcast araç kaydı oluştur
  INSERT INTO public.ogrenme_araclari (
    talep_id,
    arac_turu,
    kaynak,
    taslak_mi
  ) VALUES (
    v_talep_id,
    'podcast',
    'hazir',
    true
  )
  RETURNING arac_id INTO v_arac_id;

  INSERT INTO public.ogrenme_araci_durumu (
    arac_id,
    durum,
    degistiren_id,
    notlar
  ) VALUES (
    v_arac_id,
    'yukleme_bekliyor',
    p_uretici_id,
    'Kalıcı podcast taslağı oluşturuldu'
  );

  -- Taslak aşamasında hiçbir üretim görevi veya operasyonel zincir başlatılmaz.
  -- İlk görev yalnız kesinleştirme aşamasında oluşturulur.

  RETURN jsonb_build_object(
    'talep_id', v_talep_id,
    'arac_id', v_arac_id,
    'mevcut', false,
    'taslak_mi', true
  );
END;
$fonksiyon$;

-- 4. Atomik taslak kesinleştirme RPC'si
CREATE OR REPLACE FUNCTION public.podcast_taslak_atomik_kesinlestir(
  p_uretici_id uuid,
  p_talep_id uuid,
  p_islem_anahtari uuid,
  p_talep jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_taslak_mi boolean;
  v_uretici_id uuid;
  v_firma_id uuid;
  v_uretici_firma_id uuid;
  v_mevcut_anahtar uuid;
  v_mevcut_ozet text;
  v_istek_ozeti text;
  v_ilk_gorev jsonb;
  v_sonraki jsonb;
  v_durum_id uuid;
  v_arac_id uuid;
  v_arac_turu text;
  v_kaynak text;
  v_transkript_durumu text;
  v_dosya_yolu text;
  v_metadata jsonb;
  v_sure integer;
BEGIN
  IF p_uretici_id IS NULL OR p_talep_id IS NULL OR p_islem_anahtari IS NULL OR p_talep IS NULL THEN
    RAISE EXCEPTION 'Üretici, talep ID, işlem anahtarı ve talep verisi zorunludur.'
      USING ERRCODE = '22023';
  END IF;

  v_istek_ozeti := md5(p_talep::text);

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_talep_id::text || ':kesinlestir', 43)
  );

  -- 1. Taslak talebi kilit altında oku ve üretici + firma sahipliğini doğrula
  SELECT t.taslak_mi, t.uretici_id, t.firma_id, t.olusturma_islem_anahtari, t.olusturma_istek_ozeti,
         k.firma_id AS uretici_firma_id
    INTO v_taslak_mi, v_uretici_id, v_firma_id, v_mevcut_anahtar, v_mevcut_ozet,
         v_uretici_firma_id
  FROM public.talepler t
  JOIN public.kullanicilar k ON k.kullanici_id = p_uretici_id
  WHERE t.talep_id = p_talep_id
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Taslak talep bulunamadı.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_uretici_id IS DISTINCT FROM p_uretici_id THEN
    RAISE EXCEPTION 'Bu taslak talebi kesinleştirme yetkiniz yok.'
      USING ERRCODE = '42501';
  END IF;

  IF v_firma_id IS DISTINCT FROM v_uretici_firma_id THEN
    RAISE EXCEPTION 'Bu taslak talebi kesinleştirme yetkiniz yok (firma uyumsuz).'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Daha önce kesinleştirilmiş mi? (Çift tıklama / idempotent koruması)
  IF NOT v_taslak_mi THEN
    IF v_mevcut_anahtar = p_islem_anahtari THEN
      SELECT i.sonuc INTO v_ilk_gorev
      FROM public.uretim_islem_kayitlari i
      WHERE i.islem_anahtari = p_islem_anahtari
        AND i.islem_turu = 'talep_ilk_gorev';

      RETURN jsonb_build_object(
        'talep_id', p_talep_id,
        'mevcut', true,
        'kesinlesmis', true,
        'ilk_gorev', v_ilk_gorev
      );
    ELSE
      RAISE EXCEPTION 'Bu talep daha önce kesinleştirilmiştir.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- 3. Kayıt V2/V4 hazır podcast mi kontrolü
  SELECT a.arac_id, a.arac_turu, a.kaynak, a.dosya_yolu, a.metadata,
         (a.metadata->'transkript'->>'durum'), a.sure_saniye
    INTO v_arac_id, v_arac_turu, v_kaynak, v_dosya_yolu, v_metadata,
         v_transkript_durumu, v_sure
  FROM public.ogrenme_araclari a
  WHERE a.talep_id = p_talep_id
    AND a.arac_turu = 'podcast'
  LIMIT 1;

  IF v_arac_id IS NULL OR v_kaynak <> 'hazir' THEN
    RAISE EXCEPTION 'Yalnızca hazır V2/V4 podcast taslakları bu işlemle kesinleştirilebilir.'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Ses dosyası ve Storage doğrulaması tamamlanmış mı kontrolü
  IF v_dosya_yolu IS NULL OR length(trim(v_dosya_yolu)) = 0 THEN
    RAISE EXCEPTION 'Podcast ses dosyası yüklenmeden talep kesinleştirilemez.'
      USING ERRCODE = '22023';
  END IF;

  -- Storage doğrulaması zorunludur: sure_saniye_beyani tek başına yeterli kabul edilmez
  IF v_metadata->'depolama_dogrulamasi' IS NULL THEN
    RAISE EXCEPTION 'Podcast depolama doğrulaması tamamlanmadan talep kesinleştirilemez.'
      USING ERRCODE = '22023';
  END IF;

  -- Geçerli süre bilgisini ayrıca doğrula; süre pozitif bir tam sayı olmalı
  v_sure := COALESCE(v_sure, NULLIF(v_metadata->>'sure_saniye_beyani', '')::integer);
  IF v_sure IS NULL OR v_sure <= 0 THEN
    RAISE EXCEPTION 'Podcast geçerli ve pozitif bir süre bilgisine sahip olmalıdır.'
      USING ERRCODE = '22023';
  END IF;

  -- 5. Transkript durumu yalnız yok, onaylandi veya iptal kontrolü
  IF v_transkript_durumu IN ('ai_bekliyor', 'ai_isleniyor', 'ai_taslak', 'manuel_taslak', 'hata') THEN
    RAISE EXCEPTION 'Podcast transkript kararı tamamlanmadan talep kesinleştirilemez (mevcut durum: %). Yalnızca yok, onaylandi veya iptal kabul edilir.', v_transkript_durumu
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_transkript_durumu, 'yok') NOT IN ('yok', 'onaylandi', 'iptal') THEN
    RAISE EXCEPTION 'Podcast transkript kararı tamamlanmadan talep kesinleştirilemez (mevcut durum: %). Yalnızca yok, onaylandi veya iptal kabul edilir.', COALESCE(v_transkript_durumu, 'yok')
      USING ERRCODE = '22023';
  END IF;

  -- 6. Taslağı kesinleştir: formu nihai alanlarla güncelle, taslak_mi = false yap
  UPDATE public.talepler SET
    egitim_turu = p_talep->>'egitim_turu',
    hedef_roller = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_talep->'hedef_roller', '[]'::jsonb))),
    icerik_turu = p_talep->>'icerik_turu',
    ogrenme_araci_tercihleri = COALESCE(p_talep->'ogrenme_araci_tercihleri', '{}'::jsonb),
    urun_id = NULLIF(p_talep->>'urun_id', '')::uuid,
    teknik_id = NULLIF(p_talep->>'teknik_id', '')::uuid,
    urun_adi = NULLIF(p_talep->>'urun_adi', ''),
    aciklama = NULLIF(p_talep->>'aciklama', ''),
    hazir_video = COALESCE((p_talep->>'hazir_video')::boolean, true),
    hazir_soru_seti = COALESCE((p_talep->>'hazir_soru_seti')::boolean, false),
    hazir_soru_seti_verisi = CASE
      WHEN p_talep->'hazir_soru_seti_verisi' IS NULL
        OR jsonb_typeof(p_talep->'hazir_soru_seti_verisi') = 'null'
      THEN NULL
      ELSE p_talep->'hazir_soru_seti_verisi'
    END,
    soru_seti_buyuklugu = (p_talep->>'soru_seti_buyuklugu')::integer,
    secenek_sayisi = (p_talep->>'secenek_sayisi')::integer,
    video_basi_soru_sayisi = (p_talep->>'video_basi_soru_sayisi')::integer,
    olusturma_islem_anahtari = p_islem_anahtari,
    olusturma_istek_ozeti = v_istek_ozeti,
    taslak_mi = false,
    taslak_oturum_anahtari = NULL,
    updated_at = now()
  WHERE talep_id = p_talep_id;

  -- 7. Bağlı araç kaydının teknik doğrulama ve süre alanlarını kesinleştir, taslak_mi = false yap
  UPDATE public.ogrenme_araclari SET
    taslak_mi = false,
    sure_saniye = v_sure,
    metadata_dogrulandi = true,
    metadata = v_metadata || jsonb_build_object('sure_dogrulandi', true, 'kesinlesme_tarihi', now()),
    updated_at = now()
  WHERE arac_id = v_arac_id;

  -- 8. Podcast durumunu mükerrer kayıt üretmeden onaylandi yap
  SELECT arac_durum_id INTO v_durum_id
  FROM public.ogrenme_araci_durumu
  WHERE arac_id = v_arac_id AND durum = 'onaylandi'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_durum_id IS NULL THEN
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (v_arac_id, 'onaylandi', p_uretici_id, 'Hazır podcast — kesinleştirildi ve onaylandı')
    RETURNING arac_durum_id INTO v_durum_id;
  END IF;

  -- 9. V2/V4 soru zincirini yalnız bir kez başlat
  v_sonraki := public.uretim_podcast_soru_zinciri_ac(
    p_talep_id,
    v_durum_id,
    p_uretici_id,
    NULL
  );

  -- 10. İlk görevi aç
  v_ilk_gorev := public.uretim_talep_ilk_gorevini_ac(
    p_talep_id,
    p_uretici_id,
    p_islem_anahtari
  );

  RETURN jsonb_build_object(
    'talep_id', p_talep_id,
    'mevcut', false,
    'kesinlesmis', true,
    'ilk_gorev', v_ilk_gorev,
    'sonraki', v_sonraki
  );
END;
$fonksiyon$;

-- 5. Kullanıcı tarafından açıkça taslak iptal etme RPC'si (Aşama 4 Kural 10 & 12)
CREATE OR REPLACE FUNCTION public.podcast_taslak_iptal_et_atomik(
  p_talep_id uuid,
  p_kullanici_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE;
  v_arac public.ogrenme_araclari%ROWTYPE;
BEGIN
  SELECT * INTO v_talep
  FROM public.talepler
  WHERE talep_id = p_talep_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'zaten_yok', true);
  END IF;

  IF v_talep.uretici_id IS DISTINCT FROM p_kullanici_id THEN
    RAISE EXCEPTION 'Bu taslak talebi iptal etme yetkiniz yok.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_talep.taslak_mi THEN
    RAISE EXCEPTION 'Kesinleşmiş talep taslak iptal mekanizmasıyla silinemez.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_arac
  FROM public.ogrenme_araclari
  WHERE talep_id = p_talep_id AND arac_turu = 'podcast'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- 1. AI transkript girişimini iptal et
    UPDATE public.ogrenme_araci_transkript_kuyrugu
    SET durum = 'iptal', hata_mesaji = 'Kullanıcı taslağı iptal etti', updated_at = now()
    WHERE arac_id = v_arac.arac_id AND durum IN ('bekliyor', 'isleniyor');

    -- 2. Kullanılmayan Bunny depolama dosyalarını temizleme kuyruğuna aktar
    IF v_arac.dosya_yolu IS NOT NULL THEN
      INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu (
        arac_id, dosya_yolu, dosya_rolu, sebep, durum
      ) VALUES (
        v_arac.arac_id, v_arac.dosya_yolu, 'ana', 'kullanici_taslak_iptal_etti', 'bekliyor'
      ) ON CONFLICT DO NOTHING;
    END IF;

    IF v_arac.kapak_yolu IS NOT NULL THEN
      INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu (
        arac_id, dosya_yolu, dosya_rolu, sebep, durum
      ) VALUES (
        v_arac.arac_id, v_arac.kapak_yolu, 'kapak', 'kullanici_taslak_iptal_etti', 'bekliyor'
      ) ON CONFLICT DO NOTHING;
    END IF;

    IF v_arac.transkript_yolu IS NOT NULL THEN
      INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu (
        arac_id, dosya_yolu, dosya_rolu, sebep, durum
      ) VALUES (
        v_arac.arac_id, v_arac.transkript_yolu, 'transkript', 'kullanici_taslak_iptal_etti', 'bekliyor'
      ) ON CONFLICT DO NOTHING;
    END IF;

    DELETE FROM public.ogrenme_araci_durumu WHERE arac_id = v_arac.arac_id;
    DELETE FROM public.ogrenme_araclari WHERE arac_id = v_arac.arac_id;
  END IF;

  DELETE FROM public.talepler WHERE talep_id = p_talep_id;

  RETURN jsonb_build_object('ok', true, 'talep_id', p_talep_id, 'iptal_edildi', true);
END;
$fonksiyon$;

-- 6. Terk edilen taslakları güvenli zaman aşımıyla temizleme RPC'si (Aşama 4 Kural 11 & 12)
CREATE OR REPLACE FUNCTION public.podcast_taslak_zaman_asimi_temizle_atomik(
  p_saat_esigi integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_esik timestamptz;
  v_temizlenen_adet integer := 0;
  r RECORD;
BEGIN
  v_esik := now() - (COALESCE(p_saat_esigi, 24) || ' hours')::interval;

  FOR r IN
    SELECT t.talep_id, a.arac_id, a.dosya_yolu, a.kapak_yolu, a.transkript_yolu
    FROM public.talepler t
    LEFT JOIN public.ogrenme_araclari a ON a.talep_id = t.talep_id
    WHERE t.taslak_mi = true
      AND t.created_at < v_esik
    FOR UPDATE OF t
  LOOP
    IF r.arac_id IS NOT NULL THEN
      UPDATE public.ogrenme_araci_transkript_kuyrugu
      SET durum = 'iptal', hata_mesaji = 'Taslak zaman aşımına uğradı', updated_at = now()
      WHERE arac_id = r.arac_id AND durum IN ('bekliyor', 'isleniyor');

      IF r.dosya_yolu IS NOT NULL THEN
        INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
        VALUES (r.arac_id, r.dosya_yolu, 'ana', 'taslak_zaman_asimi', 'bekliyor')
        ON CONFLICT DO NOTHING;
      END IF;

      IF r.kapak_yolu IS NOT NULL THEN
        INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
        VALUES (r.arac_id, r.kapak_yolu, 'kapak', 'taslak_zaman_asimi', 'bekliyor')
        ON CONFLICT DO NOTHING;
      END IF;

      IF r.transkript_yolu IS NOT NULL THEN
        INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
        VALUES (r.arac_id, r.transkript_yolu, 'transkript', 'taslak_zaman_asimi', 'bekliyor')
        ON CONFLICT DO NOTHING;
      END IF;

      DELETE FROM public.ogrenme_araci_durumu WHERE arac_id = r.arac_id;
      DELETE FROM public.ogrenme_araclari WHERE arac_id = r.arac_id;
    END IF;

    DELETE FROM public.talepler WHERE talep_id = r.talep_id;
    v_temizlenen_adet := v_temizlenen_adet + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'temizlenen_adet', v_temizlenen_adet);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.podcast_taslak_atomik_olustur(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_taslak_atomik_olustur(uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_taslak_atomik_kesinlestir(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_taslak_atomik_kesinlestir(uuid, uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_taslak_iptal_et_atomik(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_taslak_iptal_et_atomik(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.podcast_taslak_zaman_asimi_temizle_atomik(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podcast_taslak_zaman_asimi_temizle_atomik(integer) TO service_role;

COMMIT;
