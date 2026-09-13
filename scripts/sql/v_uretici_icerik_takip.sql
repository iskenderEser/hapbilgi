-- scripts/sql/v_uretici_icerik_takip.sql
--
-- Üretici ana sayfası — içerik takip zinciri (27.07.2026).
--
-- NEDEN: lib/utils/anaSayfa/uretici.ts zinciri TypeScript'te döngüyle yürüyor,
-- talep başına 7 sorgu atıyordu (1+7N). 6 talepli bir üreticide 43 ardışık
-- gidiş-geliş ≈ 2.9 sn ölçüldü (localhost, 27.07). Projenin geri kalanı hesabı
-- DB'ye yaptırır (v_yayin_detay, v_hbligi_sirali, get_kullanici_ozet...);
-- bu sayfa tek aykırıydı. View o aykırılığı kapatır: zincir tek sorguda çözülür.
--
-- KAPSAM: view yalnız HAM veri döndürür — son kayıtların id/iu_id/durum/tarih'i.
-- Aşama seçimi ve durum METNİ burada üretilmez; onlar TS tarafında (mesaj.ts
-- sözlüğü) kalır ki aynı durum her ekranda aynı yazsın.
--
-- KRİTİK: senaryo_id / video_id / soru_seti_id kolonları bilerek döndürülür.
-- Kod "kayıt yok" (→ İÜ'ye iletildi) ile "kayıt var ama durumu yok" (→ İÜ
-- hazırlıyor) durumlarını ayırır; durum ikisinde de NULL'dur, ayrımı id verir.
--
-- Her aşama "son kayıt" semantiğini korur: ORDER BY created_at DESC LIMIT 1.
--
-- YETKİ (ZORUNLU — atlanırsa sayfa boşalır): yeni view otomatik yetki almaz;
-- service_role SELECT alamazsa uygulama "permission denied for view" hatası
-- verir, SQL editöründe (postgres rolü) her şey doğru göründüğü hâlde. Yetki
-- YALNIZ service_role'e verilir — authenticated'a verilirse giriş yapan her
-- kullanıcı tüm üreticilerin zincirini okuyabilir (v_auth_kimlik_admin ile aynı kural).
--
-- KOŞUM: Supabase SQL editöründe bir kez (view + GRANT birlikte). Yeniden koşum güvenli.
-- GERİ ALIM: DROP VIEW public.v_uretici_icerik_takip;

CREATE OR REPLACE VIEW public.v_uretici_icerik_takip AS
SELECT
  t.talep_id,
  t.uretici_id,
  -- Senaryo (yalnız normal kol kullanır; hazır videoda TS tarafı bu aşamayı atlar)
  s.senaryo_id,
  s.iu_id                  AS senaryo_iu_id,
  sd.durum                 AS senaryo_durum,
  sd.created_at            AS senaryo_durum_tarih,
  -- Video veya Öğrenme Aracı (podcast, gorsel, flip_pdf)
  COALESCE(v.video_id, oa.arac_id) AS video_id,
  COALESCE(v.iu_id, oa.iu_id)      AS video_iu_id,
  COALESCE(vd.durum, oad.durum)    AS video_durum,
  COALESCE(vd.created_at, oad.created_at) AS video_durum_tarih,
  -- Soru seti: video_durum, arac_durum veya doğrudan talebe bağlı
  ss.soru_seti_id,
  ss.iu_id                 AS soru_seti_iu_id,
  ssd.durum                AS soru_seti_durum,
  ssd.created_at           AS soru_seti_durum_tarih,
  -- Yayın: soru seti veya öğrenme aracı durumuna bağlı
  y.durum                  AS yayin_durum,
  y.yayin_tarihi
FROM talepler t
LEFT JOIN LATERAL (
  SELECT senaryo_id, iu_id FROM senaryolar
  WHERE talep_id = t.talep_id ORDER BY created_at DESC LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT durum, created_at FROM senaryo_durumu
  WHERE senaryo_id = s.senaryo_id ORDER BY created_at DESC LIMIT 1
) sd ON true
LEFT JOIN LATERAL (
  SELECT video_id, iu_id FROM videolar
  WHERE talep_id = t.talep_id ORDER BY created_at DESC LIMIT 1
) v ON true
LEFT JOIN LATERAL (
  SELECT video_durum_id, durum, created_at FROM video_durumu
  WHERE video_id = v.video_id ORDER BY created_at DESC LIMIT 1
) vd ON true
LEFT JOIN LATERAL (
  SELECT arac_id, NULL::uuid AS iu_id FROM ogrenme_araclari
  WHERE talep_id = t.talep_id ORDER BY created_at DESC LIMIT 1
) oa ON true
LEFT JOIN LATERAL (
  SELECT arac_durum_id, durum, created_at FROM ogrenme_araci_durumu
  WHERE arac_id = oa.arac_id ORDER BY created_at DESC LIMIT 1
) oad ON true
LEFT JOIN LATERAL (
  SELECT soru_seti_id, iu_id FROM soru_setleri
  WHERE (vd.video_durum_id IS NOT NULL AND video_durum_id = vd.video_durum_id)
     OR (oad.arac_durum_id IS NOT NULL AND arac_durum_id = oad.arac_durum_id)
     OR talep_id = t.talep_id
  ORDER BY created_at DESC LIMIT 1
) ss ON true
LEFT JOIN LATERAL (
  SELECT soru_seti_durum_id, durum, created_at FROM soru_seti_durumu
  WHERE soru_seti_id = ss.soru_seti_id ORDER BY created_at DESC LIMIT 1
) ssd ON true
LEFT JOIN LATERAL (
  -- Tekil kayıt beklenir; bozuk veride belirsiz satır dönmesin diye sıra sabit.
  SELECT durum, yayin_tarihi FROM yayin_yonetimi
  WHERE (ssd.soru_seti_durum_id IS NOT NULL AND soru_seti_durum_id = ssd.soru_seti_durum_id)
     OR (oad.arac_durum_id IS NOT NULL AND arac_durum_id = oad.arac_durum_id)
  ORDER BY yayin_tarihi DESC NULLS LAST, yayin_id LIMIT 1
) y ON true;

-- Yetki: yalnız uygulamanın sunucu tarafı (service_role) okur.
GRANT SELECT ON public.v_uretici_icerik_takip TO service_role;
