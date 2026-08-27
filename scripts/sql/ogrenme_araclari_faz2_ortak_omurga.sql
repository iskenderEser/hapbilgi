-- Öğrenme Araçları Genişletmesi — Faz 2 ortak veri omurgası.
--
-- Eklemeli ve yeniden çalıştırılabilir geçiştir. Mevcut video tablolarını silmez,
-- video kimliklerini değiştirmez ve yeni araçlar açılana kadar tüketici akışını
-- etkilemez. Video tabloları uyumluluk süresince yazılmaya devam eder; aşağıdaki
-- tetikleyiciler ortak modeli aynı transaction içinde güncel tutar.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-ogrenme-araclari-faz2-v1', 1));

CREATE TABLE IF NOT EXISTS public.ogrenme_araclari (
  arac_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talep_id                uuid NOT NULL REFERENCES public.talepler(talep_id),
  senaryo_durum_id        uuid REFERENCES public.senaryo_durumu(senaryo_durum_id),
  iu_id                    uuid REFERENCES public.kullanicilar(kullanici_id),
  arac_turu                text NOT NULL,
  kaynak                   text NOT NULL,
  dosya_yolu               text,
  kapak_yolu               text,
  mime_type                text,
  dosya_boyutu             bigint,
  checksum_sha256          text,
  sure_saniye              integer,
  sayfa_sayisi             integer,
  genislik                 integer,
  yukseklik                integer,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_dogrulandi      boolean NOT NULL DEFAULT false,
  legacy_video_id          uuid UNIQUE REFERENCES public.videolar(video_id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ogrenme_araclari_tur_ck CHECK (arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf')),
  CONSTRAINT ogrenme_araclari_kaynak_ck CHECK (kaynak IN ('iu', 'hazir')),
  CONSTRAINT ogrenme_araclari_boyut_ck CHECK (dosya_boyutu IS NULL OR dosya_boyutu > 0),
  CONSTRAINT ogrenme_araclari_checksum_ck CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ogrenme_araclari_sure_ck CHECK (sure_saniye IS NULL OR sure_saniye > 0),
  CONSTRAINT ogrenme_araclari_sayfa_ck CHECK (sayfa_sayisi IS NULL OR sayfa_sayisi > 0),
  CONSTRAINT ogrenme_araclari_olcu_ck CHECK (
    (genislik IS NULL AND yukseklik IS NULL)
    OR (genislik > 0 AND yukseklik > 0)
  )
);

CREATE INDEX IF NOT EXISTS ix_ogrenme_araclari_talep
  ON public.ogrenme_araclari(talep_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ogrenme_araclari_dosya_yolu
  ON public.ogrenme_araclari(dosya_yolu)
  WHERE dosya_yolu IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_ogrenme_araclari_tur
  ON public.ogrenme_araclari(arac_turu, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ogrenme_araci_durumu (
  arac_durum_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arac_id                  uuid NOT NULL REFERENCES public.ogrenme_araclari(arac_id),
  durum                    text NOT NULL,
  degistiren_id            uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  notlar                   text,
  durum_metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_video_durum_id    uuid UNIQUE REFERENCES public.video_durumu(video_durum_id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ogrenme_araci_durumu_ck CHECK (
    durum IN (
      'yukleme_bekliyor', 'dogrulama_bekliyor', 'inceleme bekleniyor',
      'revizyon bekleniyor', 'onaylandi', 'reddedildi', 'Iptal Edildi', 'iptal'
    )
  )
);

CREATE INDEX IF NOT EXISTS ix_ogrenme_araci_durumu_son
  ON public.ogrenme_araci_durumu(arac_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ogrenme_araci_puanlari (
  arac_puan_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arac_durum_id            uuid NOT NULL REFERENCES public.ogrenme_araci_durumu(arac_durum_id),
  arac_puani               integer NOT NULL,
  legacy_video_puan_id     uuid UNIQUE REFERENCES public.video_puanlari(video_puan_id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ogrenme_araci_puanlari_pozitif_ck CHECK (arac_puani > 0),
  CONSTRAINT ogrenme_araci_puanlari_durum_uq UNIQUE (arac_durum_id)
);

ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS ogrenme_araci_turu text;
UPDATE public.talepler
SET ogrenme_araci_turu = 'video'
WHERE ogrenme_araci_turu IS NULL;
ALTER TABLE public.talepler
  ALTER COLUMN ogrenme_araci_turu SET DEFAULT 'video',
  ALTER COLUMN ogrenme_araci_turu SET NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'talepler_ogrenme_araci_turu_ck'
      AND conrelid = 'public.talepler'::regclass
  ) THEN
    ALTER TABLE public.talepler
      ADD CONSTRAINT talepler_ogrenme_araci_turu_ck
      CHECK (ogrenme_araci_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf'));
  END IF;
END;
$constraint$;

ALTER TABLE public.soru_setleri
  ADD COLUMN IF NOT EXISTS arac_durum_id uuid REFERENCES public.ogrenme_araci_durumu(arac_durum_id);
ALTER TABLE public.yayin_yonetimi
  ADD COLUMN IF NOT EXISTS arac_durum_id uuid REFERENCES public.ogrenme_araci_durumu(arac_durum_id);
ALTER TABLE public.uretim_gorevleri
  ADD COLUMN IF NOT EXISTS arac_id uuid REFERENCES public.ogrenme_araclari(arac_id);

ALTER TABLE public.izleme_kayitlari
  ADD COLUMN IF NOT EXISTS arac_turu text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS ilerleme_durumu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tamamlama_kaniti jsonb;
ALTER TABLE public.cc_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS arac_turu text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS ilerleme_durumu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tamamlama_kaniti jsonb;
ALTER TABLE public.eclub_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS arac_turu text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS ilerleme_durumu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tamamlama_kaniti jsonb;
ALTER TABLE public.eczanem_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS arac_turu text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS ilerleme_durumu jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tamamlama_kaniti jsonb;

-- Mevcut video kayıtlarını ortak araç modeline idempotent olarak aktarır.
INSERT INTO public.ogrenme_araclari (
  talep_id, senaryo_durum_id, iu_id, arac_turu, kaynak, dosya_yolu,
  mime_type, sure_saniye, metadata, metadata_dogrulandi, legacy_video_id, created_at
)
SELECT
  v.talep_id,
  v.senaryo_durum_id,
  v.iu_id,
  'video',
  v.kaynak,
  COALESCE(
    substring(v.video_url FROM '/embed/[^/]+/([0-9a-fA-F-]{36})'),
    'legacy-video:' || v.video_id::text
  ),
  'video/bunny-stream',
  v.video_suresi_saniye,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_video_url', nullif(v.video_url, ''),
    'legacy_thumbnail_url', v.thumbnail_url
  )),
  (nullif(v.video_url, '') IS NOT NULL AND v.video_suresi_saniye > 0),
  v.video_id,
  COALESCE(v.created_at, now())
FROM public.videolar v
WHERE v.talep_id IS NOT NULL
ON CONFLICT (legacy_video_id) DO UPDATE SET
  sure_saniye = EXCLUDED.sure_saniye,
  metadata = EXCLUDED.metadata,
  metadata_dogrulandi = EXCLUDED.metadata_dogrulandi,
  updated_at = now();

INSERT INTO public.ogrenme_araci_durumu (
  arac_id, durum, degistiren_id, notlar, legacy_video_durum_id, created_at
)
SELECT oa.arac_id, vd.durum, vd.degistiren_id, vd.notlar, vd.video_durum_id,
       COALESCE(vd.created_at, now())
FROM public.video_durumu vd
JOIN public.ogrenme_araclari oa ON oa.legacy_video_id = vd.video_id
ON CONFLICT (legacy_video_durum_id) DO NOTHING;

INSERT INTO public.ogrenme_araci_puanlari (
  arac_durum_id, arac_puani, legacy_video_puan_id, created_at
)
SELECT oad.arac_durum_id, vp.video_puani, vp.video_puan_id, COALESCE(vp.created_at, now())
FROM public.video_puanlari vp
JOIN public.ogrenme_araci_durumu oad ON oad.legacy_video_durum_id = vp.video_durum_id
ON CONFLICT (legacy_video_puan_id) DO UPDATE SET arac_puani = EXCLUDED.arac_puani;

UPDATE public.soru_setleri ss
SET arac_durum_id = oad.arac_durum_id
FROM public.ogrenme_araci_durumu oad
WHERE ss.video_durum_id = oad.legacy_video_durum_id
  AND ss.arac_durum_id IS NULL;

UPDATE public.yayin_yonetimi ym
SET arac_durum_id = ss.arac_durum_id
FROM public.soru_seti_durumu ssd
JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
WHERE ym.soru_seti_durum_id = ssd.soru_seti_durum_id
  AND ym.arac_durum_id IS NULL;

UPDATE public.uretim_gorevleri ug
SET arac_id = oa.arac_id
FROM public.ogrenme_araclari oa
WHERE ug.video_id = oa.legacy_video_id
  AND ug.arac_id IS NULL;

CREATE OR REPLACE FUNCTION public.ogrenme_araci_updated_at_yaz()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS ogrenme_araclari_updated_at_trg ON public.ogrenme_araclari;
CREATE TRIGGER ogrenme_araclari_updated_at_trg
BEFORE UPDATE ON public.ogrenme_araclari
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_araci_updated_at_yaz();

-- Video uyumluluk yazıcıları. Eski uygulama kodu değişmeden ortak kayıt oluşur.
CREATE OR REPLACE FUNCTION public.ogrenme_video_araci_esitle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  IF NEW.talep_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.ogrenme_araclari (
    talep_id, senaryo_durum_id, iu_id, arac_turu, kaynak, dosya_yolu,
    mime_type, sure_saniye, metadata, metadata_dogrulandi, legacy_video_id, created_at
  ) VALUES (
    NEW.talep_id, NEW.senaryo_durum_id, NEW.iu_id, 'video', NEW.kaynak,
    COALESCE(
      substring(NEW.video_url FROM '/embed/[^/]+/([0-9a-fA-F-]{36})'),
      'legacy-video:' || NEW.video_id::text
    ),
    'video/bunny-stream', NEW.video_suresi_saniye,
    jsonb_strip_nulls(jsonb_build_object(
      'legacy_video_url', nullif(NEW.video_url, ''),
      'legacy_thumbnail_url', NEW.thumbnail_url
    )),
    (nullif(NEW.video_url, '') IS NOT NULL AND NEW.video_suresi_saniye > 0),
    NEW.video_id, COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (legacy_video_id) DO UPDATE SET
    senaryo_durum_id = EXCLUDED.senaryo_durum_id,
    iu_id = EXCLUDED.iu_id,
    kaynak = EXCLUDED.kaynak,
    sure_saniye = EXCLUDED.sure_saniye,
    metadata = EXCLUDED.metadata,
    metadata_dogrulandi = EXCLUDED.metadata_dogrulandi,
    updated_at = now();
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS videolar_ogrenme_araci_trg ON public.videolar;
CREATE TRIGGER videolar_ogrenme_araci_trg
AFTER INSERT OR UPDATE OF video_url, thumbnail_url, video_suresi_saniye, kaynak, iu_id
ON public.videolar
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_video_araci_esitle();

CREATE OR REPLACE FUNCTION public.ogrenme_video_durumu_esitle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac_id uuid;
BEGIN
  SELECT arac_id INTO v_arac_id
  FROM public.ogrenme_araclari
  WHERE legacy_video_id = NEW.video_id;
  IF v_arac_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.ogrenme_araci_durumu (
    arac_id, durum, degistiren_id, notlar, legacy_video_durum_id, created_at
  ) VALUES (
    v_arac_id, NEW.durum, NEW.degistiren_id, NEW.notlar,
    NEW.video_durum_id, COALESCE(NEW.created_at, now())
  ) ON CONFLICT (legacy_video_durum_id) DO NOTHING;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS video_durumu_ogrenme_araci_trg ON public.video_durumu;
CREATE TRIGGER video_durumu_ogrenme_araci_trg
AFTER INSERT ON public.video_durumu
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_video_durumu_esitle();

CREATE OR REPLACE FUNCTION public.ogrenme_video_puani_esitle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac_durum_id uuid;
BEGIN
  SELECT arac_durum_id INTO v_arac_durum_id
  FROM public.ogrenme_araci_durumu
  WHERE legacy_video_durum_id = NEW.video_durum_id;
  IF v_arac_durum_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.ogrenme_araci_puanlari (
    arac_durum_id, arac_puani, legacy_video_puan_id, created_at
  ) VALUES (
    v_arac_durum_id, NEW.video_puani, NEW.video_puan_id, COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (legacy_video_puan_id) DO UPDATE SET arac_puani = EXCLUDED.arac_puani;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS video_puanlari_ogrenme_araci_trg ON public.video_puanlari;
CREATE TRIGGER video_puanlari_ogrenme_araci_trg
AFTER INSERT OR UPDATE OF video_puani ON public.video_puanlari
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_video_puani_esitle();

CREATE OR REPLACE FUNCTION public.soru_seti_arac_durumu_esitle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  IF NEW.arac_durum_id IS NULL AND NEW.video_durum_id IS NOT NULL THEN
    SELECT arac_durum_id INTO NEW.arac_durum_id
    FROM public.ogrenme_araci_durumu
    WHERE legacy_video_durum_id = NEW.video_durum_id;
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS soru_setleri_arac_durumu_trg ON public.soru_setleri;
CREATE TRIGGER soru_setleri_arac_durumu_trg
BEFORE INSERT OR UPDATE OF video_durum_id, arac_durum_id ON public.soru_setleri
FOR EACH ROW EXECUTE FUNCTION public.soru_seti_arac_durumu_esitle();

CREATE OR REPLACE FUNCTION public.uretim_gorevi_arac_esitle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  IF NEW.arac_id IS NULL AND NEW.video_id IS NOT NULL THEN
    SELECT arac_id INTO NEW.arac_id
    FROM public.ogrenme_araclari
    WHERE legacy_video_id = NEW.video_id;
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS uretim_gorevleri_arac_trg ON public.uretim_gorevleri;
CREATE TRIGGER uretim_gorevleri_arac_trg
BEFORE INSERT OR UPDATE OF video_id, arac_id ON public.uretim_gorevleri
FOR EACH ROW EXECUTE FUNCTION public.uretim_gorevi_arac_esitle();

CREATE OR REPLACE FUNCTION public.yayin_arac_kapisini_dogrula()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac_durum_id uuid;
  v_arac_id uuid;
  v_durum text;
  v_metadata_dogrulandi boolean;
BEGIN
  SELECT ss.arac_durum_id
    INTO v_arac_durum_id
  FROM public.soru_seti_durumu ssd
  JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
  WHERE ssd.soru_seti_durum_id = NEW.soru_seti_durum_id;

  IF NEW.arac_durum_id IS NULL THEN NEW.arac_durum_id := v_arac_durum_id; END IF;
  IF NEW.arac_durum_id IS DISTINCT FROM v_arac_durum_id THEN
    RAISE EXCEPTION 'Yayın ile soru setinin öğrenme aracı eşleşmiyor.' USING ERRCODE = '23514';
  END IF;

  -- Geçiş güvenliği: henüz ortak kaydı bulunmayan tarihî video yayını eski
  -- kapılarla çalışmaya devam eder. Yeni kayıtlar ortak bağa sahip olmalıdır.
  IF NEW.arac_durum_id IS NULL THEN RETURN NEW; END IF;

  SELECT d.arac_id, d.durum, a.metadata_dogrulandi
    INTO v_arac_id, v_durum, v_metadata_dogrulandi
  FROM public.ogrenme_araci_durumu d
  JOIN public.ogrenme_araclari a ON a.arac_id = d.arac_id
  WHERE d.arac_durum_id = NEW.arac_durum_id;

  IF v_arac_id IS NULL OR v_durum <> 'onaylandi' OR v_metadata_dogrulandi IS NOT TRUE THEN
    RAISE EXCEPTION 'Onaylı ve metadata doğrulaması tamamlanmış öğrenme aracı olmadan yayın açılamaz.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS yayin_yonetimi_arac_kapisi_trg ON public.yayin_yonetimi;
CREATE TRIGGER yayin_yonetimi_arac_kapisi_trg
BEFORE INSERT OR UPDATE OF soru_seti_durum_id, arac_durum_id ON public.yayin_yonetimi
FOR EACH ROW EXECUTE FUNCTION public.yayin_arac_kapisini_dogrula();

CREATE OR REPLACE FUNCTION public.talep_arac_turu_sabitle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  IF NEW.ogrenme_araci_turu IS DISTINCT FROM OLD.ogrenme_araci_turu THEN
    RAISE EXCEPTION 'Talep gönderildikten sonra öğrenme aracı türü değiştirilemez.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS talepler_arac_turu_sabitle_trg ON public.talepler;
CREATE TRIGGER talepler_arac_turu_sabitle_trg
BEFORE UPDATE OF ogrenme_araci_turu ON public.talepler
FOR EACH ROW EXECUTE FUNCTION public.talep_arac_turu_sabitle();

ALTER TABLE public.ogrenme_araclari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ogrenme_araci_durumu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ogrenme_araci_puanlari ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ogrenme_araclari TO service_role;
GRANT ALL ON public.ogrenme_araci_durumu TO service_role;
GRANT ALL ON public.ogrenme_araci_puanlari TO service_role;
REVOKE ALL ON public.ogrenme_araclari FROM anon, authenticated;
REVOKE ALL ON public.ogrenme_araci_durumu FROM anon, authenticated;
REVOKE ALL ON public.ogrenme_araci_puanlari FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ogrenme_araci_yukleme_baslat(
  p_arac_id uuid,
  p_talep_id uuid,
  p_iu_id uuid,
  p_arac_turu text,
  p_kaynak text,
  p_dosya_yolu text,
  p_yukleme_beyani jsonb,
  p_degistiren_id uuid
)
RETURNS TABLE(arac_id uuid, arac_durum_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_durum_id uuid;
BEGIN
  IF p_arac_turu NOT IN ('podcast', 'gorsel', 'flip_pdf') THEN
    RAISE EXCEPTION 'Ortak Storage yüklemesi yalnız yeni öğrenme araçları içindir.' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_talep_id::text, 1));
  IF EXISTS (SELECT 1 FROM public.ogrenme_araclari a WHERE a.talep_id = p_talep_id) THEN
    RAISE EXCEPTION 'Bu talep için öğrenme aracı zaten oluşturulmuş.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.ogrenme_araclari (
    arac_id, talep_id, iu_id, arac_turu, kaynak, dosya_yolu, metadata,
    metadata_dogrulandi
  ) VALUES (
    p_arac_id, p_talep_id, p_iu_id, p_arac_turu, p_kaynak, p_dosya_yolu,
    jsonb_build_object('yukleme_beyani', COALESCE(p_yukleme_beyani, '{}'::jsonb)),
    false
  );

  INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id)
  VALUES (p_arac_id, 'yukleme_bekliyor', p_degistiren_id)
  RETURNING ogrenme_araci_durumu.arac_durum_id INTO v_durum_id;

  RETURN QUERY SELECT p_arac_id, v_durum_id;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.ogrenme_araci_yukleme_baslat(uuid, uuid, uuid, text, text, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ogrenme_araci_yukleme_baslat(uuid, uuid, uuid, text, text, text, jsonb, uuid)
  TO service_role;

COMMIT;

-- Doğrulama sorgusu: bütün sayılar sıfır sapma vermelidir.
SELECT
  (SELECT count(*) FROM public.videolar v WHERE v.talep_id IS NOT NULL)
    - (SELECT count(*) FROM public.ogrenme_araclari a WHERE a.legacy_video_id IS NOT NULL)
    AS eksik_video_araci,
  (SELECT count(*) FROM public.video_durumu)
    - (SELECT count(*) FROM public.ogrenme_araci_durumu d WHERE d.legacy_video_durum_id IS NOT NULL)
    AS eksik_video_durumu,
  (SELECT count(*) FROM public.video_puanlari)
    - (SELECT count(*) FROM public.ogrenme_araci_puanlari p WHERE p.legacy_video_puan_id IS NOT NULL)
    AS eksik_video_puani;

-- Geri dönüş: uygulama bayrakları kapalı tutulur. Yeni kolon ve tablolar veri
-- kaybına yol açmaması için otomatik DROP edilmez; yalnız bu dosyanın eklediği
-- trigger'lar devre dışı bırakılarak eski video yazıcısı tek başına bırakılabilir.
