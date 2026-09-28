-- ==========================================================================
-- FAZ 1A — eclub_kazanilan_puanlar.eczane_id snapshot alanı
-- ==========================================================================
-- Bu dosya yalnızca Faz 1A kapsamındadır.
--
-- Amaç:
--   * Kazanılan her puanı, kazanıldığı eczaneye kalıcı olarak bağlamak.
--   * eczane_id alanını zorunlu ve sonradan değiştirilemez yapmak.
--   * Faz 1B tamamlanıncaya kadar mevcut puan-yazma fonksiyonlarının çalışmasını,
--     aktif eczaneyi sunucu tarafında çözen BEFORE INSERT trigger'ı ile korumak.
--
-- Çalıştırma sırası:
--   1. Geliştirme veritabanında niteliksiz test puanı varsa önce
--      scripts/sql/eclub_puan_eczane_test_verisi_temizle.sql çalıştırılır.
--   2. Ardından bu dosya çalıştırılır.
--
-- Bu migration Store, rapor, lig veya puan-yazma RPC'lerini değiştirmez.
-- Bunlar sırasıyla Faz 1B ve Faz 1C kapsamındadır.
-- ==========================================================================

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('eclub-puan-eczane-sabitleme-faz-1a', 0)
);

-- Şema değişirken eşzamanlı puan yazımını engelle.
LOCK TABLE public.eclub_kazanilan_puanlar IN ACCESS EXCLUSIVE MODE;

-- Mevcut kayıtların tamamı niteliksiz test verisidir; yine de migration onları
-- kendiliğinden silmez. Temizleme kararı ve SQL çalıştırma kullanıcıya aittir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'eclub_kazanilan_puanlar'
       AND column_name = 'eczane_id'
  )
  AND EXISTS (SELECT 1 FROM public.eclub_kazanilan_puanlar) THEN
    RAISE EXCEPTION
      'Faz 1A uygulanmadı: eclub_kazanilan_puanlar test verisi içeriyor. Önce scripts/sql/eclub_puan_eczane_test_verisi_temizle.sql dosyasını çalıştırın.';
  END IF;
END;
$$;

ALTER TABLE public.eclub_kazanilan_puanlar
  ADD COLUMN IF NOT EXISTS eczane_id uuid;

ALTER TABLE public.eclub_kazanilan_puanlar
  ALTER COLUMN eczane_id SET NOT NULL;

COMMENT ON COLUMN public.eclub_kazanilan_puanlar.eczane_id IS
  'Puanın kazanıldığı anda kişinin bağlı olduğu eczanenin değişmez snapshot kimliği.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
     WHERE c.conname = 'fk_eclub_kazanilan_puanlar_eczane'
       AND c.conrelid = 'public.eclub_kazanilan_puanlar'::regclass
  ) THEN
    ALTER TABLE public.eclub_kazanilan_puanlar
      ADD CONSTRAINT fk_eclub_kazanilan_puanlar_eczane
      FOREIGN KEY (eczane_id)
      REFERENCES public.eclub_eczaneler (eczane_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_eclub_kazanilan_puanlar_eczane_yayin_cek_tarih
  ON public.eclub_kazanilan_puanlar
  (eczane_id, yayin_id, cek_karsiligi_var_mi, created_at);

CREATE INDEX IF NOT EXISTS idx_eclub_kazanilan_puanlar_eczane_tarih
  ON public.eclub_kazanilan_puanlar (eczane_id, created_at);

-- Mevcut puan-yazma fonksiyonları Faz 1B'ye kadar eczane_id göndermediği için,
-- snapshot değeri DB bütünlük katmanında kişinin o anki aktif eczanesinden
-- belirlenir. Faz 1B'de yazıcılar açıkça eczane_id ile güncellense de bu
-- trigger son güvenlik katmanı olarak kalır.
CREATE OR REPLACE FUNCTION public.tg_eclub_kazanilan_puanlar_eczane_sabitle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_aktif_eczaneler uuid[];
  v_aktif_eczane_id uuid;
BEGIN
  IF NEW.kisi_id IS NULL THEN
    RAISE EXCEPTION 'eclub_kazanilan_puanlar: kisi_id zorunludur.';
  END IF;

  SELECT array_agg(kilitli.eczane_id ORDER BY kilitli.eczane_id)
    INTO v_aktif_eczaneler
    FROM (
      SELECT ke.eczane_id
        FROM public.eclub_kisi_eczane ke
       WHERE ke.kisi_id = NEW.kisi_id
         AND ke.aktif_mi = true
       FOR SHARE
    ) AS kilitli;

  IF coalesce(cardinality(v_aktif_eczaneler), 0) = 0 THEN
    RAISE EXCEPTION
      'eclub_kazanilan_puanlar: kişinin aktif eczane kaydı bulunamadı.';
  END IF;

  IF cardinality(v_aktif_eczaneler) > 1 THEN
    RAISE EXCEPTION
      'eclub_kazanilan_puanlar: kişinin birden fazla aktif eczane kaydı var.';
  END IF;

  v_aktif_eczane_id := v_aktif_eczaneler[1];

  IF NEW.eczane_id IS NOT NULL
     AND NEW.eczane_id <> v_aktif_eczane_id THEN
    RAISE EXCEPTION
      'eclub_kazanilan_puanlar: eczane_id aktif eczane ile uyuşmuyor.';
  END IF;

  NEW.eczane_id := v_aktif_eczane_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_eclub_kazanilan_puanlar_eczane_sabitle()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_eclub_kazanilan_puanlar_eczane_sabitle
  ON public.eclub_kazanilan_puanlar;

CREATE TRIGGER trg_eclub_kazanilan_puanlar_eczane_sabitle
  BEFORE INSERT ON public.eclub_kazanilan_puanlar
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_eclub_kazanilan_puanlar_eczane_sabitle();

CREATE OR REPLACE FUNCTION public.tg_eclub_kazanilan_puanlar_eczane_degismez()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.eczane_id IS DISTINCT FROM OLD.eczane_id THEN
    RAISE EXCEPTION
      'eclub_kazanilan_puanlar: eczane_id sonradan değiştirilemez.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_eclub_kazanilan_puanlar_eczane_degismez()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_eclub_kazanilan_puanlar_eczane_degismez
  ON public.eclub_kazanilan_puanlar;

CREATE TRIGGER trg_eclub_kazanilan_puanlar_eczane_degismez
  BEFORE UPDATE OF eczane_id ON public.eclub_kazanilan_puanlar
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_eclub_kazanilan_puanlar_eczane_degismez();

NOTIFY pgrst, 'reload schema';

COMMIT;
