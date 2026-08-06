-- scripts/sql/challenge_kaybi_tara.sql
--
-- Challenge kaybı taraması — süresi geçmiş, izlenmemiş challenge'lara ceza yazan
-- ve alıcıya bildirim düşen fonksiyon. Cron ile koşar.
--
-- Bu dosya fonksiyonu ilk kez sürüm kontrolüne alır: tanım yalnız veritabanında
-- duruyordu (aynı durum `get_urun_from_yayin`'da Arıza 1'e yol açmıştı —
-- görünmeyen tanım bayatlar).
--
-- GÜNCELLEME (05.08.2026 — künye geçişi): Ürün kimliği satır satır
-- `get_urun_from_yayin()` çağrılarak çözülüyordu. Artık yayın künyesinden
-- (`v_yayin_kunye`) tek birleştirmeyle okunuyor — tek kaynak, satır-başına
-- fonksiyon çağrısı yok.
--
-- `urun_id` artık boş kalabilir (05.08.2026 — puan yayına aittir, ürün yayının
-- varsa taşıdığı etikettir). Ürünsüz içerikte kayıp yine yazılır; eskiden
-- kolon NOT NULL olduğu için bu satırlar hiç yazılamıyordu.
--
-- Bildirim metni, sayım ve eski bildirimi okundu işaretleme mantığı AYNEN
-- korunmuştur.
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE FUNCTION public.challenge_kaybi_tara()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  islenen_sayisi integer;
BEGIN
  -- 1. Süresi geçmiş izlenmemiş challenge'lar için kayıp yaz
  WITH eklenen AS (
    INSERT INTO challenge_kayip_kayitlari (kullanici_id, yayin_id, challenge_id, urun_id, kaybedilen_puan)
    SELECT
      ck.alan_id,
      ck.yayin_id,
      ck.challenge_id,
      ky.urun_id,
      COALESCE(vyd.video_puani, 0)
    FROM challenge_kayitlari ck
    JOIN v_yayin_detay vyd ON vyd.yayin_id = ck.yayin_id
    LEFT JOIN v_yayin_kunye ky ON ky.yayin_id = ck.yayin_id
    WHERE ck.izlendi_mi = false
      AND ck.son_tarih < now()
      AND NOT EXISTS (
        SELECT 1 FROM challenge_kayip_kayitlari ckk
        WHERE ckk.challenge_id = ck.challenge_id
      )
    RETURNING challenge_id, kullanici_id, yayin_id, kaybedilen_puan
  ),
  -- 2. Yeni eklenen kayıplar için alıcıya bildirim yaz
  yeni_bildirimler AS (
    INSERT INTO bildirimler (alici_id, gonderen_id, kayit_turu, kayit_id, mesaj, goruldu_mu)
    SELECT
      e.kullanici_id,
      NULL,
      'challenge',
      e.challenge_id,
      COALESCE(vyd.urun_adi, vyd.teknik_adi, 'Video') || ' challenge''ını süresi içinde izlemedin. ' || e.kaybedilen_puan || ' puan kaybettin.',
      false
    FROM eklenen e
    JOIN v_yayin_detay vyd ON vyd.yayin_id = e.yayin_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO islenen_sayisi FROM eklenen;

  -- 3. Eski "challenge geldi" bildirimini okundu yap (artık geçersiz)
  UPDATE bildirimler b
  SET goruldu_mu = true
  WHERE b.kayit_turu = 'challenge'
    AND b.goruldu_mu = false
    AND EXISTS (
      SELECT 1 FROM challenge_kayip_kayitlari ckk
      WHERE ckk.challenge_id = b.kayit_id
        AND ckk.kullanici_id = b.alici_id
    )
    AND b.gonderen_id IS NOT NULL;  -- yeni eklediğimiz bildirimi (gonderen_id NULL) okundu yapma

  RETURN islenen_sayisi;
END;
$function$;
