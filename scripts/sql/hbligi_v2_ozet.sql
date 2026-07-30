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
