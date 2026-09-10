-- HBStore: aynı kullanıcının eşzamanlı siparişlerinde bakiye bütünlüğü.
-- UTT/KD_UTT/BM ortak çekirdeğine transaction süreli kullanıcı kilidi ekler.
-- Kaynak: kullanıcı tarafından iletilen mevcut veritabanı fonksiyon tanımı.
-- Puan hesabı, dönem sınırları ve firma/ürün erişim sarmalayıcısı değişmez.
-- Mevcut fonksiyonun izinleri CREATE OR REPLACE ile korunur.

BEGIN;

CREATE OR REPLACE FUNCTION public.store_siparis_olustur_cekirdek(p_kullanici_id uuid, p_urun_id uuid, p_adres_id uuid, p_adet integer)
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
BEGIN
  -- 1. Adet validasyonu
  IF p_adet IS NULL OR p_adet <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Adet pozitif olmalı.';
    RETURN;
  END IF;

  -- Aynı kullanıcının farklı ürün siparişlerini de sıraya al.
  -- Kilit ürün kilidinden önce alınır ve transaction sonunda otomatik bırakılır.
  -- Bekleyen sipariş, önceki harcama kaydından sonraki bakiyeyi okur.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hbstore:siparis:' || p_kullanici_id::text, 0)
  );

  -- 2. Ürünü kilitle (row-level lock) ve oku
  SELECT aktif_mi, stok, puan_fiyati
    INTO v_urun_aktif, v_urun_stok, v_urun_fiyat
  FROM store_urunler
  WHERE urun_id = p_urun_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Ürün bulunamadı.';
    RETURN;
  END IF;

  IF NOT v_urun_aktif THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Ürün şu an satışta değil.';
    RETURN;
  END IF;

  IF v_urun_stok < p_adet THEN
    RETURN QUERY SELECT false, NULL::uuid,
      'Yetersiz stok. Mevcut: ' || v_urun_stok || ', istenen: ' || p_adet;
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
    RETURN QUERY SELECT false, NULL::uuid, 'Adres bulunamadı.';
    RETURN;
  END IF;

  IF v_adres_kullanici != p_kullanici_id THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Adres bu kullanıcıya ait değil.';
    RETURN;
  END IF;

  -- 4. Toplam puan hesap
  v_toplam_puan := v_urun_fiyat * p_adet;

  -- 5. Bakiye kontrolü
  v_bakiye := get_harcama_bakiyesi(p_kullanici_id);
  IF v_bakiye < v_toplam_puan THEN
    RETURN QUERY SELECT false, NULL::uuid,
      'Yetersiz bakiye. Mevcut: ' || v_bakiye || ' puan, gereken: ' || v_toplam_puan || ' puan';
    RETURN;
  END IF;

  -- 6. Stok azalt
  UPDATE store_urunler
  SET stok = stok - p_adet,
      updated_at = now()
  WHERE urun_id = p_urun_id;

  -- 7. Sipariş kaydı
  INSERT INTO store_siparisler (
    kullanici_id,
    urun_id,
    adres_id,
    adres_snapshot,
    adet,
    puan_birim_fiyat,
    toplam_puan,
    durum
  )
  VALUES (
    p_kullanici_id,
    p_urun_id,
    p_adres_id,
    v_adres_snapshot,
    p_adet,
    v_urun_fiyat,
    v_toplam_puan,
    'beklemede'
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

COMMIT;
