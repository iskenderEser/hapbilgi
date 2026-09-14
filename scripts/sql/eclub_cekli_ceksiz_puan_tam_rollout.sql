-- ============================================================================
-- FAZ 10 — MASTER MIGRATION VE GÜVENLİK DENETİMİ ROLLOUT ZİNCİRİ
-- Proje: E-Club Çekli Puan ve Çeksiz Puan Ayrımı (Uçtan Uca Bütünlük)
--
-- Kurallar ve Güvenlik Güvenceleri:
--   1. Transaction içinde çalışır (BEGIN ... COMMIT).
--   2. Eşzamanlı migration çakışmalarını önlemek için pg_advisory_xact_lock kullanır.
--   3. Kolonlar IF NOT EXISTS ile eklenir.
--   4. Backfill (IS NULL kontrolü) tamamlanmadan NOT NULL uygulanmaz.
--   5. İkinci kez çalıştırmada (idempotency) false olan kayıtlar asla ezilmez.
--   6. Trigger'lar istemci/RPC parametrelerine güvenmez; yayın tablosundan sınıfı sabitler.
--   7. search_path = public açıkça tanımlanmıştır (search_path hijacking engeli).
--   8. anon ve PUBLIC rollerinden tüm kritik EXECUTE izinleri kaldırılmıştır.
--   9. Store ve hediye çeki RPC'leri Çeksiz Puanı kullanamaz.
--  10. PostgREST şema yenileme bildirimi (NOTIFY pgrst) ile sonlanır.
-- ============================================================================

BEGIN;

-- 1. Migration Düzeyinde Transactional Advisory Lock
SELECT pg_advisory_xact_lock(hashtextextended('eclub-cekli-ceksiz-master-migration-lock', 0));

-- ----------------------------------------------------------------------------
-- 2. Tablo Şeması Güncellemeleri ve Tekrar Güvenli Backfill
-- ----------------------------------------------------------------------------

-- 2.1. yayin_yonetimi
ALTER TABLE public.yayin_yonetimi
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean DEFAULT true;

ALTER TABLE public.yayin_yonetimi
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.yayin_yonetimi
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.yayin_yonetimi
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- 2.2. eclub_kazanilan_puanlar
ALTER TABLE public.eclub_kazanilan_puanlar
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean DEFAULT true;

ALTER TABLE public.eclub_kazanilan_puanlar
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.eclub_kazanilan_puanlar
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.eclub_kazanilan_puanlar
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- 2.3. eclub_ileri_sarma_kayitlari
ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean DEFAULT true;

ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;

UPDATE public.eclub_ileri_sarma_kayitlari
  SET cek_karsiligi_var_mi = true
  WHERE cek_karsiligi_var_mi IS NULL;

ALTER TABLE public.eclub_ileri_sarma_kayitlari
  ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Güvenlikli ve Değişmez (Immutable) BEFORE INSERT Trigger Fonksiyonları
-- ----------------------------------------------------------------------------

-- 3.1. Kazanılan Puanlar Trigger'ı (İstemci girdisi yok sayılır, yayından sabitlenir)
CREATE OR REPLACE FUNCTION public.tg_eclub_kazanilan_puanlar_cek_karsiligi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cek_karsiligi boolean;
BEGIN
  IF NEW.yayin_id IS NULL THEN
    RAISE EXCEPTION 'eclub_kazanilan_puanlar: yayin_id zorunludur.';
  END IF;

  SELECT y.cek_karsiligi_var_mi
    INTO v_cek_karsiligi
    FROM public.yayin_yonetimi y
   WHERE y.yayin_id = NEW.yayin_id;

  IF v_cek_karsiligi IS NULL THEN
    RAISE EXCEPTION 'eclub_kazanilan_puanlar: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı (yayin_id: %).', NEW.yayin_id;
  END IF;

  NEW.cek_karsiligi_var_mi := v_cek_karsiligi;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eclub_kazanilan_puanlar_cek_karsiligi ON public.eclub_kazanilan_puanlar;
CREATE TRIGGER trg_eclub_kazanilan_puanlar_cek_karsiligi
  BEFORE INSERT ON public.eclub_kazanilan_puanlar
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_eclub_kazanilan_puanlar_cek_karsiligi();

