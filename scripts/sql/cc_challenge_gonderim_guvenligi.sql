-- BM -> BM Challenge gönderimini tek transaction içinde doğrular ve kaydeder.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.

BEGIN;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.challenge_kayitlari
    GROUP BY gonderen_id, alan_id, yayin_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Aynı gönderen, alıcı ve yayın için mükerrer challenge var; paket kurulmadı.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cc_kazanilan_puanlar
    WHERE challenge_id IS NOT NULL AND puan_turu = 'cc_gonderme'
    GROUP BY challenge_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Aynı challenge için mükerrer gönderme puanı var; paket kurulmadı.';
  END IF;
END;
$kontrol$;

CREATE UNIQUE INDEX IF NOT EXISTS challenge_gonderen_alici_yayin_uq
  ON public.challenge_kayitlari (gonderen_id, alan_id, yayin_id);

CREATE UNIQUE INDEX IF NOT EXISTS cc_puan_gonderme_challenge_uq
  ON public.cc_kazanilan_puanlar (challenge_id)
  WHERE challenge_id IS NOT NULL AND puan_turu = 'cc_gonderme';

CREATE OR REPLACE FUNCTION public.cc_challenge_gonder(
  p_gonderen_id uuid,
  p_alan_id uuid,
  p_yayin_id uuid,
  p_son_tarih timestamptz
)
RETURNS TABLE (challenge_id uuid, gonderme_puani integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_gonderen public.kullanicilar%ROWTYPE;
  v_alan public.kullanicilar%ROWTYPE;
  v_yayin public.yayin_yonetimi%ROWTYPE;
  v_yayin_firma_id uuid;
  v_video_suresi integer;
  v_challenge_id uuid;
  v_puan integer := 10;
  v_ay_baslangici timestamptz;
BEGIN
  IF p_gonderen_id = p_alan_id THEN
    RAISE EXCEPTION 'Kendinize challenge gönderemezsiniz.' USING ERRCODE = '22023';
  END IF;
  IF p_son_tarih <= clock_timestamp() THEN
    RAISE EXCEPTION 'Challenge son tarihi gelecekte olmalıdır.' USING ERRCODE = '22023';
  END IF;

  -- Gönderici kotası ve iki yönlü karşılıklılık aynı anda yarışamasın.
  PERFORM pg_advisory_xact_lock(hashtextextended('cc-gonderen:' || p_gonderen_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'cc-cift:' || LEAST(p_gonderen_id::text, p_alan_id::text)
      || ':' || GREATEST(p_gonderen_id::text, p_alan_id::text), 0
  ));

  SELECT k.* INTO v_gonderen
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_gonderen_id
  FOR UPDATE;
  IF NOT FOUND OR v_gonderen.rol <> 'bm' OR NOT COALESCE(v_gonderen.aktif_mi, false) THEN
    RAISE EXCEPTION 'Gönderici aktif bir BM değil.' USING ERRCODE = '42501';
  END IF;

  SELECT k.* INTO v_alan
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_alan_id
  FOR UPDATE;
  IF NOT FOUND OR v_alan.rol <> 'bm' OR NOT COALESCE(v_alan.aktif_mi, false) THEN
    RAISE EXCEPTION 'Alıcı aktif bir BM değil.' USING ERRCODE = 'P0001';
  END IF;
  IF v_gonderen.firma_id IS NULL OR v_alan.firma_id IS DISTINCT FROM v_gonderen.firma_id THEN
    RAISE EXCEPTION 'Challenge yalnız aynı firmadaki BM kullanıcıları arasında gönderilebilir.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.firmalar f
    WHERE f.firma_id = v_gonderen.firma_id
      AND COALESCE(f.aktif, false)
      AND COALESCE(f.cc_aktif, false)
  ) THEN
    RAISE EXCEPTION 'Firmanın C-Club erişimi kapalı veya firma aktif değil.' USING ERRCODE = 'P0001';
  END IF;

  SELECT yy.* INTO v_yayin
  FROM public.yayin_yonetimi yy
  WHERE yy.yayin_id = p_yayin_id
  FOR SHARE;
  IF NOT FOUND
     OR v_yayin.durum <> 'yayinda'
     OR NOT (COALESCE(v_yayin.hedef_roller, ARRAY[]::text[]) @> ARRAY['bm']::text[])
     OR v_yayin.yayin_tarihi > clock_timestamp()
     OR (v_yayin.durdurma_tarihi IS NOT NULL AND v_yayin.durdurma_tarihi <= clock_timestamp()) THEN
    RAISE EXCEPTION 'Yayın C-Club gönderimine açık değil.' USING ERRCODE = 'P0001';
  END IF;

  SELECT vyd.firma_id, COALESCE(vyd.video_suresi_saniye, 0)
  INTO v_yayin_firma_id, v_video_suresi
  FROM public.v_yayin_detay vyd
  WHERE vyd.yayin_id = p_yayin_id;
  IF NOT FOUND
     OR v_yayin_firma_id IS DISTINCT FROM v_gonderen.firma_id
     OR v_video_suresi <= 0 THEN
    RAISE EXCEPTION 'Yayın firmanızın doğrulanmış C-Club videosu değil.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_gonderen_id
      AND ik.yayin_id = p_yayin_id
      AND ik.tamamlandi_mi = true
  ) THEN
    RAISE EXCEPTION 'Bu videoyu önce kendiniz tamamlamalısınız.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_alan_id
      AND ik.yayin_id = p_yayin_id
      AND ik.tamamlandi_mi = true
  ) THEN
    RAISE EXCEPTION 'Alıcı BM bu videoyu zaten tamamlamış.' USING ERRCODE = 'P0001';
  END IF;

  -- Türkiye takvim ayının mutlak başlangıç anı.
  v_ay_baslangici := date_trunc('month', clock_timestamp() AT TIME ZONE 'Europe/Istanbul')
    AT TIME ZONE 'Europe/Istanbul';

  IF (SELECT COUNT(*) FROM public.challenge_kayitlari ck
      WHERE ck.gonderen_id = p_gonderen_id AND ck.created_at >= v_ay_baslangici) >= 3 THEN
    RAISE EXCEPTION 'Bu ay aylık challenge kotanız doldu (3/3).' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.gonderen_id = p_gonderen_id
      AND ck.alan_id = p_alan_id
      AND ck.created_at >= v_ay_baslangici
  ) THEN
    RAISE EXCEPTION 'Bu ay bu BM kullanıcısına zaten bir challenge gönderdiniz.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.gonderen_id = p_alan_id
      AND ck.alan_id = p_gonderen_id
      AND ck.created_at >= v_ay_baslangici
  ) THEN
    RAISE EXCEPTION 'Bu BM bu ay size challenge gönderdi; karşılıklı gönderim yapılamaz.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.gonderen_id = p_gonderen_id
      AND ck.alan_id = p_alan_id
      AND ck.yayin_id = p_yayin_id
  ) THEN
    RAISE EXCEPTION 'Aynı video aynı BM kullanıcısına daha önce gönderilmiş.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.challenge_kayitlari
    (gonderen_id, alan_id, yayin_id, son_tarih, izlendi_mi)
  VALUES
    (p_gonderen_id, p_alan_id, p_yayin_id, p_son_tarih, false)
  RETURNING challenge_kayitlari.challenge_id INTO v_challenge_id;

  SELECT COALESCE(MAX(
    CASE WHEN (sa.deger #>> '{}') ~ '^[0-9]+$' THEN (sa.deger #>> '{}')::integer END
  ), 10)
  INTO v_puan
  FROM public.sistem_ayarlari sa
  WHERE sa.anahtar = 'cc_gonderme_puani';

  INSERT INTO public.cc_kazanilan_puanlar
    (bm_id, yayin_id, challenge_id, puan_turu, puan)
  VALUES
    (p_gonderen_id, p_yayin_id, v_challenge_id, 'cc_gonderme', v_puan);

  RETURN QUERY SELECT v_challenge_id, v_puan;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.cc_challenge_gonder(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_challenge_gonder(uuid, uuid, uuid, timestamptz)
  TO service_role;

COMMIT;
