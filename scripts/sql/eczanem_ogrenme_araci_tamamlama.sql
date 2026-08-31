-- Eczanem müşteri tamamlamasını dört öğrenme aracı için ortaklaştırır.
-- Video sunucu süresiyle, diğer araçlar ortak tamamlama kanıtıyla doğrulanır.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eczanem-ortak-arac-tamamlama-v1', 1));

DO $kisit$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='eczanem_izleme_kayitlari_arac_turu_ck' AND conrelid='public.eczanem_izleme_kayitlari'::regclass) THEN
    ALTER TABLE public.eczanem_izleme_kayitlari
      ADD CONSTRAINT eczanem_izleme_kayitlari_arac_turu_ck
      CHECK (arac_turu IN ('video','podcast','gorsel','flip_pdf'));
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
  v_gonderim public.eczanem_gonderimler%ROWTYPE;
  v_eczane_id uuid;
  v_urun_id uuid;
  v_firma_id uuid;
  v_arac_id uuid;
  v_arac_turu text;
  v_arac_suresi integer := 0;
  v_arac_puani integer := 0;
  v_sorular jsonb := '[]'::jsonb;
  v_gosterilecek_soru integer := 0;
  v_beklenen_soru integer := 0;
  v_kanit_gecerli boolean := false;
  v_yeni boolean := false;
  v_puan_yazildi boolean := false;
