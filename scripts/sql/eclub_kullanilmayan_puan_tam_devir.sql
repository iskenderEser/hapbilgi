-- E-Club: kullanılmayan çekli puanlar eksiksiz devreder.
-- Supabase SQL Editor'da TEK PARÇA çalıştırılır. DB'de ajan tarafından çalıştırılmadı.
-- Geçmiş dönemler de yeniden hesaplanır; kazanım ve talep kayıtları silinmez.
-- Talep takvimi, baremler, çek üst sınırı ve teslimat kanalları değiştirilmez.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtextextended('eclub-tam-devir-20261009', 0));
-- Geçiş sırasında kazanım/talep/devir yazımları bekler; okuma devam eder.
LOCK TABLE public.eclub_kazanilan_puanlar,
  public.eclub_store_cek_talepleri,
  public.eclub_store_puan_devirleri IN SHARE ROW EXCLUSIVE MODE;

-- Eski tanım ve devir kayıtları bir kez yedeklenir. Tekrar çalıştırma yedeği ezmez.
CREATE TABLE IF NOT EXISTS public.eclub_tam_devir_gecis_yedegi (
  anahtar text PRIMARY KEY,
  kayit jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eclub_tam_devir_gecis_yedegi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eclub_tam_devir_gecis_yedegi FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.eclub_tam_devir_gecis_yedegi TO service_role;
INSERT INTO public.eclub_tam_devir_gecis_yedegi(anahtar, kayit)
SELECT 'fonksiyon', jsonb_build_object('tanim', pg_get_functiondef(
  'public.eclub_store_onceki_deviri_hazirla(uuid,uuid,text)'::regprocedure))
ON CONFLICT (anahtar) DO NOTHING;
INSERT INTO public.eclub_tam_devir_gecis_yedegi(anahtar, kayit)
SELECT 'devir:' || d.devir_id, to_jsonb(d)
FROM public.eclub_store_puan_devirleri d
ON CONFLICT (anahtar) DO NOTHING;

CREATE OR REPLACE FUNCTION public.eclub_store_onceki_deviri_hazirla(
  p_eczane_id uuid, p_yayin_id uuid, p_hedef_donem text
)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_hedef_bas timestamptz;
  v_ilk text;
  v_kaynak text;
  v_sonraki text;
  v_bas timestamptz;
  v_bit timestamptz;
  v_kazanc bigint;
  v_gelen bigint;
  v_kullanilan bigint;
  v_kalan bigint;
  v_talep uuid;
BEGIN
  -- Dönem kodu ve takvim ortak fonksiyondan doğrulanır.
  SELECT baslangic INTO v_hedef_bas
  FROM public.eclub_store_donem_sinirlari(p_hedef_donem);
  IF v_hedef_bas IS NULL OR p_eczane_id IS NULL OR p_yayin_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz devir kapsamı';
  END IF;
  -- Aynı eczane/yayın için hesaplama zinciri tek işlemde yürür.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'eclub-tam-devir:' || p_eczane_id || ':' || p_yayin_id, 0));

  SELECT min(donem) INTO v_ilk FROM (
    SELECT extract(year FROM kp.created_at AT TIME ZONE 'Europe/Istanbul')::integer::text
      || '-P' || ((extract(month FROM kp.created_at AT TIME ZONE 'Europe/Istanbul')::integer + 1) / 2)::text AS donem
    FROM public.eclub_kazanilan_puanlar kp
    WHERE kp.eczane_id = p_eczane_id AND kp.yayin_id = p_yayin_id
      AND kp.cek_karsiligi_var_mi = true AND kp.created_at < v_hedef_bas
    UNION ALL
    SELECT d.kaynak_donem_kodu FROM public.eclub_store_puan_devirleri d
    WHERE d.eczane_id = p_eczane_id AND d.yayin_id = p_yayin_id
    UNION ALL
    SELECT t.donem_kodu FROM public.eclub_store_cek_talepleri t
    WHERE t.eczane_id = p_eczane_id AND t.yayin_id = p_yayin_id
  ) kaynaklar;
  IF v_ilk IS NULL OR v_ilk >= p_hedef_donem THEN RETURN; END IF;
  v_kaynak := v_ilk;

  WHILE v_kaynak < p_hedef_donem LOOP
    SELECT baslangic, bitis_haric, sonraki_donem_kodu
    INTO v_bas, v_bit, v_sonraki
    FROM public.eclub_store_donem_sinirlari(v_kaynak);
    -- Kaynak dönemin 1–7 talep penceresi kapanmadan devir kesinleşmez.
    IF now() < v_bit + interval '7 days' THEN
      RAISE EXCEPTION 'Kaynak dönem talep süresi henüz kapanmadı: %', v_kaynak;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'eclub-devir:' || p_eczane_id || ':' || p_yayin_id || ':' || v_kaynak, 0));

    SELECT coalesce(sum(kp.puan), 0) INTO v_kazanc
    FROM public.eclub_kazanilan_puanlar kp
    WHERE kp.eczane_id = p_eczane_id AND kp.yayin_id = p_yayin_id
      AND kp.cek_karsiligi_var_mi = true
      AND kp.created_at >= v_bas AND kp.created_at < v_bit;
    -- Tarihsel hesabın girdisi kullanılmış devirleri de içerir;
    -- kullanılan tutar aşağıdaki talep kaydından yalnız bir kez düşülür.
    SELECT coalesce(sum(d.puan), 0) INTO v_gelen
    FROM public.eclub_store_puan_devirleri d
    WHERE d.eczane_id = p_eczane_id AND d.yayin_id = p_yayin_id
      AND d.hedef_donem_kodu = v_kaynak AND d.iptal_edildi = false;
    SELECT coalesce(sum(t.toplanan_puan), 0) INTO v_kullanilan
    FROM public.eclub_store_cek_talepleri t
    WHERE t.eczane_id = p_eczane_id AND t.yayin_id = p_yayin_id
      AND t.donem_kodu = v_kaynak AND t.durum <> 'iptal';
    SELECT t.talep_id INTO v_talep
    FROM public.eclub_store_cek_talepleri t
    WHERE t.eczane_id = p_eczane_id AND t.yayin_id = p_yayin_id
      AND t.donem_kodu = v_kaynak AND t.durum <> 'iptal';
    -- Kaynağı bulunmayan eski bir bakiyeyi sıfırlamak yerine geçişi durdur.
    IF v_kazanc + v_gelen = 0 AND EXISTS (
      SELECT 1 FROM public.eclub_store_puan_devirleri d
      WHERE d.eczane_id = p_eczane_id AND d.yayin_id = p_yayin_id
        AND d.kaynak_donem_kodu = v_kaynak AND d.iptal_edildi = false
    ) THEN
      RAISE EXCEPTION 'Eski devrin kazanım kaynağı doğrulanamadı: eczane %, yayın %, dönem %',
        p_eczane_id, p_yayin_id, v_kaynak;
    END IF;
    v_kalan := v_kazanc + v_gelen - v_kullanilan;
    IF v_kalan < 0 OR v_kalan > 2147483647 THEN
      RAISE EXCEPTION 'Devir hesabı tutarsız: eczane %, yayın %, dönem %, kazanç %, gelen %, kullanılan %',
        p_eczane_id, p_yayin_id, v_kaynak, v_kazanc, v_gelen, v_kullanilan;
    END IF;

    IF v_kalan > 0 THEN
      INSERT INTO public.eclub_store_puan_devirleri (
        eczane_id, yayin_id, kaynak_donem_kodu, hedef_donem_kodu, puan, kaynak_talep_id
      ) VALUES (p_eczane_id, p_yayin_id, v_kaynak, v_sonraki, v_kalan::integer, v_talep)
      ON CONFLICT (eczane_id, yayin_id, kaynak_donem_kodu) WHERE iptal_edildi = false
      DO UPDATE SET puan = EXCLUDED.puan,
        hedef_donem_kodu = EXCLUDED.hedef_donem_kodu,
        kaynak_talep_id = EXCLUDED.kaynak_talep_id,
        guncellenme_at = now()
      WHERE eclub_store_puan_devirleri.puan IS DISTINCT FROM EXCLUDED.puan
        OR eclub_store_puan_devirleri.hedef_donem_kodu IS DISTINCT FROM EXCLUDED.hedef_donem_kodu
        OR eclub_store_puan_devirleri.kaynak_talep_id IS DISTINCT FROM EXCLUDED.kaynak_talep_id;
    ELSE
      -- Eski artık kaydı artık geçerli değilse tarihçe korunarak pasifleştirilir.
      UPDATE public.eclub_store_puan_devirleri
      SET iptal_edildi = true, guncellenme_at = now()
      WHERE eczane_id = p_eczane_id AND yayin_id = p_yayin_id
        AND kaynak_donem_kodu = v_kaynak AND iptal_edildi = false;
    END IF;
    -- Girdi devir bir sonraki döneme taşındı veya talebe ayrıldı.
    UPDATE public.eclub_store_puan_devirleri
    SET kullanildi_mi = true, kullanilan_talep_id = v_talep, guncellenme_at = now()
    WHERE eczane_id = p_eczane_id AND yayin_id = p_yayin_id
      AND hedef_donem_kodu = v_kaynak AND iptal_edildi = false
      AND (kullanildi_mi = false OR kullanilan_talep_id IS DISTINCT FROM v_talep);
    v_kaynak := v_sonraki;
  END LOOP;

  -- Bağımsız toplam kontrolü: geçmiş kazanım - kullanılan puan = hedefe gelen bakiye.
  -- Kullanılmış hedef devirleri de sayılır; hedef dönemin talebi burada düşülmez.
  SELECT coalesce(sum(kp.puan), 0) INTO v_kazanc
  FROM public.eclub_kazanilan_puanlar kp
  WHERE kp.eczane_id = p_eczane_id AND kp.yayin_id = p_yayin_id
    AND kp.cek_karsiligi_var_mi = true AND kp.created_at < v_hedef_bas;
  SELECT coalesce(sum(t.toplanan_puan), 0) INTO v_kullanilan
  FROM public.eclub_store_cek_talepleri t
  WHERE t.eczane_id = p_eczane_id AND t.yayin_id = p_yayin_id
    AND t.donem_kodu < p_hedef_donem AND t.durum <> 'iptal';
  SELECT coalesce(sum(d.puan), 0) INTO v_gelen
  FROM public.eclub_store_puan_devirleri d
  WHERE d.eczane_id = p_eczane_id AND d.yayin_id = p_yayin_id
    AND d.hedef_donem_kodu = p_hedef_donem AND d.iptal_edildi = false;
  IF v_kazanc - v_kullanilan <> v_gelen THEN
    RAISE EXCEPTION 'Toplam puan mutabakatı başarısız: eczane %, yayın %, beklenen %, bulunan %',
      p_eczane_id, p_yayin_id, v_kazanc - v_kullanilan, v_gelen;
  END IF;
