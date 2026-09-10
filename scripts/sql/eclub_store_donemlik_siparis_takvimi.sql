-- ============================================================================
-- E-Club Store: Aylık Sipariş Takvimi ("E-Club Store Günleri")
-- Dosya: scripts/sql/eclub_store_donemlik_siparis_takvimi.sql
--
-- Sipariş Takvimi Kuralları (Europe/Istanbul):
--   * Her ayın son 7 takvim gününde siparişler açıktır.
--   * Açılış ilk gün 00:00:00 TR; kapanış sonraki ayın ilk günü 00:00:00 TR hariçtir
--     (ayın son gününün 23:59:59.999 anına kadar sipariş verilebilir).
--   * 31 günlük aylar (Ocak, Mart, Mayıs, Temmuz, Ağustos, Ekim, Aralık): 25–31
--   * 30 günlük aylar (Nisan, Haziran, Eylül, Kasım): 24–30
--   * 28 günlük Şubat (normal yıllar): 22–28
--   * 29 günlük Şubat (artık yıllar): 23–29
--   * Ay uzunluğu ve artık yıl dinamik hesaplanır; yıl sabitlenmez.
--
-- Güvenlik ve Eşzamanlılık Mimarisi:
--   * eclub_store_siparis_donemi_acik_mi(p_zaman timestamptz DEFAULT clock_timestamp()):
--     Europe/Istanbul takvimine göre anın açık pencerede olup olmadığını doğrular.
--   * eclub_store_siparis_olustur:
--     1. Fonksiyon başında erken takvim kontrolü.
--     2. Aktif üyelik (ke) FOR UPDATE OF ke ve ürün FOR UPDATE kilitleri,
--        kullanılabilir bakiye ve adres kontrollerinden sonra;
--     3. İLK VERİTABANI YAZIMI olan eclub_store_siparisler INSERT'i ve stok azaltımından
--        hemen önce clock_timestamp() ile nihai takvim kontrolü yapılır.
--        Kilitlerde beklerken mağaza kapandıysa hiçbir sipariş, stok veya harcama kaydı
--        değiştirilmeden kapalı mesajıyla işlem reddedilir.
--   * İptal, iade, teslimat ve bakiye sorgulama bu kısıttan ETKİLENMEZ;
--     kapalı dönemde de tam çalışmaya devam eder.
-- ============================================================================

BEGIN;

