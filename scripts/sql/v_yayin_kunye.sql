-- scripts/sql/v_yayin_kunye.sql
--
-- YAYIN KÜNYESİ — yayının niteliklerinin TEK KAYNAĞI (05.08.2026).
--
-- GEREKÇE: "Puan yayına aittir" kararının doğal sonucu. Puan defteri yalnız
-- kendi olgusunu taşımalı (kim, hangi yayın, hangi tür puan, kaç puan, ne zaman).
-- Ürün, teknik, içerik türü, eğitim türü, firma, takım — bunların hiçbiri puanın
-- niteliği değil, YAYININ niteliğidir. Bu görünüm o nitelikleri tek yerde toplar.
--
-- ÇÖZDÜĞÜ İKİ SORUN:
--   1. Aynı bilgi iki yerdeydi: puan defterinde kopya (`urun_id`), zincirin
--      ucunda asıl. Kopyanın gerekçesi (sekiz tablolu zincir, REDBOOK §2.5
--      İlke 2) 22.07'de zincir kısalınca geçerliliğini yitirdi.
--   2. Yayından talebe giden bağ birden çok fonksiyonda ayrı ayrı yazılıydı;
--      biri güncellenip diğeri unutulduğunda sessiz sapma doğuyordu — nitekim
--      `get_urun_from_yayin` bu yüzden aylarca yanlış çalıştı (Arıza 1).
--
-- NEDEN GÜVENLİ: Talep gönderildikten sonra ürün değişmez (İskender, 05.08.2026).
-- Dolayısıyla türetme, kopyanın dondurduğu tarihçeyi bozmaz.
--
-- v_yayin_detay'dan FARKI: O görünüm tüketim ekranları içindir; senaryo metni,
-- soru seti, video adresi, puan ortalaması taşır ve GROUP BY + avg ile ağırdır.
-- Bu görünüm yalnız ANAHTARLARI taşır: küçük, birleştirmeye uygun boyut tablosu.
--
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE VIEW public.v_yayin_kunye AS
SELECT
  ym.yayin_id,
  t.talep_id,
  t.talep_no,
  t.urun_id,
  t.teknik_id,
  t.icerik_turu,
  t.egitim_turu,
  t.hedef_rol,
  t.firma_id,
  t.takim_id,
  t.uretici_id,
  ym.hedef_roller
FROM yayin_yonetimi ym
JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
JOIN soru_setleri ss      ON ss.soru_seti_id        = ssd.soru_seti_id
JOIN talepler t           ON t.talep_id             = ss.talep_id;

GRANT SELECT ON public.v_yayin_kunye TO service_role;
