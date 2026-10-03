-- YALNIZ GÖRÜNÜM TESTİ: Eczanem > Mutabakat için 4 veya 5 sahte işlem.
-- Bu dosyayı yalnız kullanıcı Supabase SQL Editor'de çalıştırır.
-- HEDEF UTT: 765b6890-183f-4518-b887-07003ff5cdc7
-- Önceki konuşmada paylaşılan bu UUID'nin ekranda kullanılan UTT hesabı
-- olduğunu çalıştırmadan önce doğrulayın. Bu hesabın en az
-- 4 farklı aktif bağlı eczanesi yoksa HİÇBİR kayıt eklenmeden durur.
-- Gerçek sipariş, müşteri, puan, yayın veya eczane tablolarına yazmaz.
-- Kaynak sipariş / ürün / yayın UUID'leri test amaçlıdır ve gerçek işlem değildir.
-- Test kayıtları kullanıcının Tümü/Karar bekliyor/Onay/Beklet/Ret filtrelerinde
-- görünür. Varsayılan seçilen ay için önceki ayın tarihini kullanır.
-- Aynı dosya ikinci kez çalıştırılmamalıdır; sabit mutabakat UUID'leri korunur.
-- Teste özel 99 önekli görünür İndirim ID için ardından
-- eczanem_mutabakat_test_urun_adlarini_duzelt.sql çalıştırılır.

BEGIN;

