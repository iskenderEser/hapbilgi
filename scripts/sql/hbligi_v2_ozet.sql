-- scripts/sql/hbligi_v2_ozet.sql
--
-- E9 Faz 2.1 — HBLigi_v2 özet tablosu (docs/E9_hebligi_gelistirme_is_plani.md).
-- Ölçek geliştirmesi: her okumada 4 tablodan sıfırdan SUM yapan ilkel yöntem
-- yerine, kişi × ay bazında önceden hesaplanmış toplamı tutar.
--
-- MODEL:
--   * Anahtar (kullanici_id, yil, ay) — kişi başına aylık kova.
--     Çeyrek = 3 ay toplamı, yıl = 12 ay, tüm-zaman = tüm aylar.
--   * Yalnız puan bileşenleri (4 kazanım + 3 kayıp) tutulur.
--     Hiyerarşi (firma/takım/bölge) ve sıra SAKLANMAZ — okuma anında
--     kullanicilar'dan JOIN + row_number ile üretilir (v1 semantiği:
--     hiyerarşi güncel, kullanıcı takım değiştirirse geçmiş donmaz).
--   * toplam_puan saklanmaz, okumada türetilir (drift önlenir).
--
-- Bu tablo Faz 2.5'te KORUMALI_TABLOLAR'a eklenecek; yazımı yalnız Faz 2.3
-- trigger'ından gelir (uygulama koduna dokunulmaz).
--
-- KOŞUM: bir kez çalıştırılır. IF NOT EXISTS → tekrar koşumu güvenli.
-- Tablo boş doğar; okuma katmanı henüz v2 canlı-SUM'da (Faz 2.4'e kadar),
-- dolayısıyla bu adım v2 çıktısını değiştirmez.

CREATE TABLE IF NOT EXISTS public.hb_ligi_ozet_v2 (
  kullanici_id       uuid        NOT NULL REFERENCES kullanicilar(kullanici_id) ON DELETE CASCADE,
  yil                smallint    NOT NULL,
  ay                 smallint    NOT NULL CHECK (ay BETWEEN 1 AND 12),
  izleme_puani       integer     NOT NULL DEFAULT 0,
  cevaplama_puani    integer     NOT NULL DEFAULT 0,
  oneri_puani        integer     NOT NULL DEFAULT 0,
  extra_puani        integer     NOT NULL DEFAULT 0,
  ileri_sarma_kaybi  integer     NOT NULL DEFAULT 0,
  yanlis_cevap_kaybi integer     NOT NULL DEFAULT 0,
  oneri_kaybi        integer     NOT NULL DEFAULT 0,
  guncellenme        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kullanici_id, yil, ay)
);

-- Periyot okuması (bir ayın tüm kullanıcıları) için (yil, ay) indeksi.
-- Kişi bazlı ve tüm-zaman okumaları zaten PK ön ekinden yararlanır.
CREATE INDEX IF NOT EXISTS ix_hb_ligi_ozet_v2_donem
  ON public.hb_ligi_ozet_v2 (yil, ay);


-- ============================================================================
-- Faz 2.3 — Bakım tetikleyicisi
-- ============================================================================
-- 4 besleyen tabloya AFTER INSERT → ilgili (kullanıcı, yıl, ay) kovasına
-- deltayı ekler. Kova, created_at'in yıl/ay'ına göre seçilir (periyot RPC'leri
-- de make_timestamptz ile aynı oturum saat dilimini kullanır → tutarlı; Faz 2.6
-- birebir doğrular). Tek generic fonksiyon; hedef kolon TG_TABLE_NAME +
-- puan_turu'ndan belirlenir.
--
-- KAPSAM: yalnız INSERT. Kaynak satır SİLİNİRSE (yalnız test-sil araçları
-- siler; normal akış append-only) kova senkronu bozulur → backfill (Faz 2.2)
-- yeniden koşularak düzeltilir.
--
-- Yazım tek noktadan (bu trigger); uygulama koduna dokunulmaz. Tablo Faz 2.5'te
-- KORUMALI_TABLOLAR'a eklenir (eslint TS yazımını engeller; trigger DB'dedir).

CREATE OR REPLACE FUNCTION public.hb_ligi_ozet_v2_guncelle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_yil   smallint := EXTRACT(year  FROM NEW.created_at)::smallint;
  v_ay    smallint := EXTRACT(month FROM NEW.created_at)::smallint;
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
    RETURN NULL;  -- tanınmayan tür/tablo, ya da null değer — dokunma
  END IF;

  EXECUTE format(
    'INSERT INTO public.hb_ligi_ozet_v2 (kullanici_id, yil, ay, %1$I, guncellenme)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (kullanici_id, yil, ay)
     DO UPDATE SET %1$I = hb_ligi_ozet_v2.%1$I + EXCLUDED.%1$I, guncellenme = now()',
    v_kol
  ) USING NEW.kullanici_id, v_yil, v_ay, v_delta;

  RETURN NULL;  -- AFTER trigger; dönüş yok sayılır
END;
$fonk$;

DROP TRIGGER IF EXISTS trg_ozet_v2_kazanim ON public.kazanilan_puanlar;
CREATE TRIGGER trg_ozet_v2_kazanim AFTER INSERT ON public.kazanilan_puanlar
  FOR EACH ROW EXECUTE FUNCTION public.hb_ligi_ozet_v2_guncelle();

DROP TRIGGER IF EXISTS trg_ozet_v2_ileri_sarma ON public.ileri_sarma_kayitlari;
CREATE TRIGGER trg_ozet_v2_ileri_sarma AFTER INSERT ON public.ileri_sarma_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.hb_ligi_ozet_v2_guncelle();

DROP TRIGGER IF EXISTS trg_ozet_v2_yanlis_cevap ON public.yanlis_cevap_kayitlari;
CREATE TRIGGER trg_ozet_v2_yanlis_cevap AFTER INSERT ON public.yanlis_cevap_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.hb_ligi_ozet_v2_guncelle();

DROP TRIGGER IF EXISTS trg_ozet_v2_oneri_kayip ON public.oneri_kayip_kayitlari;
CREATE TRIGGER trg_ozet_v2_oneri_kayip AFTER INSERT ON public.oneri_kayip_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.hb_ligi_ozet_v2_guncelle();
