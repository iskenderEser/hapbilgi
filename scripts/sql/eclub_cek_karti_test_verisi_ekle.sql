-- Yalnız kart görünüm çalışması. Gerçek talep, sipariş ve bildirim oluşturmaz.
-- Temizlik: eclub_cek_karti_test_verisi_temizle.sql (şimdi çalıştırılmaz).
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(hashtextextended('eclub-cek-karti-gorunum-v1', 0));
LOCK TABLE public.eclub_kazanilan_puanlar, public.eclub_izleme_kayitlari,
  public.eclub_store_puan_devirleri, public.eclub_store_cek_talepleri
  IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE cek_karti_ornekleri (
  sira integer PRIMARY KEY, yayin_id uuid, urun_id uuid, puan integer,
  izleme_id uuid, puan_id uuid
) ON COMMIT DROP;
INSERT INTO cek_karti_ornekleri VALUES
  (1, 'f364c684-eadc-4ccc-8671-f333da7b555f', '90c0ca99-8d17-40d9-97d7-5b209bd730b0', 100,
   'e1200000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000101'),
  (2, 'bc71b5d2-0c91-4a7e-aa19-1a17a7a66f50', '748aa439-159d-4701-ba0d-554082ce0738', 300,
   'e1200000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000102'),
  (3, '3a6e0db1-bc42-44cf-ab16-b99630681ae9', 'cb6b9390-b321-440f-9c2f-be9064b4b79c', 650,
   'e1200000-0000-4000-8000-000000000003', 'e1200000-0000-4000-8000-000000000103');

DO $test$
DECLARE
  v_kisi constant uuid := '3b0b6c01-428e-4797-a8ad-67d5d2400b5f';
  v_eczane constant uuid := '0d8385df-4eed-429e-b691-81acee1ad606';
  v_d record;
  r record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
    JOIN public.eclub_eczaneler e ON e.eczane_id = ke.eczane_id
    JOIN public.eclub_eczane_master em ON em.gln = e.gln
    WHERE ke.kisi_id = v_kisi AND ke.eczane_id = v_eczane AND ke.aktif_mi
      AND k.rol = 'eczaci' AND em.kaynak = 'test' AND e.gln = '1110000000003'
  ) THEN RAISE EXCEPTION 'Hedef test eczanesi/eczacı bağı doğrulanamadı.'; END IF;
  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();
  FOR r IN SELECT x.*, ky.arac_turu FROM cek_karti_ornekleri x
    LEFT JOIN public.v_yayin_kunye ky ON ky.yayin_id = x.yayin_id
  LOOP
    IF r.arac_turu IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.yayin_yonetimi y
      JOIN public.v_yayin_kunye ky ON ky.yayin_id = y.yayin_id
      JOIN public.eclub_eczane_firma ef ON ef.firma_id = ky.firma_id
      JOIN public.firmalar f ON f.firma_id = ef.firma_id
      WHERE y.yayin_id = r.yayin_id AND ky.urun_id = r.urun_id
        AND ef.eczane_id = v_eczane AND ef.aktif_mi
        AND f.aktif AND f.eclub_aktif AND f.eclub_store_aktif
        AND y.durum = 'yayinda' AND y.cek_karsiligi_var_mi
        AND public.eclub_store_barem_gecerli(y.barem_tablosu)
    ) THEN RAISE EXCEPTION 'Test yayını doğrulanamadı: %', r.yayin_id; END IF;
    IF EXISTS (
      SELECT 1 FROM public.eclub_kazanilan_puanlar p
      WHERE p.eczane_id = v_eczane AND p.yayin_id = r.yayin_id
        AND p.kazanilan_puan_id <> r.puan_id
    ) OR EXISTS (
      SELECT 1 FROM public.eclub_store_puan_devirleri d
      WHERE d.eczane_id = v_eczane AND d.yayin_id = r.yayin_id
    ) OR EXISTS (
      SELECT 1 FROM public.eclub_store_cek_talepleri t
      WHERE t.eczane_id = v_eczane AND t.yayin_id = r.yayin_id
    ) THEN RAISE EXCEPTION 'Yayında mevcut puan/devir/talep var; test verisi eklenmedi: %', r.yayin_id; END IF;
    IF EXISTS (
      SELECT 1 FROM public.eclub_izleme_kayitlari i WHERE i.izleme_id = r.izleme_id
        AND (i.kisi_id <> v_kisi OR i.yayin_id <> r.yayin_id
          OR i.ilerleme_durumu->>'gorunum_testi' IS DISTINCT FROM 'eclub-cek-karti-v1')
    ) OR EXISTS (
      SELECT 1 FROM public.eclub_kazanilan_puanlar p WHERE p.kazanilan_puan_id = r.puan_id
        AND (p.kisi_id <> v_kisi OR p.eczane_id <> v_eczane OR p.yayin_id <> r.yayin_id
          OR p.izleme_id <> r.izleme_id OR p.puan <> r.puan
          OR p.created_at IS DISTINCT FROM v_d.donem_baslangic + interval '1 day')
    ) THEN RAISE EXCEPTION 'Test kimliği farklı kayıtla çakışıyor.'; END IF;
    INSERT INTO public.eclub_izleme_kayitlari (
      izleme_id, yayin_id, kisi_id, izleme_turu, tamamlandi_mi,
      izleme_baslangic, izleme_bitis, created_at, arac_turu, ilerleme_durumu,
      soru_hakki_var_mi, soru_erisimi_acik_mi
    ) VALUES (
      r.izleme_id, r.yayin_id, v_kisi, 'oneri', true,
      v_d.donem_baslangic + interval '1 day', v_d.donem_baslangic + interval '1 day',
      v_d.donem_baslangic + interval '1 day', r.arac_turu,
      '{"gorunum_testi":"eclub-cek-karti-v1"}'::jsonb, false, false
    ) ON CONFLICT (izleme_id) DO NOTHING;
    INSERT INTO public.eclub_kazanilan_puanlar (
      kazanilan_puan_id, kisi_id, yayin_id, izleme_id, puan_turu,
      puan, created_at, urun_id, cek_karsiligi_var_mi, eczane_id
    ) VALUES (
      r.puan_id, v_kisi, r.yayin_id, r.izleme_id, 'izleme', r.puan,
      v_d.donem_baslangic + interval '1 day', r.urun_id, true, v_eczane
    ) ON CONFLICT (kazanilan_puan_id) DO NOTHING;
  END LOOP;
