-- scripts/sql/bildirimler_alici_kayit_unique.sql
--
-- Çift bildirimi kesin engellemek için bildirimler tablosuna
-- (alici_id, kayit_turu, kayit_id) UNIQUE kısıtı eklenir.

-- 1. Varsa eski mükerrer satırları en güncel olanı koruyarak temizle
DELETE FROM public.bildirimler
WHERE bildirim_id IN (
  SELECT bildirim_id
  FROM (
    SELECT bildirim_id,
           ROW_NUMBER() OVER (
             PARTITION BY alici_id, kayit_turu, kayit_id 
             ORDER BY created_at DESC, bildirim_id DESC
           ) AS rnum
    FROM public.bildirimler
  ) t
  WHERE t.rnum > 1
);

-- 2. Unique constraint ekle (zaten yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.bildirimler'::regclass 
      AND conname = 'uq_bildirimler_alici_kayit_turu_kayit_id'
  ) THEN
    ALTER TABLE public.bildirimler
      ADD CONSTRAINT uq_bildirimler_alici_kayit_turu_kayit_id
      UNIQUE (alici_id, kayit_turu, kayit_id);
  END IF;
END $$;
