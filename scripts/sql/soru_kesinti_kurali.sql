-- Soru Erişimi Kesinti Kuralı — Faz 1 (şema)
--
-- Sorun: Video tamamlanıp izleme puanı + soru indeksleri yazıldıktan sonra
-- kullanıcı soruları cevaplamadan çıkarsa, DB'de soru hakkı açık kalıyor;
-- eski izleme_id yeniden kullanılan akışlarda (BM challenge, E-Club, müşteri)
-- sorular tekrar açılabiliyor.
--
-- Çözüm: Dört izleme tablosuna TEK TİP bir kapı alanı eklenir. Durum geçişleri:
--   İlk uygun video tamamlandı  → true   (Faz 2 — bitir/tamamla)
--   Cevaplar gönderildi         → false  (Faz 5 — cevap)
--   Yayın yeniden başlatıldı    → false  (Faz 3 — baslat)
--
-- DEFAULT false: mevcut tamamlanmış-cevaplanmamış eski kayıtlar kapalı kalır,
-- geçmiş sorular açılmaz (backfill yapılmaz).
--
-- İskender tarafından Supabase SQL Editor'da çalıştırılır (tek transaction).

BEGIN;

ALTER TABLE public.izleme_kayitlari
  ADD COLUMN IF NOT EXISTS soru_erisimi_acik_mi boolean NOT NULL DEFAULT false;

ALTER TABLE public.cc_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS soru_erisimi_acik_mi boolean NOT NULL DEFAULT false;

ALTER TABLE public.eclub_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS soru_erisimi_acik_mi boolean NOT NULL DEFAULT false;

ALTER TABLE public.eczanem_izleme_kayitlari
  ADD COLUMN IF NOT EXISTS soru_erisimi_acik_mi boolean NOT NULL DEFAULT false;

COMMIT;

-- Uygulama sonrası doğrulama: dört değer de true dönmelidir.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='izleme_kayitlari'
      AND column_name='soru_erisimi_acik_mi') AS utt_kolonu_var,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cc_izleme_kayitlari'
      AND column_name='soru_erisimi_acik_mi') AS cc_kolonu_var,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='eclub_izleme_kayitlari'
      AND column_name='soru_erisimi_acik_mi') AS eclub_kolonu_var,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='eczanem_izleme_kayitlari'
      AND column_name='soru_erisimi_acik_mi') AS eczanem_kolonu_var;
