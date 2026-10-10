-- Kullanıcı tasarım çalışmasını bitirip açıkça temizlik istediğinde çalıştırılır.
-- Yalnız eclub_cek_karti_test_verisi_ekle.sql kapsamındaki test verisini siler.
-- Diğer Hediye Takibi test verileri korunur. Okuma fonksiyonundaki hata düzeltmesi korunur.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(hashtextextended('eclub-cek-karti-gorunum-v1', 0));
LOCK TABLE public.eclub_kazanilan_puanlar, public.eclub_izleme_kayitlari,
  public.eclub_store_puan_devirleri, public.eclub_store_cek_talepleri
  IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE cek_karti_temizlik (
  yayin_id uuid, izleme_id uuid, puan_id uuid, puan integer
) ON COMMIT DROP;
INSERT INTO cek_karti_temizlik VALUES
  ('f364c684-eadc-4ccc-8671-f333da7b555f', 'e1200000-0000-4000-8000-000000000001', 'e1200000-0000-4000-8000-000000000101', 100),
  ('bc71b5d2-0c91-4a7e-aa19-1a17a7a66f50', 'e1200000-0000-4000-8000-000000000002', 'e1200000-0000-4000-8000-000000000102', 300),
  ('3a6e0db1-bc42-44cf-ab16-b99630681ae9', 'e1200000-0000-4000-8000-000000000003', 'e1200000-0000-4000-8000-000000000103', 650);
DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.eclub_store_puan_devirleri d
    JOIN cek_karti_temizlik x ON x.yayin_id = d.yayin_id
    WHERE d.eczane_id = '0d8385df-4eed-429e-b691-81acee1ad606'::uuid
      AND NOT EXISTS (
        SELECT 1 FROM public.eclub_izleme_kayitlari i
        WHERE i.izleme_id = x.izleme_id
          AND i.ilerleme_durumu->>'gorunum_testi' = 'eclub-cek-karti-v1'
      )
  ) THEN RAISE EXCEPTION 'Devrin test kaynağı bulunamadı; temizlik durduruldu.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.eclub_izleme_kayitlari i
    JOIN cek_karti_temizlik x ON x.izleme_id = i.izleme_id
    WHERE i.kisi_id <> '3b0b6c01-428e-4797-a8ad-67d5d2400b5f'::uuid
      OR i.yayin_id <> x.yayin_id
      OR i.ilerleme_durumu->>'gorunum_testi' IS DISTINCT FROM 'eclub-cek-karti-v1'
  ) OR EXISTS (
    SELECT 1 FROM public.eclub_kazanilan_puanlar p
    JOIN cek_karti_temizlik x ON x.puan_id = p.kazanilan_puan_id
    WHERE p.kisi_id <> '3b0b6c01-428e-4797-a8ad-67d5d2400b5f'::uuid
      OR p.eczane_id <> '0d8385df-4eed-429e-b691-81acee1ad606'::uuid
      OR p.yayin_id <> x.yayin_id OR p.izleme_id <> x.izleme_id OR p.puan <> x.puan
  ) THEN RAISE EXCEPTION 'Test kimlikleri beklenen kapsamda değil; temizlik durduruldu.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.eclub_store_cek_talepleri t
    JOIN cek_karti_temizlik x ON x.yayin_id = t.yayin_id
    WHERE t.eczane_id = '0d8385df-4eed-429e-b691-81acee1ad606'::uuid
  ) OR EXISTS (
    SELECT 1 FROM public.eclub_kazanilan_puanlar p
    JOIN cek_karti_temizlik x ON x.yayin_id = p.yayin_id
    WHERE p.eczane_id = '0d8385df-4eed-429e-b691-81acee1ad606'::uuid
      AND p.kazanilan_puan_id <> x.puan_id
  ) THEN RAISE EXCEPTION 'Test yayınlarında başka puan/talep oluşmuş; karışık bakiye için temizlik durduruldu.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.eclub_store_puan_devirleri d
    JOIN cek_karti_temizlik x ON x.yayin_id = d.yayin_id
    WHERE d.eczane_id = '0d8385df-4eed-429e-b691-81acee1ad606'::uuid
      AND (d.puan <> x.puan OR d.kaynak_talep_id IS NOT NULL OR d.kullanilan_talep_id IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Devir kayıtları yalnız test puanından oluşmuyor; temizlik durduruldu.'; END IF;
END;
$kontrol$;
-- Eklerken bu eczane/yayın çiftlerinde devir bulunmadığı doğrulanmıştı.
DELETE FROM public.eclub_store_puan_devirleri d USING cek_karti_temizlik x
WHERE d.eczane_id = '0d8385df-4eed-429e-b691-81acee1ad606'::uuid AND d.yayin_id = x.yayin_id;
DELETE FROM public.eclub_kazanilan_puanlar p USING cek_karti_temizlik x
WHERE p.kazanilan_puan_id = x.puan_id;
DELETE FROM public.eclub_izleme_kayitlari i USING cek_karti_temizlik x
WHERE i.izleme_id = x.izleme_id;
SELECT count(*) AS kalan_test_puani FROM public.eclub_kazanilan_puanlar p
JOIN cek_karti_temizlik x ON x.puan_id = p.kazanilan_puan_id;
COMMIT;