END;
$fonksiyon$;
REVOKE ALL ON FUNCTION public.eclub_store_onceki_deviri_hazirla(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_onceki_deviri_hazirla(uuid,uuid,text) TO service_role;

-- Geçmişte aktarılmayan puanları, gerçek kazanım ve talep kayıtlarından hesapla.
-- Sahte sipariş, sahte kazanım veya çek talebi oluşturulmaz.
DO $gecis$
DECLARE r record; v_hedef text;
BEGIN
  SELECT donem_kodu INTO v_hedef FROM public.eclub_store_aktif_donem();
  FOR r IN
    SELECT eczane_id, yayin_id FROM public.eclub_kazanilan_puanlar
    WHERE cek_karsiligi_var_mi = true
    UNION
    SELECT eczane_id, yayin_id FROM public.eclub_store_puan_devirleri
    UNION
    SELECT eczane_id, yayin_id FROM public.eclub_store_cek_talepleri
  LOOP
    PERFORM public.eclub_store_onceki_deviri_hazirla(r.eczane_id, r.yayin_id, v_hedef);
  END LOOP;
END;
$gecis$;

-- İşlem sonrası özet (kişisel bilgi içermez).
SELECT 'TAMAMLANDI' AS sql_sonucu, d.donem_kodu AS hedef_donem,
  count(p.devir_id) AS kullanilmamis_devir_kaydi,
  coalesce(sum(p.puan), 0) AS devreden_toplam_puan
FROM public.eclub_store_aktif_donem() d
LEFT JOIN public.eclub_store_puan_devirleri p ON p.hedef_donem_kodu = d.donem_kodu
  AND p.iptal_edildi = false AND p.kullanildi_mi = false
GROUP BY d.donem_kodu;
COMMIT;
