-- Öğrenme Araçları Genişletmesi / Tamamlama Fazı 4
-- Ön koşul: Faz 2 omurga ile Podcast, Görsel ve Flip PDF üretim migrationları.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-tamamlama-faz4-uretim-hatti-v1', 1));

-- Kolon adı video uyumluluğu için korunur; yeni türlerde "hazır araç"tır.
COMMENT ON COLUMN public.talepler.hazir_video IS
  'Geriye dönük ad: seçilen öğrenme aracının üretici tarafından hazır sağlandığını belirtir.';

-- Görev, talep ve öğrenme aracı kimliklerini DB seviyesinde birlikte doğrular.
CREATE OR REPLACE FUNCTION public.uretim_gorevi_arac_esitle()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac_talep_id uuid;
  v_arac_turu text;
  v_talep_arac_turu text;
BEGIN
  IF NEW.arac_id IS NULL AND NEW.video_id IS NOT NULL THEN
    SELECT arac_id INTO NEW.arac_id FROM public.ogrenme_araclari
    WHERE legacy_video_id = NEW.video_id;
  END IF;
  IF NEW.arac_id IS NOT NULL THEN
    SELECT talep_id, arac_turu INTO v_arac_talep_id, v_arac_turu
    FROM public.ogrenme_araclari WHERE arac_id = NEW.arac_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Göreve bağlanan öğrenme aracı bulunamadı.' USING ERRCODE = 'P0002';
    END IF;
    SELECT ogrenme_araci_turu INTO v_talep_arac_turu
    FROM public.talepler WHERE talep_id = NEW.talep_id;
    IF v_arac_talep_id IS DISTINCT FROM NEW.talep_id
       OR v_arac_turu IS DISTINCT FROM v_talep_arac_turu THEN
      RAISE EXCEPTION 'Üretim görevi, talep ve öğrenme aracı eşleşmiyor.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

-- V1/V3: senaryo görevi. V2/V4: üreticinin hazır araç yüklemesi.
CREATE OR REPLACE FUNCTION public.uretim_talep_ilk_gorevini_ac(
  p_talep_id uuid, p_uretici_id uuid, p_islem_anahtari uuid
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE;
  v_onceki jsonb;
  v_sonuc jsonb;
BEGIN
  IF p_islem_anahtari IS NULL THEN
    RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));
  SELECT sonuc INTO v_onceki FROM public.uretim_islem_kayitlari
  WHERE islem_anahtari = p_islem_anahtari AND islem_turu = 'talep_ilk_gorev';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari WHERE islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = p_talep_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN
    RAISE EXCEPTION 'İlk görevi yalnız talebi açan üretici başlatabilir.' USING ERRCODE = '42501';
  END IF;
  IF v_talep.ogrenme_araci_turu NOT IN ('video', 'podcast', 'gorsel', 'flip_pdf') THEN
    RAISE EXCEPTION 'Talebin öğrenme aracı türü geçersiz.' USING ERRCODE = '23514';
  END IF;

  IF v_talep.hazir_video IS TRUE THEN
    v_sonuc := jsonb_build_object(
      'talep_id', p_talep_id, 'arac_turu', v_talep.ogrenme_araci_turu,
      'gorev_acildi', false, 'beklenen', 'hazir_arac_yukleme'
    );
  ELSE
    v_sonuc := public.uretim_gorev_ac(
      p_talep_id, 'senaryo', p_uretici_id, NULL, 'otomatik', NULL, NULL, NULL
    ) || jsonb_build_object(
      'gorev_acildi', true, 'arac_turu', v_talep.ogrenme_araci_turu,
      'beklenen', 'senaryo'
    );
  END IF;
  INSERT INTO public.uretim_islem_kayitlari
    (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (
    p_islem_anahtari, 'talep_ilk_gorev',
    NULLIF(v_sonuc->>'gorev_id', '')::uuid, p_talep_id, v_sonuc
  );
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Adı eski Podcast migrationından kalır; üç yeni aracın ortak soru zinciridir.
CREATE OR REPLACE FUNCTION public.uretim_podcast_soru_zinciri_ac(
  p_talep_id uuid, p_arac_durum_id uuid, p_uretici_id uuid,
  p_oncelikli_iu_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE;
  v_soru_seti_id uuid;
  v_sonraki jsonb;
  v_arac_id uuid;
BEGIN
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = p_talep_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  SELECT d.arac_id INTO v_arac_id
  FROM public.ogrenme_araci_durumu d
  JOIN public.ogrenme_araclari a ON a.arac_id = d.arac_id
  WHERE d.arac_durum_id = p_arac_durum_id
    AND d.durum = 'onaylandi'
    AND a.talep_id = p_talep_id
    AND a.arac_turu = v_talep.ogrenme_araci_turu
    AND a.metadata_dogrulandi IS TRUE;
  IF v_arac_id IS NULL THEN
    RAISE EXCEPTION 'Onaylı araç, talep ve araç türü eşleşmiyor.' USING ERRCODE = '23514';
  END IF;

  SELECT soru_seti_id INTO v_soru_seti_id FROM public.soru_setleri
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
    IF NOT EXISTS (
      SELECT 1 FROM public.soru_seti_durumu
      WHERE soru_seti_id = v_soru_seti_id AND durum = 'onaylandi'
    ) THEN
      INSERT INTO public.soru_seti_durumu (soru_seti_id, durum, degistiren_id, notlar)
      VALUES (v_soru_seti_id, 'onaylandi', p_uretici_id, 'Hazır soru seti — otomatik onay');
    END IF;
    v_sonraki := jsonb_build_object(
      'gorev_acildi', false, 'soru_seti_id', v_soru_seti_id,
      'arac_id', v_arac_id, 'arac_durum_id', p_arac_durum_id,
      'hazir_soru_seti_islendi', true, 'sonraki', 'yayin_yonetimi'
    );
  ELSE
    v_sonraki := public.uretim_gorev_ac(
      p_talep_id, 'soru_seti', p_uretici_id, p_oncelikli_iu_id,
      'otomatik', NULL, NULL, v_soru_seti_id
    ) || jsonb_build_object(
      'arac_id', v_arac_id, 'arac_durum_id', p_arac_durum_id,
      'sonraki', 'soru_seti'
    );
  END IF;
  RETURN v_sonraki;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_talep_ilk_gorevini_ac(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_podcast_soru_zinciri_ac(uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_talep_ilk_gorevini_ac(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_podcast_soru_zinciri_ac(uuid,uuid,uuid,uuid) TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.uretim_talep_ilk_gorevini_ac(uuid,uuid,uuid)') IS NOT NULL AS ilk_gorev_rpc_kuruldu,
  to_regprocedure('public.uretim_podcast_soru_zinciri_ac(uuid,uuid,uuid,uuid)') IS NOT NULL AS ortak_soru_zinciri_rpc_kuruldu;
