-- ============================================================================
-- HBStore: Dönemlik Sipariş Takvimi ("Store Günleri" — Tamamlanan Çeyrek Sonrası)
-- Dosya: scripts/sql/hbstore_donemlik_siparis_takvimi.sql
--
-- Sipariş Takvimi Kuralları (Europe/Istanbul):
--   * Siparişler tamamlanan çeyreği takip eden ayın ilk 7 takvim gününde alınır:
--     - Q1 (Ocak–Mart Kazanımı):     1–7 Nisan     (Açılış: 1 Nisan 00:00, Kapanış: 8 Nisan 00:00 hariç)
--     - Q2 (Nisan–Haziran Kazanımı): 1–7 Temmuz    (Açılış: 1 Temmuz 00:00, Kapanış: 8 Temmuz 00:00 hariç)
--     - Q3 (Temmuz–Eylül Kazanımı):  1–7 Ekim      (Açılış: 1 Ekim 00:00, Kapanış: 8 Ekim 00:00 hariç)
--     - Q4 (Ekim–Aralık Kazanımı):   1–7 Ocak (sonraki yıl) (Açılış: 1 Ocak 00:00, Kapanış: 8 Ocak 00:00 hariç)
--   * Açılış ilk gün 00:00:00, kapanış 8. gün 00:00:00 hariç (7. gün 23:59:59 dahil).
--
-- Bakiye ve Dönem Eşleştirme Mimarisi:
--   * get_harcama_bakiyesi:
--     - Mağaza açıkken (1–7 günleri) hemen önce tamamlanan çeyreğin kullanılabilir puanı esas alınır.
--     - Yeni çeyrekte (ör. 2 Nisan) kazanılan puanlar önceki çeyreğin sipariş bakiyesine karıştırılmaz.
--     - Harcama ve iptal iadeleri, s.kaynak_ceyrek_baslangici ve h.siparis_id
--       üzerinden kaynak çeyreğe şaşmaz biçimde bağlanır. NULL kaynak tahmini yoktur.
--     - HBStore'da kullanılmayan puanlar sonraki dönemlere DEVRETMEZ.
--     - UTT/KD_UTT için E-Club kazanımı ve BM için CC kazanımı korunur.
--   * store_siparis_olustur_cekirdek:
--     - Kilitlerden sonra, ilk veri yazımından (stok UPDATE ve sipariş INSERT) hemen önce
--       clock_timestamp() ile son takvim kontrolü yapılır.
-- ============================================================================

BEGIN;

-- 0a. Ön Kontrol: Tabloda mevcut sipariş bulunmadığını doğrula
-- HBStore'da sipariş bulunmadığı teyit edilmiştir. Tabloda kayıt varsa işlem güvenle durdurulur.
DO $on_kontrol$
BEGIN
  IF EXISTS (SELECT 1 FROM public.store_siparisler) THEN
    RAISE EXCEPTION 'Tabloda mevcut sipariş kaydı bulunmaktadır. Bu geçiş paketi yalnızca sıfır siparişli temiz şema için tasarlanmıştır. Otomatik doldurma yapılmaz; işlem durduruldu.';
  END IF;
END;
$on_kontrol$;

-- 0b. Şema Genişletmesi: Siparişin kaynak çeyrek başlangıcı alanı (ZORUNLU - NOT NULL)
-- Yeni siparişlerde sunucu tarafından otomatik belirlenir; istemciden parametre kabul edilmez.
ALTER TABLE public.store_siparisler
  ADD COLUMN IF NOT EXISTS kaynak_ceyrek_baslangici timestamptz;

ALTER TABLE public.store_siparisler
  ALTER COLUMN kaynak_ceyrek_baslangici SET NOT NULL;

