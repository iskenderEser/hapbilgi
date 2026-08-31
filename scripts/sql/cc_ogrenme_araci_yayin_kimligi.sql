-- C-Club challenge ve izleme kayıtlarını ortak öğrenme aracı kimliğine geçirir.
-- Mevcut RPC imzası korunur; yayın kimliği v_yayin_detay üzerinden doğrulanır.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-cc-ortak-arac-kimligi-v1', 1));

ALTER TABLE public.challenge_kayitlari
  ADD COLUMN IF NOT EXISTS arac_id uuid,
  ADD COLUMN IF NOT EXISTS arac_turu text;

ALTER TABLE public.cc_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS arac_id uuid;

UPDATE public.challenge_kayitlari c
SET arac_id = vyd.arac_id,
    arac_turu = vyd.arac_turu
FROM public.v_yayin_detay vyd
WHERE vyd.yayin_id = c.yayin_id
  AND (c.arac_id IS NULL OR c.arac_turu IS NULL);

UPDATE public.cc_izleme_kayitlari i
SET arac_id = vyd.arac_id,
    arac_turu = vyd.arac_turu
FROM public.v_yayin_detay vyd
WHERE vyd.yayin_id = i.yayin_id
  AND (i.arac_id IS NULL OR i.arac_turu IS DISTINCT FROM vyd.arac_turu);

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.challenge_kayitlari c
    LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = c.yayin_id
    WHERE c.arac_id IS NULL OR c.arac_turu IS NULL
       OR c.arac_id IS DISTINCT FROM vyd.arac_id
       OR c.arac_turu IS DISTINCT FROM vyd.arac_turu
  ) THEN
    RAISE EXCEPTION 'C-Club challenge kayıtlarında ortak araç kimliği eksik veya uyumsuz.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cc_izleme_kayitlari i
    LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = i.yayin_id
    WHERE i.arac_id IS NULL OR i.arac_turu IS NULL
       OR i.arac_id IS DISTINCT FROM vyd.arac_id
       OR i.arac_turu IS DISTINCT FROM vyd.arac_turu
  ) THEN
    RAISE EXCEPTION 'C-Club izleme kayıtlarında ortak araç kimliği eksik veya uyumsuz.';
  END IF;
END;
$kontrol$;

ALTER TABLE public.challenge_kayitlari
  ALTER COLUMN arac_id SET NOT NULL,
  ALTER COLUMN arac_turu SET NOT NULL;

ALTER TABLE public.cc_izleme_kayitlari
  ALTER COLUMN arac_id SET NOT NULL;

