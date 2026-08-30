-- Soru Erişimi Kesinti Kuralı — Faz 2 (tamamlama RPC'leri)
--
-- Dört tamamlama RPC'si, İLK başarılı tamamlamada aynı transaction içinde
-- soru_erisimi_acik_mi alanını "soruya uygunsa" true yapar. Tekrarlanan/eski
-- tamamlama yollarına dokunulmaz (geçmiş sorular açılmaz).
-- Ek olarak cc_izleme_tamamla, video tamamlanınca challenge_kayitlari.izlendi_mi=true
-- yapar (referral VERMEZ — referral cc_cevaplari_kaydet'te kalır; izlendi_mi
-- tetikleyicisi yalnız bildirim kapatır).
--
-- Gövdeler canlı pg_get_functiondef çıktısından birebir alınmıştır; yalnız
-- işaretli satırlar eklenmiştir.
-- İskender tarafından Supabase SQL Editor'da çalıştırılır (tek transaction).

BEGIN;

-- ── 1. UTT ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.utt_izleme_tamamla(p_izleme_id uuid, p_kullanici_id uuid, p_soru_hakki_var_mi boolean, p_soru_hakki_nedeni text, p_soru_indeksleri integer[])
 RETURNS TABLE(izleme_id uuid, tamamlandi_mi boolean, yeni_tamamlandi boolean, soru_hakki_var_mi boolean, soru_hakki_nedeni text, soru_indeksleri integer[], izleme_bitis timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_izleme public.izleme_kayitlari%ROWTYPE;
  v_onayli_atlanan_sure integer;
BEGIN
  SELECT ik.*
  INTO v_izleme
  FROM public.izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF v_izleme.kullanici_id <> p_kullanici_id THEN
    RAISE EXCEPTION 'İzleme kaydı kullanıcıya ait değil.' USING ERRCODE = '42501';
  END IF;

  IF NOT v_izleme.gercek_oynatma_mi THEN
    RAISE EXCEPTION 'Yalın açılış kaydı tamamlanamaz.' USING ERRCODE = '22023';
  END IF;

  -- Ağ tekrarı mevcut kalıcı kararı aynen döndürür.
  IF COALESCE(v_izleme.tamamlandi_mi, false) THEN
    RETURN QUERY SELECT
      v_izleme.izleme_id,
      true,
      false,
      v_izleme.soru_hakki_var_mi,
      v_izleme.soru_hakki_nedeni,
      v_izleme.soru_indeksleri,
      v_izleme.izleme_bitis;
    RETURN;
  END IF;

  IF v_izleme.video_suresi_saniye IS NULL OR v_izleme.video_suresi_saniye <= 0 THEN
    RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(isk.atlanan_sure), 0)::integer
  INTO v_onayli_atlanan_sure
  FROM public.ileri_sarma_kayitlari isk
  WHERE isk.izleme_id = p_izleme_id;

  -- İstemci süre beyanı kullanılmaz. Sunucuda geçen süre + sunucunun onayladığı
  -- ileri sarma süresi, video süresine iki saniyelik toleransla ulaşmalıdır.
  IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic))
       + v_onayli_atlanan_sure
       < GREATEST(0, v_izleme.video_suresi_saniye - 2) THEN
    RAISE EXCEPTION 'Video henüz tamamlanabilecek kadar oynatılmadı.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.izleme_kayitlari ik
  SET tamamlandi_mi = true,
      izleme_bitis = clock_timestamp(),
      soru_hakki_var_mi = p_soru_hakki_var_mi,
      soru_hakki_nedeni = p_soru_hakki_nedeni,
      soru_erisimi_acik_mi = p_soru_hakki_var_mi,          -- [Faz 2] soru hakkı açıldıysa erişim açık
      soru_indeksleri = CASE
        WHEN p_soru_hakki_var_mi THEN p_soru_indeksleri
        ELSE NULL
      END
  WHERE ik.izleme_id = p_izleme_id
  RETURNING ik.* INTO v_izleme;

  RETURN QUERY SELECT
    v_izleme.izleme_id,
    true,
    true,
    v_izleme.soru_hakki_var_mi,
    v_izleme.soru_hakki_nedeni,
    v_izleme.soru_indeksleri,
    v_izleme.izleme_bitis;
END;
$function$;

