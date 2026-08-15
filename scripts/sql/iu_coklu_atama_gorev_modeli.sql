-- Çoklu İçerik Üreticisi — Paket A veri modeli.
-- İskender tarafından Supabase SQL Editor'da çalıştırılır; uygulama bu paket
-- tamamlanana kadar bu tablolara bağımlı değildir. Tekrar çalıştırılabilir.

BEGIN;

-- Ürün bazlı adaylık. Bir eşleşme pasife alındığında tarihî satır korunur;
-- aynı IU/ürün çifti ileride yeni bir satırla yeniden etkinleştirilebilir.
CREATE TABLE IF NOT EXISTS public.iu_urun_atamalari (
  atama_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iu_id             uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  urun_id           uuid NOT NULL REFERENCES public.urunler(urun_id),
  aktif_mi          boolean NOT NULL DEFAULT true,
  baslangic_tarihi  timestamptz NOT NULL DEFAULT now(),
  bitis_tarihi      timestamptz,
  atayan_id         uuid REFERENCES public.kullanicilar(kullanici_id),
  pasife_alan_id    uuid REFERENCES public.kullanicilar(kullanici_id),
  aciklama          text,
  son_atama_tarihi  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iu_urun_atamalari_aktif_tarih_ck CHECK (
    (aktif_mi IS TRUE AND bitis_tarihi IS NULL)
    OR (aktif_mi IS FALSE AND bitis_tarihi IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_iu_urun_atamalari_aktif
  ON public.iu_urun_atamalari (iu_id, urun_id)
  WHERE aktif_mi IS TRUE;
CREATE INDEX IF NOT EXISTS ix_iu_urun_atamalari_urun_aktif
  ON public.iu_urun_atamalari (urun_id, son_atama_tarihi NULLS FIRST)
  WHERE aktif_mi IS TRUE;

-- urun_id taşımayan satış/medikal/İK talepleri için eğitim türü bazlı genel
-- havuz. Ürünlü işlerde bu tablo kullanılmaz.
CREATE TABLE IF NOT EXISTS public.iu_genel_atamalari (
  atama_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iu_id             uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  egitim_turu       text NOT NULL,
  aktif_mi          boolean NOT NULL DEFAULT true,
  baslangic_tarihi  timestamptz NOT NULL DEFAULT now(),
  bitis_tarihi      timestamptz,
  atayan_id         uuid REFERENCES public.kullanicilar(kullanici_id),
  pasife_alan_id    uuid REFERENCES public.kullanicilar(kullanici_id),
  aciklama          text,
  son_atama_tarihi  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iu_genel_atamalari_tur_ck CHECK (
    egitim_turu IN ('urun_egitimi', 'satis_teknikleri', 'medikal_egitim', 'urun_medikal_egitim', 'ik_egitimi')
  ),
  CONSTRAINT iu_genel_atamalari_aktif_tarih_ck CHECK (
    (aktif_mi IS TRUE AND bitis_tarihi IS NULL)
    OR (aktif_mi IS FALSE AND bitis_tarihi IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_iu_genel_atamalari_aktif
  ON public.iu_genel_atamalari (iu_id, egitim_turu)
  WHERE aktif_mi IS TRUE;
CREATE INDEX IF NOT EXISTS ix_iu_genel_atamalari_tur_aktif
  ON public.iu_genel_atamalari (egitim_turu, son_atama_tarihi NULLS FIRST)
  WHERE aktif_mi IS TRUE;

-- Bir talebin belirli üretim aşamasındaki gerçek sorumluluk kaydı. Artifact
-- iu_id'leri yazarı korur; görev ataması sorumluyu tanımlar.
CREATE TABLE IF NOT EXISTS public.uretim_gorevleri (
  gorev_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talep_id              uuid NOT NULL REFERENCES public.talepler(talep_id),
  asama                  text NOT NULL,
  senaryo_id             uuid REFERENCES public.senaryolar(senaryo_id),
  video_id               uuid REFERENCES public.videolar(video_id),
  soru_seti_id           uuid REFERENCES public.soru_setleri(soru_seti_id),
  atanan_iu_id           uuid REFERENCES public.kullanicilar(kullanici_id),
  durum                  text NOT NULL DEFAULT 'atama_bekliyor',
  atama_kaynagi          text,
  atayan_id              uuid REFERENCES public.kullanicilar(kullanici_id),
  atama_tarihi           timestamptz,
  baslama_tarihi         timestamptz,
  inceleme_tarihi        timestamptz,
  tamamlanma_tarihi      timestamptz,
  iptal_tarihi           timestamptz,
  son_islem_anahtari     uuid,
  surum                  integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uretim_gorevleri_asama_ck CHECK (asama IN ('senaryo', 'video', 'soru_seti')),
  CONSTRAINT uretim_gorevleri_durum_ck CHECK (
    durum IN ('atama_bekliyor', 'hazirlaniyor', 'inceleme_bekliyor', 'revizyon_bekliyor', 'tamamlandi', 'iptal')
  ),
  CONSTRAINT uretim_gorevleri_atama_kaynagi_ck CHECK (
    atama_kaynagi IS NULL OR atama_kaynagi IN ('otomatik', 'manuel', 'devir', 'gecis')
  ),
  CONSTRAINT uretim_gorevleri_atama_ck CHECK (
    (durum IN ('atama_bekliyor', 'iptal') AND atanan_iu_id IS NULL AND atama_kaynagi IS NULL AND atama_tarihi IS NULL)
    OR (durum <> 'atama_bekliyor' AND atanan_iu_id IS NOT NULL AND atama_kaynagi IS NOT NULL AND atama_tarihi IS NOT NULL)
  ),
  CONSTRAINT uretim_gorevleri_artifact_ck CHECK (
    (asama = 'senaryo' AND video_id IS NULL AND soru_seti_id IS NULL)
    OR (asama = 'video' AND senaryo_id IS NULL AND soru_seti_id IS NULL)
    OR (asama = 'soru_seti' AND senaryo_id IS NULL AND video_id IS NULL)
  ),
  CONSTRAINT uretim_gorevleri_surum_ck CHECK (surum > 0),
  CONSTRAINT uretim_gorevleri_talep_asama_uq UNIQUE (talep_id, asama)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_uretim_gorevleri_talep_aktif
  ON public.uretim_gorevleri (talep_id)
  WHERE durum IN ('atama_bekliyor', 'hazirlaniyor', 'inceleme_bekliyor', 'revizyon_bekliyor');
CREATE UNIQUE INDEX IF NOT EXISTS ux_uretim_gorevleri_senaryo
  ON public.uretim_gorevleri (senaryo_id) WHERE senaryo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_uretim_gorevleri_video
  ON public.uretim_gorevleri (video_id) WHERE video_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_uretim_gorevleri_soru_seti
  ON public.uretim_gorevleri (soru_seti_id) WHERE soru_seti_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_uretim_gorevleri_iu_aktif
  ON public.uretim_gorevleri (atanan_iu_id, durum, created_at)
  WHERE durum IN ('hazirlaniyor', 'inceleme_bekliyor', 'revizyon_bekliyor');

CREATE TABLE IF NOT EXISTS public.uretim_gorev_atama_gecmisi (
  gecmis_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gorev_id        uuid NOT NULL REFERENCES public.uretim_gorevleri(gorev_id),
  onceki_iu_id    uuid REFERENCES public.kullanicilar(kullanici_id),
  yeni_iu_id      uuid REFERENCES public.kullanicilar(kullanici_id),
  islem           text NOT NULL,
  atama_kaynagi   text NOT NULL,
  islemi_yapan_id uuid REFERENCES public.kullanicilar(kullanici_id),
  neden           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uretim_gorev_atama_gecmisi_islem_ck CHECK (
    islem IN ('atandi', 'devredildi', 'atama_kaldirildi')
  ),
  CONSTRAINT uretim_gorev_atama_gecmisi_kaynak_ck CHECK (
    atama_kaynagi IN ('otomatik', 'manuel', 'devir', 'gecis')
  ),
  CONSTRAINT uretim_gorev_atama_gecmisi_degisim_ck CHECK (
    onceki_iu_id IS DISTINCT FROM yeni_iu_id
  )
);

CREATE INDEX IF NOT EXISTS ix_uretim_gorev_atama_gecmisi_gorev
  ON public.uretim_gorev_atama_gecmisi (gorev_id, created_at DESC);

-- Atama hedefinin gerçekten aktif bir IU olduğunu DB sınırında doğrular.
CREATE OR REPLACE FUNCTION public.uretim_aktif_iu_dogrula()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  hedef_iu uuid;
  iu_gecerli boolean;
BEGIN
  hedef_iu := CASE
    WHEN TG_TABLE_NAME = 'uretim_gorevleri' THEN NEW.atanan_iu_id
    ELSE NEW.iu_id
  END;

  IF hedef_iu IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (lower(k.rol) = 'iu' AND k.aktif_mi IS TRUE)
  INTO iu_gecerli
  FROM public.kullanicilar k
  WHERE k.kullanici_id = hedef_iu;

  IF iu_gecerli IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Atama yalnız aktif bir içerik üreticisine yapılabilir.';
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS iu_urun_atamalari_aktif_iu_trg ON public.iu_urun_atamalari;
CREATE TRIGGER iu_urun_atamalari_aktif_iu_trg
BEFORE INSERT OR UPDATE OF iu_id, aktif_mi ON public.iu_urun_atamalari
FOR EACH ROW
WHEN (NEW.aktif_mi IS TRUE)
EXECUTE FUNCTION public.uretim_aktif_iu_dogrula();

DROP TRIGGER IF EXISTS iu_genel_atamalari_aktif_iu_trg ON public.iu_genel_atamalari;
CREATE TRIGGER iu_genel_atamalari_aktif_iu_trg
BEFORE INSERT OR UPDATE OF iu_id, aktif_mi ON public.iu_genel_atamalari
FOR EACH ROW
WHEN (NEW.aktif_mi IS TRUE)
EXECUTE FUNCTION public.uretim_aktif_iu_dogrula();

DROP TRIGGER IF EXISTS uretim_gorevleri_aktif_iu_trg ON public.uretim_gorevleri;
CREATE TRIGGER uretim_gorevleri_aktif_iu_trg
BEFORE INSERT OR UPDATE OF atanan_iu_id ON public.uretim_gorevleri
FOR EACH ROW
WHEN (NEW.atanan_iu_id IS NOT NULL)
EXECUTE FUNCTION public.uretim_aktif_iu_dogrula();

CREATE OR REPLACE FUNCTION public.uretim_updated_at_yaz()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS iu_urun_atamalari_updated_at_trg ON public.iu_urun_atamalari;
CREATE TRIGGER iu_urun_atamalari_updated_at_trg
BEFORE UPDATE ON public.iu_urun_atamalari
FOR EACH ROW EXECUTE FUNCTION public.uretim_updated_at_yaz();

DROP TRIGGER IF EXISTS iu_genel_atamalari_updated_at_trg ON public.iu_genel_atamalari;
CREATE TRIGGER iu_genel_atamalari_updated_at_trg
BEFORE UPDATE ON public.iu_genel_atamalari
FOR EACH ROW EXECUTE FUNCTION public.uretim_updated_at_yaz();

DROP TRIGGER IF EXISTS uretim_gorevleri_updated_at_trg ON public.uretim_gorevleri;
CREATE TRIGGER uretim_gorevleri_updated_at_trg
BEFORE UPDATE ON public.uretim_gorevleri
FOR EACH ROW EXECUTE FUNCTION public.uretim_updated_at_yaz();

-- Yeni tablolar doğrudan tarayıcıdan yazılmaz. Paket C'de gerekli SELECT
-- politikaları görev/sahiplik sözleşmesine göre ayrıca açılacaktır.
ALTER TABLE public.iu_urun_atamalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iu_genel_atamalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uretim_gorevleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uretim_gorev_atama_gecmisi ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.iu_urun_atamalari TO service_role;
GRANT ALL ON public.iu_genel_atamalari TO service_role;
GRANT ALL ON public.uretim_gorevleri TO service_role;
GRANT ALL ON public.uretim_gorev_atama_gecmisi TO service_role;
REVOKE ALL ON public.iu_urun_atamalari FROM anon, authenticated;
REVOKE ALL ON public.iu_genel_atamalari FROM anon, authenticated;
REVOKE ALL ON public.uretim_gorevleri FROM anon, authenticated;
REVOKE ALL ON public.uretim_gorev_atama_gecmisi FROM anon, authenticated;

COMMIT;

WITH beklenen(nesne) AS (
  VALUES
    ('iu_urun_atamalari'),
    ('iu_genel_atamalari'),
    ('uretim_gorevleri'),
    ('uretim_gorev_atama_gecmisi')
), tablolar AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
), rls AS (
  SELECT relname
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relrowsecurity IS TRUE
)
SELECT
  b.nesne,
  (t.table_name IS NOT NULL) AS tablo_var,
  (r.relname IS NOT NULL) AS rls_acik
FROM beklenen b
LEFT JOIN tablolar t ON t.table_name = b.nesne
LEFT JOIN rls r ON r.relname = b.nesne
ORDER BY b.nesne;