-- 1. Takvim kontrol fonksiyonu
CREATE OR REPLACE FUNCTION public.hbstore_siparis_donemi_acik_mi(
  p_zaman timestamptz DEFAULT clock_timestamp()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_yerel timestamp;
  v_ay integer;
  v_gun integer;
BEGIN
  -- p_zaman timestamptz'i Türkiye saatine (Europe/Istanbul) dönüştür
  v_yerel := p_zaman AT TIME ZONE 'Europe/Istanbul';
  v_ay := EXTRACT(MONTH FROM v_yerel)::integer;
  v_gun := EXTRACT(DAY FROM v_yerel)::integer;

  -- Tamamlanan çeyreği takip eden ayın ilk 7 takvim günü:
  -- Q1 (Ocak–Mart)    -> 1–7 Nisan   (ay = 4, gün 1..7)
  -- Q2 (Nisan–Haziran)-> 1–7 Temmuz  (ay = 7, gün 1..7)
  -- Q3 (Temmuz–Eylül) -> 1–7 Ekim    (ay = 10, gün 1..7)
  -- Q4 (Ekim–Aralık)  -> 1–7 Ocak    (ay = 1, gün 1..7)
  IF (v_ay = 4 AND v_gun >= 1 AND v_gun <= 7) OR
     (v_ay = 7 AND v_gun >= 1 AND v_gun <= 7) OR
     (v_ay = 10 AND v_gun >= 1 AND v_gun <= 7) OR
     (v_ay = 1 AND v_gun >= 1 AND v_gun <= 7) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.hbstore_siparis_donemi_acik_mi(timestamptz)
  TO authenticated, service_role;


-- 2. Harcama bakiyesi fonksiyonları (Tamamlanan çeyrek, eski/yeni sipariş ayrımı ve iade eşleştirmeli)
-- 2a. Tarih parametreli test ve simülasyon yardımcısı
CREATE OR REPLACE FUNCTION public.get_harcama_bakiyesi_tarihli(
  p_kullanici_id uuid,
  p_zaman timestamptz DEFAULT clock_timestamp()
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_rol text;
  v_kazanim integer := 0;
  v_kayip integer := 0;
  v_harcama integer := 0;
  v_iade integer := 0;

  v_yerel timestamp;
  v_yil integer;
  v_ay integer;
  v_gun integer;
  v_magaza_acik boolean;

  v_kazanim_bas timestamptz;
  v_kazanim_bit timestamptz;
BEGIN
  SELECT k.rol INTO v_rol
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_kullanici_id;

  IF v_rol NOT IN ('utt', 'kd_utt', 'bm') OR v_rol IS NULL THEN
    RETURN 0;
  END IF;

  -- Anlık Türkiye saati bileşenleri
  v_yerel := p_zaman AT TIME ZONE 'Europe/Istanbul';
  v_yil := EXTRACT(YEAR FROM v_yerel)::integer;
  v_ay := EXTRACT(MONTH FROM v_yerel)::integer;
  v_gun := EXTRACT(DAY FROM v_yerel)::integer;

  -- Mağaza sipariş günlerinde mi? (1–7 Nisan, 1–7 Temmuz, 1–7 Ekim, 1–7 Ocak)
  v_magaza_acik := (
    (v_ay = 4 AND v_gun >= 1 AND v_gun <= 7) OR
    (v_ay = 7 AND v_gun >= 1 AND v_gun <= 7) OR
    (v_ay = 10 AND v_gun >= 1 AND v_gun <= 7) OR
    (v_ay = 1 AND v_gun >= 1 AND v_gun <= 7)
  );

  IF v_magaza_acik THEN
    -- ─── MAĞAZA AÇIKKEN (SİPARİŞ HAFTASI) ───────────────────────────────────
    -- Hemen önce tamamlanan çeyreğin kazanımları ve o kaynak çeyreğe ait harcamalar
    IF v_ay = 4 THEN
      -- Q1 (Ocak–Mart) kazanımları -> 1–7 Nisan siparişi
      v_kazanim_bas := make_timestamptz(v_yil, 1, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay = 7 THEN
      -- Q2 (Nisan–Haziran) kazanımları -> 1–7 Temmuz siparişi
      v_kazanim_bas := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay = 10 THEN
      -- Q3 (Temmuz–Eylül) kazanımları -> 1–7 Ekim siparişi
      v_kazanim_bas := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 10, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSE -- v_ay = 1
      -- Q4 (Ekim–Aralık [yil-1]) kazanımları -> 1–7 Ocak [yil] siparişi
      v_kazanim_bas := make_timestamptz(v_yil - 1, 10, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 1, 1, 0, 0, 0, 'Europe/Istanbul');
    END IF;
  ELSE
    -- ─── MAĞAZA KAPALIYKEN (BİRİKİM DÖNEMİ) ─────────────────────────────────
    -- Kullanıcının bir sonraki sipariş dönemi için o an biriktirmekte olduğu çeyrek
    -- Kullanılmayan eski puanlar devretmez (kural: sonraki döneme taşınmaz)
    IF v_ay IN (1, 2, 3) THEN
      -- 8 Ocak - 31 Mart: 1–7 Nisan siparişi için Q1 (Ocak–Mart) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 1, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay IN (4, 5, 6) THEN
      -- 8 Nisan - 30 Haziran: 1–7 Temmuz siparişi için Q2 (Nisan–Haziran) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay IN (7, 8, 9) THEN
      -- 8 Temmuz - 30 Eylül: 1–7 Ekim siparişi için Q3 (Temmuz–Eylül) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 10, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSE -- v_ay IN (10, 11, 12)
      -- 8 Ekim - 31 Aralık: 1–7 Ocak [yil+1] siparişi için Q4 (Ekim–Aralık) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 10, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil + 1, 1, 1, 0, 0, 0, 'Europe/Istanbul');
    END IF;
  END IF;

  -- 1. Kazanımlar ve kayıplar (yalnızca kaynak çeyrek aralığında)
  IF v_rol IN ('utt', 'kd_utt') THEN
    SELECT COALESCE(SUM(p.puan), 0)::integer INTO v_kazanim
    FROM public.kazanilan_puanlar p
    WHERE p.kullanici_id = p_kullanici_id
      AND p.puan_turu IN ('izleme', 'cevaplama', 'oneri', 'extra')
      AND p.created_at >= v_kazanim_bas AND p.created_at < v_kazanim_bit;

    SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::integer INTO v_kayip
    FROM (
      SELECT kaybedilen_puan, created_at FROM public.ileri_sarma_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.yanlis_cevap_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.oneri_kayip_kayitlari WHERE kullanici_id = p_kullanici_id
    ) x
    WHERE x.created_at >= v_kazanim_bas AND x.created_at < v_kazanim_bit;

    -- UTT/KD_UTT'nin E-Club kazanımı aynı çeyrekte harcanabilir bakiyeye dahildir.
    SELECT v_kazanim + COALESCE(SUM(ep.puan), 0)::integer INTO v_kazanim
    FROM public.eclub_utt_puanlari ep
    WHERE ep.utt_id = p_kullanici_id
      AND ep.created_at >= v_kazanim_bas AND ep.created_at < v_kazanim_bit;
  ELSE
    -- BM: Ortak öğrenme puanı fonksiyonunu (get_bm_puan_ozet) çağır
    SELECT COALESCE(b.toplam_kazanc, 0)::integer, COALESCE(b.toplam_kayip, 0)::integer
    INTO v_kazanim, v_kayip
    FROM public.get_bm_puan_ozet(
      p_kullanici_id,
      v_kazanim_bas,
      v_kazanim_bit - interval '1 microsecond'
    ) b;
  END IF;

  -- 2. Harcama ve İade:
  -- Her sipariş ve harcama s.kaynak_ceyrek_baslangici üzerinden ilgili kaynak
  -- çeyreğe (v_kazanim_bas) kesin olarak bağlanır. Böylece:
  --   * 1–7 Ocak siparişi önceki yılın Q4'üne bağlanır ve yeni yılın Q1'inden DÜŞMEZ (çakışma giderildi).
  --   * Harcama ve iadeler yalnız siparişin kayıtlı kaynak çeyreğine bağlanır; NULL kaynak tahmini kaldırılmıştır.
  --   * İadeler de iade tarihine göre değil, siparişin kaynak çeyreğine bağlanır.
  --   * Her sipariş yalnız bir çeyrekten düşülür.
  SELECT
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'harcama'), 0)::integer,
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'iade'), 0)::integer
  INTO v_harcama, v_iade
  FROM public.store_puan_harcamalari h
  JOIN public.store_siparisler s ON s.siparis_id = h.siparis_id
  WHERE h.kullanici_id = p_kullanici_id
    AND s.kaynak_ceyrek_baslangici = v_kazanim_bas;

  -- Kural: Mevcut negatif bakiye davranışı korunur (GREATEST(0, ...) kullanılmaz).
  RETURN v_kazanim - v_kayip - v_harcama + v_iade;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_harcama_bakiyesi_tarihli(uuid, timestamptz) TO authenticated, service_role;