-- 3.2. İleri Sarma Kayıtları Trigger'ı (Fail-closed)
CREATE OR REPLACE FUNCTION public.tg_eclub_ileri_sarma_kayitlari_cek_karsiligi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cek_karsiligi boolean;
BEGIN
  IF NEW.yayin_id IS NULL THEN
    RAISE EXCEPTION 'eclub_ileri_sarma_kayitlari: yayin_id zorunludur.';
  END IF;

  SELECT y.cek_karsiligi_var_mi
    INTO v_cek_karsiligi
    FROM public.yayin_yonetimi y
   WHERE y.yayin_id = NEW.yayin_id;

  IF v_cek_karsiligi IS NULL THEN
    RAISE EXCEPTION 'eclub_ileri_sarma_kayitlari: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı (yayin_id: %).', NEW.yayin_id;
  END IF;

  NEW.cek_karsiligi_var_mi := v_cek_karsiligi;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eclub_ileri_sarma_kayitlari_cek_karsiligi ON public.eclub_ileri_sarma_kayitlari;
CREATE TRIGGER trg_eclub_ileri_sarma_kayitlari_cek_karsiligi
  BEFORE INSERT ON public.eclub_ileri_sarma_kayitlari
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_eclub_ileri_sarma_kayitlari_cek_karsiligi();

