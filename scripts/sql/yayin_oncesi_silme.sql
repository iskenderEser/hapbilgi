-- scripts/sql/yayin_oncesi_silme.sql
--
-- Yayın Yönetimi'ne ulaşmış fakat henüz yayınlanmamış içeriğin kontrollü silinmesi.
-- Dış sistem (Bunny) transaction'a katılamadığı için süreç iki atomik RPC'dir:
--   1) yayin_oncesi_silme_baslat  → sahiplik/yayın kontrolü + yayın kilidi
--   2) Bunny DELETE (sunucu route'u)
--   3) yayin_oncesi_silme_tamamla → varyanta göre kalıcı silme / arşiv
-- Bunny hatasında yayin_oncesi_silme_hata çağrılır; içerik yayınlanamaz ve silme
-- aynı yüzeyden yeniden denenebilir.
--
-- DB işlemlerini yalnız İskender Supabase SQL editöründe çalıştırır.

BEGIN;

ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS yayin_oncesi_silme_durumu text,
  ADD COLUMN IF NOT EXISTS yayin_oncesi_silme_anahtari uuid,
  ADD COLUMN IF NOT EXISTS yayin_oncesi_silen_id uuid,
  ADD COLUMN IF NOT EXISTS yayin_oncesi_silme_tarihi timestamptz;