END;
$test$;

-- Sayfanın okuma fonksiyonundaki bilinen ürün adı referansı varsa düzelt.
-- Fonksiyonun imzası, hesapları ve yetkileri korunur; yeni devir fonksiyonu değiştirilmez.
DO $okuma$
DECLARE v_tanim text; v_yeni text;
BEGIN
  SELECT pg_get_functiondef('public.get_eclub_eczane_store_ozet(uuid)'::regprocedure)
    INTO v_tanim;
  v_yeni := v_tanim;
  IF strpos(v_yeni, 'k.urun_adi') > 0 THEN
    IF v_yeni !~ 'JOIN[[:space:]]+public[.]urunler[[:space:]]+u[[:space:]]' THEN
      v_yeni := regexp_replace(v_yeni,
        '(JOIN[[:space:]]+public[.]v_yayin_kunye[[:space:]]+k[[:space:]]+ON[[:space:]]+k[.]yayin_id[[:space:]]*=[[:space:]]*y[.]yayin_id)',
        '\1 LEFT JOIN public.urunler u ON u.urun_id = k.urun_id', 'g');
      IF v_yeni = v_tanim THEN
        RAISE EXCEPTION 'Okuma fonksiyonunun ürün bağı beklenen yapıda değil; işlem geri alındı.';
      END IF;
    END IF;
    v_yeni := replace(v_yeni, 'k.urun_adi', 'u.urun_adi');
  END IF;
  v_yeni := replace(v_yeni, 'v_d.talep_penceresi_acik_mi', 'v_d.talep_acik_mi');
  IF v_yeni <> v_tanim THEN EXECUTE v_yeni; END IF;
  -- Gerçek sayfa okumasını doğrula; hata olursa test kayıtları da geri alınır.
  PERFORM * FROM public.get_eclub_eczane_store_ozet('3b0b6c01-428e-4797-a8ad-67d5d2400b5f');
END;
$okuma$;

SELECT u.urun_adi, p.puan AS ornek_puan, y.satis_sarti_tipi, y.barem_tablosu,
  y.karsilik_puan, y.karsilik_tl, d.donem_kodu
FROM cek_karti_ornekleri x
JOIN public.eclub_kazanilan_puanlar p ON p.kazanilan_puan_id = x.puan_id
JOIN public.urunler u ON u.urun_id = x.urun_id
JOIN public.yayin_yonetimi y ON y.yayin_id = x.yayin_id
CROSS JOIN public.eclub_store_aktif_donem() d
ORDER BY x.sira;
COMMIT;