-- ----------------------------------------------------------------------------
-- 4. E-Club Ligi Raporu (get_eclub_utt_rapor) — Çekli/Çeksiz Ayrımı
-- ----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_eclub_utt_rapor(uuid, timestamp with time zone, timestamp with time zone);
CREATE FUNCTION public.get_eclub_utt_rapor(
  p_utt_id uuid,
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone
)
RETURNS TABLE(
  eczane_id uuid,
  gln character varying,
  eczane_adi character varying,
  kisi_id uuid,
  kisi_ad character varying,
  kisi_soyad character varying,
  kisi_rol character varying,
  icerik_anahtari text,
  icerik_adi text,
  gonderilen_sayisi bigint,
  tamamlanan_izleme bigint,
  dogru_cevap bigint,
  yanlis_cevap bigint,
  izleme_puani bigint,
  cevaplama_puani bigint,
  cekli_puan bigint,
  ceksiz_puan bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH kapsam_eczaneler AS (
    SELECT DISTINCT ef.eczane_id
    FROM public.eclub_utt_eczane ue
    JOIN public.eclub_eczane_firma ef ON ef.id = ue.eczane_firma_id
    WHERE ue.utt_id = p_utt_id
      AND ue.aktif_mi = true
      AND ef.aktif_mi = true
  ),
  temel AS (
    SELECT
      ke.eczane_id,
      e.gln,
      m.eczane_adi,
      k.kisi_id,
      k.ad AS kisi_ad,
      k.soyad AS kisi_soyad,
      k.rol AS kisi_rol
    FROM kapsam_eczaneler ke
    JOIN public.eclub_eczaneler e ON e.eczane_id = ke.eczane_id
    LEFT JOIN public.eclub_eczane_master m ON m.gln = e.gln
    LEFT JOIN public.eclub_kisi_eczane kke
      ON kke.eczane_id = ke.eczane_id
     AND kke.aktif_mi = true
    LEFT JOIN public.eclub_kisiler k ON k.kisi_id = kke.kisi_id
  ),
  yayin_bilgi AS (
    SELECT DISTINCT ON (ky.yayin_id)
      ky.yayin_id,
      COALESCE(ky.urun_id::text, ky.teknik_id::text, ky.yayin_id::text) AS icerik_anahtari,
      COALESCE(vd.urun_adi, vd.teknik_adi, 'Diğer')::text AS icerik_adi
    FROM public.v_yayin_kunye ky
    LEFT JOIN public.v_yayin_detay vd ON vd.yayin_id = ky.yayin_id
    ORDER BY ky.yayin_id
  ),
  tum_oneriler AS (
    SELECT
      o.oneri_id,
      o.kisi_id,
      o.yayin_id,
      COALESCE(yb.icerik_anahtari, o.yayin_id::text) AS icerik_anahtari,
      COALESCE(yb.icerik_adi, 'Diğer') AS icerik_adi,
      COALESCE(o.created_at, o.oneri_baslangic) AS created_at
    FROM public.eclub_oneri_kayitlari o
    LEFT JOIN yayin_bilgi yb ON yb.yayin_id = o.yayin_id
    WHERE o.oneren_id = p_utt_id
  ),
  donem_oneri AS (
    SELECT
      o.kisi_id,
      o.icerik_anahtari,
      o.icerik_adi,
      COUNT(*) AS gonderilen_sayisi
    FROM tum_oneriler o
    WHERE o.created_at >= p_baslangic
      AND o.created_at < p_bitis
    GROUP BY o.kisi_id, o.icerik_anahtari, o.icerik_adi
  ),
  tum_izlemeler AS (
    SELECT
      ik.izleme_id,
      ik.kisi_id,
      ik.yayin_id,
      COALESCE(yb.icerik_anahtari, ik.yayin_id::text) AS icerik_anahtari,
      COALESCE(yb.icerik_adi, 'Diğer') AS icerik_adi,
      ik.created_at
    FROM public.eclub_izleme_kayitlari ik
    LEFT JOIN yayin_bilgi yb ON yb.yayin_id = ik.yayin_id
    WHERE ik.oneren_id = p_utt_id
      AND ik.tamamlandi_mi = true
  ),
  donem_izleme AS (
    SELECT
      i.kisi_id,
      i.icerik_anahtari,
      i.icerik_adi,
      COUNT(*) AS tamamlanan_izleme
    FROM tum_izlemeler i
    WHERE i.created_at >= p_baslangic
      AND i.created_at < p_bitis
    GROUP BY i.kisi_id, i.icerik_anahtari, i.icerik_adi
  ),
  tum_cevaplar AS (
    SELECT
      ck.id,
      ck.kisi_id,
      ck.yayin_id,
      COALESCE(yb.icerik_anahtari, ck.yayin_id::text) AS icerik_anahtari,
      COALESCE(yb.icerik_adi, 'Diğer') AS icerik_adi,
      ck.dogru_mu,
      ck.created_at
    FROM public.eclub_soru_cevap_kayitlari ck
    LEFT JOIN yayin_bilgi yb ON yb.yayin_id = ck.yayin_id
    WHERE ck.oneren_id = p_utt_id
  ),
  donem_cevap AS (
    SELECT
      c.kisi_id,
      c.icerik_anahtari,
      c.icerik_adi,
      COUNT(*) FILTER (WHERE c.dogru_mu = true) AS dogru_cevap,
      COUNT(*) FILTER (WHERE c.dogru_mu = false) AS yanlis_cevap
    FROM tum_cevaplar c
    WHERE c.created_at >= p_baslangic
      AND c.created_at < p_bitis
    GROUP BY c.kisi_id, c.icerik_anahtari, c.icerik_adi
  ),
  donem_puanlar AS (
    SELECT
      kp.kisi_id,
      COALESCE(yb.icerik_anahtari, kp.yayin_id::text) AS icerik_anahtari,
      COALESCE(yb.icerik_adi, 'Diğer') AS icerik_adi,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0) AS izleme_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevap'), 0) AS cevaplama_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.cek_karsiligi_var_mi = true), 0) AS cekli_puan,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.cek_karsiligi_var_mi = false), 0) AS ceksiz_puan
    FROM public.eclub_kazanilan_puanlar kp
    LEFT JOIN yayin_bilgi yb ON yb.yayin_id = kp.yayin_id
    WHERE kp.oneren_id = p_utt_id
      AND kp.created_at >= p_baslangic
      AND kp.created_at < p_bitis
    GROUP BY kp.kisi_id, COALESCE(yb.icerik_anahtari, kp.yayin_id::text), COALESCE(yb.icerik_adi, 'Diğer')
  ),
  kisi_icerik_kombinasyon AS (
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM donem_oneri
    UNION
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM donem_izleme
    UNION
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM donem_cevap
    UNION
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM donem_puanlar
  )
  SELECT
    t.eczane_id,
    t.gln,
    t.eczane_adi,
    t.kisi_id,
    t.kisi_ad,
    t.kisi_soyad,
    t.kisi_rol,
    kik.icerik_anahtari,
    kik.icerik_adi,
    COALESCE(o.gonderilen_sayisi, 0)::bigint,
    COALESCE(i.tamamlanan_izleme, 0)::bigint,
    COALESCE(c.dogru_cevap, 0)::bigint,
    COALESCE(c.yanlis_cevap, 0)::bigint,
    COALESCE(p.izleme_puani, 0)::bigint,
    COALESCE(p.cevaplama_puani, 0)::bigint,
    COALESCE(p.cekli_puan, 0)::bigint,
    COALESCE(p.ceksiz_puan, 0)::bigint
  FROM temel t
  JOIN kisi_icerik_kombinasyon kik ON kik.kisi_id = t.kisi_id
  LEFT JOIN donem_oneri o ON o.kisi_id = kik.kisi_id AND o.icerik_anahtari = kik.icerik_anahtari
  LEFT JOIN donem_izleme i ON i.kisi_id = kik.kisi_id AND i.icerik_anahtari = kik.icerik_anahtari
  LEFT JOIN donem_cevap c ON c.kisi_id = kik.kisi_id AND c.icerik_anahtari = kik.icerik_anahtari
  LEFT JOIN donem_puanlar p ON p.kisi_id = kik.kisi_id AND p.icerik_anahtari = kik.icerik_anahtari
  WHERE t.kisi_id IS NOT NULL;
