-- E-Club izleme/cevap akışının tekillik ve atomik yazım paketi.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.
-- Ön kontrol mükerrer veri bulursa hiçbir şema değişikliği yapmadan durur.

BEGIN;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.eclub_izleme_kayitlari
    WHERE oneri_id IS NOT NULL GROUP BY oneri_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'eclub_izleme_kayitlari içinde mükerrer oneri_id var.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.eclub_dogru_cevap_kayitlari
    GROUP BY izleme_id, soru_index HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM public.eclub_yanlis_cevap_kayitlari
    GROUP BY izleme_id, soru_index HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'E-Club cevap kayıtlarında mükerrer izleme/soru var.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.eclub_kazanilan_puanlar
    GROUP BY izleme_id, puan_turu HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'E-Club kazanım kayıtlarında mükerrer izleme/puan türü var.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.eclub_utt_puanlari
    GROUP BY oneri_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'E-Club UTT puanlarında mükerrer öneri var.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.eclub_dogru_cevap_kayitlari dc
    JOIN public.eclub_yanlis_cevap_kayitlari yc
      ON yc.izleme_id = dc.izleme_id AND yc.soru_index = dc.soru_index
  ) THEN
    RAISE EXCEPTION 'Aynı E-Club sorusu hem doğru hem yanlış kaydedilmiş.';
  END IF;
END;
$kontrol$;

ALTER TABLE public.eclub_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS soru_hakki_var_mi boolean,
  ADD COLUMN IF NOT EXISTS soru_hakki_nedeni text,
  ADD COLUMN IF NOT EXISTS soru_indeksleri integer[];

CREATE UNIQUE INDEX IF NOT EXISTS eclub_izleme_oneri_uq
  ON public.eclub_izleme_kayitlari (oneri_id)
  WHERE oneri_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS eclub_dogru_cevap_izleme_soru_uq
  ON public.eclub_dogru_cevap_kayitlari (izleme_id, soru_index);
CREATE UNIQUE INDEX IF NOT EXISTS eclub_yanlis_cevap_izleme_soru_uq
  ON public.eclub_yanlis_cevap_kayitlari (izleme_id, soru_index);
CREATE UNIQUE INDEX IF NOT EXISTS eclub_puan_izleme_tur_uq
  ON public.eclub_kazanilan_puanlar (izleme_id, puan_turu);
CREATE UNIQUE INDEX IF NOT EXISTS eclub_utt_puan_oneri_uq
  ON public.eclub_utt_puanlari (oneri_id);

DO $kisit$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eclub_yanlis_cevap_sifir_kayip_ck'
  ) THEN
    ALTER TABLE public.eclub_yanlis_cevap_kayitlari
      ADD CONSTRAINT eclub_yanlis_cevap_sifir_kayip_ck CHECK (kaybedilen_puan = 0);
  END IF;
END;
$kisit$;

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
SET search_path = public
AS $fonksiyon$
DECLARE
  v_izleme public.eclub_izleme_kayitlari%ROWTYPE;
  v_oneri public.eclub_oneri_kayitlari%ROWTYPE;
  v_urun_id uuid;
  v_video_puani integer := 0;
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

  -- Bu temel paket ileri-sarma migrasyonundan önce de kurulabilir. Tablo varsa
  -- soru kilidi uygulanır; yoksa sonradan eclub_ileri_sarma_kurali.sql fonksiyonu
  -- aynı sözleşmeyle yeniler.
  IF to_regclass('public.eclub_ileri_sarma_kayitlari') IS NOT NULL THEN
    EXECUTE
      'SELECT EXISTS (SELECT 1 FROM public.eclub_ileri_sarma_kayitlari WHERE izleme_id = $1)'
      INTO v_ileri_sarildi
      USING p_izleme_id;
  END IF;

  IF NOT COALESCE(v_izleme.tamamlandi_mi, false) THEN
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
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eclub_cevaplari_kaydet(
  p_izleme_id uuid,
  p_kisi_id uuid,
  p_sonuclar jsonb
)
RETURNS TABLE (kazanilan_puan integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
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

COMMIT;
