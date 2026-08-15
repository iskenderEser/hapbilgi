-- E-Club eczacı/teknisyen ileri sarma ve puan sözleşmesi.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.
--
-- Sonuç:
--   * İleri sarılan saniye kadar oransal video puanı kaybı atomik/idempotent yazılır.
--   * Bir kez ileri sarılan izlemeye soru hakkı verilmez.
--   * Kayıp, kişinin firma bazlı E-Club Store bakiyesinden düşer.
--   * Eczacı/teknisyen yayınlarındaki eski Extra puan değerleri temizlenir.

BEGIN;

CREATE TABLE IF NOT EXISTS public.eclub_ileri_sarma_kayitlari (
  kayit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  olay_id uuid NOT NULL UNIQUE,
  izleme_id uuid NOT NULL REFERENCES public.eclub_izleme_kayitlari(izleme_id) ON DELETE CASCADE,
  kisi_id uuid NOT NULL REFERENCES public.eclub_kisiler(kisi_id) ON DELETE CASCADE,
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id) ON DELETE CASCADE,
  urun_id uuid REFERENCES public.urunler(urun_id) ON DELETE SET NULL,
  atlama_baslangic integer NOT NULL,
  atlama_bitis integer NOT NULL,
  atlanan_sure integer NOT NULL,
  kaybedilen_puan integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT eclub_ileri_sarma_konum_ck CHECK (
    atlama_baslangic >= 0
    AND atlama_bitis > atlama_baslangic
    AND atlanan_sure = atlama_bitis - atlama_baslangic
  ),
  CONSTRAINT eclub_ileri_sarma_kayip_ck CHECK (kaybedilen_puan >= 0)
);

CREATE INDEX IF NOT EXISTS eclub_ileri_sarma_izleme_idx
  ON public.eclub_ileri_sarma_kayitlari (izleme_id);
CREATE INDEX IF NOT EXISTS eclub_ileri_sarma_kisi_idx
  ON public.eclub_ileri_sarma_kayitlari (kisi_id);
CREATE INDEX IF NOT EXISTS eclub_ileri_sarma_yayin_idx
  ON public.eclub_ileri_sarma_kayitlari (yayin_id);

ALTER TABLE public.eclub_ileri_sarma_kayitlari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eclub_ileri_sarma_kayitlari FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.eclub_ileri_sarma_kayitlari TO service_role;

