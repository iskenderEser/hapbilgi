-- Soru Erişimi Kesinti Kuralı — Faz 5 (cevap RPC'leri)
--
-- Üç cevap RPC'si (BM/E-Club/müşteri) izleme satırını FOR UPDATE kilitler:
--   1. soru_erisimi_acik_mi = true değilse cevap REDDEDİLİR (kapanmış hakla
--      cevap yazılamaz; atomik, eşzamanlı ikinci isteği de keser).
--   2. Başarılı kayıtta soru_erisimi_acik_mi = false yapılır.
-- cc_cevaplari_kaydet ayrıca artık challenge_kayitlari.izlendi_mi = true YAPMAZ
--   (bu, Faz 2'de video tamamlanırken cc_izleme_tamamla içinde yapılıyor).
--   Referral yalnız cevap başarıyla kaydedilince verilmeye devam eder.
--
-- Gövdeler canlı pg_get_functiondef çıktısından birebir; yalnız [Faz 5] işaretli
-- satırlar eklenmiş/çıkarılmıştır. İskender tarafından çalıştırılır (tek transaction).

BEGIN;

-- ── 1. BM (Challenge) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cc_cevaplari_kaydet(p_izleme_id uuid, p_bm_id uuid, p_cevaplar jsonb)
 RETURNS TABLE(toplam_kazanim integer, toplam_kayip integer, referral_yazildi boolean, referral_gonderen_id uuid, referral_puani integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  -- [Faz 5] Kapanmış soru hakkıyla (yeniden başlatılmış izleme) cevap yazılamaz.
  IF NOT COALESCE(v_izleme.soru_erisimi_acik_mi, false) THEN
    RAISE EXCEPTION 'Bu izleme için soru hakkı kapanmıştır.' USING ERRCODE = 'P0001';
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
  SET cevaplandi_mi = true,
      soru_erisimi_acik_mi = false             -- [Faz 5] cevaplandı: hak kapanır
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

    -- [Faz 5] challenge_kayitlari.izlendi_mi = true GÜNCELLEMESİ KALDIRILDI:
    -- artık video tamamlanınca cc_izleme_tamamla içinde yapılıyor.
  END IF;

  RETURN QUERY SELECT
    v_kazanim,
    v_kayip,
    v_referral_yazildi,
    CASE WHEN v_challenge.challenge_id IS NOT NULL THEN v_challenge.gonderen_id ELSE NULL END,
    CASE WHEN v_referral_yazildi THEN v_referral ELSE 0 END;
END;
$function$;

-- ── 2. E-Club ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eclub_cevaplari_kaydet(p_izleme_id uuid, p_kisi_id uuid, p_sonuclar jsonb)
 RETURNS TABLE(kazanilan_puan integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_izleme public.eclub_izleme_kayitlari%ROWTYPE;
  v_oneri public.eclub_oneri_kayitlari%ROWTYPE;
  v_urun_id uuid;
  v_sonuc jsonb;
  v_toplam integer := 0;
  v_gelen_indeksler integer[];
BEGIN
  SELECT ik.* INTO v_izleme
  FROM public.eclub_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_izleme.kisi_id <> p_kisi_id THEN
    RAISE EXCEPTION 'İzleme kaydı kişiye ait değil.' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(v_izleme.tamamlandi_mi, false) OR NOT COALESCE(v_izleme.soru_hakki_var_mi, false) THEN
    RAISE EXCEPTION 'Bu izleme için soru hakkı bulunmuyor.' USING ERRCODE = 'P0001';
  END IF;
  -- [Faz 5] Kapanmış soru hakkıyla (yeniden başlatılmış izleme) cevap yazılamaz.
  IF NOT COALESCE(v_izleme.soru_erisimi_acik_mi, false) THEN
    RAISE EXCEPTION 'Bu izleme için soru hakkı kapanmıştır.' USING ERRCODE = 'P0001';
  END IF;

  SELECT ok.* INTO v_oneri
  FROM public.eclub_oneri_kayitlari ok
  WHERE ok.oneri_id = v_izleme.oneri_id;
  IF NOT FOUND OR clock_timestamp() NOT BETWEEN v_oneri.oneri_baslangic AND v_oneri.oneri_bitis THEN
    RAISE EXCEPTION 'Süresi geçmiş öneride soru cevaplanamaz.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.eclub_dogru_cevap_kayitlari WHERE izleme_id = p_izleme_id)
     OR EXISTS (SELECT 1 FROM public.eclub_yanlis_cevap_kayitlari WHERE izleme_id = p_izleme_id) THEN
    RAISE EXCEPTION 'Bu izleme için sorular zaten cevaplandı.' USING ERRCODE = '23505';
  END IF;

  SELECT ARRAY_AGG((deger->>'soru_index')::integer ORDER BY (deger->>'soru_index')::integer)
  INTO v_gelen_indeksler
  FROM jsonb_array_elements(p_sonuclar) deger;

  IF v_gelen_indeksler IS DISTINCT FROM (
    SELECT ARRAY_AGG(indeks ORDER BY indeks) FROM unnest(v_izleme.soru_indeksleri) indeks
  ) THEN
    RAISE EXCEPTION 'Cevaplar atanmış soru kümesiyle eşleşmiyor.' USING ERRCODE = '22023';
  END IF;

  SELECT public.get_urun_from_yayin(v_izleme.yayin_id) INTO v_urun_id;

  FOR v_sonuc IN SELECT value FROM jsonb_array_elements(p_sonuclar)
  LOOP
    IF (v_sonuc->>'dogru_mu')::boolean THEN
      INSERT INTO public.eclub_dogru_cevap_kayitlari
        (kisi_id, yayin_id, izleme_id, soru_index, kazanilan_puan, urun_id)
      VALUES
        (p_kisi_id, v_izleme.yayin_id, p_izleme_id, (v_sonuc->>'soru_index')::integer,
         GREATEST(0, (v_sonuc->>'kazanilan_puan')::integer), v_urun_id);
      v_toplam := v_toplam + GREATEST(0, (v_sonuc->>'kazanilan_puan')::integer);
    ELSE
      INSERT INTO public.eclub_yanlis_cevap_kayitlari
        (kisi_id, yayin_id, izleme_id, soru_index, kaybedilen_puan, urun_id)
      VALUES
        (p_kisi_id, v_izleme.yayin_id, p_izleme_id, (v_sonuc->>'soru_index')::integer, 0, v_urun_id);
    END IF;
  END LOOP;

  IF v_toplam > 0 THEN
    INSERT INTO public.eclub_kazanilan_puanlar
      (kisi_id, yayin_id, izleme_id, puan_turu, puan, urun_id)
    VALUES
      (p_kisi_id, v_izleme.yayin_id, p_izleme_id, 'cevaplama', v_toplam, v_urun_id)
    ON CONFLICT (izleme_id, puan_turu) DO NOTHING;
  END IF;

  -- [Faz 5] cevaplandı: soru hakkı kapanır (eclub'da ayrı cevaplandi_mi kolonu yok).
  UPDATE public.eclub_izleme_kayitlari
  SET soru_erisimi_acik_mi = false
  WHERE izleme_id = p_izleme_id;

  RETURN QUERY SELECT v_toplam;
END;
$function$;

-- ── 3. Eczanem (Müşteri) — çekirdek ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.eczanem_cevaplari_kaydet_cekirdek(p_izleme_id uuid, p_musteri_id uuid, p_sonuclar jsonb)
 RETURNS TABLE(kazanilan_puan integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  -- [Faz 5] Kapanmış soru hakkıyla (yeniden başlatılmış izleme) cevap yazılamaz.
  IF NOT COALESCE(v_izleme.soru_erisimi_acik_mi, false) THEN
    RAISE EXCEPTION 'Bu izleme için soru hakkı kapanmıştır.' USING ERRCODE = 'P0001';
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
  SET cevaplandi_mi = true,
      soru_erisimi_acik_mi = false             -- [Faz 5] cevaplandı: hak kapanır
  WHERE izleme_id = p_izleme_id;

  RETURN QUERY SELECT v_toplam;
END;
$function$;

COMMIT;

-- Uygulama sonrası doğrulama: üçü de yeni kapıyı içeriyor mu, cc izlendi_mi'yi
-- artık cevap içinde yazmıyor mu?
SELECT
  position('soru_erisimi_acik_mi' IN pg_get_functiondef('public.cc_cevaplari_kaydet(uuid,uuid,jsonb)'::regprocedure)) > 0                     AS cc_kapi_ok,
  position('izlendi_mi'           IN pg_get_functiondef('public.cc_cevaplari_kaydet(uuid,uuid,jsonb)'::regprocedure)) = 0                       AS cc_izlendi_kaldirildi,
  position('soru_erisimi_acik_mi' IN pg_get_functiondef('public.eclub_cevaplari_kaydet(uuid,uuid,jsonb)'::regprocedure)) > 0                  AS eclub_kapi_ok,
  position('soru_erisimi_acik_mi' IN pg_get_functiondef('public.eczanem_cevaplari_kaydet_cekirdek(uuid,uuid,jsonb)'::regprocedure)) > 0       AS eczanem_kapi_ok;