-- 2b. Mevcut üretim get_harcama_bakiyesi(uuid) fonksiyonu (orijinal imza ve izinler korunur)
CREATE OR REPLACE FUNCTION public.get_harcama_bakiyesi(p_kullanici_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.get_harcama_bakiyesi_tarihli(p_kullanici_id, clock_timestamp());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_harcama_bakiyesi(uuid) TO authenticated, service_role;


-- 3. Çekirdek sipariş oluşturma fonksiyonu güncellemesi (çift takvim kontrolü)
CREATE OR REPLACE FUNCTION public.store_siparis_olustur_cekirdek(
  p_kullanici_id uuid,
  p_urun_id uuid,
  p_adres_id uuid,
  p_adet integer
)
RETURNS TABLE(ok boolean, siparis_id uuid, hata text)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_urun_aktif boolean;
  v_urun_stok integer;
  v_urun_fiyat integer;
  v_adres_kullanici uuid;
  v_adres_snapshot jsonb;
  v_bakiye integer;
  v_toplam_puan integer;
  v_yeni_siparis_id uuid;
  v_siparis_yerel timestamp;
  v_sip_yil integer;
  v_sip_ay integer;
  v_kaynak_ceyrek_bas timestamptz;
BEGIN
  -- 1. Adet validasyonu
  IF p_adet IS NULL OR p_adet <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Adet pozitif olmalı.'::text;
    RETURN;
  END IF;

  -- Aynı kullanıcının farklı ürün siparişlerini sıraya al
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hbstore:siparis:' || p_kullanici_id::text, 0)
  );

  -- Kilit beklerken kapanış saatinin geçme ihtimaline karşı clock_timestamp() ile erken kontrol
  IF NOT public.hbstore_siparis_donemi_acik_mi(clock_timestamp()) THEN
    RETURN QUERY SELECT false, NULL::uuid, 'HBStore şu an siparişe kapalıdır. Siparişler yalnızca Store Günleri döneminde verilebilir.'::text;
    RETURN;
  END IF;

  -- 2. Ürünü kilitle (row-level lock) ve oku
  SELECT aktif_mi, stok, puan_fiyati
    INTO v_urun_aktif, v_urun_stok, v_urun_fiyat
  FROM store_urunler
  WHERE urun_id = p_urun_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Ürün bulunamadı.'::text;
    RETURN;
  END IF;

  IF NOT v_urun_aktif THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Ürün şu an satışta değil.'::text;
    RETURN;
  END IF;

  IF v_urun_stok < p_adet THEN
    RETURN QUERY SELECT false, NULL::uuid,
      ('Yetersiz stok. Mevcut: ' || v_urun_stok || ', istenen: ' || p_adet)::text;
    RETURN;
  END IF;

  -- 3. Adres kontrolü + snapshot
  SELECT kullanici_id, jsonb_build_object(
    'adres_id', adres_id,
    'baslik', baslik,
    'alici_adi', alici_adi,
    'telefon', telefon,
    'il', il,
    'ilce', ilce,
    'adres_detay', adres_detay,
    'posta_kodu', posta_kodu
  )
    INTO v_adres_kullanici, v_adres_snapshot
  FROM store_adresler
  WHERE adres_id = p_adres_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Adres bulunamadı.'::text;
    RETURN;
  END IF;

  IF v_adres_kullanici != p_kullanici_id THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Adres bu kullanıcıya ait değil.'::text;
    RETURN;
  END IF;

  -- 4. Toplam puan hesap
  v_toplam_puan := v_urun_fiyat * p_adet;

  -- 5. Bakiye kontrolü (tamamlanan çeyrek kullanılabilir puanı)
  v_bakiye := public.get_harcama_bakiyesi(p_kullanici_id);
  IF v_bakiye < v_toplam_puan THEN
    RETURN QUERY SELECT false, NULL::uuid,
      ('Yetersiz bakiye. Mevcut: ' || v_bakiye || ' puan, gereken: ' || v_toplam_puan || ' puan')::text;
    RETURN;
  END IF;

  -- 5.1. Nihai kapanış kontrolü: ürün kilidinde (FOR UPDATE), adres ve bakiye sorgularında
  -- bekleme esnasında kapanış saatinin geçme ihtimaline karşı, stok azaltılmadan ve sipariş
  -- yazılmadan hemen önce gerçek anlık sunucu saatiyle (clock_timestamp()) son kontrol yapılır.
  IF NOT public.hbstore_siparis_donemi_acik_mi(clock_timestamp()) THEN
    RETURN QUERY SELECT false, NULL::uuid, 'HBStore şu an siparişe kapalıdır. Siparişler yalnızca Store Günleri döneminde verilebilir.'::text;
    RETURN;
  END IF;

  -- 6. Stok azalt
  UPDATE store_urunler
  SET stok = stok - p_adet,
      updated_at = now()
  WHERE urun_id = p_urun_id;

  -- 6.1. Kaynak çeyrek başlangıcını sunucu hesaplar (istemciden parametre alınmaz)
  v_siparis_yerel := clock_timestamp() AT TIME ZONE 'Europe/Istanbul';
  v_sip_yil := EXTRACT(YEAR FROM v_siparis_yerel)::integer;
  v_sip_ay := EXTRACT(MONTH FROM v_siparis_yerel)::integer;

  IF v_sip_ay = 4 THEN
    v_kaynak_ceyrek_bas := make_timestamptz(v_sip_yil, 1, 1, 0, 0, 0, 'Europe/Istanbul');
  ELSIF v_sip_ay = 7 THEN
    v_kaynak_ceyrek_bas := make_timestamptz(v_sip_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
  ELSIF v_sip_ay = 10 THEN
    v_kaynak_ceyrek_bas := make_timestamptz(v_sip_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
  ELSIF v_sip_ay = 1 THEN
    v_kaynak_ceyrek_bas := make_timestamptz(v_sip_yil - 1, 10, 1, 0, 0, 0, 'Europe/Istanbul');
  ELSE
    v_kaynak_ceyrek_bas := NULL;
  END IF;

  IF v_kaynak_ceyrek_bas IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'HBStore sipariş dönemi için kaynak çeyrek belirlenemedi.'::text;
    RETURN;
  END IF;

  -- 7. Sipariş kaydı (kaynak_ceyrek_baslangici ile)
  INSERT INTO store_siparisler (
    kullanici_id,
    urun_id,
    adres_id,
    adres_snapshot,
    adet,
    puan_birim_fiyat,
    toplam_puan,
    durum,
    kaynak_ceyrek_baslangici
  )
  VALUES (
    p_kullanici_id,
    p_urun_id,
    p_adres_id,
    v_adres_snapshot,
    p_adet,
    v_urun_fiyat,
    v_toplam_puan,
    'beklemede',
    v_kaynak_ceyrek_bas
  )
  RETURNING store_siparisler.siparis_id INTO v_yeni_siparis_id;

  -- 8. Harcama kaydı
  INSERT INTO store_puan_harcamalari (
    kullanici_id,
    siparis_id,
    puan_miktari,
    tur
  )
  VALUES (
    p_kullanici_id,
    v_yeni_siparis_id,
    v_toplam_puan,
    'harcama'
  );

  -- 9. Başarı
  RETURN QUERY SELECT true, v_yeni_siparis_id, NULL::text;
END;
$function$;

-- 4. Güvenlik sarmalayıcısı güncellemesi (firma, ürün ve takvim kontrolü)
CREATE OR REPLACE FUNCTION public.store_siparis_olustur(
  p_kullanici_id uuid,
  p_urun_id uuid,
  p_adres_id uuid,
  p_adet integer
)
RETURNS TABLE(ok boolean, siparis_id uuid, hata text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_firma_id uuid;
  v_hbstore_aktif boolean;
  v_urun_aktif boolean;
BEGIN
  -- Sipariş dönemi kontrolü
  IF NOT public.hbstore_siparis_donemi_acik_mi(clock_timestamp()) THEN
    RETURN QUERY SELECT false, NULL::uuid, 'HBStore şu an siparişe kapalıdır. Siparişler yalnızca Store Günleri döneminde verilebilir.'::text;
    RETURN;
  END IF;

  -- Firma yetki ve aktiflik kontrolü
  SELECT k.firma_id, f.hbstore_aktif
    INTO v_firma_id, v_hbstore_aktif
  FROM public.kullanicilar k
  LEFT JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE k.kullanici_id = p_kullanici_id;

  IF v_firma_id IS NULL OR v_hbstore_aktif IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Firmanız için HBStore kullanıma açık değil.'::text;
    RETURN;
  END IF;

  -- Ürün firma erişim kontrolü
  SELECT u.aktif_mi
    AND COALESCE(a.aktif_mi, true)
    INTO v_urun_aktif
  FROM public.store_urunler u
  LEFT JOIN public.store_urun_firma_ayarlari a
    ON a.urun_id = u.urun_id
   AND a.firma_id = v_firma_id
  WHERE u.urun_id = p_urun_id;

  IF v_urun_aktif IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Bu ürün firmanız için satışa açık değil.'::text;
    RETURN;
  END IF;

  -- Çekirdeğe devret
  RETURN QUERY
  SELECT sonuc.ok, sonuc.siparis_id, sonuc.hata
  FROM public.store_siparis_olustur_cekirdek(
    p_kullanici_id,
    p_urun_id,
    p_adres_id,
    p_adet
  ) AS sonuc;
END;
$fonksiyon$;

-- 5. İzinler
REVOKE ALL ON FUNCTION public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_siparis_olustur(uuid,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_siparis_olustur(uuid,uuid,uuid,integer) TO service_role;

COMMIT;
