-- Eczanem izleme süresi, izleme puanı ve soru cevaplama güvenliği.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.
--
-- Kazanımlar:
--   1. Her gönderim için tek izleme oturumu oluşturulur.
--   2. Video süresi izleme başlangıcında kayda sabitlenebilir ve bitirmede
--      sunucu saatiyle doğrulanır.
--   3. İzlemeyi tamamlama + izleme puanı tek transaction içinde yazılır.
--   4. Gösterilecek soru indeksleri izleme kaydına sabitlenir.
--   5. Aynı soru kümesi yalnız bir kez ve tek transaction içinde cevaplanır.
--
-- Ön kontrol mükerrer gönderim/izleme bulursa hiçbir değişiklik yapmadan durur.

BEGIN;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.eczanem_izleme_kayitlari
    GROUP BY gonderim_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'eczanem_izleme_kayitlari içinde aynı gonderim_id için birden fazla izleme var. Tekilleştirme kararı verilmeden paket kurulmadı.';
  END IF;
END;
$kontrol$;

ALTER TABLE public.eczanem_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS video_suresi_saniye integer,
  ADD COLUMN IF NOT EXISTS soru_indeksleri integer[],
  ADD COLUMN IF NOT EXISTS cevaplandi_mi boolean NOT NULL DEFAULT false;

-- Eski sürümde doğru cevap puanı bulunan izlemeler tekrar cevaplanamasın.
UPDATE public.eczanem_izleme_kayitlari ik
SET cevaplandi_mi = true
WHERE COALESCE(ik.cevaplandi_mi, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.eczanem_puan_kayitlari pk
    WHERE pk.izleme_id = ik.izleme_id
      AND pk.puan_turu = 'cevap'
  );

CREATE UNIQUE INDEX IF NOT EXISTS eczanem_izleme_gonderim_uq
  ON public.eczanem_izleme_kayitlari (gonderim_id);

DO $kisit$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eczanem_izleme_video_suresi_pozitif_ck'
      AND conrelid = 'public.eczanem_izleme_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.eczanem_izleme_kayitlari
      ADD CONSTRAINT eczanem_izleme_video_suresi_pozitif_ck
      CHECK (video_suresi_saniye IS NULL OR video_suresi_saniye > 0);
  END IF;
END;
$kisit$;