DO $blok$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'talepler_yayin_oncesi_silme_durumu_ck'
      AND conrelid = 'public.talepler'::regclass
  ) THEN
    ALTER TABLE public.talepler
      ADD CONSTRAINT talepler_yayin_oncesi_silme_durumu_ck
      CHECK (yayin_oncesi_silme_durumu IS NULL OR yayin_oncesi_silme_durumu IN ('isleniyor', 'tamamlandi', 'hata'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'talepler_yayin_oncesi_silen_id_fk'
      AND conrelid = 'public.talepler'::regclass
  ) THEN
    ALTER TABLE public.talepler
      ADD CONSTRAINT talepler_yayin_oncesi_silen_id_fk
      FOREIGN KEY (yayin_oncesi_silen_id)
      REFERENCES public.kullanicilar(kullanici_id)
      ON DELETE SET NULL;
  END IF;
END
$blok$;

CREATE INDEX IF NOT EXISTS idx_talepler_yayin_oncesi_silme_durumu
  ON public.talepler (yayin_oncesi_silme_durumu)
  WHERE yayin_oncesi_silme_durumu IS NOT NULL;

-- Yayın ekleme ve silme hazırlığı aynı talep satırını kilitler. Böylece iki
-- işlem eş zamanlı başlasa bile yayın kaydı silinmiş bir Bunny videosuna bağlanamaz.
CREATE OR REPLACE FUNCTION public.yayin_oncesi_silme_yayin_kapisi()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE;
BEGIN
  SELECT t.* INTO v_talep
  FROM public.soru_seti_durumu ssd
  JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  JOIN public.talepler t ON t.talep_id = ss.talep_id
  WHERE ssd.soru_seti_durum_id = NEW.soru_seti_durum_id
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın adayının talebi bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_talep.yayin_oncesi_silme_durumu IS NOT NULL THEN
    RAISE EXCEPTION 'Silme işlemi başlatılmış yayın adayı yayına alınamaz.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS trg_yayin_oncesi_silme_yayin_kapisi ON public.yayin_yonetimi;
CREATE TRIGGER trg_yayin_oncesi_silme_yayin_kapisi
BEFORE INSERT OR UPDATE OF soru_seti_durum_id ON public.yayin_yonetimi
FOR EACH ROW EXECUTE FUNCTION public.yayin_oncesi_silme_yayin_kapisi();

CREATE OR REPLACE FUNCTION public.yayin_oncesi_silme_baslat(
  p_soru_seti_durum_id uuid,
  p_uretici_id uuid,
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
  v_soru_seti_id uuid;
  v_video_id uuid;
  v_video_url text;
  v_son_durum_id uuid;
  v_talep_id uuid;
BEGIN
  IF p_soru_seti_durum_id IS NULL OR p_uretici_id IS NULL OR p_islem_anahtari IS NULL THEN
    RAISE EXCEPTION 'Soru seti durumu, üretici ve işlem anahtarı zorunludur.' USING ERRCODE = '22023';
  END IF;

  SELECT t.talep_id, ss.soru_seti_id, v.video_id, v.video_url
    INTO v_talep_id, v_soru_seti_id, v_video_id, v_video_url
  FROM public.soru_seti_durumu ssd
  JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  JOIN public.video_durumu vd ON vd.video_durum_id = ss.video_durum_id
  JOIN public.videolar v ON v.video_id = vd.video_id
  JOIN public.talepler t ON t.talep_id = v.talep_id
  WHERE ssd.soru_seti_durum_id = p_soru_seti_durum_id
    AND ssd.durum = 'onaylandi';
  IF NOT FOUND THEN RAISE EXCEPTION 'Yayına hazır içerik bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_talep
  FROM public.talepler
  WHERE talep_id = v_talep_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN
    RAISE EXCEPTION 'Yalnız kendi yayın adayınızı silebilirsiniz.' USING ERRCODE = '42501';
  END IF;

  SELECT d.soru_seti_durum_id INTO v_son_durum_id
  FROM public.soru_seti_durumu d
  WHERE d.soru_seti_id = v_soru_seti_id
  ORDER BY d.created_at DESC NULLS LAST, d.soru_seti_durum_id DESC
  LIMIT 1;
  IF v_son_durum_id IS DISTINCT FROM p_soru_seti_durum_id THEN
    RAISE EXCEPTION 'Yalnız güncel onaylı soru seti silinebilir.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.yayin_yonetimi y
    JOIN public.soru_seti_durumu d ON d.soru_seti_durum_id = y.soru_seti_durum_id
    WHERE d.soru_seti_id = v_soru_seti_id
  ) THEN
    RAISE EXCEPTION 'Yayına alınmış içerik bu işlemle silinemez.' USING ERRCODE = '23514';
  END IF;

  IF v_talep.yayin_oncesi_silme_durumu = 'tamamlandi' THEN
    RAISE EXCEPTION 'Bu yayın adayı daha önce silinmiş.' USING ERRCODE = '23514';
  END IF;
  IF v_talep.yayin_oncesi_silme_durumu = 'isleniyor'
     AND v_talep.yayin_oncesi_silme_tarihi > now() - interval '2 minutes'
     AND v_talep.yayin_oncesi_silme_anahtari IS DISTINCT FROM p_islem_anahtari THEN
    RAISE EXCEPTION 'Yayın silme işlemi halen devam ediyor.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.talepler
  SET yayin_oncesi_silme_durumu = 'isleniyor',
      yayin_oncesi_silme_anahtari = p_islem_anahtari,
      yayin_oncesi_silen_id = p_uretici_id,
      yayin_oncesi_silme_tarihi = now()
  WHERE talep_id = v_talep.talep_id;

  RETURN jsonb_build_object(
    'talep_id', v_talep.talep_id,
    'soru_seti_id', v_soru_seti_id,
    'video_id', v_video_id,
    'video_url', v_video_url,
    'tam_silme', v_talep.hazir_video IS TRUE AND v_talep.hazir_soru_seti IS TRUE
  );
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.yayin_oncesi_silme_hata(
  p_talep_id uuid,
  p_uretici_id uuid,
  p_islem_anahtari uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  UPDATE public.talepler
  SET yayin_oncesi_silme_durumu = 'hata'
  WHERE talep_id = p_talep_id
    AND uretici_id = p_uretici_id
    AND yayin_oncesi_silme_anahtari = p_islem_anahtari
    AND yayin_oncesi_silme_durumu = 'isleniyor';
  IF NOT FOUND THEN RAISE EXCEPTION 'Silme işlemi bulunamadı.' USING ERRCODE = 'P0002'; END IF;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.yayin_oncesi_silme_tamamla(
  p_talep_id uuid,
  p_soru_seti_durum_id uuid,
  p_uretici_id uuid,
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
  v_soru_seti_id uuid;
  v_tam_silme boolean;
  v_senaryo_idler uuid[];
  v_senaryo_durum_idler uuid[];
  v_video_idler uuid[];
  v_video_durum_idler uuid[];
  v_soru_seti_idler uuid[];
  v_soru_seti_durum_idler uuid[];
  v_gorev_idler uuid[];
  v_sonuc jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 7));

  SELECT sonuc INTO v_sonuc
  FROM public.uretim_islem_kayitlari
  WHERE islem_anahtari = p_islem_anahtari
    AND islem_turu = 'yayin_oncesi_silme';
  IF FOUND THEN RETURN v_sonuc; END IF;

  SELECT * INTO v_talep
  FROM public.talepler
  WHERE talep_id = p_talep_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN
    RAISE EXCEPTION 'Yalnız kendi yayın adayınızı silebilirsiniz.' USING ERRCODE = '42501';
  END IF;
  IF v_talep.yayin_oncesi_silme_anahtari IS DISTINCT FROM p_islem_anahtari
     OR v_talep.yayin_oncesi_silme_durumu <> 'isleniyor' THEN
    RAISE EXCEPTION 'Silme hazırlığı bulunamadı.' USING ERRCODE = '23514';
  END IF;

  SELECT soru_seti_id INTO v_soru_seti_id
  FROM public.soru_seti_durumu
  WHERE soru_seti_durum_id = p_soru_seti_durum_id;
  IF v_soru_seti_id IS NULL THEN RAISE EXCEPTION 'Soru seti bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.yayin_yonetimi y
    JOIN public.soru_seti_durumu d ON d.soru_seti_durum_id = y.soru_seti_durum_id
    JOIN public.soru_setleri ss ON ss.soru_seti_id = d.soru_seti_id
    WHERE ss.talep_id = p_talep_id
  ) THEN
    RAISE EXCEPTION 'Yayına alınmış içerik bu işlemle silinemez.' USING ERRCODE = '23514';
  END IF;

  v_tam_silme := v_talep.hazir_video IS TRUE AND v_talep.hazir_soru_seti IS TRUE;

  -- Yayına özel puanlama taslakları üretim içeriği değildir; her varyantta temizlenir.
  DELETE FROM public.soru_seti_puanlari
  WHERE soru_seti_durum_id = p_soru_seti_durum_id;
  DELETE FROM public.video_puanlari
  WHERE video_durum_id = (
    SELECT ss.video_durum_id FROM public.soru_setleri ss WHERE ss.soru_seti_id = v_soru_seti_id
  );

  IF v_tam_silme THEN
    -- Hazır+hazır kolunda İÜ emeği yoktur: gerçek içerik FK sırasıyla kaldırılır.
    v_senaryo_idler := ARRAY(SELECT senaryo_id FROM public.senaryolar WHERE talep_id = p_talep_id);
    v_senaryo_durum_idler := ARRAY(SELECT senaryo_durum_id FROM public.senaryo_durumu WHERE senaryo_id = ANY(v_senaryo_idler));
    v_video_idler := ARRAY(SELECT video_id FROM public.videolar WHERE talep_id = p_talep_id);
    v_video_durum_idler := ARRAY(SELECT video_durum_id FROM public.video_durumu WHERE video_id = ANY(v_video_idler));
    v_soru_seti_idler := ARRAY(SELECT soru_seti_id FROM public.soru_setleri WHERE talep_id = p_talep_id);
    v_soru_seti_durum_idler := ARRAY(SELECT soru_seti_durum_id FROM public.soru_seti_durumu WHERE soru_seti_id = ANY(v_soru_seti_idler));
    v_gorev_idler := ARRAY(SELECT gorev_id FROM public.uretim_gorevleri WHERE talep_id = p_talep_id);

    DELETE FROM public.bildirimler
    WHERE talep_id = p_talep_id
       OR gorev_id = ANY(v_gorev_idler)
       OR (kayit_turu = 'senaryo' AND kayit_id = ANY(v_senaryo_idler))
       OR (kayit_turu = 'video' AND kayit_id = ANY(v_video_idler))
       OR (kayit_turu = 'soru_seti' AND kayit_id = ANY(v_soru_seti_idler));
    DELETE FROM public.uretim_gorev_atama_gecmisi WHERE gorev_id = ANY(v_gorev_idler);
    DELETE FROM public.uretim_islem_kayitlari WHERE gorev_id = ANY(v_gorev_idler);
    DELETE FROM public.uretim_gorevleri WHERE gorev_id = ANY(v_gorev_idler);
    DELETE FROM public.soru_seti_puanlari WHERE soru_seti_durum_id = ANY(v_soru_seti_durum_idler);
    DELETE FROM public.soru_seti_durumu WHERE soru_seti_id = ANY(v_soru_seti_idler);
    DELETE FROM public.soru_setleri WHERE soru_seti_id = ANY(v_soru_seti_idler);
    DELETE FROM public.video_puanlari WHERE video_durum_id = ANY(v_video_durum_idler);
    DELETE FROM public.video_durumu WHERE video_id = ANY(v_video_idler);
    DELETE FROM public.videolar WHERE video_id = ANY(v_video_idler);
    DELETE FROM public.senaryo_durumu WHERE senaryo_id = ANY(v_senaryo_idler);
    DELETE FROM public.senaryolar WHERE senaryo_id = ANY(v_senaryo_idler);

    UPDATE public.talepler
    SET hazir_video_url = NULL,
        hazir_soru_seti_verisi = NULL
    WHERE talep_id = p_talep_id;
  END IF;

  UPDATE public.talepler
  SET yayin_oncesi_silme_durumu = 'tamamlandi',
      yayin_oncesi_silme_tarihi = now()
  WHERE talep_id = p_talep_id;

  v_sonuc := jsonb_build_object(
    'talep_id', p_talep_id,
    'tam_silme', v_tam_silme,
    'durum', 'tamamlandi'
  );
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'yayin_oncesi_silme', NULL, p_talep_id, v_sonuc);

  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.yayin_oncesi_silme_baslat(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yayin_oncesi_silme_hata(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yayin_oncesi_silme_tamamla(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yayin_oncesi_silme_yayin_kapisi() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.yayin_oncesi_silme_baslat(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.yayin_oncesi_silme_hata(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.yayin_oncesi_silme_tamamla(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.yayin_oncesi_silme_baslat(uuid,uuid,uuid)') IS NOT NULL AS baslat_kuruldu,
  to_regprocedure('public.yayin_oncesi_silme_hata(uuid,uuid,uuid)') IS NOT NULL AS hata_kuruldu,
  to_regprocedure('public.yayin_oncesi_silme_tamamla(uuid,uuid,uuid,uuid)') IS NOT NULL AS tamamla_kuruldu,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_yayin_oncesi_silme_yayin_kapisi'
      AND tgrelid = 'public.yayin_yonetimi'::regclass
      AND NOT tgisinternal
  ) AS yayin_kapisi_kuruldu;