$function$;

-- ----------------------------------------------------------------------------
-- 5. Store Firma Bakiyesi (get_eclub_store_firma_bakiye) — Yalnız Çekli Puan
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_eclub_store_firma_bakiye(p_kisi_id uuid)
RETURNS TABLE(firma_id uuid, firma_adi character varying, kazanilan bigint, harcanan bigint, bakiye bigint)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  WITH kazanc AS (
    SELECT ky.firma_id, COALESCE(SUM(kp.puan), 0) AS kazanilan
    FROM public.eclub_kazanilan_puanlar kp
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kisi_id = p_kisi_id
      AND kp.cek_karsiligi_var_mi = true
    GROUP BY ky.firma_id
  ),
  kayip AS (
    SELECT ky.firma_id, COALESCE(SUM(ks.kaybedilen_puan), 0) AS kaybedilen
    FROM public.eclub_ileri_sarma_kayitlari ks
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = ks.yayin_id
    WHERE ks.kisi_id = p_kisi_id
      AND ks.cek_karsiligi_var_mi = true
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
$function$;

-- ----------------------------------------------------------------------------
-- 6. Hediye Çeki Fonksiyonları (Devir, Özet ve Talep) — Yalnız Çekli Puan
-- ----------------------------------------------------------------------------

-- 6.1. Önceki Devir Hazırlama
CREATE OR REPLACE FUNCTION public.eclub_store_onceki_deviri_hazirla(p_eczane_id uuid,p_yayin_id uuid,p_hedef_donem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public, pg_temp AS $f$
DECLARE
  v_kaynak text;
  v_bas timestamptz;
  v_bit timestamptz;
  v_min integer;
  v_max integer;
  v_kazanc integer;
  v_gelen integer;
  v_toplam integer;
  v_devir integer:=0;
  v_cekli boolean;
BEGIN
  SELECT d.kaynak_donem_kodu INTO v_kaynak FROM (SELECT CASE WHEN substring(p_hedef_donem,7,1)::int=1 THEN (substring(p_hedef_donem,1,4)::int-1)::text||'-P6' ELSE substring(p_hedef_donem,1,4)||'-P'||(substring(p_hedef_donem,7,1)::int-1)::text END kaynak_donem_kodu) d;
  PERFORM pg_advisory_xact_lock(hashtextextended('eclub-devir:'||p_eczane_id||':'||p_yayin_id||':'||v_kaynak,0));
  IF EXISTS(SELECT 1 FROM public.eclub_store_puan_devirleri WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND kaynak_donem_kodu=v_kaynak AND iptal_edildi=false) OR
     EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND donem_kodu=v_kaynak AND durum<>'iptal') THEN RETURN; END IF;

  -- Çeksiz yayınlar için devir kaydı oluşturulmaz
  SELECT y.cek_karsiligi_var_mi INTO v_cekli FROM public.yayin_yonetimi y WHERE y.yayin_id=p_yayin_id;
  IF coalesce(v_cekli, true) = false THEN RETURN; END IF;

  SELECT baslangic,bitis_haric INTO v_bas,v_bit FROM public.eclub_store_donem_sinirlari(v_kaynak);
  SELECT min((x->>'min_puan')::int),max((x->>'max_puan')::int) INTO v_min,v_max FROM public.yayin_yonetimi y, jsonb_array_elements(y.barem_tablosu) x WHERE y.yayin_id=p_yayin_id;
  IF v_min IS NULL THEN RETURN; END IF;

  SELECT coalesce(sum(kp.puan),0)::int INTO v_kazanc
  FROM public.eclub_kazanilan_puanlar kp
  JOIN public.eclub_kisi_eczane ke ON ke.kisi_id=kp.kisi_id AND ke.eczane_id=p_eczane_id AND ke.aktif_mi=true
  WHERE kp.yayin_id=p_yayin_id
    AND kp.created_at>=v_bas
    AND kp.created_at<v_bit
    AND kp.cek_karsiligi_var_mi = true;

  SELECT coalesce(sum(puan),0)::int INTO v_gelen
  FROM public.eclub_store_puan_devirleri
  WHERE eczane_id=p_eczane_id
    AND yayin_id=p_yayin_id
    AND hedef_donem_kodu=v_kaynak
    AND kullanildi_mi=false
    AND iptal_edildi=false;

  v_toplam:=v_kazanc+v_gelen;
  IF v_toplam>0 AND v_toplam<v_min THEN v_devir:=v_toplam;
  ELSIF v_toplam>v_max THEN v_devir:=v_toplam-v_max; END IF;

  IF v_devir>0 THEN
    INSERT INTO public.eclub_store_puan_devirleri(eczane_id,yayin_id,kaynak_donem_kodu,hedef_donem_kodu,puan)
    VALUES(p_eczane_id,p_yayin_id,v_kaynak,p_hedef_donem,v_devir)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.eclub_store_puan_devirleri
  SET kullanildi_mi=true,guncellenme_at=now()
  WHERE eczane_id=p_eczane_id
    AND yayin_id=p_yayin_id
    AND hedef_donem_kodu=v_kaynak
    AND kullanildi_mi=false
    AND iptal_edildi=false;
END $f$;

-- 6.2. Eczane Store Özeti (Çeksiz yayınlar listelenmez)
DROP FUNCTION IF EXISTS public.get_eclub_eczane_store_ozet(uuid);
CREATE FUNCTION public.get_eclub_eczane_store_ozet(p_kisi_id uuid)
RETURNS TABLE(
  yayin_id uuid,
  urun_id uuid,
  urun_adi text,
  firma_id uuid,
  firma_adi text,
  eczane_id uuid,
  eczane_adi text,
  toplanan_puan integer,
  satis_sarti_tipi text,
  gizli_sart_katlama_orani integer,
  barem_tablosu jsonb,
  karsilik_puan integer,
  karsilik_tl numeric,
  uygun_adet integer,
  uygun_mal_fazlasi integer,
  hak_edilen_cek_tl numeric,
  katlanmis_cek_tl numeric,
  talep_durumu text,
  cek_kodu text,
  donem_kodu text,
  talep_penceresi_acik_mi boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public, pg_temp AS $f$
DECLARE
  v_eczane uuid;
  v_ad text;
  v_d record;
  r record;
BEGIN
  SELECT ke.eczane_id,coalesce(em.eczane_adi,'Eczane') INTO v_eczane,v_ad
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_eczaneler e ON e.eczane_id=ke.eczane_id
  LEFT JOIN public.eclub_eczane_master em ON em.gln=e.gln
  WHERE ke.kisi_id=p_kisi_id AND ke.aktif_mi=true
  LIMIT 1;

  IF v_eczane IS NULL THEN RETURN; END IF;
  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();

  -- Yalnız çekli yayınlar döngüye alınır
  FOR r IN
    SELECT y.yayin_id
    FROM public.yayin_yonetimi y
    JOIN public.v_yayin_kunye k ON k.yayin_id=y.yayin_id
    JOIN public.eclub_eczane_firma ef ON ef.eczane_id=v_eczane AND ef.firma_id=k.firma_id AND ef.aktif_mi=true
    WHERE y.barem_tablosu IS NOT NULL
      AND y.durum='yayinda'
      AND y.cek_karsiligi_var_mi = true
  LOOP
    PERFORM public.eclub_store_onceki_deviri_hazirla(v_eczane,r.yayin_id,v_d.donem_kodu);
  END LOOP;

  RETURN QUERY WITH personel AS (
    SELECT DISTINCT kisi_id
    FROM public.eclub_kisi_eczane
    WHERE eczane_id=v_eczane AND aktif_mi=true
  ), kazanc AS (
    SELECT kp.yayin_id,coalesce(sum(kp.puan),0)::int puan
    FROM public.eclub_kazanilan_puanlar kp
    JOIN personel p USING(kisi_id)
    WHERE kp.created_at>=v_d.donem_baslangic
      AND kp.created_at<v_d.donem_bitis_haric
      AND kp.cek_karsiligi_var_mi = true
    GROUP BY kp.yayin_id
  ), gelen AS (
    SELECT d.yayin_id,sum(d.puan)::int puan
    FROM public.eclub_store_puan_devirleri d
    WHERE d.eczane_id=v_eczane
      AND d.hedef_donem_kodu=v_d.donem_kodu
      AND d.kullanildi_mi=false
      AND d.iptal_edildi=false
    GROUP BY d.yayin_id
  )
  SELECT
    y.yayin_id,
    k.urun_id,
    coalesce(k.urun_adi,'Ürün')::text,
    k.firma_id,
    coalesce(f.firma_adi,'Firma')::text,
    v_eczane,
    v_ad,
    (coalesce(z.puan,0)+coalesce(g.puan,0))::int,
    y.satis_sarti_tipi,
    y.gizli_sart_katlama_orani,
    y.barem_tablosu,
    y.karsilik_puan,
    y.karsilik_tl,
    coalesce((SELECT (x->>'adet')::int FROM jsonb_array_elements(y.barem_tablosu) x WHERE coalesce(z.puan,0)+coalesce(g.puan,0)>=(x->>'min_puan')::int ORDER BY (x->>'min_puan')::int DESC LIMIT 1),0),
    coalesce((SELECT (x->>'mal_fazlasi')::int FROM jsonb_array_elements(y.barem_tablosu) x WHERE coalesce(z.puan,0)+coalesce(g.puan,0)>=(x->>'min_puan')::int ORDER BY (x->>'min_puan')::int DESC LIMIT 1),0),
    round(least(coalesce(z.puan,0)+coalesce(g.puan,0),(SELECT max((x->>'max_puan')::int) FROM jsonb_array_elements(y.barem_tablosu)x))*y.karsilik_tl/greatest(y.karsilik_puan,1),2),
    round(least(coalesce(z.puan,0)+coalesce(g.puan,0),(SELECT max((x->>'max_puan')::int) FROM jsonb_array_elements(y.barem_tablosu)x))*y.karsilik_tl/greatest(y.karsilik_puan,1)*(1+coalesce(y.gizli_sart_katlama_orani,0)/100.0),2),
    t.durum,
    t.cek_kodu,
    v_d.donem_kodu,
    v_d.talep_acik_mi
  FROM public.yayin_yonetimi y
  JOIN public.v_yayin_kunye k ON k.yayin_id=y.yayin_id
  LEFT JOIN public.firmalar f ON f.firma_id=k.firma_id
  LEFT JOIN kazanc z ON z.yayin_id=y.yayin_id
  LEFT JOIN gelen g ON g.yayin_id=y.yayin_id
  LEFT JOIN public.eclub_store_cek_talepleri t ON t.eczane_id=v_eczane AND t.yayin_id=y.yayin_id AND t.donem_kodu=v_d.donem_kodu AND t.durum<>'iptal'
  WHERE y.barem_tablosu IS NOT NULL
    AND y.durum='yayinda'
    AND public.eclub_store_barem_gecerli(y.barem_tablosu)
    AND y.cek_karsiligi_var_mi = true
    AND EXISTS(SELECT 1 FROM public.eclub_eczane_firma ef WHERE ef.eczane_id=v_eczane AND ef.firma_id=k.firma_id AND ef.aktif_mi=true);
END $f$;

-- 6.3. Çek Talebi Oluşturma (Doğrudan çağrıda Çeksiz yayın reddedilir)
CREATE OR REPLACE FUNCTION public.eclub_store_cek_talebi_olustur(p_kisi_id uuid,p_yayin_id uuid,p_siparis_verilsin_mi boolean)
RETURNS TABLE(ok boolean,talep_id uuid,hata text,cek_tutari numeric,devreden_puan integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public, pg_temp AS $f$
DECLARE
  v_eczane uuid;
  v_firma uuid;
  v_utt uuid;
  v_d record;
  v_y public.yayin_yonetimi%rowtype;
  v_bas numeric;
  v_gelen integer;
  v_toplam integer;
  v_min integer;
  v_max integer;
  v_kullan integer;
  v_devir integer;
  v_adet integer;
  v_mf integer;
  v_tl numeric;
  v_id uuid;
BEGIN
  SELECT ke.eczane_id INTO v_eczane
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler k ON k.kisi_id=ke.kisi_id
  WHERE ke.kisi_id=p_kisi_id AND ke.aktif_mi=true AND lower(k.rol) IN ('eczaci','ikinci_eczaci','yardimci_eczaci','eczane_teknisyeni')
  LIMIT 1;

  IF v_eczane IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Aktif eczane üyeliği bulunamadı.',0::numeric,0; RETURN; END IF;

  SELECT * INTO v_y FROM public.yayin_yonetimi WHERE yayin_yonetimi.yayin_id=p_yayin_id FOR SHARE;
  IF v_y.yayin_id IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Yayın bulunamadı.',0::numeric,0; RETURN; END IF;

  -- Çeksiz puan yayını için talep açılamaz (güvenli iş kuralı hatası)
  IF v_y.cek_karsiligi_var_mi = false THEN
    RETURN QUERY SELECT false,NULL::uuid,'Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz.',0::numeric,0;
    RETURN;
  END IF;

  SELECT k.firma_id INTO v_firma FROM public.v_yayin_kunye k WHERE k.yayin_id=p_yayin_id;
  IF v_firma IS NULL OR NOT public.eclub_store_barem_gecerli(v_y.barem_tablosu) THEN RETURN QUERY SELECT false,NULL::uuid,'Yayın veya barem ayarı geçersiz.',0::numeric,0; RETURN; END IF;

  SELECT ue.utt_id INTO v_utt
  FROM public.eclub_eczane_firma ef
  JOIN public.eclub_utt_eczane ue ON ue.eczane_firma_id=ef.id AND ue.aktif_mi=true
  JOIN public.kullanicilar u ON u.kullanici_id=ue.utt_id AND u.aktif_mi=true
  WHERE ef.eczane_id=v_eczane AND ef.firma_id=v_firma AND ef.aktif_mi=true
  ORDER BY ue.created_at DESC
  LIMIT 1;

  IF v_utt IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Bu yayın firması için aktif UTT bağlantısı bulunamadı.',0::numeric,0; RETURN; END IF;

  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();
  IF NOT v_d.talep_acik_mi THEN RETURN QUERY SELECT false,NULL::uuid,'Çek talep dönemi kapalıdır.',0::numeric,0; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('eclub-talep:'||v_eczane||':'||p_yayin_id||':'||v_d.donem_kodu,0));
  IF EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND donem_kodu=v_d.donem_kodu AND durum<>'iptal') THEN
    RETURN QUERY SELECT false,NULL::uuid,'Bu dönem için talep zaten oluşturuldu.',0::numeric,0;
    RETURN;
  END IF;

  PERFORM public.eclub_store_onceki_deviri_hazirla(v_eczane,p_yayin_id,v_d.donem_kodu);

  -- Puanlar yalnız Çekli Puanlardan toplanır
  SELECT coalesce(sum(kp.puan),0) INTO v_bas
  FROM public.eclub_kazanilan_puanlar kp
  JOIN public.eclub_kisi_eczane ke ON ke.kisi_id=kp.kisi_id AND ke.eczane_id=v_eczane AND ke.aktif_mi=true
  WHERE kp.yayin_id=p_yayin_id
    AND kp.created_at>=v_d.donem_baslangic
    AND kp.created_at<v_d.donem_bitis_haric
    AND kp.cek_karsiligi_var_mi = true;

  PERFORM 1 FROM public.eclub_store_puan_devirleri
  WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false FOR UPDATE;

  SELECT coalesce(sum(puan),0)::int INTO v_gelen
  FROM public.eclub_store_puan_devirleri
  WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false;

  v_toplam:=v_bas::int+v_gelen;
  SELECT min((x->>'min_puan')::int),max((x->>'max_puan')::int) INTO v_min,v_max
  FROM jsonb_array_elements(v_y.barem_tablosu) x;

  IF v_toplam<v_min THEN
    RETURN QUERY SELECT false,NULL::uuid,('Minimum '||v_min||' puan gereklidir; bakiye sonraki döneme devreder.'),0::numeric,v_toplam;
    RETURN;
  END IF;

  IF v_y.satis_sarti_tipi='satis_sartli' AND NOT p_siparis_verilsin_mi THEN
    RETURN QUERY SELECT false,NULL::uuid,'Bu yayın için sipariş zorunludur.',0::numeric,0;
    RETURN;
  END IF;

  v_kullan:=least(v_toplam,v_max);
  v_devir:=greatest(v_toplam-v_max,0);

  SELECT (x->>'adet')::int,(x->>'mal_fazlasi')::int INTO v_adet,v_mf
  FROM jsonb_array_elements(v_y.barem_tablosu) x
  WHERE v_kullan BETWEEN (x->>'min_puan')::int AND (x->>'max_puan')::int
  ORDER BY (x->>'min_puan')::int DESC
  LIMIT 1;

  v_tl:=round(v_kullan*v_y.karsilik_tl/greatest(v_y.karsilik_puan,1),2);
  IF v_y.satis_sarti_tipi='serbest_siparis' AND p_siparis_verilsin_mi THEN
    v_tl:=round(v_tl*(1+coalesce(v_y.gizli_sart_katlama_orani,0)/100.0),2);
  END IF;

  INSERT INTO public.eclub_store_cek_talepleri(
    eczane_id,firma_id,yayin_id,talep_eden_kisi_id,toplanan_puan,talep_edilen_cek_tl,
    siparis_tipi,siparis_verildi_mi,siparis_adet,siparis_mal_fazlasi,durum,utt_id,devreden_puan,donem_kodu
  ) VALUES (
    v_eczane,v_firma,p_yayin_id,p_kisi_id,v_kullan,v_tl,
    v_y.satis_sarti_tipi,p_siparis_verilsin_mi,
    CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_adet,0) ELSE 0 END,
    CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_mf,0) ELSE 0 END,
    'beklemede',v_utt,v_devir,v_d.donem_kodu
  ) RETURNING eclub_store_cek_talepleri.talep_id INTO v_id;

  UPDATE public.eclub_store_puan_devirleri
  SET kullanildi_mi=true,kullanilan_talep_id=v_id,guncellenme_at=now()
  WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false;

  IF v_devir>0 THEN
    INSERT INTO public.eclub_store_puan_devirleri(eczane_id,yayin_id,kaynak_donem_kodu,hedef_donem_kodu,puan,kaynak_talep_id)
    SELECT v_eczane,p_yayin_id,v_d.donem_kodu,s.sonraki_donem_kodu,v_devir,v_id
    FROM public.eclub_store_donem_sinirlari(v_d.donem_kodu) s
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT true,v_id,NULL::text,v_tl,v_devir;
END $f$;

-- ----------------------------------------------------------------------------
-- 7. Rol Yetki Matrisi (Privilege Hardening)
-- ----------------------------------------------------------------------------

-- 7.1. anon, authenticated ve PUBLIC yetkilerini temizle
REVOKE ALL ON FUNCTION public.get_eclub_utt_rapor(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_eclub_store_firma_bakiye(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_eclub_eczane_store_ozet(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_store_onceki_deviri_hazirla(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_store_cek_talebi_olustur(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- 7.2. Yalnız gerekli rollere açık izinler
GRANT EXECUTE ON FUNCTION public.get_eclub_utt_rapor(uuid, timestamp with time zone, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_eclub_store_firma_bakiye(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_eclub_eczane_store_ozet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_store_onceki_deviri_hazirla(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_store_cek_talebi_olustur(uuid, uuid, boolean) TO service_role;

-- ----------------------------------------------------------------------------
-- 8. Şema Yenileme ve Commit
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
COMMIT;
