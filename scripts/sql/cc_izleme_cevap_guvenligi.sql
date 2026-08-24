-- C-Club izleme, soru ve puan zincirini atomik ve tekrarlanamaz hale getirir.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.

BEGIN;

-- Tekillik indeksleri kurulmadan önce mevcut çakışmaları görünür biçimde durdur.
DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cc_ileri_sarma_kayitlari
    GROUP BY izleme_id, atlama_baslangic, atlama_bitis
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'C-Club ileri sarma kayıtlarında mükerrer olay var; paket kurulmadı.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cc_izleme_kayitlari
    WHERE challenge_id IS NOT NULL
    GROUP BY challenge_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Aynı challenge için birden fazla C-Club izlemesi var; paket kurulmadı.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cc_kazanilan_puanlar
    WHERE izleme_id IS NOT NULL AND puan_turu IN ('izleme', 'extra')
    GROUP BY izleme_id, puan_turu
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'C-Club izleme/extra puanlarında mükerrer kayıt var; paket kurulmadı.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cc_kazanilan_puanlar
    WHERE challenge_id IS NOT NULL AND puan_turu = 'cc_referral'
    GROUP BY challenge_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'C-Club referral puanlarında mükerrer kayıt var; paket kurulmadı.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cc_yanlis_cevap_kayitlari
    GROUP BY izleme_id, soru_index
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'C-Club yanlış cevaplarında mükerrer kayıt var; paket kurulmadı.';
  END IF;
END;
$kontrol$;

ALTER TABLE public.cc_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS video_suresi_saniye integer,
  ADD COLUMN IF NOT EXISTS soru_indeksleri integer[],
  ADD COLUMN IF NOT EXISTS cevaplandi_mi boolean NOT NULL DEFAULT false;

-- Paket öncesinde açılmış oturumlar doğrulanmış yayın süresiyle devam edebilsin.
UPDATE public.cc_izleme_kayitlari ik
SET video_suresi_saniye = CEIL(vyd.video_suresi_saniye)::integer
FROM public.v_yayin_detay vyd
WHERE vyd.yayin_id = ik.yayin_id
  AND ik.video_suresi_saniye IS NULL
  AND vyd.video_suresi_saniye > 0;

-- Daha önce herhangi bir cevap sonucu oluşmuş izlemeler yeniden cevaplanamasın.
UPDATE public.cc_izleme_kayitlari ik
SET cevaplandi_mi = true
WHERE NOT COALESCE(ik.cevaplandi_mi, false)
  AND (
    EXISTS (
      SELECT 1 FROM public.cc_kazanilan_puanlar kp
      WHERE kp.izleme_id = ik.izleme_id AND kp.puan_turu = 'cevaplama'
    )
    OR EXISTS (
      SELECT 1 FROM public.cc_yanlis_cevap_kayitlari yk
      WHERE yk.izleme_id = ik.izleme_id
    )
  );

DO $kisit$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cc_izleme_video_suresi_pozitif_ck'
      AND conrelid = 'public.cc_izleme_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.cc_izleme_kayitlari
      ADD CONSTRAINT cc_izleme_video_suresi_pozitif_ck
      CHECK (video_suresi_saniye IS NULL OR video_suresi_saniye > 0);
  END IF;
END;
$kisit$;

CREATE UNIQUE INDEX IF NOT EXISTS cc_puan_izleme_turu_uq
  ON public.cc_kazanilan_puanlar (izleme_id, puan_turu)
  WHERE izleme_id IS NOT NULL AND puan_turu IN ('izleme', 'extra');

CREATE UNIQUE INDEX IF NOT EXISTS cc_izleme_challenge_uq
  ON public.cc_izleme_kayitlari (challenge_id)
  WHERE challenge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cc_puan_referral_challenge_uq
  ON public.cc_kazanilan_puanlar (challenge_id)
  WHERE challenge_id IS NOT NULL AND puan_turu = 'cc_referral';

CREATE UNIQUE INDEX IF NOT EXISTS cc_yanlis_cevap_izleme_soru_uq
  ON public.cc_yanlis_cevap_kayitlari (izleme_id, soru_index);

CREATE UNIQUE INDEX IF NOT EXISTS cc_ileri_sarma_olay_uq
  ON public.cc_ileri_sarma_kayitlari (izleme_id, atlama_baslangic, atlama_bitis);

