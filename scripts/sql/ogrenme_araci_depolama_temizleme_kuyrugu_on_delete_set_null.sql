-- scripts/sql/ogrenme_araci_depolama_temizleme_kuyrugu_on_delete_set_null.sql
--
-- Depolama Temizleme Kuyruğu — Araçtan Bağımsız Koruma Migrasyonu
--
-- ogrenme_araci_depolama_temizleme_kuyrugu tablosundaki ON DELETE CASCADE kısıtını
-- kaldırarak ON DELETE SET NULL kuralını ve arac_id NULL olabilme özelliğini uygular.
-- Bu sayede taslak iptal edildiğinde veya zaman aşımıyla silindiğinde Bunny Storage
-- temizleme kuyruğu kayıtları silinmez, temizlik worker'ı dosya yolu üzerinden
-- dosyaları başarıyla temizler.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-depolama-temizleme-kuyrugu-set-null', 1));

-- 1. arac_id kolonundaki NOT NULL kısıtını kaldır
ALTER TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu
  ALTER COLUMN arac_id DROP NOT NULL;

-- 2. Eski ON DELETE CASCADE yabancı anahtar kısıtını bul ve kaldır, yerine ON DELETE SET NULL ekle
DO $$
DECLARE
  v_con text;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.ogrenme_araci_depolama_temizleme_kuyrugu'::regclass
      AND contype = 'f'
      AND confrelid = 'public.ogrenme_araclari'::regclass
  LOOP
    EXECUTE 'ALTER TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu DROP CONSTRAINT ' || quote_ident(v_con);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ogrenme_araci_depolama_temizleme_kuyrugu'::regclass
      AND contype = 'f'
      AND confrelid = 'public.ogrenme_araclari'::regclass
  ) THEN
    ALTER TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu
      ADD CONSTRAINT fk_ogrenme_araci_depolama_temizleme_arac
      FOREIGN KEY (arac_id)
      REFERENCES public.ogrenme_araclari(arac_id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

SELECT
  attnotnull = false AS arac_id_nullable,
  EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.ogrenme_araci_depolama_temizleme_kuyrugu'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.ogrenme_araclari'::regclass
      AND c.confdeltype = 'n'
  ) AS on_delete_set_null_kuruldu
FROM pg_attribute
WHERE attrelid = 'public.ogrenme_araci_depolama_temizleme_kuyrugu'::regclass
  AND attname = 'arac_id';