-- ── 2. BM (Challenge) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cc_izleme_tamamla(p_izleme_id uuid, p_bm_id uuid, p_soru_indeksleri integer[] DEFAULT NULL::integer[], p_extra_alt_sinir timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(yeni_tamamlandi boolean, kazanilan_puan integer, soru_gosterilecek boolean, ileri_sarildi boolean, izleme_turu text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      soru_erisimi_acik_mi = (v_beklenen_soru > 0),         -- [Faz 2] soruya uygunsa erişim açık
      soru_indeksleri = CASE WHEN v_beklenen_soru > 0 THEN p_soru_indeksleri ELSE NULL END
  WHERE ik.izleme_id = p_izleme_id
  RETURNING ik.* INTO v_izleme;
  v_yeni := true;

  -- [Faz 2] Challenge izlemesinde video tamamlanınca izlendi_mi kalıcı olarak
  -- açılır (tetikleyici yalnız bildirim kapatır; REFERRAL BURADA VERİLMEZ).
  IF v_izleme.challenge_id IS NOT NULL THEN
    UPDATE public.challenge_kayitlari
    SET izlendi_mi = true
    WHERE challenge_id = v_izleme.challenge_id
      AND COALESCE(izlendi_mi, false) = false;
  END IF;

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
$function$;

-- ── 3. E-Club ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eclub_izleme_tamamla(p_izleme_id uuid, p_kisi_id uuid, p_tur_baslangic timestamp with time zone, p_soru_indeksleri integer[])
 RETURNS TABLE(yeni_tamamlandi boolean, puan_kazanildi boolean, izleme_puani integer, soru_gosterilecek boolean, soru_hakki_nedeni text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_izleme public.eclub_izleme_kayitlari%ROWTYPE;
  v_oneri public.eclub_oneri_kayitlari%ROWTYPE;
  v_urun_id uuid;
  v_video_puani integer := 0;
  v_video_suresi integer := 0;
  v_onayli_atlanan_sure integer := 0;
  v_pencere_acik boolean := false;
  v_ileri_sarildi boolean := false;
  v_yeni boolean := false;
BEGIN
  SELECT ik.* INTO v_izleme
  FROM public.eclub_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_izleme.kisi_id <> p_kisi_id THEN
    RAISE EXCEPTION 'İzleme kaydı kişiye ait değil.' USING ERRCODE = '42501';
  END IF;

  SELECT ok.* INTO v_oneri
  FROM public.eclub_oneri_kayitlari ok
  WHERE ok.oneri_id = v_izleme.oneri_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Öneri kaydı bulunamadı.' USING ERRCODE = 'P0002'; END IF;

  v_pencere_acik := clock_timestamp() BETWEEN v_oneri.oneri_baslangic AND v_oneri.oneri_bitis;
  SELECT EXISTS (
    SELECT 1 FROM public.eclub_ileri_sarma_kayitlari k
    WHERE k.izleme_id = p_izleme_id
  ) INTO v_ileri_sarildi;

  IF NOT COALESCE(v_izleme.tamamlandi_mi, false) THEN
    -- Süre önce izleme kaydının SNAPSHOT'ından (UTT deseni). Yoksa (bu değişiklikten
    -- önce açılmış izleme) geriye dönük olarak canlı videolar'dan çözülür.
    v_video_suresi := COALESCE(v_izleme.video_suresi_saniye, 0);
    IF v_video_suresi <= 0 THEN
      SELECT COALESCE(v.video_suresi_saniye, 0)
      INTO v_video_suresi
      FROM public.v_yayin_detay vyd
      JOIN public.video_durumu vd ON vd.video_durum_id = vyd.video_durum_id
      JOIN public.videolar v ON v.video_id = vd.video_id
      WHERE vyd.yayin_id = v_izleme.yayin_id;
    END IF;

    IF v_video_suresi <= 0 THEN
      RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(SUM(k.atlanan_sure), 0)::integer
    INTO v_onayli_atlanan_sure
    FROM public.eclub_ileri_sarma_kayitlari k
    WHERE k.izleme_id = p_izleme_id;

    IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic))
         + v_onayli_atlanan_sure
         < GREATEST(0, v_video_suresi - 2) THEN
      RAISE EXCEPTION 'Video henüz tamamlanabilecek kadar oynatılmadı.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.eclub_izleme_kayitlari ik
    SET tamamlandi_mi = true,
        izleme_bitis = clock_timestamp(),
        soru_hakki_var_mi = v_pencere_acik
          AND NOT v_ileri_sarildi
          AND COALESCE(cardinality(p_soru_indeksleri), 0) > 0,
        soru_erisimi_acik_mi = v_pencere_acik              -- [Faz 2] soruya uygunsa erişim açık
          AND NOT v_ileri_sarildi
          AND COALESCE(cardinality(p_soru_indeksleri), 0) > 0,
        soru_hakki_nedeni = CASE
          WHEN NOT v_pencere_acik THEN 'sure_gecmis'
          WHEN v_ileri_sarildi THEN 'ileri_sarma'
          WHEN COALESCE(cardinality(p_soru_indeksleri), 0) = 0 THEN 'soru_yok'
          ELSE 'hak_var'
        END,
        soru_indeksleri = CASE
          WHEN v_pencere_acik AND NOT v_ileri_sarildi THEN p_soru_indeksleri
          ELSE NULL
        END
    WHERE ik.izleme_id = p_izleme_id
    RETURNING ik.* INTO v_izleme;
    v_yeni := true;

    UPDATE public.eclub_oneri_kayitlari
    SET izlendi_mi = true
    WHERE oneri_id = v_oneri.oneri_id AND COALESCE(izlendi_mi, false) = false;

    IF v_pencere_acik THEN
      SELECT COALESCE(vyd.video_puani, 0)
      INTO v_video_puani
      FROM public.v_yayin_detay vyd
      WHERE vyd.yayin_id = v_izleme.yayin_id;

      SELECT public.get_urun_from_yayin(v_izleme.yayin_id) INTO v_urun_id;

      IF v_video_puani > 0 AND NOT EXISTS (
        SELECT 1 FROM public.eclub_kazanilan_puanlar kp
        WHERE kp.kisi_id = p_kisi_id
          AND kp.yayin_id = v_izleme.yayin_id
          AND kp.puan_turu = 'izleme'
          AND kp.created_at >= p_tur_baslangic
      ) THEN
        INSERT INTO public.eclub_kazanilan_puanlar
          (kisi_id, yayin_id, izleme_id, puan_turu, puan, urun_id)
        VALUES
          (p_kisi_id, v_izleme.yayin_id, p_izleme_id, 'izleme', v_video_puani, v_urun_id)
        ON CONFLICT (izleme_id, puan_turu) DO NOTHING;
      END IF;

      INSERT INTO public.eclub_utt_puanlari
        (utt_id, kisi_id, yayin_id, izleme_id, oneri_id, urun_id, puan)
      VALUES
        (v_oneri.oneren_id, p_kisi_id, v_izleme.yayin_id, p_izleme_id, v_oneri.oneri_id, v_urun_id, 10)
      ON CONFLICT (oneri_id) DO NOTHING;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_yeni,
    EXISTS (
      SELECT 1 FROM public.eclub_kazanilan_puanlar kp
      WHERE kp.izleme_id = p_izleme_id AND kp.puan_turu = 'izleme'
    ),
    COALESCE((
      SELECT SUM(kp.puan)::integer FROM public.eclub_kazanilan_puanlar kp
      WHERE kp.izleme_id = p_izleme_id AND kp.puan_turu = 'izleme'
    ), 0),
    COALESCE(v_izleme.soru_hakki_var_mi, false)
      AND NOT EXISTS (SELECT 1 FROM public.eclub_dogru_cevap_kayitlari WHERE izleme_id = p_izleme_id)
      AND NOT EXISTS (SELECT 1 FROM public.eclub_yanlis_cevap_kayitlari WHERE izleme_id = p_izleme_id),
    COALESCE(v_izleme.soru_hakki_nedeni, 'uygun_degil');
