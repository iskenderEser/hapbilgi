-- C-Club tamamlamasını video, podcast, görsel ve Flip PDF için ortaklaştırır.
-- Video sunucu süresi/ileri sarma kaydıyla, diğer araçlar ortak kanıtla doğrulanır.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-cc-ortak-arac-tamamlama-v1', 1));

CREATE OR REPLACE FUNCTION public.cc_izleme_tamamla(
  p_izleme_id uuid,
  p_bm_id uuid,
  p_soru_indeksleri integer[] DEFAULT NULL,
  p_extra_alt_sinir timestamptz DEFAULT NULL
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
  v_arac_id uuid;
  v_arac_turu text;
  v_arac_suresi integer := 0;
  v_arac_puani integer := 0;
  v_sorular jsonb := '[]'::jsonb;
  v_extra_puani integer := 0;
  v_gosterilecek_soru integer := 0;
  v_beklenen_soru integer := 0;
  v_atlanan_sure integer := 0;
  v_tam_tekrar integer := 0;
  v_kazanilan integer := 0;
  v_kanit_gecerli boolean := false;
  v_yeni boolean := false;
BEGIN
  SELECT ik.* INTO v_izleme
  FROM public.cc_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_izleme.bm_id <> p_bm_id THEN
    RAISE EXCEPTION 'İzleme kaydı BM kullanıcısına ait değil.' USING ERRCODE = '42501';
  END IF;

  SELECT
    vyd.arac_id,
    vyd.arac_turu,
    COALESCE(v_izleme.video_suresi_saniye, vyd.arac_sure_saniye, vyd.video_suresi_saniye, 0),
    GREATEST(0, COALESCE(vyd.ogrenme_araci_puani, 0)),
    CASE WHEN jsonb_typeof(vyd.sorular) = 'array' THEN vyd.sorular ELSE '[]'::jsonb END,
    GREATEST(0, COALESCE(vyd.video_basi_soru_sayisi, 2))
  INTO v_arac_id, v_arac_turu, v_arac_suresi, v_arac_puani, v_sorular, v_gosterilecek_soru
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND OR v_arac_id IS NULL THEN
    RAISE EXCEPTION 'Yayın detayı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_izleme.arac_id <> v_arac_id OR v_izleme.arac_turu <> v_arac_turu THEN
    RAISE EXCEPTION 'İzleme ve yayın öğrenme aracı bağı uyuşmuyor.' USING ERRCODE = '23514';
  END IF;
  IF v_izleme.challenge_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.challenge_id = v_izleme.challenge_id
      AND ck.alan_id = p_bm_id
      AND ck.yayin_id = v_izleme.yayin_id
      AND ck.arac_id = v_arac_id
      AND ck.arac_turu = v_arac_turu
  ) THEN
    RAISE EXCEPTION 'Challenge ve izleme öğrenme aracı bağı uyuşmuyor.' USING ERRCODE = '23514';
  END IF;

  IF COALESCE(v_izleme.tamamlandi_mi, false) THEN
    SELECT COALESCE(sum(kp.puan), 0)::integer INTO v_kazanilan
    FROM public.cc_kazanilan_puanlar kp
    WHERE kp.izleme_id = p_izleme_id
      AND kp.puan_turu IN ('izleme', 'extra');

    RETURN QUERY SELECT
      false,
      v_kazanilan,
      COALESCE(v_izleme.soru_erisimi_acik_mi, false)
        AND COALESCE(cardinality(v_izleme.soru_indeksleri), 0) > 0
        AND NOT COALESCE(v_izleme.cevaplandi_mi, false),
      v_izleme.ileri_sarildi_mi,
      v_izleme.izleme_turu;
    RETURN;
  END IF;

  IF v_arac_turu = 'video' THEN
    IF v_arac_suresi <= 0 THEN
      RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(sum(isk.atlanan_sure), 0)::integer INTO v_atlanan_sure
    FROM public.cc_ileri_sarma_kayitlari isk
    WHERE isk.izleme_id = p_izleme_id;
    v_izleme.ileri_sarildi_mi := v_izleme.ileri_sarildi_mi OR v_atlanan_sure > 0;

    IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic))
         + v_atlanan_sure < GREATEST(0, v_arac_suresi - 2) THEN
      RAISE EXCEPTION 'Video henüz tamamlanabilecek kadar oynatılmadı.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_arac_turu = 'podcast' THEN
    v_kanit_gecerli := CASE
      WHEN v_izleme.tamamlama_kaniti->>'aracTuru' = 'podcast'
       AND v_izleme.tamamlama_kaniti->>'surum' = '1'
       AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'dogrulanmisSaniye') = 'number'
      THEN (v_izleme.tamamlama_kaniti->'veri'->>'dogrulanmisSaniye')::numeric > 0
       AND v_izleme.tamamlama_kaniti->'veri'->'sonaUlasti' = 'true'::jsonb
      ELSE false
    END;
  ELSIF v_arac_turu = 'gorsel' THEN
    v_kanit_gecerli := CASE
      WHEN v_izleme.tamamlama_kaniti->>'aracTuru' = 'gorsel'
       AND v_izleme.tamamlama_kaniti->>'surum' = '1'
       AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'aktifIncelemeSaniye') = 'number'
      THEN (v_izleme.tamamlama_kaniti->'veri'->>'aktifIncelemeSaniye')::numeric > 0
       AND v_izleme.tamamlama_kaniti->'veri'->'kullaniciOnayi' = 'true'::jsonb
      ELSE false
    END;
  ELSIF v_arac_turu = 'flip_pdf' THEN
    v_kanit_gecerli := CASE
      WHEN v_izleme.tamamlama_kaniti->>'aracTuru' = 'flip_pdf'
       AND v_izleme.tamamlama_kaniti->>'surum' = '1'
       AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'toplamSayfa') = 'number'
       AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'okunanSayfalar') = 'array'
      THEN (v_izleme.tamamlama_kaniti->'veri'->>'toplamSayfa')::integer > 0
       AND jsonb_array_length(v_izleme.tamamlama_kaniti->'veri'->'okunanSayfalar')
         >= (v_izleme.tamamlama_kaniti->'veri'->>'toplamSayfa')::integer
      ELSE false
    END;
  ELSE
    RAISE EXCEPTION 'Öğrenme aracı türü desteklenmiyor.' USING ERRCODE = '23514';
  END IF;

  IF v_arac_turu <> 'video' AND NOT COALESCE(v_kanit_gecerli, false) THEN
    RAISE EXCEPTION 'Öğrenme aracı tamamlama kanıtı doğrulanmadı.' USING ERRCODE = 'P0001';
  END IF;

  SELECT GREATEST(0, COALESCE(yy.extra_puan, 0)) INTO v_extra_puani
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
       SELECT 1 FROM unnest(COALESCE(p_soru_indeksleri, ARRAY[]::integer[])) indeks
       WHERE indeks < 0 OR indeks >= jsonb_array_length(v_sorular)
     )
     OR (
       SELECT count(*) FROM (
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
      video_suresi_saniye = CASE WHEN v_arac_turu = 'video' THEN v_arac_suresi ELSE ik.video_suresi_saniye END,
      soru_erisimi_acik_mi = (v_beklenen_soru > 0),
      soru_indeksleri = CASE WHEN v_beklenen_soru > 0 THEN p_soru_indeksleri ELSE NULL END
  WHERE ik.izleme_id = p_izleme_id
  RETURNING ik.* INTO v_izleme;
  v_yeni := true;

  IF v_izleme.challenge_id IS NOT NULL THEN
    UPDATE public.challenge_kayitlari
    SET izlendi_mi = true
    WHERE challenge_id = v_izleme.challenge_id
      AND COALESCE(izlendi_mi, false) = false;
  END IF;

  IF NOT v_izleme.ileri_sarildi_mi AND v_izleme.izleme_turu IN ('kendi_izleme', 'challenge') THEN
    IF v_arac_puani > 0 THEN
      INSERT INTO public.cc_kazanilan_puanlar
        (bm_id, yayin_id, izleme_id, puan_turu, puan)
      VALUES
        (p_bm_id, v_izleme.yayin_id, p_izleme_id, 'izleme', v_arac_puani)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_kazanilan = ROW_COUNT;
      IF v_kazanilan > 0 THEN v_kazanilan := v_arac_puani; END IF;
    END IF;
  ELSIF NOT v_izleme.ileri_sarildi_mi AND v_izleme.izleme_turu = 'extra' THEN
    SELECT count(*)::integer INTO v_tam_tekrar
    FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_bm_id
      AND ik.arac_id = v_arac_id
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

REVOKE ALL ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz)
  TO service_role;

COMMIT;

SELECT
  position('tamamlama_kaniti' IN lower(pg_get_functiondef('public.cc_izleme_tamamla(uuid,uuid,integer[],timestamptz)'::regprocedure))) > 0 AS kanit_kontrolu_var,
  position('ogrenme_araci_puani' IN lower(pg_get_functiondef('public.cc_izleme_tamamla(uuid,uuid,integer[],timestamptz)'::regprocedure))) > 0 AS ortak_puan_var;
