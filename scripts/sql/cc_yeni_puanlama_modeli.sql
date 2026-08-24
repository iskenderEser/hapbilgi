-- scripts/sql/cc_yeni_puanlama_modeli.sql
--
-- Challenge Club (CC) Yeni Puanlama ve Davranış Modeli SQL Paketi
--
-- Değişiklikler:
-- 1. Karşılıklılık kilidi kaldırıldı (BM'ler arası karşılıklı gönderim serbest).
-- 2. "Ömür boyu tekil video" kuralı "Geçerli tur/periyot bazlı tekillik" kuralına dönüştürüldü.
-- 3. Eski `challenge_gonderen_alici_yayin_uq` ömür boyu indeksi kaldırıldı.
-- 4. 5 iş günü ceza ve süre aşımı kaybı (challenge_kaybi) kaldırıldı; cron görevi devreden çıkarıldı.
-- 5. CC Ligi net puan formülünden challenge_kaybi çıkarıldı.
-- 6. v_cc_challenge_listesi view'ına firma_id eklendi ve durumlar 'İzlendi' / 'Bekliyor' olarak sadeleştirildi.
--
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('challenge-kaybi-tara');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

BEGIN;

-- 1. Eski ömür boyu tekillik indeksini kaldır (yeni turlarda aynı videonun gönderilebilmesi için)
DROP INDEX IF EXISTS public.challenge_gonderen_alici_yayin_uq;

-- 2. cc_challenge_gonder RPC'sini yeni kurallara göre güncelle
CREATE OR REPLACE FUNCTION public.cc_challenge_gonder(
  p_gonderen_id uuid,
  p_alan_id uuid,
  p_yayin_id uuid,
  p_son_tarih timestamptz DEFAULT NULL
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
  v_tur_baslangici timestamptz;
BEGIN
  IF p_gonderen_id = p_alan_id THEN
    RAISE EXCEPTION 'Kendinize challenge gönderemezsiniz.' USING ERRCODE = '22023';
  END IF;

  -- Gönderici kotası aynı anda yarışamasın.
  PERFORM pg_advisory_xact_lock(hashtextextended('cc-gonderen:' || p_gonderen_id::text, 0));

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

  -- Geçerli tur başlangıç tarihini çöz
  SELECT COALESCE(
    (SELECT baslangic_tarihi FROM public.yayin_tekrar_kayitlari
     WHERE yayin_id = p_yayin_id
     ORDER BY tur_no DESC LIMIT 1),
    v_yayin.yayin_tarihi,
    '1970-01-01'::timestamptz
  ) INTO v_tur_baslangici;

  -- 1. Gönderen bu videoyu geçerli turda tamamlamış mı?
  IF NOT EXISTS (
    SELECT 1 FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_gonderen_id
      AND ik.yayin_id = p_yayin_id
      AND ik.tamamlandi_mi = true
      AND ik.izleme_baslangic >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Bu videoyu geçerli turda önce kendiniz tamamlamalısınız.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Alıcı bu videoyu geçerli turda zaten tamamlamış mı?
  IF EXISTS (
    SELECT 1 FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = p_alan_id
      AND ik.yayin_id = p_yayin_id
      AND ik.tamamlandi_mi = true
      AND ik.izleme_baslangic >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Alıcı BM bu videoyu geçerli turda zaten tamamlamış.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Aynı tur içinde bu video alıcıya zaten gönderilmiş mi?
  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.gonderen_id = p_gonderen_id
      AND ck.alan_id = p_alan_id
      AND ck.yayin_id = p_yayin_id
      AND ck.created_at >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Aynı video bu tur içinde bu BM kullanıcısına zaten gönderilmiş.' USING ERRCODE = '23505';
  END IF;

  -- 4. Alıcının bu video için geçerli turda bekleyen başka bir challenge'ı var mı?
  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.alan_id = p_alan_id
      AND ck.yayin_id = p_yayin_id
      AND ck.izlendi_mi = false
      AND ck.created_at >= v_tur_baslangici
  ) THEN
    RAISE EXCEPTION 'Alıcı BM''nin bu video için zaten bekleyen bir challenge''ı bulunuyor.' USING ERRCODE = 'P0001';
  END IF;

  -- Türkiye takvim ayının mutlak başlangıç anı.
  v_ay_baslangici := date_trunc('month', clock_timestamp() AT TIME ZONE 'Europe/Istanbul')
    AT TIME ZONE 'Europe/Istanbul';

  -- Aylık max 3 kota kontrolü
  IF (SELECT COUNT(*) FROM public.challenge_kayitlari ck
      WHERE ck.gonderen_id = p_gonderen_id AND ck.created_at >= v_ay_baslangici) >= 3 THEN
    RAISE EXCEPTION 'Bu ay aylık challenge kotanız doldu (3/3).' USING ERRCODE = 'P0001';
  END IF;

  -- Aynı ay aynı alıcıya 1 gönderim kontrolü (Karşılıklılık serbesttir, yalnızca aynı yönde 2. gönderim engellenir)
  IF EXISTS (
    SELECT 1 FROM public.challenge_kayitlari ck
    WHERE ck.gonderen_id = p_gonderen_id
      AND ck.alan_id = p_alan_id
      AND ck.created_at >= v_ay_baslangici
  ) THEN
    RAISE EXCEPTION 'Bu ay bu BM kullanıcısına zaten bir challenge gönderdiniz.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.challenge_kayitlari
    (gonderen_id, alan_id, yayin_id, son_tarih, izlendi_mi)
  VALUES
    (p_gonderen_id, p_alan_id, p_yayin_id, COALESCE(p_son_tarih, clock_timestamp() + interval '100 years'), false)
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

-- 3. Bildirim kapatma tetikleyicisi (alıcı izleyince gelen bildirim otomatik okunur)
CREATE OR REPLACE FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $tetikleyici$
BEGIN
  IF NEW.izlendi_mi = true AND (OLD.izlendi_mi IS DISTINCT FROM true) THEN
    UPDATE public.bildirimler b
    SET goruldu_mu = true
    WHERE b.kayit_turu = 'challenge'
      AND b.kayit_id = NEW.challenge_id
      AND b.alici_id = NEW.alan_id
      AND b.gonderen_id IS NOT NULL
      AND b.goruldu_mu = false;
  END IF;
  RETURN NEW;
END;
$tetikleyici$;

DROP TRIGGER IF EXISTS trg_cc_challenge_tamamlaninca_bildirim_kapat
  ON public.challenge_kayitlari;
CREATE TRIGGER trg_cc_challenge_tamamlaninca_bildirim_kapat
AFTER UPDATE OF izlendi_mi ON public.challenge_kayitlari
FOR EACH ROW
EXECUTE FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat();

REVOKE ALL ON FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat()
  TO service_role;

-- 4. cc_izleme_tamamla RPC'sini güncelle (challenge izlemelerine de video izleme puanı yazılır)
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
      soru_indeksleri = CASE WHEN v_beklenen_soru > 0 THEN p_soru_indeksleri ELSE NULL END
  WHERE ik.izleme_id = p_izleme_id
  RETURNING ik.* INTO v_izleme;
  v_yeni := true;

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
$fonksiyon$;

REVOKE ALL ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz)
  TO service_role;

-- 5. Geçmişte tamamlanmış challenge izlemelerindeki eksik izleme puanlarını telafi et (Backfill)
INSERT INTO public.cc_kazanilan_puanlar (bm_id, yayin_id, izleme_id, puan_turu, puan, created_at)
SELECT
  ik.bm_id,
  ik.yayin_id,
  ik.izleme_id,
  'izleme',
  COALESCE(vyd.video_puani, 0),
  COALESCE(ik.izleme_bitis, ik.created_at)
FROM public.cc_izleme_kayitlari ik
JOIN public.v_yayin_detay vyd ON vyd.yayin_id = ik.yayin_id
WHERE ik.izleme_turu = 'challenge'
  AND ik.tamamlandi_mi = true
  AND ik.ileri_sarildi_mi = false
  AND COALESCE(vyd.video_puani, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.cc_kazanilan_puanlar kp
    WHERE kp.izleme_id = ik.izleme_id
      AND kp.puan_turu = 'izleme'
  )
ON CONFLICT DO NOTHING;

-- 6. challenge_kaybi_tara cron görevini kaldır (ceza mekanizması iptal)
DO $cron$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE command ILIKE '%challenge_kaybi_tara%' OR jobname = 'challenge_kaybi_tarama';
  END IF;
END;
$cron$;



-- 4. _cc_ligi_aralik fonksiyonunu güncelle (challenge_kaybi net puandan çıkarıldı)
CREATE OR REPLACE FUNCTION public._cc_ligi_aralik(p_bas date, p_bit date)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH oz AS (
    SELECT o.kullanici_id,
      SUM(o.izleme_puani)::integer AS izleme, SUM(o.cevaplama_puani)::integer AS cev, SUM(o.extra_puani)::integer AS extra,
      SUM(o.cc_gonderme_puani)::integer AS ccg, SUM(o.cc_referral_puani)::integer AS ccr,
      SUM(o.ileri_sarma_kaybi)::integer AS ileri, SUM(o.yanlis_cevap_kaybi)::integer AS yanlis
    FROM cc_ligi_ozet o
    WHERE o.tarih >= p_bas AND o.tarih < p_bit
    GROUP BY o.kullanici_id
  ),
  birlesik AS (
    SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad, k.firma_id, k.takim_id, k.bolge_id,
      COALESCE(oz.izleme,0) AS izleme_puani, COALESCE(oz.cev,0) AS cevaplama_puani, COALESCE(oz.extra,0) AS extra_puani,
      COALESCE(oz.ccg,0) AS cc_gonderme_puani, COALESCE(oz.ccr,0) AS cc_referral_puani,
      COALESCE(oz.ileri,0) AS ileri_sarma_kaybi, COALESCE(oz.yanlis,0) AS yanlis_cevap_kaybi,
      (COALESCE(oz.izleme,0)+COALESCE(oz.cev,0)+COALESCE(oz.extra,0)+COALESCE(oz.ccg,0)+COALESCE(oz.ccr,0)
       - COALESCE(oz.ileri,0) - COALESCE(oz.yanlis,0))::integer AS toplam_net_puan
    FROM kullanicilar k
    LEFT JOIN oz ON oz.kullanici_id = k.kullanici_id
    WHERE k.rol = 'bm' AND k.aktif_mi = true
  )
  SELECT b.kullanici_id, b.ad, b.soyad, b.firma_id, b.takim_id, b.bolge_id,
    b.izleme_puani, b.cevaplama_puani, b.extra_puani, b.cc_gonderme_puani, b.cc_referral_puani,
    b.ileri_sarma_kaybi, b.yanlis_cevap_kaybi, b.toplam_net_puan,
    RANK() OVER (ORDER BY b.toplam_net_puan DESC),
    RANK() OVER (PARTITION BY b.firma_id ORDER BY b.toplam_net_puan DESC),
    RANK() OVER (PARTITION BY b.takim_id ORDER BY b.toplam_net_puan DESC),
    RANK() OVER (PARTITION BY b.bolge_id ORDER BY b.toplam_net_puan DESC)
  FROM birlesik b
  ORDER BY b.toplam_net_puan DESC;
END;
$function$;

-- get_cc_ligi_* fonksiyonlarını güncelle
CREATE OR REPLACE FUNCTION public.get_cc_ligi_aylik(p_yil integer, p_ay integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    make_date(p_yil, p_ay, 1),
    (make_date(p_yil, p_ay, 1) + interval '1 month')::date
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_cc_ligi_donemlik(p_yil integer, p_ceyrek integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1),
    (make_date(p_yil, (p_ceyrek - 1) * 3 + 1, 1) + interval '3 months')::date
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_cc_ligi_yillik(p_yil integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    make_date(p_yil, 1, 1),
    make_date(p_yil + 1, 1, 1)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_cc_ligi_haftalik(p_yil integer, p_hafta integer)
 RETURNS TABLE(kullanici_id uuid, ad text, soyad text, firma_id uuid, takim_id uuid, bolge_id uuid, izleme_puani integer, cevaplama_puani integer, extra_puani integer, cc_gonderme_puani integer, cc_referral_puani integer, ileri_sarma_kaybi integer, yanlis_cevap_kaybi integer, toplam_net_puan integer, genel_sira bigint, firma_sirasi bigint, takim_sirasi bigint, bolge_sirasi bigint)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public._cc_ligi_aralik(
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7),
    (date_trunc('week', make_date(p_yil, 1, 1))::date + (p_hafta - 1) * 7 + 7)
  );
$function$;

-- 5. v_cc_challenge_listesi görünümünü güncelle (firma_id eklendi, durum sadeleştirildi)
CREATE OR REPLACE VIEW public.v_cc_challenge_listesi AS
SELECT
  ck.challenge_id,
  g.firma_id,
  ck.gonderen_id,
  (g.ad::text || ' '::text) || g.soyad::text AS challenger_adi,
  ck.alan_id,
  (a.ad::text || ' '::text) || a.soyad::text AS challengee_adi,
  ck.yayin_id,
  vyd.urun_adi,
  vyd.teknik_adi,
  ck.created_at AS challenge_tarihi,
  ck.son_tarih,
  ck.izlendi_mi,
  CASE
    WHEN ck.izlendi_mi = true THEN 'İzlendi'::text
    ELSE 'Bekliyor'::text
  END AS durum,
  (
    SELECT ik.izleme_bitis
    FROM public.cc_izleme_kayitlari ik
    WHERE ik.bm_id = ck.alan_id
      AND ik.yayin_id = ck.yayin_id
      AND ik.challenge_id = ck.challenge_id
      AND ik.tamamlandi_mi = true
    ORDER BY ik.izleme_bitis
    LIMIT 1
  ) AS izleme_tarihi
FROM public.challenge_kayitlari ck
JOIN public.kullanicilar g ON g.kullanici_id = ck.gonderen_id
JOIN public.kullanicilar a ON a.kullanici_id = ck.alan_id
JOIN public.v_yayin_detay vyd ON vyd.yayin_id = ck.yayin_id;

REVOKE ALL ON public.v_cc_challenge_listesi FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_cc_challenge_listesi TO service_role;

GRANT EXECUTE ON FUNCTION public._cc_ligi_aralik(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_aylik(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_donemlik(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_yillik(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_haftalik(integer, integer) TO service_role;

COMMIT;