END;
$function$;

-- ── 4. Eczanem (Müşteri) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eczanem_izleme_tamamla(p_izleme_id uuid, p_musteri_id uuid, p_soru_indeksleri integer[])
 RETURNS TABLE(yeni_tamamlandi boolean, puan_kazanildi boolean, izleme_puani integer, soru_gosterilecek boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
        soru_erisimi_acik_mi = (COALESCE(cardinality(p_soru_indeksleri), 0) > 0),  -- [Faz 2] soruya uygunsa erişim açık
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
    -- sabit soru modeliyle uyumlu hâle getirir. (Geçmiş erişim AÇILMAZ.)
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
$function$;

COMMIT;

-- Uygulama sonrası doğrulama: dört RPC de yeni alanı yazıyor mu?
SELECT
  position('soru_erisimi_acik_mi' IN pg_get_functiondef('public.utt_izleme_tamamla(uuid,uuid,boolean,text,integer[])'::regprocedure)) > 0    AS utt_ok,
  position('soru_erisimi_acik_mi' IN pg_get_functiondef('public.cc_izleme_tamamla(uuid,uuid,integer[],timestamptz)'::regprocedure)) > 0        AS cc_soru_ok,
  position('challenge_kayitlari'  IN pg_get_functiondef('public.cc_izleme_tamamla(uuid,uuid,integer[],timestamptz)'::regprocedure)) > 0        AS cc_izlendi_ok,
  position('soru_erisimi_acik_mi' IN pg_get_functiondef('public.eclub_izleme_tamamla(uuid,uuid,timestamptz,integer[])'::regprocedure)) > 0     AS eclub_ok,
  position('soru_erisimi_acik_mi' IN pg_get_functiondef('public.eczanem_izleme_tamamla(uuid,uuid,integer[])'::regprocedure)) > 0              AS eczanem_ok;
