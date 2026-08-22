-- scripts/sql/cc_ligi_ozet.sql
--
-- CC Ligi ölçek — günlük özet tablosu + bakım trigger'ı.
-- (HBLigi E9+Faz6 deseninin CC'ye uyarlaması, 31.07.2026.)
--
-- CC lig (rol='bm') kendi 4 puan/kayıp tablosundan günlük özete aktarılır.
-- Kova: kişi × gün (tüm periyotlar — hafta/ay/çeyrek/yıl/tüm-zaman — günden türer).
--
-- Besleyen tablolar:
--   cc_kazanilan_puanlar: izleme/cevaplama/extra/cc_gonderme/cc_referral
--   cc_ileri_sarma_kayitlari, cc_yanlis_cevap_kayitlari, challenge_kayip_kayitlari
-- HBLigi tabloları bu akışa dahil değildir.
--
-- Yazım tek noktadan (trigger); uygulama koduna dokunulmaz. KORUMALI'ya eklenecek.
-- RLS geliştirme boyunca kapalı (genel kural).
-- KAPSAM: yalnız INSERT. Kaynak silme → backfill ile resync.
--
-- KOŞUM: tamamı bir kez. Yeniden koşumu güvenli (idempotent).

CREATE TABLE IF NOT EXISTS public.cc_ligi_ozet (
  kullanici_id       uuid        NOT NULL REFERENCES kullanicilar(kullanici_id) ON DELETE CASCADE,
  tarih              date        NOT NULL,
  izleme_puani       integer     NOT NULL DEFAULT 0,
  cevaplama_puani    integer     NOT NULL DEFAULT 0,
  extra_puani        integer     NOT NULL DEFAULT 0,
  cc_gonderme_puani  integer     NOT NULL DEFAULT 0,
  cc_referral_puani  integer     NOT NULL DEFAULT 0,
  ileri_sarma_kaybi  integer     NOT NULL DEFAULT 0,
  yanlis_cevap_kaybi integer     NOT NULL DEFAULT 0,
  challenge_kaybi    integer     NOT NULL DEFAULT 0,
  guncellenme        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kullanici_id, tarih)
);

CREATE INDEX IF NOT EXISTS ix_cc_ligi_ozet_tarih ON public.cc_ligi_ozet (tarih);

CREATE OR REPLACE FUNCTION public.cc_ligi_ozet_guncelle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_tarih        date;
  v_kullanici_id uuid;
  v_kol          text;
  v_delta        integer;
BEGIN
  IF TG_TABLE_NAME = 'cc_kazanilan_puanlar' THEN
    v_tarih := (NEW.created_at AT TIME ZONE 'Europe/Istanbul')::date;
    v_kullanici_id := NEW.bm_id;
    v_delta := NEW.puan;
    v_kol := CASE NEW.puan_turu
      WHEN 'izleme'      THEN 'izleme_puani'
      WHEN 'cevaplama'   THEN 'cevaplama_puani'
      WHEN 'extra'       THEN 'extra_puani'
      WHEN 'cc_gonderme' THEN 'cc_gonderme_puani'
      WHEN 'cc_referral' THEN 'cc_referral_puani'
      ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'cc_ileri_sarma_kayitlari' THEN
    v_tarih := (NEW.created_at AT TIME ZONE 'Europe/Istanbul')::date;
    v_kullanici_id := NEW.bm_id;
    v_delta := NEW.kaybedilen_puan; v_kol := 'ileri_sarma_kaybi';
  ELSIF TG_TABLE_NAME = 'cc_yanlis_cevap_kayitlari' THEN
    v_tarih := (NEW.created_at AT TIME ZONE 'Europe/Istanbul')::date;
    v_kullanici_id := NEW.bm_id;
    v_delta := NEW.kaybedilen_puan; v_kol := 'yanlis_cevap_kaybi';
  ELSIF TG_TABLE_NAME = 'challenge_kayip_kayitlari' THEN
    v_tarih := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Europe/Istanbul')::date;
    v_kullanici_id := NEW.kullanici_id;
    v_delta := NEW.kaybedilen_puan; v_kol := 'challenge_kaybi';
  END IF;

  IF v_kullanici_id IS NULL OR v_tarih IS NULL OR v_kol IS NULL OR v_delta IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE format(
    'INSERT INTO public.cc_ligi_ozet (kullanici_id, tarih, %1$I, guncellenme)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (kullanici_id, tarih)
     DO UPDATE SET %1$I = cc_ligi_ozet.%1$I + EXCLUDED.%1$I, guncellenme = now()',
    v_kol
  ) USING v_kullanici_id, v_tarih, v_delta;

  RETURN NULL;
END;
$fonk$;

-- Eski, hatalı HBLigi bağlantılarını kaldır.
DROP TRIGGER IF EXISTS trg_cc_ozet_kazanim ON public.kazanilan_puanlar;
DROP TRIGGER IF EXISTS trg_cc_ozet_ileri_sarma ON public.ileri_sarma_kayitlari;
DROP TRIGGER IF EXISTS trg_cc_ozet_yanlis_cevap ON public.yanlis_cevap_kayitlari;

DROP TRIGGER IF EXISTS trg_cc_ozet_kazanim ON public.cc_kazanilan_puanlar;
CREATE TRIGGER trg_cc_ozet_kazanim AFTER INSERT ON public.cc_kazanilan_puanlar
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();

DROP TRIGGER IF EXISTS trg_cc_ozet_ileri_sarma ON public.cc_ileri_sarma_kayitlari;
CREATE TRIGGER trg_cc_ozet_ileri_sarma AFTER INSERT ON public.cc_ileri_sarma_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();

DROP TRIGGER IF EXISTS trg_cc_ozet_yanlis_cevap ON public.cc_yanlis_cevap_kayitlari;
CREATE TRIGGER trg_cc_ozet_yanlis_cevap AFTER INSERT ON public.cc_yanlis_cevap_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();

DROP TRIGGER IF EXISTS trg_cc_ozet_challenge_kayip ON public.challenge_kayip_kayitlari;
CREATE TRIGGER trg_cc_ozet_challenge_kayip AFTER INSERT ON public.challenge_kayip_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();

REVOKE ALL ON FUNCTION public.cc_ligi_ozet_guncelle()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_ligi_ozet_guncelle()
  TO service_role;