DO $kontrol$
DECLARE
  v_eczane_sayisi integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.kullanicilar k
    JOIN public.firmalar f ON f.firma_id = k.firma_id
    WHERE k.kullanici_id = '765b6890-183f-4518-b887-07003ff5cdc7'::uuid
      AND LOWER(k.rol) = 'utt'
      AND k.aktif_mi = true
      AND f.aktif = true
      AND f.eczanem_aktif = true
  ) THEN
    RAISE EXCEPTION 'Hedef UTT hesabı aktif/uygun değil; test kaydı eklenmedi.';
  END IF;

  SELECT COUNT(DISTINCT ef.eczane_id) INTO v_eczane_sayisi
  FROM public.kullanicilar k
  JOIN public.eclub_utt_eczane ue ON ue.utt_id = k.kullanici_id AND ue.aktif_mi = true
  JOIN public.eclub_eczane_firma ef ON ef.id = ue.eczane_firma_id
    AND ef.firma_id = k.firma_id AND ef.aktif_mi = true
  WHERE k.kullanici_id = '765b6890-183f-4518-b887-07003ff5cdc7'::uuid;

  IF v_eczane_sayisi < 4 THEN
    RAISE EXCEPTION 'Hedef UTT için % aktif bağlı eczane bulundu; en az 4 gerekli. Test kaydı eklenmedi.', v_eczane_sayisi;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.eczanem_indirim_onaylari
    WHERE eczanem_indirim_onay_id IN (
      'a73682fb-521c-4313-bd38-44245b65336b'::uuid,
      '9c894492-0d2d-4c0e-8117-0e16f8fb8255'::uuid,
      'd622ad69-7b73-43a7-9a07-8eb61a8e5e0f'::uuid,
      'b64148ef-bab4-499f-8aa6-7d6122a61990'::uuid,
      '49be3a03-806e-4f76-af40-d2d22ec79b7c'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Bu görünüm test kayıtları zaten var; ikinci kez eklenmedi.';
  END IF;
END;
$kontrol$;

CREATE TEMP TABLE mutabakat_ui_test_satirlari ON COMMIT DROP AS
WITH hedef_utt AS (
  SELECT k.kullanici_id AS utt_id, k.firma_id, k.takim_id
  FROM public.kullanicilar k
  WHERE k.kullanici_id = '765b6890-183f-4518-b887-07003ff5cdc7'::uuid
),
aktif_eczaneler AS (
  SELECT DISTINCT ON (ef.eczane_id)
    ef.eczane_id,
    NULLIF(BTRIM(em.eczane_adi), '') AS eczane_adi
  FROM hedef_utt u
  JOIN public.eclub_utt_eczane ue ON ue.utt_id = u.utt_id AND ue.aktif_mi = true
  JOIN public.eclub_eczane_firma ef ON ef.id = ue.eczane_firma_id
    AND ef.firma_id = u.firma_id AND ef.aktif_mi = true
  LEFT JOIN public.eclub_eczaneler e ON e.eczane_id = ef.eczane_id
  LEFT JOIN public.eclub_eczane_master em ON em.gln = e.gln
  ORDER BY ef.eczane_id
),
sirali_eczaneler AS (
  SELECT ROW_NUMBER() OVER (ORDER BY eczane_id)::integer AS sira, eczane_id, eczane_adi
  FROM aktif_eczaneler
  LIMIT 5
),
ornekler(sira, mutabakat_id, urun_adi, arac_turu, teknik_adi, kullanilan_puan, indirim_tl, pm_puani, karar, ayin_gunu) AS (
  VALUES
    (1, 'a73682fb-521c-4313-bd38-44245b65336b'::uuid, 'Test Ürün A', 'video',    'TEST Ürün A anlatımı',         40, 20.00::numeric, 15, NULL::text,  3),
    (2, '9c894492-0d2d-4c0e-8117-0e16f8fb8255'::uuid, 'Test Ürün B', 'podcast',  'TEST Ürün B sesli anlatım',  60, 30.00::numeric, 20, 'onay',      7),
    (3, 'd622ad69-7b73-43a7-9a07-8eb61a8e5e0f'::uuid, 'Test Ürün C', 'gorsel',   'TEST Ürün C broşürü',        100, 50.00::numeric, 30, 'beklet',   11),
    (4, 'b64148ef-bab4-499f-8aa6-7d6122a61990'::uuid, 'Test Ürün D', 'flip_pdf', 'TEST Ürün D literatürü',      80, 40.00::numeric, 25, 'ret',      15),
    (5, '49be3a03-806e-4f76-af40-d2d22ec79b7c'::uuid, 'Test Ürün E', 'video',    'TEST Ürün E anlatımı',        150, 75.00::numeric, 40, NULL::text, 20)
)
SELECT o.*, u.utt_id, u.firma_id, u.takim_id, e.eczane_id,
  COALESCE(e.eczane_adi, 'TEST Eczane ' || e.sira) AS eczane_adi,
  gen_random_uuid() AS urun_id,
  gen_random_uuid() AS yayin_id,
  gen_random_uuid() AS arac_id,
  ((date_trunc('month', timezone('Europe/Istanbul', now())) - INTERVAL '1 month'
    + make_interval(days => o.ayin_gunu - 1, hours => 12)) AT TIME ZONE 'Europe/Istanbul') AS onay_tarihi
FROM ornekler o
JOIN sirali_eczaneler e ON e.sira = o.sira
CROSS JOIN hedef_utt u;

INSERT INTO public.eczanem_indirim_onaylari (
  eczanem_indirim_onay_id, kaynak_siparis_id, eczane_id, eczane_adi,
  firma_id, takim_id, urun_id, urun_adi, onay_tarihi, kullanilan_puan,
  indirim_tl, tarife_puan, tarife_tl, satis_fiyati
)
SELECT mutabakat_id, gen_random_uuid(), eczane_id, eczane_adi,
  firma_id, takim_id, urun_id, urun_adi, onay_tarihi, kullanilan_puan,
  indirim_tl, 100, 50.00, 450.00
FROM mutabakat_ui_test_satirlari;

INSERT INTO public.eczanem_indirim_onay_kaynaklari (
  eczanem_indirim_onay_id, yayin_id, arac_id, arac_turu,
  teknik_adi, pm_ogrenme_puani, kullanilan_puan
)
SELECT mutabakat_id, yayin_id, arac_id, arac_turu,
  teknik_adi, pm_puani,
  CASE WHEN sira = 5 THEN 100 ELSE kullanilan_puan END
FROM mutabakat_ui_test_satirlari;

-- Beşinci örnek iki yayına bağlıdır; çoklu kaynak yerleşimini de gösterir.
INSERT INTO public.eczanem_indirim_onay_kaynaklari (
  eczanem_indirim_onay_id, yayin_id, arac_id, arac_turu,
  teknik_adi, pm_ogrenme_puani, kullanilan_puan
)
SELECT mutabakat_id, gen_random_uuid(), gen_random_uuid(), 'podcast',
  'TEST Ürün E sesli anlatım', 20, 50
FROM mutabakat_ui_test_satirlari
WHERE sira = 5;

INSERT INTO public.eczanem_utt_mutabakatlar (
  mutabakat_id, utt_karar, utt_karar_veren_id, utt_karar_tarihi, karar_surumu
)
SELECT mutabakat_id, karar,
  CASE WHEN karar IS NOT NULL THEN utt_id ELSE NULL END,
  CASE WHEN karar IS NOT NULL THEN now() ELSE NULL END,
  CASE WHEN karar IS NOT NULL THEN 1 ELSE 0 END
FROM mutabakat_ui_test_satirlari;

INSERT INTO public.eczanem_utt_mutabakat_kararlari (
  mutabakat_id, surum, karar, karar_veren_id, karar_tarihi
)
SELECT mutabakat_id, 1, karar, utt_id, now()
FROM mutabakat_ui_test_satirlari
WHERE karar IS NOT NULL;

COMMIT;

SELECT eczanem_indirim_onay_id AS test_mutabakat_id, eczane_adi, urun_adi, onay_tarihi
FROM public.eczanem_indirim_onaylari
WHERE eczanem_indirim_onay_id IN (
  'a73682fb-521c-4313-bd38-44245b65336b'::uuid,
  '9c894492-0d2d-4c0e-8117-0e16f8fb8255'::uuid,
  'd622ad69-7b73-43a7-9a07-8eb61a8e5e0f'::uuid,
  'b64148ef-bab4-499f-8aa6-7d6122a61990'::uuid,
  '49be3a03-806e-4f76-af40-d2d22ec79b7c'::uuid
)
ORDER BY onay_tarihi;