CREATE OR REPLACE FUNCTION public.eclub_ileri_sarma_kaydet(
  p_izleme_id uuid,
  p_kisi_id uuid,
  p_olay_id uuid,
  p_atlama_baslangic integer,
  p_atlama_bitis integer,
  p_kaybedilen_puan integer
)
RETURNS TABLE (kaybedilen_puan integer, tekrar_istek boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_izleme public.eclub_izleme_kayitlari%ROWTYPE;
  v_oneri public.eclub_oneri_kayitlari%ROWTYPE;
  v_mevcut public.eclub_ileri_sarma_kayitlari%ROWTYPE;
  v_yeni public.eclub_ileri_sarma_kayitlari%ROWTYPE;
  v_urun_id uuid;
  v_video_puani integer := 0;
  v_onceki_kayip integer := 0;
  v_yazilacak_kayip integer := 0;
  v_pencere_acik boolean := false;
BEGIN
  IF p_atlama_baslangic < 0 OR p_atlama_bitis <= p_atlama_baslangic THEN
    RAISE EXCEPTION 'İleri sarma konumları geçersiz.' USING ERRCODE = '22023';
  END IF;
  IF p_kaybedilen_puan < 0 THEN
    RAISE EXCEPTION 'Kaybedilen puan negatif olamaz.' USING ERRCODE = '22023';
  END IF;

  SELECT k.* INTO v_mevcut
  FROM public.eclub_ileri_sarma_kayitlari k
  WHERE k.olay_id = p_olay_id;

  IF FOUND THEN
    IF v_mevcut.izleme_id <> p_izleme_id
       OR v_mevcut.kisi_id <> p_kisi_id
       OR v_mevcut.atlama_baslangic <> p_atlama_baslangic
       OR v_mevcut.atlama_bitis <> p_atlama_bitis THEN
      RAISE EXCEPTION 'İleri sarma olay kimliği farklı bir işlemde kullanılmış.' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_mevcut.kaybedilen_puan, true;
    RETURN;
  END IF;

  SELECT ik.* INTO v_izleme
  FROM public.eclub_izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_izleme.kisi_id <> p_kisi_id THEN
    RAISE EXCEPTION 'İzleme kaydı kişiye ait değil.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(v_izleme.tamamlandi_mi, false) THEN
    RAISE EXCEPTION 'Tamamlanmış izlemeye ileri sarma kaybı yazılamaz.' USING ERRCODE = 'P0001';
  END IF;

  SELECT ok.* INTO v_oneri
  FROM public.eclub_oneri_kayitlari ok
  WHERE ok.oneri_id = v_izleme.oneri_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Öneri kaydı bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  v_pencere_acik := clock_timestamp() BETWEEN v_oneri.oneri_baslangic AND v_oneri.oneri_bitis;

  SELECT COALESCE(vyd.video_puani, 0)
  INTO v_video_puani
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = v_izleme.yayin_id;

  SELECT COALESCE(SUM(k.kaybedilen_puan), 0)::integer
  INTO v_onceki_kayip
  FROM public.eclub_ileri_sarma_kayitlari k
  WHERE k.izleme_id = p_izleme_id;

  -- Bir izleme, video puanından daha fazla kayıp üretemez. Süresi geçen
  -- öneride kayıt soru kilidi kanıtı olarak tutulur fakat puan kaybı sıfırdır.
  v_yazilacak_kayip := CASE
    WHEN NOT v_pencere_acik THEN 0
    ELSE LEAST(
      GREATEST(v_video_puani - v_onceki_kayip, 0),
      GREATEST(p_kaybedilen_puan, 0)
    )
  END;

  SELECT public.get_urun_from_yayin(v_izleme.yayin_id) INTO v_urun_id;

  INSERT INTO public.eclub_ileri_sarma_kayitlari (
    olay_id, izleme_id, kisi_id, yayin_id, urun_id,
    atlama_baslangic, atlama_bitis, atlanan_sure, kaybedilen_puan
  ) VALUES (
    p_olay_id, p_izleme_id, p_kisi_id, v_izleme.yayin_id, v_urun_id,
    p_atlama_baslangic, p_atlama_bitis,
    p_atlama_bitis - p_atlama_baslangic, v_yazilacak_kayip
  )
  ON CONFLICT (olay_id) DO NOTHING
  RETURNING * INTO v_yeni;

  IF v_yeni.kayit_id IS NULL THEN
    SELECT k.* INTO v_mevcut
    FROM public.eclub_ileri_sarma_kayitlari k
    WHERE k.olay_id = p_olay_id;
    IF v_mevcut.izleme_id <> p_izleme_id
       OR v_mevcut.kisi_id <> p_kisi_id
       OR v_mevcut.atlama_baslangic <> p_atlama_baslangic
       OR v_mevcut.atlama_bitis <> p_atlama_bitis THEN
      RAISE EXCEPTION 'İleri sarma olay kimliği farklı bir işlemde kullanılmış.' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT v_mevcut.kaybedilen_puan, true;
  ELSE
    RETURN QUERY SELECT v_yeni.kaybedilen_puan, false;
  END IF;
END;
$fonksiyon$;

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
  SELECT EXISTS (
    SELECT 1 FROM public.eclub_ileri_sarma_kayitlari k
    WHERE k.izleme_id = p_izleme_id
  ) INTO v_ileri_sarildi;

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

CREATE OR REPLACE FUNCTION public.get_eclub_store_firma_bakiye(p_kisi_id uuid)
RETURNS TABLE(firma_id uuid, firma_adi character varying, kazanilan bigint, harcanan bigint, bakiye bigint)
LANGUAGE sql
STABLE
AS $fonksiyon$
  WITH kazanc AS (
    SELECT ky.firma_id, COALESCE(SUM(kp.puan), 0) AS kazanilan
    FROM public.eclub_kazanilan_puanlar kp
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kisi_id = p_kisi_id
    GROUP BY ky.firma_id
  ),
  kayip AS (
    SELECT ky.firma_id, COALESCE(SUM(ks.kaybedilen_puan), 0) AS kaybedilen
    FROM public.eclub_ileri_sarma_kayitlari ks
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = ks.yayin_id
    WHERE ks.kisi_id = p_kisi_id
    GROUP BY ky.firma_id
  ),
  harcama AS (
    SELECT sfp.firma_id, COALESCE(SUM(sfp.kullanilan_puan), 0) AS harcanan
    FROM public.eclub_store_siparis_firma_puan sfp
    JOIN public.eclub_store_siparisler s ON s.siparis_id = sfp.siparis_id
    WHERE s.kisi_id = p_kisi_id
      AND s.durum <> 'iptal'
    GROUP BY sfp.firma_id
  )
  SELECT
    f.firma_id,
    f.firma_adi,
    COALESCE(k.kazanilan, 0),
    COALESCE(h.harcanan, 0),
    (
      COALESCE(k.kazanilan, 0)
      - COALESCE(ka.kaybedilen, 0)
      - COALESCE(h.harcanan, 0)
    ) AS bakiye
  FROM public.firmalar f
  JOIN kazanc k ON k.firma_id = f.firma_id
  LEFT JOIN kayip ka ON ka.firma_id = f.firma_id
  LEFT JOIN harcama h ON h.firma_id = f.firma_id
  WHERE f.eclub_store_aktif = true
    AND (
      COALESCE(k.kazanilan, 0)
      - COALESCE(ka.kaybedilen, 0)
      - COALESCE(h.harcanan, 0)
    ) > 0
  ORDER BY bakiye DESC;
$fonksiyon$;

-- Önceki yayın yönetimi sözleşmesiyle yazılmış E-Club Extra puanlarını kaldır.
UPDATE public.yayin_yonetimi y
SET extra_puan = NULL,
    ileri_sarma_acik = true
WHERE cardinality(y.hedef_roller) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(y.hedef_roller) AS hedef(rol)
    WHERE hedef.rol NOT IN ('eczaci', 'eczane_teknisyeni')
  );

REVOKE ALL ON FUNCTION public.eclub_ileri_sarma_kaydet(uuid, uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_ileri_sarma_kaydet(uuid, uuid, uuid, integer, integer, integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.eclub_izleme_tamamla(uuid, uuid, timestamptz, integer[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_izleme_tamamla(uuid, uuid, timestamptz, integer[])
  TO service_role;

COMMIT;

SELECT
  to_regclass('public.eclub_ileri_sarma_kayitlari') IS NOT NULL AS tablo_var,
  to_regprocedure('public.eclub_ileri_sarma_kaydet(uuid,uuid,uuid,integer,integer,integer)') IS NOT NULL AS kayit_rpc_var,
  to_regprocedure('public.eclub_izleme_tamamla(uuid,uuid,timestamp with time zone,integer[])') IS NOT NULL AS tamamlama_rpc_var,
  COUNT(*) FILTER (WHERE y.extra_puan IS NOT NULL) AS eclub_extra_puan_kaldi
FROM public.yayin_yonetimi y
WHERE cardinality(y.hedef_roller) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(y.hedef_roller) AS hedef(rol)
    WHERE hedef.rol NOT IN ('eczaci', 'eczane_teknisyeni')
  );
