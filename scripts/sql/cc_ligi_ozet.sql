-- scripts/sql/cc_ligi_ozet.sql
--
-- CC Ligi ölçek — günlük özet tablosu + bakım trigger'ı.
-- (HBLigi E9+Faz6 deseninin CC'ye uyarlaması, 31.07.2026.)
--
-- CC lig (rol='bm') 4 tablodan canlı-SUM yapıyordu; özet tabloya geçiriliyor.
-- Kova: kişi × gün (tüm periyotlar — hafta/ay/çeyrek/yıl/tüm-zaman — günden türer).
--
-- Besleyen tablolar (get_cc_ligi_aylik gövdesinden):
--   kazanilan_puanlar: izleme/cevaplama/extra/cc_gonderme/cc_referral
--   ileri_sarma_kayitlari, yanlis_cevap_kayitlari (paylaşımlı), challenge_kayip_kayitlari
-- İlk 3 tablo HBLigi ile paylaşımlı → aynı tablolarda ikinci trigger (Postgres
-- ikisini de tetikler). CC trigger'ı yalnız CC puan türlerini eşler; kalanı atlar.
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
  v_tarih date := (NEW.created_at AT TIME ZONE 'Europe/Istanbul')::date;
  v_kol   text;
  v_delta integer;
BEGIN
  IF TG_TABLE_NAME = 'kazanilan_puanlar' THEN
    v_delta := NEW.puan;
    v_kol := CASE NEW.puan_turu
      WHEN 'izleme'      THEN 'izleme_puani'
      WHEN 'cevaplama'   THEN 'cevaplama_puani'
      WHEN 'extra'       THEN 'extra_puani'
      WHEN 'cc_gonderme' THEN 'cc_gonderme_puani'
      WHEN 'cc_referral' THEN 'cc_referral_puani'
      ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'ileri_sarma_kayitlari' THEN
    v_delta := NEW.kaybedilen_puan; v_kol := 'ileri_sarma_kaybi';
  ELSIF TG_TABLE_NAME = 'yanlis_cevap_kayitlari' THEN
    v_delta := NEW.kaybedilen_puan; v_kol := 'yanlis_cevap_kaybi';
  ELSIF TG_TABLE_NAME = 'challenge_kayip_kayitlari' THEN
    v_delta := NEW.kaybedilen_puan; v_kol := 'challenge_kaybi';
  END IF;

  IF v_kol IS NULL OR v_delta IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE format(
    'INSERT INTO public.cc_ligi_ozet (kullanici_id, tarih, %1$I, guncellenme)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (kullanici_id, tarih)
     DO UPDATE SET %1$I = cc_ligi_ozet.%1$I + EXCLUDED.%1$I, guncellenme = now()',
    v_kol
  ) USING NEW.kullanici_id, v_tarih, v_delta;

  RETURN NULL;
END;
$fonk$;

DROP TRIGGER IF EXISTS trg_cc_ozet_kazanim ON public.kazanilan_puanlar;
CREATE TRIGGER trg_cc_ozet_kazanim AFTER INSERT ON public.kazanilan_puanlar
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();

DROP TRIGGER IF EXISTS trg_cc_ozet_ileri_sarma ON public.ileri_sarma_kayitlari;
CREATE TRIGGER trg_cc_ozet_ileri_sarma AFTER INSERT ON public.ileri_sarma_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();

DROP TRIGGER IF EXISTS trg_cc_ozet_yanlis_cevap ON public.yanlis_cevap_kayitlari;
CREATE TRIGGER trg_cc_ozet_yanlis_cevap AFTER INSERT ON public.yanlis_cevap_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();

DROP TRIGGER IF EXISTS trg_cc_ozet_challenge_kayip ON public.challenge_kayip_kayitlari;
CREATE TRIGGER trg_cc_ozet_challenge_kayip AFTER INSERT ON public.challenge_kayip_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.cc_ligi_ozet_guncelle();
