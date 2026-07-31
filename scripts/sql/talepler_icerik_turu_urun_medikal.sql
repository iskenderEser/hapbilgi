-- scripts/sql/talepler_icerik_turu_urun_medikal.sql
--
-- "Ürün Medikal" 5. içerik türü — DB tarafı (31.07.2026).
-- talepler.icerik_turu CHECK'i 4 türle sınırlıydı (ik/medikal/egitim/urun);
-- 'urun_medikal' eklendi. Ardından mevcut urun_medikal_egitim talepleri
-- (icerik_turu='medikal' olarak çökmüştü) doğru türe taşındı.
--
-- Kök neden: icerik_turu rolün tek icerikTuru'sundan yazılıyordu; artık talep
-- türünden yazılıyor (lib/uretici/yetenekler.ts TALEP_TURU_KURALLARI.icerikTuru +
-- app/talepler/api/route.ts). v_yayin_detay.icerik_turu doğrudan talepler'den
-- geldiğinden migration otomatik yansır.
--
-- KOŞUM: bir kez, tek transaction (kısıtsız pencere olmaz). Yeniden koşumda
-- UPDATE zaten taşınmış satır bırakmaz; CONSTRAINT drop/add tekrar güvenlidir.

BEGIN;

ALTER TABLE talepler DROP CONSTRAINT talepler_icerik_turu_check;
ALTER TABLE talepler ADD CONSTRAINT talepler_icerik_turu_check
  CHECK (icerik_turu = ANY (ARRAY['ik'::text, 'medikal'::text, 'egitim'::text, 'urun'::text, 'urun_medikal'::text]));

UPDATE talepler SET icerik_turu = 'urun_medikal'
WHERE egitim_turu = 'urun_medikal_egitim' AND icerik_turu = 'medikal';

COMMIT;