BEGIN
  SELECT ik.* INTO v_izleme
  FROM public.eczanem_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE='P0002'; END IF;
  IF v_izleme.musteri_id <> p_musteri_id THEN
    RAISE EXCEPTION 'İzleme kaydı müşteriye ait değil.' USING ERRCODE='42501';
  END IF;

  SELECT g.* INTO v_gonderim
  FROM public.eczanem_gonderimler g
  WHERE g.gonderim_id = v_izleme.gonderim_id
    AND g.musteri_id = p_musteri_id
    AND g.yayin_id = v_izleme.yayin_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İzlemenin gönderim bağı doğrulanamadı.' USING ERRCODE='P0001'; END IF;
  v_eczane_id := v_gonderim.eczane_id;

  SELECT
    vyd.arac_id,
    vyd.arac_turu,
    COALESCE(v_izleme.video_suresi_saniye, vyd.arac_sure_saniye, vyd.video_suresi_saniye, 0),
    COALESCE(vyd.ogrenme_araci_puani, 0),
    CASE WHEN jsonb_typeof(vyd.sorular)='array' THEN vyd.sorular ELSE '[]'::jsonb END,
    GREATEST(0, COALESCE(vyd.video_basi_soru_sayisi, 2))
  INTO v_arac_id, v_arac_turu, v_arac_suresi, v_arac_puani, v_sorular, v_gosterilecek_soru
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND OR v_arac_id IS NULL THEN RAISE EXCEPTION 'Yayın detayı bulunamadı.' USING ERRCODE='P0002'; END IF;
  IF v_gonderim.arac_id <> v_arac_id
     OR v_gonderim.arac_turu <> v_arac_turu
     OR v_izleme.arac_turu <> v_arac_turu THEN
    RAISE EXCEPTION 'Gönderim, izleme ve yayın öğrenme aracı bağı uyuşmuyor.' USING ERRCODE='23514';
  END IF;

  v_beklenen_soru := LEAST(jsonb_array_length(v_sorular), v_gosterilecek_soru);
  IF COALESCE(cardinality(p_soru_indeksleri), 0) <> v_beklenen_soru THEN
    RAISE EXCEPTION 'Soru kümesi beklenen soru sayısıyla eşleşmiyor.' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_soru_indeksleri, ARRAY[]::integer[])) indeks
    WHERE indeks < 0 OR indeks >= jsonb_array_length(v_sorular)
  ) OR (
    SELECT count(*) FROM (SELECT DISTINCT indeks FROM unnest(COALESCE(p_soru_indeksleri, ARRAY[]::integer[])) indeks) tekil
  ) <> v_beklenen_soru THEN
    RAISE EXCEPTION 'Soru kümesi geçersiz veya mükerrer indeks içeriyor.' USING ERRCODE='22023';
  END IF;

  IF NOT COALESCE(v_izleme.tamamlandi_mi, false) THEN
    IF v_arac_turu = 'video' THEN
      IF v_arac_suresi <= 0 THEN RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE='22023'; END IF;
      IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic)) < GREATEST(0, v_arac_suresi - 2) THEN
        RAISE EXCEPTION 'Video henüz tamamlanabilecek kadar oynatılmadı.' USING ERRCODE='P0001';
      END IF;
    ELSIF v_arac_turu = 'podcast' THEN
      v_kanit_gecerli := CASE WHEN v_izleme.tamamlama_kaniti->>'aracTuru'='podcast' AND v_izleme.tamamlama_kaniti->>'surum'='1'
        AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'dogrulanmisSaniye')='number'
        THEN (v_izleme.tamamlama_kaniti->'veri'->>'dogrulanmisSaniye')::numeric > 0
          AND v_izleme.tamamlama_kaniti->'veri'->'sonaUlasti'='true'::jsonb ELSE false END;
    ELSIF v_arac_turu = 'gorsel' THEN
      v_kanit_gecerli := CASE WHEN v_izleme.tamamlama_kaniti->>'aracTuru'='gorsel' AND v_izleme.tamamlama_kaniti->>'surum'='1'
        AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'aktifIncelemeSaniye')='number'
        THEN (v_izleme.tamamlama_kaniti->'veri'->>'aktifIncelemeSaniye')::numeric > 0
          AND v_izleme.tamamlama_kaniti->'veri'->'kullaniciOnayi'='true'::jsonb ELSE false END;
    ELSIF v_arac_turu = 'flip_pdf' THEN
      v_kanit_gecerli := CASE WHEN v_izleme.tamamlama_kaniti->>'aracTuru'='flip_pdf' AND v_izleme.tamamlama_kaniti->>'surum'='1'
        AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'toplamSayfa')='number'
        AND jsonb_typeof(v_izleme.tamamlama_kaniti->'veri'->'okunanSayfalar')='array'
        THEN (v_izleme.tamamlama_kaniti->'veri'->>'toplamSayfa')::integer > 0
          AND jsonb_array_length(v_izleme.tamamlama_kaniti->'veri'->'okunanSayfalar') >= (v_izleme.tamamlama_kaniti->'veri'->>'toplamSayfa')::integer
        ELSE false END;
    ELSE
      RAISE EXCEPTION 'Öğrenme aracı türü desteklenmiyor.' USING ERRCODE='23514';
    END IF;

    IF v_arac_turu <> 'video' AND NOT COALESCE(v_kanit_gecerli, false) THEN
      RAISE EXCEPTION 'Öğrenme aracı tamamlama kanıtı doğrulanmadı.' USING ERRCODE='P0001';
    END IF;

    UPDATE public.eczanem_izleme_kayitlari ik
    SET tamamlandi_mi=true,
        izleme_bitis=clock_timestamp(),
        video_suresi_saniye=CASE WHEN v_arac_turu='video' THEN v_arac_suresi ELSE video_suresi_saniye END,
        soru_erisimi_acik_mi=(COALESCE(cardinality(p_soru_indeksleri),0)>0),
        soru_indeksleri=p_soru_indeksleri
    WHERE ik.izleme_id=p_izleme_id
    RETURNING ik.* INTO v_izleme;
    v_yeni := true;

    IF v_arac_puani > 0 THEN
      SELECT public.get_urun_from_yayin(v_izleme.yayin_id) INTO v_urun_id;
      IF v_urun_id IS NULL THEN RAISE EXCEPTION 'Yayının ürün bağı çözülemedi.' USING ERRCODE='P0001'; END IF;
      SELECT u.firma_id INTO v_firma_id FROM public.urunler u WHERE u.urun_id=v_urun_id;
      IF NOT FOUND OR v_firma_id IS NULL THEN RAISE EXCEPTION 'Ürünün firma bağı çözülemedi.' USING ERRCODE='P0001'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.eczanem_puan_kayitlari pk WHERE pk.izleme_id=p_izleme_id AND pk.puan_turu='izleme') THEN
        INSERT INTO public.eczanem_puan_kayitlari
          (musteri_id,eczane_id,firma_id,urun_id,izleme_id,puan_turu,puan,kalan_puan)
        VALUES (p_musteri_id,v_eczane_id,v_firma_id,v_urun_id,p_izleme_id,'izleme',v_arac_puani,v_arac_puani);
        v_puan_yazildi := true;
      END IF;
    END IF;
  ELSIF v_izleme.soru_indeksleri IS NULL AND NOT COALESCE(v_izleme.cevaplandi_mi,false) THEN
    UPDATE public.eczanem_izleme_kayitlari ik SET soru_indeksleri=p_soru_indeksleri
    WHERE ik.izleme_id=p_izleme_id RETURNING ik.* INTO v_izleme;
  END IF;

  RETURN QUERY SELECT v_yeni, v_puan_yazildi,
    CASE WHEN v_puan_yazildi THEN v_arac_puani ELSE 0 END,
    COALESCE(v_izleme.soru_erisimi_acik_mi,false)
      AND COALESCE(cardinality(v_izleme.soru_indeksleri),0)>0
      AND NOT COALESCE(v_izleme.cevaplandi_mi,false);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_izleme_tamamla(uuid,uuid,integer[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_izleme_tamamla(uuid,uuid,integer[]) TO service_role;

COMMIT;

SELECT
  position('tamamlama_kaniti' IN lower(pg_get_functiondef('public.eczanem_izleme_tamamla(uuid,uuid,integer[])'::regprocedure))) > 0 AS kanit_kontrolu_var,
  position('ogrenme_araci_puani' IN lower(pg_get_functiondef('public.eczanem_izleme_tamamla(uuid,uuid,integer[])'::regprocedure))) > 0 AS ortak_puan_var;