DO $kisit$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'challenge_kayitlari_arac_id_fkey'
      AND conrelid = 'public.challenge_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.challenge_kayitlari
      ADD CONSTRAINT challenge_kayitlari_arac_id_fkey
      FOREIGN KEY (arac_id) REFERENCES public.ogrenme_araclari(arac_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'challenge_kayitlari_arac_turu_ck'
      AND conrelid = 'public.challenge_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.challenge_kayitlari
      ADD CONSTRAINT challenge_kayitlari_arac_turu_ck
      CHECK (arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cc_izleme_kayitlari_arac_id_fkey'
      AND conrelid = 'public.cc_izleme_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.cc_izleme_kayitlari
      ADD CONSTRAINT cc_izleme_kayitlari_arac_id_fkey
      FOREIGN KEY (arac_id) REFERENCES public.ogrenme_araclari(arac_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cc_izleme_kayitlari_arac_turu_ck'
      AND conrelid = 'public.cc_izleme_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.cc_izleme_kayitlari
      ADD CONSTRAINT cc_izleme_kayitlari_arac_turu_ck
      CHECK (arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf'));
  END IF;
END;
$kisit$;

CREATE OR REPLACE FUNCTION public.cc_arac_kimligi_dogrula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_arac_id uuid;
  v_arac_turu text;
BEGIN
  SELECT vyd.arac_id, vyd.arac_turu
  INTO v_arac_id, v_arac_turu
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = NEW.yayin_id;

  IF NOT FOUND OR v_arac_id IS NULL
     OR v_arac_turu NOT IN ('video', 'podcast', 'gorsel', 'flip_pdf') THEN
    RAISE EXCEPTION 'Yayının geçerli öğrenme aracı kimliği bulunamadı.' USING ERRCODE = '23514';
  END IF;
  IF NEW.arac_id IS NOT NULL AND NEW.arac_id IS DISTINCT FROM v_arac_id THEN
    RAISE EXCEPTION 'C-Club araç kimliği yayınla uyuşmuyor.' USING ERRCODE = '23514';
  END IF;
  IF NEW.arac_turu IS NOT NULL AND NEW.arac_turu IS DISTINCT FROM v_arac_turu THEN
    RAISE EXCEPTION 'C-Club araç türü yayınla uyuşmuyor.' USING ERRCODE = '23514';
  END IF;

  NEW.arac_id := v_arac_id;
  NEW.arac_turu := v_arac_turu;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS trg_challenge_arac_kimligi ON public.challenge_kayitlari;
CREATE TRIGGER trg_challenge_arac_kimligi
BEFORE INSERT OR UPDATE OF yayin_id, arac_id, arac_turu
ON public.challenge_kayitlari
FOR EACH ROW EXECUTE FUNCTION public.cc_arac_kimligi_dogrula();

DROP TRIGGER IF EXISTS trg_cc_izleme_arac_kimligi ON public.cc_izleme_kayitlari;
CREATE TRIGGER trg_cc_izleme_arac_kimligi
BEFORE INSERT OR UPDATE OF yayin_id, arac_id, arac_turu
ON public.cc_izleme_kayitlari
FOR EACH ROW EXECUTE FUNCTION public.cc_arac_kimligi_dogrula();

CREATE OR REPLACE FUNCTION public.cc_challenge_gonder(
  p_gonderen_id uuid,
  p_alan_id uuid,
  p_yayin_id uuid,
  p_son_tarih timestamptz DEFAULT NULL
)
RETURNS TABLE (challenge_id uuid, gonderme_puani integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_gonderen public.kullanicilar%ROWTYPE;
  v_alan public.kullanicilar%ROWTYPE;
  v_yayin public.yayin_yonetimi%ROWTYPE;
  v_yayin_firma_id uuid;
  v_arac_id uuid;
  v_arac_turu text;
  v_arac_suresi integer := 0;
  v_challenge_id uuid;
  v_puan integer := 10;
  v_ay_baslangici timestamptz;
  v_tur_baslangici timestamptz;
BEGIN
  IF p_gonderen_id = p_alan_id THEN
    RAISE EXCEPTION 'Kendinize challenge gönderemezsiniz.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('cc-gonderen:' || p_gonderen_id::text, 0));

  SELECT k.* INTO v_gonderen
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_gonderen_id
  FOR UPDATE;
  IF NOT FOUND OR v_gonderen.rol <> 'bm' OR NOT COALESCE(v_gonderen.aktif_mi, false) THEN
    RAISE EXCEPTION 'Gönderici aktif bir BM değil.' USING ERRCODE = '42501';
  END IF;

  SELECT k.* INTO v_alan
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_alan_id
  FOR UPDATE;
  IF NOT FOUND OR v_alan.rol <> 'bm' OR NOT COALESCE(v_alan.aktif_mi, false) THEN
    RAISE EXCEPTION 'Alıcı aktif bir BM değil.' USING ERRCODE = 'P0001';
  END IF;
  IF v_gonderen.firma_id IS NULL OR v_alan.firma_id IS DISTINCT FROM v_gonderen.firma_id THEN
    RAISE EXCEPTION 'Challenge yalnız aynı firmadaki BM kullanıcıları arasında gönderilebilir.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.firmalar f
    WHERE f.firma_id = v_gonderen.firma_id
      AND COALESCE(f.aktif, false)
      AND COALESCE(f.cc_aktif, false)
  ) THEN
    RAISE EXCEPTION 'Firmanın C-Club erişimi kapalı veya firma aktif değil.' USING ERRCODE = 'P0001';
  END IF;

  SELECT yy.* INTO v_yayin
  FROM public.yayin_yonetimi yy
  WHERE yy.yayin_id = p_yayin_id
  FOR SHARE;
  IF NOT FOUND
     OR v_yayin.durum <> 'yayinda'
     OR NOT (COALESCE(v_yayin.hedef_roller, ARRAY[]::text[]) @> ARRAY['bm']::text[])
     OR v_yayin.yayin_tarihi > clock_timestamp()
     OR (v_yayin.durdurma_tarihi IS NOT NULL AND v_yayin.durdurma_tarihi <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Yayın C-Club gönderimine açık değil.' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    vyd.firma_id,
    vyd.arac_id,
    vyd.arac_turu,
    COALESCE(vyd.arac_sure_saniye, vyd.video_suresi_saniye, 0)
  INTO v_yayin_firma_id, v_arac_id, v_arac_turu, v_arac_suresi
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = p_yayin_id;
  IF NOT FOUND
     OR v_yayin_firma_id IS DISTINCT FROM v_gonderen.firma_id
     OR v_arac_id IS NULL
     OR v_arac_turu NOT IN ('video', 'podcast', 'gorsel', 'flip_pdf')
     OR (v_arac_turu IN ('video', 'podcast') AND v_arac_suresi <= 0) THEN
    RAISE EXCEPTION 'Yayın firmanızın doğrulanmış C-Club öğrenme aracı değil.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    (SELECT baslangic_tarihi FROM public.yayin_tekrar_kayitlari
     WHERE yayin_id = p_yayin_id ORDER BY tur_no DESC LIMIT 1),
    v_yayin.yayin_tarihi,
    '1970-01-01'::timestamptz
  ) INTO v_tur_baslangici;

  IF NOT EXISTS (
    SELECT 1 FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_gonderen_id
      AND ik.yayin_id = p_yayin_id
      AND ik.arac_id = v_arac_id
      AND ik.arac_turu = v_arac_turu
      AND ik.tamamlandi_mi = true
      AND ik.izleme_baslangic >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Bu öğrenme aracını geçerli turda önce kendiniz tamamlamalısınız.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_alan_id
      AND ik.yayin_id = p_yayin_id
      AND ik.arac_id = v_arac_id
      AND ik.arac_turu = v_arac_turu
      AND ik.tamamlandi_mi = true
      AND ik.izleme_baslangic >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Alıcı BM bu öğrenme aracını geçerli turda zaten tamamlamış.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.gonderen_id = p_gonderen_id
      AND ck.alan_id = p_alan_id
      AND ck.arac_id = v_arac_id
      AND ck.created_at >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Aynı öğrenme aracı bu tur içinde bu BM kullanıcısına zaten gönderilmiş.' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.alan_id = p_alan_id
      AND ck.arac_id = v_arac_id
      AND ck.izlendi_mi = false
      AND ck.created_at >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Alıcı BM''nin bu öğrenme aracı için zaten bekleyen challenge''ı bulunuyor.' USING ERRCODE = 'P0001';
  END IF;

  v_ay_baslangici := date_trunc('month', clock_timestamp() AT TIME ZONE 'Europe/Istanbul')
    AT TIME ZONE 'Europe/Istanbul';

  IF (SELECT count(*) FROM public.challenge_kayitlari ck
      WHERE ck.gonderen_id = p_gonderen_id AND ck.created_at >= v_ay_baslangici) >= 3 THEN
    RAISE EXCEPTION 'Bu ay aylık challenge kotanız doldu (3/3).' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.gonderen_id = p_gonderen_id
      AND ck.alan_id = p_alan_id
      AND ck.created_at >= v_ay_baslangici
  ) THEN
    RAISE EXCEPTION 'Bu ay bu BM kullanıcısına zaten bir challenge gönderdiniz.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.challenge_kayitlari
    (gonderen_id, alan_id, yayin_id, arac_id, arac_turu, son_tarih, izlendi_mi)
  VALUES
    (p_gonderen_id, p_alan_id, p_yayin_id, v_arac_id, v_arac_turu,
     COALESCE(p_son_tarih, clock_timestamp() + interval '100 years'), false)
  RETURNING challenge_kayitlari.challenge_id INTO v_challenge_id;

  SELECT COALESCE(MAX(
    CASE WHEN (sa.deger #>> '{}') ~ '^[0-9]+$' THEN (sa.deger #>> '{}')::integer END
  ), 10)
  INTO v_puan
  FROM public.sistem_ayarlari sa
  WHERE sa.anahtar = 'cc_gonderme_puani';

  INSERT INTO public.cc_kazanilan_puanlar
    (bm_id, yayin_id, challenge_id, puan_turu, puan)
  VALUES
    (p_gonderen_id, p_yayin_id, v_challenge_id, 'cc_gonderme', v_puan);

  RETURN QUERY SELECT v_challenge_id, v_puan;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.cc_challenge_gonder(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_challenge_gonder(uuid, uuid, uuid, timestamptz)
  TO service_role;

COMMIT;

SELECT
  (SELECT count(*) FROM public.challenge_kayitlari WHERE arac_id IS NULL OR arac_turu IS NULL) AS eksik_challenge,
  (SELECT count(*) FROM public.cc_izleme_kayitlari WHERE arac_id IS NULL OR arac_turu IS NULL) AS eksik_izleme,
  to_regprocedure('public.cc_arac_kimligi_dogrula()') IS NOT NULL AS kimlik_trigger_fonksiyonu_var;