-- 1. Takvim kontrol fonksiyonu (dinamik ay uzunluğu ve artık yıl)
CREATE OR REPLACE FUNCTION public.eclub_store_siparis_donemi_acik_mi(
  p_zaman timestamptz DEFAULT clock_timestamp()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_yerel timestamp;
  v_tarih date;
  v_gun integer;
  v_ayin_son_gunu_tarihi date;
  v_son_gun integer;
  v_acilis_gun integer;
BEGIN
  -- p_zaman timestamptz'i Türkiye saatine (Europe/Istanbul) dönüştür
  v_yerel := p_zaman AT TIME ZONE 'Europe/Istanbul';
  v_tarih := v_yerel::date;
  v_gun := EXTRACT(DAY FROM v_yerel)::integer;

  -- Ayın son gününün tarihini dinamik olarak hesapla (artık yıl ve ay uzunlukları dahil)
  v_ayin_son_gunu_tarihi := (date_trunc('month', v_tarih) + interval '1 month - 1 day')::date;
  v_son_gun := EXTRACT(DAY FROM v_ayin_son_gunu_tarihi)::integer;

  -- Son 7 takvim günü kuralı:
  -- 31 günlük ay: 31 - 6 = 25 (25..31)
  -- 30 günlük ay: 30 - 6 = 24 (24..30)
  -- 29 günlük ay: 29 - 6 = 23 (23..29)
  -- 28 günlük ay: 28 - 6 = 22 (22..28)
  v_acilis_gun := v_son_gun - 6;

  IF v_gun >= v_acilis_gun THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.eclub_store_siparis_donemi_acik_mi(timestamptz)
  TO authenticated, service_role, anon;


-- 2. Çekirdek sipariş oluşturma fonksiyonu güncellemesi (çift takvim kontrolü)
CREATE OR REPLACE FUNCTION public.eclub_store_siparis_olustur(
  p_kisi_id uuid,
  p_urun_id uuid,
  p_adres_id uuid,
  p_adet integer
)
RETURNS TABLE(ok boolean, siparis_id uuid, hata text)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_urun record;
  v_toplam_puan bigint;
  v_uygun_bakiye bigint;
  v_siparis_id uuid;
  v_adres_snapshot jsonb;
  v_kalan bigint;
  v_dus bigint;
  r record;
BEGIN
  -- 0. Adet validasyonu
  IF p_adet IS NULL OR p_adet <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Adet pozitif olmalı.'::text;
    RETURN;
  END IF;

  -- 1. Erken takvim kontrolü: Mağaza kapalıysa kilit ve sorgu yüküne girmeden reddet
  IF NOT public.eclub_store_siparis_donemi_acik_mi(clock_timestamp()) THEN
    RETURN QUERY SELECT false, NULL::uuid,
      'E-Club Store şu an siparişe kapalıdır. Siparişler yalnızca E-Club Store Günleri döneminde verilebilir.'::text;
    RETURN;
  END IF;

  -- 2. Aktif kişi→eczane→firma zincirini kilitleyerek pasifleştirme ile siparişin yarışmasını sırala
  PERFORM ke.id
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_eczane_firma ef
    ON ef.eczane_id = ke.eczane_id
   AND ef.aktif_mi = true
  JOIN public.firmalar f
    ON f.firma_id = ef.firma_id
   AND f.aktif = true
   AND f.eclub_aktif = true
   AND f.eclub_store_aktif = true
  WHERE ke.kisi_id = p_kisi_id
    AND ke.aktif_mi = true
  LIMIT 1
  FOR UPDATE OF ke;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid,
      'Aktif E-Club üyeliğiniz bulunmadığı için yeni sipariş oluşturamazsınız.'::text;
    RETURN;
  END IF;

  -- 3. Ürünü kilitle (row-level lock) ve oku
  SELECT urun_id, puan_fiyat, stok, aktif_mi
    INTO v_urun
  FROM public.eclub_store_urunler
  WHERE urun_id = p_urun_id
  FOR UPDATE;

  IF NOT FOUND OR v_urun.aktif_mi = false THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Ürün bulunamadı veya pasif.'::text;
    RETURN;
  END IF;

  IF v_urun.stok < p_adet THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Yetersiz stok.'::text;
    RETURN;
  END IF;

  -- 4. Toplam puan ve firma bazlı kullanılabilir bakiye kontrolü
  v_toplam_puan := v_urun.puan_fiyat::bigint * p_adet;

  SELECT COALESCE(SUM(b.bakiye), 0)
    INTO v_uygun_bakiye
  FROM public.get_eclub_store_firma_bakiye(p_kisi_id) b
  LEFT JOIN public.eclub_store_urun_firma_ayarlari a
    ON a.urun_id = p_urun_id
   AND a.firma_id = b.firma_id
  WHERE COALESCE(a.aktif_mi, true);

  IF v_uygun_bakiye < v_toplam_puan THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Bu ürün için kullanılabilir firma puanı yetersiz.'::text;
    RETURN;
  END IF;

  -- 5. Adres kontrolü ve snapshot
  SELECT to_jsonb(a)
    INTO v_adres_snapshot
  FROM public.eclub_store_adresler a
  WHERE a.adres_id = p_adres_id
    AND a.kisi_id = p_kisi_id;

  IF v_adres_snapshot IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Adres bulunamadı.'::text;
    RETURN;
  END IF;

  -- 5.1. Nihai kapanış kontrolü:
  -- Üyelik kilidi (FOR UPDATE OF ke), ürün kilidi (FOR UPDATE), bakiye ve adres kontrolleri
  -- esnasında bekleme nedeniyle kapanış anının geçme ihtimaline karşı; ilk sipariş kaydı
  -- (eclub_store_siparisler) yazılmadan, puan harcaması kaydedilmeden ve stok azaltılmadan
  -- hemen önce clock_timestamp() ile anlık takvim tekrar doğrulanır.
  IF NOT public.eclub_store_siparis_donemi_acik_mi(clock_timestamp()) THEN
    RETURN QUERY SELECT false, NULL::uuid,
      'E-Club Store şu an siparişe kapalıdır. Siparişler yalnızca E-Club Store Günleri döneminde verilebilir.'::text;
    RETURN;
  END IF;

  -- 6. Sipariş kaydı (ilk veritabanı yazımı)
  INSERT INTO public.eclub_store_siparisler (
    kisi_id, urun_id, adres_id, adres_snapshot, adet,
    puan_birim_fiyat, toplam_puan, durum
  ) VALUES (
    p_kisi_id, p_urun_id, p_adres_id, v_adres_snapshot, p_adet,
    v_urun.puan_fiyat, v_toplam_puan, 'beklemede'
  ) RETURNING eclub_store_siparisler.siparis_id INTO v_siparis_id;

  -- 7. Firma puan harcama kayıtları
  v_kalan := v_toplam_puan;
  FOR r IN
    SELECT b.firma_id, b.bakiye
    FROM public.get_eclub_store_firma_bakiye(p_kisi_id) b
    LEFT JOIN public.eclub_store_urun_firma_ayarlari a
      ON a.urun_id = p_urun_id
     AND a.firma_id = b.firma_id
    WHERE COALESCE(a.aktif_mi, true)
    ORDER BY b.bakiye DESC
  LOOP
    EXIT WHEN v_kalan <= 0;
    v_dus := LEAST(r.bakiye, v_kalan);
    INSERT INTO public.eclub_store_siparis_firma_puan (siparis_id, firma_id, kullanilan_puan)
    VALUES (v_siparis_id, r.firma_id, v_dus);
    v_kalan := v_kalan - v_dus;
  END LOOP;

  -- 8. Stok azaltımı
  UPDATE public.eclub_store_urunler
     SET stok = stok - p_adet,
         guncellenme_at = now()
   WHERE urun_id = p_urun_id;

  RETURN QUERY SELECT true, v_siparis_id, NULL::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.eclub_store_siparis_olustur(uuid,uuid,uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_siparis_olustur(uuid,uuid,uuid,integer)
  TO service_role;

COMMIT;
