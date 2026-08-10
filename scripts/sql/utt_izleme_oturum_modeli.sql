-- UTT izleme oturum modeli — şema + kullanıcı lehine geçmiş veri geçişi.
-- Önce: scripts/sql/utt_izleme_oturum_modeli_on_kontrol.sql
-- Canlı DB'de yalnız İskender tarafından çalıştırılır.
-- Ön kontroldeki üç mükerrerlik sorgusu boş dönmeden bu dosya KOŞULMAZ.
-- Yeniden koşum güvenlidir; mevcut veri silinmez.

BEGIN;

-- A) Gerçek deneme, soru kararı, sabit soru seti, güvenilir süre ve başlangıç idempotency.
ALTER TABLE public.izleme_kayitlari
  ADD COLUMN IF NOT EXISTS gercek_oynatma_mi boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS soru_hakki_var_mi boolean,
  ADD COLUMN IF NOT EXISTS soru_hakki_nedeni text,
  ADD COLUMN IF NOT EXISTS soru_indeksleri integer[],
  ADD COLUMN IF NOT EXISTS video_suresi_saniye integer,
  ADD COLUMN IF NOT EXISTS baslat_olay_id uuid;

-- B) İleri sarma ağ tekrarlarının aynı kaybı iki kez yazmasını engelleyen olay kimliği.
ALTER TABLE public.ileri_sarma_kayitlari
  ADD COLUMN IF NOT EXISTS olay_id uuid;

-- C) Video süresinin sunucu-kaynaklı kalıcı adresi.
ALTER TABLE public.videolar
  ADD COLUMN IF NOT EXISTS video_suresi_saniye integer;

-- D) Geçmiş kayıt geçişi. Eski belirsizlik kullanıcı aleyhine yorumlanmaz:
-- yalnız tamamlanmış veya ileri sarma kanıtı olan eski kayıt gerçek denemedir.
UPDATE public.izleme_kayitlari ik
SET gercek_oynatma_mi = true
WHERE ik.gercek_oynatma_mi = false
  AND (
    ik.tamamlandi_mi = true
    OR EXISTS (
      SELECT 1
      FROM public.ileri_sarma_kayitlari isk
      WHERE isk.izleme_id = ik.izleme_id
    )
  );

-- Daha önce cevap üretilmiş tamamlanmış kayıt, tarihsel olarak soru hakkı almıştır.
-- Diğer tarihsel kayıtlar NULL kalır; yeni kod NULL'ı yeni soru hakkı olarak yorumlamaz.
UPDATE public.izleme_kayitlari ik
SET soru_hakki_var_mi = true,
    soru_hakki_nedeni = 'uygun'
WHERE ik.tamamlandi_mi = true
  AND ik.soru_hakki_var_mi IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.soru_cevaplari sc
    WHERE sc.izleme_id = ik.izleme_id
  );

-- E) Alan doğruluk sınırları. NOT VALID eski satırları bloklamadan ekler;
-- bu geçişte yeni alanlar NULL veya kontrollü değer olduğu için hemen doğrulanır.
DO $blok$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'izleme_kayitlari_soru_hakki_nedeni_ck'
      AND conrelid = 'public.izleme_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.izleme_kayitlari
      ADD CONSTRAINT izleme_kayitlari_soru_hakki_nedeni_ck
      CHECK (
        soru_hakki_nedeni IS NULL
        OR soru_hakki_nedeni IN (
          'uygun', 'tamamlanmadi', 'puan_disinda',
          'yarim_deneme', 'tekrar_izleme', 'ileri_sarma'
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'izleme_kayitlari_video_suresi_ck'
      AND conrelid = 'public.izleme_kayitlari'::regclass
  ) THEN
    ALTER TABLE public.izleme_kayitlari
      ADD CONSTRAINT izleme_kayitlari_video_suresi_ck
      CHECK (video_suresi_saniye IS NULL OR video_suresi_saniye > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'videolar_video_suresi_ck'
      AND conrelid = 'public.videolar'::regclass
  ) THEN
    ALTER TABLE public.videolar
      ADD CONSTRAINT videolar_video_suresi_ck
      CHECK (video_suresi_saniye IS NULL OR video_suresi_saniye > 0) NOT VALID;
  END IF;
END;
$blok$;

ALTER TABLE public.izleme_kayitlari
  VALIDATE CONSTRAINT izleme_kayitlari_soru_hakki_nedeni_ck;
ALTER TABLE public.izleme_kayitlari
  VALIDATE CONSTRAINT izleme_kayitlari_video_suresi_ck;
ALTER TABLE public.videolar
  VALIDATE CONSTRAINT videolar_video_suresi_ck;

-- F) İdempotency ve okuma indexleri.
CREATE UNIQUE INDEX IF NOT EXISTS uq_izleme_kayitlari_baslat_olay
  ON public.izleme_kayitlari (baslat_olay_id)
  WHERE baslat_olay_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ileri_sarma_kayitlari_olay
  ON public.ileri_sarma_kayitlari (olay_id)
  WHERE olay_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kazanilan_puanlar_izleme_turu
  ON public.kazanilan_puanlar (izleme_id, puan_turu)
  WHERE puan_turu IN ('izleme', 'extra', 'oneri');

CREATE UNIQUE INDEX IF NOT EXISTS uq_soru_cevaplari_izleme_soru
  ON public.soru_cevaplari (izleme_id, soru_index);

CREATE UNIQUE INDEX IF NOT EXISTS uq_yanlis_cevap_kayitlari_izleme_soru
  ON public.yanlis_cevap_kayitlari (izleme_id, soru_index);

CREATE INDEX IF NOT EXISTS ix_izleme_kayitlari_gercek_tur
  ON public.izleme_kayitlari (kullanici_id, yayin_id, izleme_baslangic)
  WHERE gercek_oynatma_mi = true;

CREATE INDEX IF NOT EXISTS ix_ileri_sarma_kayitlari_izleme
  ON public.ileri_sarma_kayitlari (izleme_id);

COMMIT;

-- SON TEYİT (salt okuma)
SELECT
  COUNT(*) FILTER (WHERE gercek_oynatma_mi = true) AS gercek_deneme,
  COUNT(*) FILTER (WHERE gercek_oynatma_mi = false) AS eski_belirsiz_acilis,
  COUNT(*) FILTER (WHERE soru_hakki_var_mi = true) AS tarihsel_soru_hakki
FROM public.izleme_kayitlari;

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'izleme_kayitlari' AND column_name IN (
      'gercek_oynatma_mi', 'soru_hakki_var_mi', 'soru_hakki_nedeni',
      'soru_indeksleri', 'video_suresi_saniye', 'baslat_olay_id'
    ))
    OR (table_name = 'ileri_sarma_kayitlari' AND column_name = 'olay_id')
    OR (table_name = 'videolar' AND column_name = 'video_suresi_saniye')
  )
ORDER BY table_name, column_name;
