-- scripts/sql/push_tablolar.sql
-- P0 — Web Push zemini (hapbilgi_push_teknik_is_plani.md C.2 + P0).
-- İskender elle çalıştırır (çalışma kuralı: canlı DB yazımı kullanıcıda).
-- İdempotent: tekrar koşulabilir.
--
-- K-E7 deseni: tablolar RLS'siz doğar, service_role'e GRANT'li,
-- anon/authenticated'a bilinçli kapalı; RLS genel açık işe eklidir (C.8).

-- 1) Abonelikler — bir kullanıcının bir tarayıcısındaki push aboneliği.
--    auth_user_id: üç kimlik düzleminin ortak paydası (K-P2), iş tablosuna FK YOK.
--    endpoint UNIQUE: aboneliğin doğal anahtarı; upsert bunun üzerinden (K-P5).
CREATE TABLE IF NOT EXISTS public.push_abonelikleri (
  abonelik_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  aktif_mi     boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  son_gorulme  timestamptz NOT NULL DEFAULT now()
);

-- Gönderim anında "bu kullanıcının aktif abonelikleri" sorgusu için.
CREATE INDEX IF NOT EXISTS idx_push_abonelikleri_kullanici
  ON public.push_abonelikleri (auth_user_id) WHERE aktif_mi;

-- 2) Gönderim denetim kaydı (C.2). İçerik BİLEREK tutulmaz (K-P6 — PII'siz iz);
--    alici_rol gönderim anı snapshot'ıdır (kayıt-anı simetrisi, §2.5).
--    durum: 'gonderildi' | 'basarisiz' | 'abonelik_olu' (CHECK bilinçli yok — proje idiomu).
CREATE TABLE IF NOT EXISTS public.push_gonderim_kayitlari (
  gonderim_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  olay_turu    text NOT NULL,
  alici_rol    text NOT NULL,
  durum        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_gonderim_kayitlari_kullanici
  ON public.push_gonderim_kayitlari (auth_user_id, created_at);

-- 3) Erişim — K-E7: yalnız service_role.
GRANT ALL ON public.push_abonelikleri TO service_role;
GRANT ALL ON public.push_gonderim_kayitlari TO service_role;
REVOKE ALL ON public.push_abonelikleri FROM anon, authenticated;
REVOKE ALL ON public.push_gonderim_kayitlari FROM anon, authenticated;

-- 4) sistem_ayarlari anahtarları (P0 — yeni anahtar migration işidir, §6.1).
--    push_ttl_saniye: push servisi kuyruk bekletme süresi (3 gün).
--    push_olay_aktif: olay bazlı aç/kapa (lib/push/tipler.ts PushOlayTuru anahtarları).
INSERT INTO public.sistem_ayarlari (anahtar, deger, aciklama) VALUES
  ('push_ttl_saniye', '259200'::jsonb,
   'Web push mesajının push servisinde bekletilme süresi (saniye). Varsayılan 3 gün.'),
  ('push_olay_aktif',
   '{"uretim_durum_gecisi": true, "video_onerisi": true, "eclub_oneri": true, "challenge": true, "eczanem_gonderim": true, "eczanem_siparis": true, "store_siparis": true}'::jsonb,
   'Olay bazlı web push aç/kapa. Anahtarlar lib/push/tipler.ts PushOlayTuru ile birebirdir.')
ON CONFLICT (anahtar) DO NOTHING;
