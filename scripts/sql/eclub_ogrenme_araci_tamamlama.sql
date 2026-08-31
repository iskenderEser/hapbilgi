-- E-Club tamamlama RPC'sini dört öğrenme aracı için ortaklaştırır.
-- Video: süre snapshot'ı + onaylı ileri sarma süresi.
-- Podcast / görsel / Flip PDF: ortak ilerleme uçlarının yazdığı tamamlama kanıtı.
-- Puan ve soru hakkı mevcut E-Club kurallarıyla aynı atomik işlemde korunur.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-ortak-arac-tamamlama-v1', 1));

-- Faz 2 öncesinde açılmış kayıtları yayın sözleşmesiyle hizala.
UPDATE public.eclub_izleme_kayitlari i
SET arac_turu = vyd.arac_turu
FROM public.v_yayin_detay vyd
WHERE vyd.yayin_id = i.yayin_id
  AND i.arac_turu IS DISTINCT FROM vyd.arac_turu;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.eclub_izleme_kayitlari i
    JOIN public.v_yayin_detay vyd ON vyd.yayin_id = i.yayin_id
    WHERE i.arac_turu IS DISTINCT FROM vyd.arac_turu
  ) THEN
    RAISE EXCEPTION 'E-Club izlemelerinde yayınla uyuşmayan öğrenme aracı türü var; işlem geri alındı.';
  END IF;
END;
$kontrol$;

DO $kisit$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eclub_izleme_kayitlari_arac_turu_ck'
      AND conrelid = 'public.eclub_izleme_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.eclub_izleme_kayitlari
      ADD CONSTRAINT eclub_izleme_kayitlari_arac_turu_ck
      CHECK (arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf'));
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
  v_arac_id uuid;
  v_arac_turu text;
  v_arac_puani integer := 0;
  v_arac_suresi integer := 0;
  v_onayli_atlanan_sure integer := 0;
  v_pencere_acik boolean := false;
  v_ileri_sarildi boolean := false;
  v_kanit_gecerli boolean := false;
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
        INSERT INTO public.eclub_kazanilan_puanlar
          (kisi_id, yayin_id, izleme_id, puan_turu, puan, urun_id)
        VALUES
          (p_kisi_id, v_izleme.yayin_id, p_izleme_id, 'izleme', v_arac_puani, v_urun_id)
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

REVOKE ALL ON FUNCTION public.eclub_izleme_tamamla(uuid, uuid, timestamptz, integer[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_izleme_tamamla(uuid, uuid, timestamptz, integer[])
  TO service_role;

COMMIT;

WITH rpc AS (
  SELECT lower(pg_get_functiondef(p.oid)) AS tanim
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'eclub_izleme_tamamla'
)
SELECT
  position('tamamlama_kaniti' IN tanim) > 0 AS tamamlama_kaniti_kontrolu_var,
  position('arac_turu' IN tanim) > 0 AS arac_turu_kontrolu_var,
  position('ogrenme_araci_puani' IN tanim) > 0 AS ortak_puan_kullaniliyor,
  position('join public.video_durumu' IN tanim) = 0 AS legacy_video_durumu_join_yok,
  position('join public.videolar' IN tanim) = 0 AS legacy_videolar_join_yok
FROM rpc;