CREATE OR REPLACE FUNCTION public.eczanem_izleme_tamamla(
  p_izleme_id uuid,
  p_musteri_id uuid,
  p_soru_indeksleri integer[]
)
RETURNS TABLE (
  yeni_tamamlandi boolean,
  puan_kazanildi boolean,
  izleme_puani integer,
  soru_gosterilecek boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_izleme public.eczanem_izleme_kayitlari%ROWTYPE;
  v_eczane_id uuid;
  v_urun_id uuid;
  v_firma_id uuid;
  v_video_suresi integer := 0;
  v_video_puani integer := 0;
  v_sorular jsonb := '[]'::jsonb;
  v_soru_adedi integer := 0;
  v_gosterilecek_soru integer := 0;
  v_beklenen_soru integer := 0;
  v_yeni boolean := false;
  v_puan_yazildi boolean := false;
BEGIN
  SELECT ik.*
  INTO v_izleme
  FROM public.eczanem_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_izleme.musteri_id <> p_musteri_id THEN
    RAISE EXCEPTION 'İzleme kaydı müşteriye ait değil.' USING ERRCODE = '42501';
  END IF;

  SELECT g.eczane_id
  INTO v_eczane_id
  FROM public.eczanem_gonderimler g
  WHERE g.gonderim_id = v_izleme.gonderim_id
    AND g.musteri_id = p_musteri_id
    AND g.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzlemenin gönderim bağı doğrulanamadı.' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(vyd.video_suresi_saniye, 0),
    COALESCE(vyd.video_puani, 0),
    CASE WHEN jsonb_typeof(vyd.sorular) = 'array' THEN vyd.sorular ELSE '[]'::jsonb END,
    GREATEST(0, COALESCE(vyd.video_basi_soru_sayisi, 2))
  INTO v_video_suresi, v_video_puani, v_sorular, v_gosterilecek_soru
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın detayı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  v_soru_adedi := jsonb_array_length(v_sorular);
  v_beklenen_soru := LEAST(v_soru_adedi, v_gosterilecek_soru);

  IF COALESCE(cardinality(p_soru_indeksleri), 0) <> v_beklenen_soru THEN
    RAISE EXCEPTION 'Soru kümesi beklenen soru sayısıyla eşleşmiyor.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_soru_indeksleri, ARRAY[]::integer[])) indeks
    WHERE indeks < 0 OR indeks >= v_soru_adedi
  ) OR (
    SELECT COUNT(*)
    FROM (
      SELECT DISTINCT indeks
      FROM unnest(COALESCE(p_soru_indeksleri, ARRAY[]::integer[])) indeks
    ) tekil
  ) <> v_beklenen_soru THEN
    RAISE EXCEPTION 'Soru kümesi geçersiz veya mükerrer indeks içeriyor.' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(v_izleme.tamamlandi_mi, false) THEN
    v_video_suresi := COALESCE(v_izleme.video_suresi_saniye, v_video_suresi, 0);
    IF v_video_suresi <= 0 THEN
      RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE = '22023';
    END IF;

    IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic))
         < GREATEST(0, v_video_suresi - 2) THEN
      RAISE EXCEPTION 'Video henüz tamamlanabilecek kadar oynatılmadı.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.eczanem_izleme_kayitlari ik
    SET tamamlandi_mi = true,
        izleme_bitis = clock_timestamp(),
        video_suresi_saniye = v_video_suresi,
        soru_indeksleri = p_soru_indeksleri
    WHERE ik.izleme_id = p_izleme_id
    RETURNING ik.* INTO v_izleme;
    v_yeni := true;

    IF v_video_puani > 0 THEN
      SELECT public.get_urun_from_yayin(v_izleme.yayin_id)
      INTO v_urun_id;
      IF v_urun_id IS NULL THEN
        RAISE EXCEPTION 'Yayının ürün bağı çözülemedi.' USING ERRCODE = 'P0001';
      END IF;

      SELECT u.firma_id
      INTO v_firma_id
      FROM public.urunler u
      WHERE u.urun_id = v_urun_id;
      IF NOT FOUND OR v_firma_id IS NULL THEN
        RAISE EXCEPTION 'Ürünün firma bağı çözülemedi.' USING ERRCODE = 'P0001';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.eczanem_puan_kayitlari pk
        WHERE pk.izleme_id = p_izleme_id
          AND pk.puan_turu = 'izleme'
      ) THEN
        INSERT INTO public.eczanem_puan_kayitlari
          (musteri_id, eczane_id, firma_id, urun_id, izleme_id, puan_turu, puan, kalan_puan)
        VALUES
          (p_musteri_id, v_eczane_id, v_firma_id, v_urun_id, p_izleme_id,
           'izleme', v_video_puani, v_video_puani);
        v_puan_yazildi := true;
      END IF;
    END IF;
  ELSIF v_izleme.soru_indeksleri IS NULL
        AND NOT COALESCE(v_izleme.cevaplandi_mi, false) THEN
    -- Paket öncesinde tamamlanan fakat henüz cevaplanmamış izlemeyi yeni
    -- sabit soru modeliyle uyumlu hâle getirir.
    UPDATE public.eczanem_izleme_kayitlari ik
    SET soru_indeksleri = p_soru_indeksleri
    WHERE ik.izleme_id = p_izleme_id
    RETURNING ik.* INTO v_izleme;
  END IF;

  RETURN QUERY
  SELECT
    v_yeni,
    v_puan_yazildi,
    CASE WHEN v_puan_yazildi THEN v_video_puani ELSE 0 END,
    COALESCE(cardinality(v_izleme.soru_indeksleri), 0) > 0
      AND NOT COALESCE(v_izleme.cevaplandi_mi, false);
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_cevaplari_kaydet(
  p_izleme_id uuid,
  p_musteri_id uuid,
  p_sonuclar jsonb
)
RETURNS TABLE (kazanilan_puan integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_izleme public.eczanem_izleme_kayitlari%ROWTYPE;
  v_eczane_id uuid;
  v_urun_id uuid;
  v_firma_id uuid;
  v_soru_seti_durum_id uuid;
  v_gelen_indeksler integer[];
  v_atanan_indeksler integer[];
  v_toplam integer := 0;
BEGIN
  SELECT ik.*
  INTO v_izleme
  FROM public.eczanem_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_izleme.musteri_id <> p_musteri_id THEN
    RAISE EXCEPTION 'İzleme kaydı müşteriye ait değil.' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(v_izleme.tamamlandi_mi, false)
     OR COALESCE(cardinality(v_izleme.soru_indeksleri), 0) = 0 THEN
    RAISE EXCEPTION 'Bu izleme için cevaplanabilir soru bulunmuyor.' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_izleme.cevaplandi_mi, false) THEN
    RAISE EXCEPTION 'Bu izleme için sorular zaten cevaplandı.' USING ERRCODE = '23505';
  END IF;

  IF jsonb_typeof(p_sonuclar) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Cevap sonucu biçimi geçersiz.' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_sonuclar) = 0
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(p_sonuclar) sonuc
       WHERE jsonb_typeof(sonuc) <> 'object'
          OR jsonb_typeof(sonuc->'soru_index') <> 'number'
          OR jsonb_typeof(sonuc->'dogru_mu') <> 'boolean'
          OR (sonuc->>'soru_index') !~ '^[0-9]+$'
     ) THEN
    RAISE EXCEPTION 'Cevap sonucu biçimi geçersiz.' USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY_AGG((sonuc->>'soru_index')::integer ORDER BY (sonuc->>'soru_index')::integer)
  INTO v_gelen_indeksler
  FROM jsonb_array_elements(p_sonuclar) sonuc;

  SELECT ARRAY_AGG(indeks ORDER BY indeks)
  INTO v_atanan_indeksler
  FROM unnest(v_izleme.soru_indeksleri) indeks;

  IF v_gelen_indeksler IS DISTINCT FROM v_atanan_indeksler THEN
    RAISE EXCEPTION 'Cevaplar atanmış soru kümesiyle eşleşmiyor.' USING ERRCODE = '22023';
  END IF;

  SELECT g.eczane_id
  INTO v_eczane_id
  FROM public.eczanem_gonderimler g
  WHERE g.gonderim_id = v_izleme.gonderim_id
    AND g.musteri_id = p_musteri_id
    AND g.yayin_id = v_izleme.yayin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzlemenin gönderim bağı doğrulanamadı.' USING ERRCODE = 'P0001';
  END IF;

  SELECT vyd.soru_seti_durum_id
  INTO v_soru_seti_durum_id
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın detayı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN (sonuc->>'dogru_mu')::boolean THEN COALESCE((
      SELECT MAX(GREATEST(0, sp.soru_puani))
      FROM public.soru_seti_puanlari sp
      WHERE sp.soru_seti_durum_id = v_soru_seti_durum_id
        AND sp.soru_index = (sonuc->>'soru_index')::integer
    ), 0) ELSE 0 END
  ), 0)::integer
  INTO v_toplam
  FROM jsonb_array_elements(p_sonuclar) sonuc;

  IF v_toplam > 0 THEN
    SELECT public.get_urun_from_yayin(v_izleme.yayin_id)
    INTO v_urun_id;
    IF v_urun_id IS NULL THEN
      RAISE EXCEPTION 'Yayının ürün bağı çözülemedi.' USING ERRCODE = 'P0001';
    END IF;

    SELECT u.firma_id
    INTO v_firma_id
    FROM public.urunler u
    WHERE u.urun_id = v_urun_id;
    IF NOT FOUND OR v_firma_id IS NULL THEN
      RAISE EXCEPTION 'Ürünün firma bağı çözülemedi.' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.eczanem_puan_kayitlari
      (musteri_id, eczane_id, firma_id, urun_id, izleme_id, puan_turu, puan, kalan_puan)
    VALUES
      (p_musteri_id, v_eczane_id, v_firma_id, v_urun_id, p_izleme_id,
       'cevap', v_toplam, v_toplam);
  END IF;

  -- Tüm cevaplar yanlış olsa ve puan satırı oluşmasa da tekrar cevaplanamaz.
  UPDATE public.eczanem_izleme_kayitlari
  SET cevaplandi_mi = true
  WHERE izleme_id = p_izleme_id;

  RETURN QUERY SELECT v_toplam;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_izleme_tamamla(uuid, uuid, integer[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_izleme_tamamla(uuid, uuid, integer[])
  TO service_role;

REVOKE ALL ON FUNCTION public.eczanem_cevaplari_kaydet(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_cevaplari_kaydet(uuid, uuid, jsonb)
  TO service_role;

COMMIT;
