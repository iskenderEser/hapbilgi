-- Talep hedef kitlesini çoğul sözleşmeye geçirir.
-- Tek yayın; Eczacı, Eczane Teknisyeni veya ikisini birlikte hedefleyebilir.
-- Eski hedef_rol kolonu geçiş süresince canlı eski sürümle uyumluluk için tutulur;
-- karar kaynağı hedef_roller'dir ve hedef_rol dizinin ilk elemanından türetilir.

BEGIN;

ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS hedef_roller text[];

UPDATE public.talepler
SET hedef_roller = ARRAY[hedef_rol]::text[]
WHERE hedef_roller IS NULL OR cardinality(hedef_roller) = 0;

CREATE OR REPLACE FUNCTION public.talepler_hedef_roller_esitle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.hedef_roller IS NOT DISTINCT FROM OLD.hedef_roller
     AND NEW.hedef_rol IS DISTINCT FROM OLD.hedef_rol THEN
    -- Eski uygulama tekil kolonu güncellerse çoğul kaynak da eşitlenir.
    NEW.hedef_roller := ARRAY[NEW.hedef_rol]::text[];
  ELSIF NEW.hedef_roller IS NULL OR cardinality(NEW.hedef_roller) = 0 THEN
    -- Eski uygulamanın INSERT'i.
    NEW.hedef_roller := ARRAY[NEW.hedef_rol]::text[];
  ELSE
    -- Yeni uygulamada tekil kolon yalnız geçici uyumluluk gölgesidir.
    NEW.hedef_rol := NEW.hedef_roller[1];
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS talepler_hedef_roller_esitle_trg ON public.talepler;
CREATE TRIGGER talepler_hedef_roller_esitle_trg
BEFORE INSERT OR UPDATE OF hedef_rol, hedef_roller ON public.talepler
FOR EACH ROW EXECUTE FUNCTION public.talepler_hedef_roller_esitle();

ALTER TABLE public.talepler
  DROP CONSTRAINT IF EXISTS chk_talepler_hedef_roller;
ALTER TABLE public.talepler
  ADD CONSTRAINT chk_talepler_hedef_roller CHECK (
    hedef_roller = ARRAY['utt']::text[]
    OR hedef_roller = ARRAY['bm']::text[]
    OR hedef_roller = ARRAY['eczanem']::text[]
    OR hedef_roller = ARRAY['eczaci']::text[]
    OR hedef_roller = ARRAY['eczane_teknisyeni']::text[]
    OR hedef_roller = ARRAY['eczaci', 'eczane_teknisyeni']::text[]
  );
ALTER TABLE public.talepler
  ALTER COLUMN hedef_roller SET NOT NULL;

ALTER TABLE public.yayin_yonetimi
  DROP CONSTRAINT IF EXISTS chk_yayin_yonetimi_hedef_roller;
ALTER TABLE public.yayin_yonetimi
  ADD CONSTRAINT chk_yayin_yonetimi_hedef_roller CHECK (
    hedef_roller = ARRAY['utt']::text[]
    OR hedef_roller = ARRAY['bm']::text[]
    OR hedef_roller = ARRAY['eczanem']::text[]
    OR hedef_roller = ARRAY['eczaci']::text[]
    OR hedef_roller = ARRAY['eczane_teknisyeni']::text[]
    OR hedef_roller = ARRAY['eczaci', 'eczane_teknisyeni']::text[]
  );

-- Mevcut kolon sırası korunur; hedef_roller sona eklenir.
CREATE OR REPLACE VIEW public.v_yayin_detay AS
 SELECT ym.yayin_id,
    ym.soru_seti_durum_id,
    ym.durum,
    ym.yayin_tarihi,
    ym.durdurma_tarihi,
    COALESCE(u.urun_adi, t.urun_adi) AS urun_adi,
    tek.teknik_adi,
    t.takim_id,
    t.uretici_id,
    t.video_basi_soru_sayisi,
    t.soru_seti_buyuklugu,
    v.video_url,
    v.thumbnail_url,
    vp.video_puani,
    avg(ssp.soru_puani)::integer AS soru_puani,
    ss.sorular,
    s.senaryo_metni,
    s.senaryo_id,
    sd.senaryo_durum_id,
    vd.video_durum_id,
    ssd.soru_seti_id,
    t.icerik_turu,
    t.hedef_rol,
    t.talep_no,
    f.firma_adi,
    t.egitim_turu,
    t.firma_id,
    ym.hedef_roller
   FROM yayin_yonetimi ym
     JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
     JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
     JOIN video_durumu vd ON vd.video_durum_id = ss.video_durum_id
     JOIN videolar v ON v.video_id = vd.video_id
     JOIN talepler t ON t.talep_id = v.talep_id
     LEFT JOIN senaryo_durumu sd ON sd.senaryo_durum_id = v.senaryo_durum_id
     LEFT JOIN senaryolar s ON s.senaryo_id = sd.senaryo_id
     LEFT JOIN urunler u ON u.urun_id = t.urun_id
     LEFT JOIN teknikler tek ON tek.teknik_id = t.teknik_id
     LEFT JOIN video_puanlari vp ON vp.video_durum_id = vd.video_durum_id
     LEFT JOIN soru_seti_puanlari ssp ON ssp.soru_seti_durum_id = ym.soru_seti_durum_id
     LEFT JOIN firmalar f ON f.firma_id = t.firma_id
  GROUP BY ym.yayin_id, ym.soru_seti_durum_id, ym.durum, ym.yayin_tarihi, ym.durdurma_tarihi,
    u.urun_adi, t.urun_adi, tek.teknik_adi, t.takim_id, t.uretici_id, t.video_basi_soru_sayisi,
    t.soru_seti_buyuklugu, v.video_url, v.thumbnail_url, vp.video_puani, ss.sorular,
    s.senaryo_metni, s.senaryo_id, sd.senaryo_durum_id, vd.video_durum_id, ssd.soru_seti_id,
    t.icerik_turu, t.egitim_turu, t.hedef_rol, t.talep_no, f.firma_adi, t.firma_id,
    ym.hedef_roller;

CREATE OR REPLACE VIEW public.v_yayin_kunye AS
SELECT
  ym.yayin_id,
  t.talep_id,
  t.talep_no,
  t.urun_id,
  t.teknik_id,
  t.icerik_turu,
  t.egitim_turu,
  t.hedef_rol,
  t.firma_id,
  t.takim_id,
  t.uretici_id,
  ym.hedef_roller
FROM yayin_yonetimi ym
JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
JOIN soru_setleri ss      ON ss.soru_seti_id        = ssd.soru_seti_id
JOIN talepler t           ON t.talep_id             = ss.talep_id;

GRANT SELECT ON public.v_yayin_kunye TO service_role;

COMMIT;
