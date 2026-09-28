-- ==========================================================================
-- FAZ 1B — E-Club puan yazma fonksiyonlarında eczane snapshot'ı
-- ==========================================================================
-- Bağımlılık: scripts/sql/eclub_puan_eczane_sabitleme.sql (Faz 1A)
--
-- Bu migration yalnız iki kanonik puan yazma RPC'sini günceller:
--   * eclub_izleme_tamamla
--   * eclub_cevaplari_kaydet
--
-- Store, rapor ve lig sorguları Faz 1C kapsamındadır.
-- ==========================================================================

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('eclub-puan-yazma-fonksiyonlari-faz-1b', 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'eclub_kazanilan_puanlar'
       AND column_name = 'eczane_id'
       AND data_type = 'uuid'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION
      'Faz 1B uygulanmadı: önce Faz 1A eclub_puan_eczane_sabitleme.sql çalıştırılmalıdır.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.eclub_izleme_tamamla(
  p_izleme_id uuid,
  p_kisi_id uuid,
  p_tur_baslangic timestamptz,
  p_soru_indeksleri integer[]
)
RETURNS TABLE (
  yeni_tamamlandi boolean,
  puan_kazanildi boolean,
  izleme_puani integer,
  soru_gosterilecek boolean,
  soru_hakki_nedeni text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_izleme public.eclub_izleme_kayitlari%ROWTYPE;
  v_oneri public.eclub_oneri_kayitlari%ROWTYPE;
  v_urun_id uuid;
  v_arac_id uuid;
  v_arac_turu text;
  v_arac_puani integer := 0;
  v_arac_suresi integer := 0;
  v_onayli_atlanan_sure integer := 0;
  v_pencere_acik boolean := false;
  v_ileri_sarildi boolean := false;
  v_kanit_gecerli boolean := false;
  v_yeni boolean := false;
  v_aktif_eczaneler uuid[];
  v_eczane_id uuid;
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
  IF v_oneri.yayin_id <> v_izleme.yayin_id THEN
    RAISE EXCEPTION 'Öneri ile izleme yayın kimliği uyuşmuyor.' USING ERRCODE = '23514';
  END IF;

  SELECT
    vyd.arac_id,
    vyd.arac_turu,
    COALESCE(vyd.ogrenme_araci_puani, 0),
    COALESCE(v_izleme.video_suresi_saniye, vyd.arac_sure_saniye, vyd.video_suresi_saniye, 0)
  INTO v_arac_id, v_arac_turu, v_arac_puani, v_arac_suresi
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;

  IF NOT FOUND OR v_arac_id IS NULL THEN
    RAISE EXCEPTION 'Yayının öğrenme aracı kimliği bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF v_oneri.arac_id <> v_arac_id
     OR v_oneri.arac_turu <> v_arac_turu
     OR v_izleme.arac_turu <> v_arac_turu THEN
    RAISE EXCEPTION 'Öneri, izleme ve yayın öğrenme aracı bağı uyuşmuyor.' USING ERRCODE = '23514';
  END IF;

  v_pencere_acik := clock_timestamp() BETWEEN v_oneri.oneri_baslangic AND v_oneri.oneri_bitis;
  SELECT EXISTS (
    SELECT 1 FROM public.eclub_ileri_sarma_kayitlari k
    WHERE k.izleme_id = p_izleme_id
  ) INTO v_ileri_sarildi;

  IF NOT COALESCE(v_izleme.tamamlandi_mi, false) THEN
    IF v_arac_turu = 'video' THEN
      IF v_arac_suresi <= 0 THEN
        RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE = '22023';
      END IF;

      SELECT COALESCE(SUM(k.atlanan_sure), 0)::integer
      INTO v_onayli_atlanan_sure
      FROM public.eclub_ileri_sarma_kayitlari k
      WHERE k.izleme_id = p_izleme_id;

      IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic))
           + v_onayli_atlanan_sure
           < GREATEST(0, v_arac_suresi - 2) THEN
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

    UPDATE public.eclub_izleme_kayitlari ik
    SET tamamlandi_mi = true,
        izleme_bitis = clock_timestamp(),
        soru_hakki_var_mi = v_pencere_acik
          AND NOT v_ileri_sarildi
          AND COALESCE(cardinality(p_soru_indeksleri), 0) > 0,
        soru_erisimi_acik_mi = v_pencere_acik
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
      SELECT public.get_urun_from_yayin(v_izleme.yayin_id) INTO v_urun_id;

      IF v_arac_puani > 0 AND NOT EXISTS (
        SELECT 1 FROM public.eclub_kazanilan_puanlar kp
        WHERE kp.kisi_id = p_kisi_id
          AND kp.yayin_id = v_izleme.yayin_id
          AND kp.puan_turu = 'izleme'
          AND kp.created_at >= p_tur_baslangic
      ) THEN
        SELECT array_agg(kilitli.eczane_id ORDER BY kilitli.eczane_id)
          INTO v_aktif_eczaneler
          FROM (
            SELECT ke.eczane_id
              FROM public.eclub_kisi_eczane ke
             WHERE ke.kisi_id = p_kisi_id
               AND ke.aktif_mi = true
             FOR SHARE
          ) AS kilitli;

        IF coalesce(cardinality(v_aktif_eczaneler), 0) = 0 THEN
          RAISE EXCEPTION 'E-Club puanı yazılamadı: kişinin aktif eczanesi yok.' USING ERRCODE = '23514';
        END IF;
        IF cardinality(v_aktif_eczaneler) > 1 THEN
          RAISE EXCEPTION 'E-Club puanı yazılamadı: kişinin birden fazla aktif eczanesi var.' USING ERRCODE = '23514';
        END IF;
        v_eczane_id := v_aktif_eczaneler[1];

        INSERT INTO public.eclub_kazanilan_puanlar
          (kisi_id, eczane_id, yayin_id, izleme_id, puan_turu, puan, urun_id)
        VALUES
          (p_kisi_id, v_eczane_id, v_izleme.yayin_id, p_izleme_id,
           'izleme', v_arac_puani, v_urun_id)
        ON CONFLICT (izleme_id, puan_turu) DO NOTHING;
      END IF;

      INSERT INTO public.eclub_utt_puanlari
        (utt_id, kisi_id, yayin_id, izleme_id, oneri_id, urun_id, puan)
      VALUES
        (v_oneri.oneren_id, p_kisi_id, v_izleme.yayin_id, p_izleme_id,
         v_oneri.oneri_id, v_urun_id, 10)
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
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eclub_cevaplari_kaydet(
  p_izleme_id uuid,
  p_kisi_id uuid,
  p_sonuclar jsonb
)
RETURNS TABLE (kazanilan_puan integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_izleme public.eclub_izleme_kayitlari%ROWTYPE;
  v_oneri public.eclub_oneri_kayitlari%ROWTYPE;
  v_urun_id uuid;
  v_sonuc jsonb;
  v_toplam integer := 0;
  v_gelen_indeksler integer[];
  v_aktif_eczaneler uuid[];
  v_eczane_id uuid;
BEGIN
  SELECT ik.* INTO v_izleme
  FROM public.eclub_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_izleme.kisi_id <> p_kisi_id THEN
    RAISE EXCEPTION 'İzleme kaydı kişiye ait değil.' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE(v_izleme.tamamlandi_mi, false)
     OR NOT COALESCE(v_izleme.soru_hakki_var_mi, false) THEN
    RAISE EXCEPTION 'Bu izleme için soru hakkı bulunmuyor.' USING ERRCODE = 'P0001';
  END IF;
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
    SELECT ARRAY_AGG(indeks ORDER BY indeks)
    FROM unnest(v_izleme.soru_indeksleri) indeks
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
        (p_kisi_id, v_izleme.yayin_id, p_izleme_id,
         (v_sonuc->>'soru_index')::integer,
         GREATEST(0, (v_sonuc->>'kazanilan_puan')::integer), v_urun_id);
      v_toplam := v_toplam + GREATEST(0, (v_sonuc->>'kazanilan_puan')::integer);
    ELSE
      INSERT INTO public.eclub_yanlis_cevap_kayitlari
        (kisi_id, yayin_id, izleme_id, soru_index, kaybedilen_puan, urun_id)
      VALUES
        (p_kisi_id, v_izleme.yayin_id, p_izleme_id,
         (v_sonuc->>'soru_index')::integer, 0, v_urun_id);
    END IF;
  END LOOP;

  IF v_toplam > 0 THEN
    SELECT array_agg(kilitli.eczane_id ORDER BY kilitli.eczane_id)
      INTO v_aktif_eczaneler
      FROM (
        SELECT ke.eczane_id
          FROM public.eclub_kisi_eczane ke
         WHERE ke.kisi_id = p_kisi_id
           AND ke.aktif_mi = true
         FOR SHARE
      ) AS kilitli;

    IF coalesce(cardinality(v_aktif_eczaneler), 0) = 0 THEN
      RAISE EXCEPTION 'E-Club puanı yazılamadı: kişinin aktif eczanesi yok.' USING ERRCODE = '23514';
    END IF;
    IF cardinality(v_aktif_eczaneler) > 1 THEN
      RAISE EXCEPTION 'E-Club puanı yazılamadı: kişinin birden fazla aktif eczanesi var.' USING ERRCODE = '23514';
    END IF;
    v_eczane_id := v_aktif_eczaneler[1];

    INSERT INTO public.eclub_kazanilan_puanlar
      (kisi_id, eczane_id, yayin_id, izleme_id, puan_turu, puan, urun_id)
    VALUES
      (p_kisi_id, v_eczane_id, v_izleme.yayin_id, p_izleme_id,
       'cevaplama', v_toplam, v_urun_id)
    ON CONFLICT (izleme_id, puan_turu) DO NOTHING;
  END IF;

  UPDATE public.eclub_izleme_kayitlari
  SET soru_erisimi_acik_mi = false
  WHERE izleme_id = p_izleme_id;

  RETURN QUERY SELECT v_toplam;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eclub_izleme_tamamla(uuid, uuid, timestamptz, integer[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_izleme_tamamla(uuid, uuid, timestamptz, integer[])
  TO service_role;

REVOKE ALL ON FUNCTION public.eclub_cevaplari_kaydet(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_cevaplari_kaydet(uuid, uuid, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