CREATE OR REPLACE FUNCTION public.cc_izleme_tamamla(
  p_izleme_id uuid,
  p_bm_id uuid,
  p_soru_indeksleri integer[],
  p_extra_alt_sinir timestamptz
)
RETURNS TABLE (
  yeni_tamamlandi boolean,
  kazanilan_puan integer,
  soru_gosterilecek boolean,
  ileri_sarildi boolean,
  izleme_turu text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_izleme public.cc_izleme_kayitlari%ROWTYPE;
  v_sorular jsonb := '[]'::jsonb;
  v_video_puani integer := 0;
  v_extra_puani integer := 0;
  v_gosterilecek_soru integer := 0;
  v_beklenen_soru integer := 0;
  v_atlanan_sure integer := 0;
  v_tam_tekrar integer := 0;
  v_kazanilan integer := 0;
  v_yeni boolean := false;
BEGIN
  SELECT ik.*
  INTO v_izleme
  FROM public.cc_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_izleme.bm_id <> p_bm_id THEN
    RAISE EXCEPTION 'İzleme kaydı BM kullanıcısına ait değil.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_izleme.tamamlandi_mi, false) THEN
    SELECT COALESCE(SUM(kp.puan), 0)::integer
    INTO v_kazanilan
    FROM public.cc_kazanilan_puanlar kp
    WHERE kp.izleme_id = p_izleme_id
      AND kp.puan_turu IN ('izleme', 'extra');

    RETURN QUERY SELECT
      false,
      v_kazanilan,
      COALESCE(cardinality(v_izleme.soru_indeksleri), 0) > 0
        AND NOT COALESCE(v_izleme.cevaplandi_mi, false),
      v_izleme.ileri_sarildi_mi,
      v_izleme.izleme_turu;
    RETURN;
  END IF;

  IF v_izleme.video_suresi_saniye IS NULL OR v_izleme.video_suresi_saniye <= 0 THEN
    RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(isk.atlanan_sure), 0)::integer
  INTO v_atlanan_sure
  FROM public.cc_ileri_sarma_kayitlari isk
  WHERE isk.izleme_id = p_izleme_id;

  v_izleme.ileri_sarildi_mi := v_izleme.ileri_sarildi_mi OR v_atlanan_sure > 0;

  IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic))
       + v_atlanan_sure
       < GREATEST(0, v_izleme.video_suresi_saniye - 2) THEN
    RAISE EXCEPTION 'Video henüz tamamlanabilecek kadar oynatılmadı.' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    CASE WHEN jsonb_typeof(vyd.sorular) = 'array' THEN vyd.sorular ELSE '[]'::jsonb END,
    GREATEST(0, COALESCE(vyd.video_basi_soru_sayisi, 2)),
    GREATEST(0, COALESCE(vyd.video_puani, 0))
  INTO v_sorular, v_gosterilecek_soru, v_video_puani
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın detayı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  SELECT GREATEST(0, COALESCE(yy.extra_puan, 0))
  INTO v_extra_puani
  FROM public.yayin_yonetimi yy
  WHERE yy.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın ayarları bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  v_beklenen_soru := CASE
    WHEN NOT v_izleme.ileri_sarildi_mi
      AND v_izleme.izleme_turu IN ('kendi_izleme', 'challenge')
    THEN LEAST(jsonb_array_length(v_sorular), v_gosterilecek_soru)
    ELSE 0
  END;

  IF COALESCE(cardinality(p_soru_indeksleri), 0) <> v_beklenen_soru
     OR EXISTS (
       SELECT 1
       FROM unnest(COALESCE(p_soru_indeksleri, ARRAY[]::integer[])) indeks
       WHERE indeks < 0 OR indeks >= jsonb_array_length(v_sorular)
     )
     OR (
       SELECT COUNT(*) FROM (
         SELECT DISTINCT indeks
         FROM unnest(COALESCE(p_soru_indeksleri, ARRAY[]::integer[])) indeks
       ) tekil
     ) <> v_beklenen_soru THEN
    RAISE EXCEPTION 'Soru kümesi geçersiz veya beklenen soru sayısıyla eşleşmiyor.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.cc_izleme_kayitlari ik
  SET tamamlandi_mi = true,
      izleme_bitis = clock_timestamp(),
      ileri_sarildi_mi = v_izleme.ileri_sarildi_mi,
      soru_indeksleri = CASE WHEN v_beklenen_soru > 0 THEN p_soru_indeksleri ELSE NULL END
  WHERE ik.izleme_id = p_izleme_id
  RETURNING ik.* INTO v_izleme;
  v_yeni := true;

  IF NOT v_izleme.ileri_sarildi_mi AND v_izleme.izleme_turu IN ('kendi_izleme', 'challenge') THEN
    IF v_video_puani > 0 THEN
      INSERT INTO public.cc_kazanilan_puanlar
        (bm_id, yayin_id, izleme_id, puan_turu, puan)
      VALUES
        (p_bm_id, v_izleme.yayin_id, p_izleme_id, 'izleme', v_video_puani)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_kazanilan = ROW_COUNT;
      IF v_kazanilan > 0 THEN v_kazanilan := v_video_puani; END IF;
    END IF;
  ELSIF NOT v_izleme.ileri_sarildi_mi AND v_izleme.izleme_turu = 'extra' THEN
    SELECT COUNT(*)::integer
    INTO v_tam_tekrar
    FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_bm_id
      AND ik.yayin_id = v_izleme.yayin_id
      AND ik.izleme_turu = 'extra'
      AND ik.tamamlandi_mi = true
      AND ik.ileri_sarildi_mi = false
      AND ik.izleme_baslangic >= COALESCE(p_extra_alt_sinir, date_trunc('month', clock_timestamp()));

    IF v_tam_tekrar = 2 AND v_extra_puani > 0 THEN
      INSERT INTO public.cc_kazanilan_puanlar
        (bm_id, yayin_id, izleme_id, puan_turu, puan)
      VALUES
        (p_bm_id, v_izleme.yayin_id, p_izleme_id, 'extra', v_extra_puani)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_kazanilan = ROW_COUNT;
      IF v_kazanilan > 0 THEN v_kazanilan := v_extra_puani; END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_yeni,
    v_kazanilan,
    v_beklenen_soru > 0,
    v_izleme.ileri_sarildi_mi,
    v_izleme.izleme_turu;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.cc_cevaplari_kaydet(
  p_izleme_id uuid,
  p_bm_id uuid,
  p_cevaplar jsonb
)
RETURNS TABLE (
  toplam_kazanim integer,
  toplam_kayip integer,
  referral_yazildi boolean,
  referral_gonderen_id uuid,
  referral_puani integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_izleme public.cc_izleme_kayitlari%ROWTYPE;
  v_sorular jsonb := '[]'::jsonb;
  v_soru_seti_durum_id uuid;
  v_gelen_indeksler integer[];
  v_atanan_indeksler integer[];
  v_cevap jsonb;
  v_indeks integer;
  v_verilen text;
  v_dogru text;
  v_puan integer;
  v_kazanim integer := 0;
  v_kayip integer := 0;
  v_challenge public.challenge_kayitlari%ROWTYPE;
  v_referral integer := 0;
  v_referral_yazildi boolean := false;
  v_satir integer := 0;
BEGIN
  SELECT ik.*
  INTO v_izleme
  FROM public.cc_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_izleme.bm_id <> p_bm_id THEN
    RAISE EXCEPTION 'İzleme kaydı BM kullanıcısına ait değil.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_izleme.tamamlandi_mi
     OR v_izleme.ileri_sarildi_mi
     OR COALESCE(cardinality(v_izleme.soru_indeksleri), 0) = 0 THEN
    RAISE EXCEPTION 'Bu izleme için cevaplanabilir soru bulunmuyor.' USING ERRCODE = 'P0001';
  END IF;
  IF v_izleme.cevaplandi_mi THEN
    RAISE EXCEPTION 'Bu izleme için sorular zaten cevaplandı.' USING ERRCODE = '23505';
  END IF;
  IF jsonb_typeof(p_cevaplar) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_cevaplar) = 0
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_cevaplar) cevap
       WHERE jsonb_typeof(cevap) <> 'object'
          OR jsonb_typeof(cevap->'soru_index') <> 'number'
          OR jsonb_typeof(cevap->'verilen_cevap') <> 'string'
          OR (cevap->>'soru_index') !~ '^[0-9]+$'
          OR btrim(cevap->>'verilen_cevap') = ''
     ) THEN
    RAISE EXCEPTION 'Cevap biçimi geçersiz.' USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY_AGG((cevap->>'soru_index')::integer ORDER BY (cevap->>'soru_index')::integer)
  INTO v_gelen_indeksler
  FROM jsonb_array_elements(p_cevaplar) cevap;

  SELECT ARRAY_AGG(indeks ORDER BY indeks)
  INTO v_atanan_indeksler
  FROM unnest(v_izleme.soru_indeksleri) indeks;

  IF v_gelen_indeksler IS DISTINCT FROM v_atanan_indeksler THEN
    RAISE EXCEPTION 'Cevaplar atanmış soru kümesiyle birebir eşleşmiyor.' USING ERRCODE = '22023';
  END IF;

  SELECT
    CASE WHEN jsonb_typeof(vyd.sorular) = 'array' THEN vyd.sorular ELSE '[]'::jsonb END,
    vyd.soru_seti_durum_id
  INTO v_sorular, v_soru_seti_durum_id
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yayın soru seti bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  FOR v_cevap IN SELECT value FROM jsonb_array_elements(p_cevaplar)
  LOOP
    v_indeks := (v_cevap->>'soru_index')::integer;
    v_verilen := v_cevap->>'verilen_cevap';

    IF v_indeks < 0 OR v_indeks >= jsonb_array_length(v_sorular) THEN
      RAISE EXCEPTION 'Cevaplanan soru güncel soru setinde bulunamadı.' USING ERRCODE = '22023';
    END IF;

    SELECT secenek->>'harf'
    INTO v_dogru
    FROM jsonb_array_elements(v_sorular->v_indeks->'secenekler') secenek
    WHERE COALESCE((secenek->>'dogru')::boolean, false)
    LIMIT 1;

    IF v_dogru IS NULL OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_sorular->v_indeks->'secenekler') secenek
      WHERE secenek->>'harf' = v_verilen
    ) THEN
      RAISE EXCEPTION 'Verilen cevap güncel soru seçenekleriyle eşleşmiyor.' USING ERRCODE = '22023';
    END IF;

    SELECT GREATEST(0, COALESCE(MAX(sp.soru_puani), 0))::integer
    INTO v_puan
    FROM public.soru_seti_puanlari sp
    WHERE sp.soru_seti_durum_id = v_soru_seti_durum_id
      AND sp.soru_index = v_indeks;

    IF v_verilen = v_dogru THEN
      IF v_puan > 0 THEN
        INSERT INTO public.cc_kazanilan_puanlar
          (bm_id, yayin_id, izleme_id, puan_turu, puan)
        VALUES
          (p_bm_id, v_izleme.yayin_id, p_izleme_id, 'cevaplama', v_puan);
      END IF;
      v_kazanim := v_kazanim + v_puan;
    ELSE
      INSERT INTO public.cc_yanlis_cevap_kayitlari
        (bm_id, yayin_id, izleme_id, soru_index, verilen_cevap, dogru_cevap, kaybedilen_puan)
      VALUES
        (p_bm_id, v_izleme.yayin_id, p_izleme_id, v_indeks, v_verilen, v_dogru, v_puan);
      v_kayip := v_kayip + v_puan;
    END IF;
  END LOOP;

  UPDATE public.cc_izleme_kayitlari
  SET cevaplandi_mi = true
  WHERE izleme_id = p_izleme_id;

  IF v_izleme.izleme_turu = 'challenge' AND v_izleme.challenge_id IS NOT NULL THEN
    SELECT ck.*
    INTO v_challenge
    FROM public.challenge_kayitlari ck
    WHERE ck.challenge_id = v_izleme.challenge_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_challenge.alan_id <> p_bm_id
       OR v_challenge.yayin_id <> v_izleme.yayin_id THEN
      RAISE EXCEPTION 'İzlemenin challenge bağı doğrulanamadı.' USING ERRCODE = 'P0001';
    END IF;
    IF v_challenge.son_tarih < clock_timestamp() THEN
      RAISE EXCEPTION 'Challenge süresi dolmuş.' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(MAX(
      CASE WHEN (sa.deger #>> '{}') ~ '^[0-9]+$' THEN (sa.deger #>> '{}')::integer END
    ), 10)
    INTO v_referral
    FROM public.sistem_ayarlari sa
    WHERE sa.anahtar = 'cc_referral_puani';

    INSERT INTO public.cc_kazanilan_puanlar
      (bm_id, yayin_id, challenge_id, izleme_id, puan_turu, puan)
    VALUES
      (v_challenge.gonderen_id, v_izleme.yayin_id, v_izleme.challenge_id,
       p_izleme_id, 'cc_referral', v_referral)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_satir = ROW_COUNT;
    v_referral_yazildi := v_satir > 0;

    UPDATE public.challenge_kayitlari
    SET izlendi_mi = true
    WHERE challenge_id = v_izleme.challenge_id;
  END IF;

  RETURN QUERY SELECT
    v_kazanim,
    v_kayip,
    v_referral_yazildi,
    CASE WHEN v_challenge.challenge_id IS NOT NULL THEN v_challenge.gonderen_id ELSE NULL END,
    CASE WHEN v_referral_yazildi THEN v_referral ELSE 0 END;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz)
  TO service_role;

REVOKE ALL ON FUNCTION public.cc_cevaplari_kaydet(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_cevaplari_kaydet(uuid, uuid, jsonb)
  TO service_role;

COMMIT;
