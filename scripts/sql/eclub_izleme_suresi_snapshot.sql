-- E-Club izlemeyi UTT desenine hizala: süreyi izleme başlarken kayda snapshot'la,
-- tamamlamada canlı videolar yerine snapshot'tan yargıla. (Tek yazıcı bozulmaz —
-- videolar'a YAZMAZ; videolar'dan OKUYUP eclub_izleme_kayitlari'na kopyalar.)
--
-- İki komut; Supabase'de AYRI AYRI koşulur. Önce Part A, sonra Part C.

-- ── Part A: eclub_izleme_kayitlari'na süre snapshot kolonu ────────────────────
ALTER TABLE public.eclub_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS video_suresi_saniye integer;

-- ── Part C: tamamlama RPC — süre snapshot'tan (geriye dönük: yoksa canlı fallback) ─
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
