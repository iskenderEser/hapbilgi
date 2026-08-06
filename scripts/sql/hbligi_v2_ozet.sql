-- scripts/sql/hbligi_v2_ozet.sql
--
-- E9 Faz 6.1+6.2 — HBLigi_v2 GÜNLÜK özet tablosu + trigger
-- (docs/E9_hebligi_gelistirme_is_plani.md).
--
-- Faz 2'de kova ay bazlıydı; haftalık periyot (Faz 6) için GÜNLÜK'e geçildi:
-- tüm periyotlar (hafta/ay/çeyrek/yıl/tüm-zaman) tek günlük kovadan tarih
-- aralığıyla türer. Bedeli: uzun periyotlar daha çok satır toplar (K1-A bilinçli).
--
-- MODEL:
--   * Anahtar (kullanici_id, tarih) — kişi başına günlük kova.
--   * Yalnız puan bileşenleri (4 kazanım + 3 kayıp). Hiyerarşi/sıra okumada.
--   * Yazım tek noktadan (trigger); uygulama koduna dokunulmaz. KORUMALI.
--
-- Tek transaction: view'lar (Faz 6.4'te yeniden kurulur) ve eski aylık tablo
-- düşürülür, günlük tablo + trigger fonksiyonu atomik kurulur → base tabloya
-- yazım trigger'ının tablosuz kalacağı pencere oluşmaz.
--
-- KOŞUM: tamamı bir kez. Yeniden koşumu güvenli (idempotent).

BEGIN;

-- View'lar tabloya bağlı — Faz 6.4 yeniden kuracak, şimdilik düşür.
DROP VIEW IF EXISTS public.v_hbligi_sirali_v2;
DROP VIEW IF EXISTS public.hb_ligi_v2;

-- Eski aylık tabloyu düşür (özet türetilmiş veri — kayıp yok, backfill doldurur).
DROP TABLE IF EXISTS public.hb_ligi_ozet_v2;

CREATE TABLE public.hb_ligi_ozet_v2 (
  kullanici_id       uuid        NOT NULL REFERENCES kullanicilar(kullanici_id) ON DELETE CASCADE,
  tarih              date        NOT NULL,
  izleme_puani       integer     NOT NULL DEFAULT 0,
  cevaplama_puani    integer     NOT NULL DEFAULT 0,
  oneri_puani        integer     NOT NULL DEFAULT 0,
  extra_puani        integer     NOT NULL DEFAULT 0,
  ileri_sarma_kaybi  integer     NOT NULL DEFAULT 0,
  yanlis_cevap_kaybi integer     NOT NULL DEFAULT 0,
  oneri_kaybi        integer     NOT NULL DEFAULT 0,
  guncellenme        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kullanici_id, tarih)
);

-- Periyot okuması (bir aralığın tüm kullanıcıları) için tarih indeksi.
CREATE INDEX ix_hb_ligi_ozet_v2_tarih ON public.hb_ligi_ozet_v2 (tarih);

-- Bakım tetikleyici fonksiyonu — GÜNLÜK kova (created_at::date).
-- Trigger'lar base tablolarda zaten kayıtlı (Faz 2.3); yalnız fonksiyon gövdesi
-- güncellenir. Hedef kolon TG_TABLE_NAME + puan_turu'ndan belirlenir.
-- KAPSAM: yalnız INSERT. Kaynak silme (test-sil) → backfill ile resync.
CREATE OR REPLACE FUNCTION public.hb_ligi_ozet_v2_guncelle()
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
      WHEN 'izleme'    THEN 'izleme_puani'
      WHEN 'cevaplama' THEN 'cevaplama_puani'
      WHEN 'oneri'     THEN 'oneri_puani'
      WHEN 'extra'     THEN 'extra_puani'
      ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'ileri_sarma_kayitlari' THEN
    v_delta := NEW.kaybedilen_puan; v_kol := 'ileri_sarma_kaybi';
  ELSIF TG_TABLE_NAME = 'yanlis_cevap_kayitlari' THEN
    v_delta := NEW.kaybedilen_puan; v_kol := 'yanlis_cevap_kaybi';
  ELSIF TG_TABLE_NAME = 'oneri_kayip_kayitlari' THEN
    v_delta := NEW.kaybedilen_puan; v_kol := 'oneri_kaybi';
  END IF;

  IF v_kol IS NULL OR v_delta IS NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE format(
    'INSERT INTO public.hb_ligi_ozet_v2 (kullanici_id, tarih, %1$I, guncellenme)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (kullanici_id, tarih)
     DO UPDATE SET %1$I = hb_ligi_ozet_v2.%1$I + EXCLUDED.%1$I, guncellenme = now()',
    v_kol
  ) USING NEW.kullanici_id, v_tarih, v_delta;

  RETURN NULL;
END;
$fonk$;

COMMIT;
