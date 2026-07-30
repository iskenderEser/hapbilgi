-- scripts/sql/oneri_kaybi_tara.sql
--
-- Öneri kaybı taraması — süresi geçmiş, izlenmemiş önerilere ceza yazan fonksiyon.
-- (E9 öncesi v1 düzeltmesi, 31.07.2026 — açık işler md.9 keşfinde tespit edildi.)
--
-- KÖK SEBEP: cron job (jobid 2, 'oneri_kaybi_tarama', her gece 03:00) 'SELECT
-- oneri_kaybi_tara();' çağırıyordu ama fonksiyon DB'de yoktu ve repo'da hiç
-- tanımlanmamıştı → ceza hiç yazılmadı, oneri_kayip_kayitlari boş kaldı.
-- Bu dosya fonksiyonu versiyon kontrolüne alır ki bir daha düşmesin.
--
-- KURAL (REDBOOK §410): "Öneri döngüsü tüketimle kapanır: UTT öneriyi penceresi
-- içinde izlerse öneri puanı kazanır; süresi geçer de izlemezse
-- oneri_kayip_kayitlari'na kayıp düşer." Ceza miktarı tek kaynaktan okunur
-- (sistem_ayarlari.oneri_puani — kazanç kadar kayıp, simetrik; REDBOOK §276).
--
-- İdempotent: oneri_id UNIQUE + ON CONFLICT DO NOTHING → tekrar koşumu güvenli.
-- Desen yayin_aktivasyon.sql ile aynı (SECURITY DEFINER, search_path, SKIP LOCKED).
--
-- KOŞUM: Supabase SQL editöründe bu dosyanın tamamı bir kez çalıştırılır.
-- Yeniden çalıştırmak güvenlidir (CREATE OR REPLACE). Cron kaydı zaten mevcut
-- olduğundan (jobid 2, doğru fonksiyonu çağırıyor) yeniden schedule edilmez.

CREATE OR REPLACE FUNCTION public.oneri_kaybi_tara()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_ceza integer;
  v_sayi integer := 0;
  o RECORD;
  v_urun_id uuid;
BEGIN
  -- Ceza puanı — tek kaynak: sistem_ayarlari.oneri_puani (kazanç kadar kayıp, simetrik)
  SELECT replace(deger::text, '"', '')::int INTO v_ceza
  FROM sistem_ayarlari WHERE anahtar = 'oneri_puani';

  IF v_ceza IS NULL OR v_ceza <= 0 THEN
    RETURN 0;  -- ayar okunamazsa hiçbir şey yazma
  END IF;

  FOR o IN
    SELECT ok.oneri_id, ok.kullanici_id, ok.yayin_id
    FROM oneri_kayitlari ok
    WHERE ok.oneri_bitis < now()
      AND ok.izlendi_mi = false
      AND NOT EXISTS (SELECT 1 FROM oneri_kayip_kayitlari kk WHERE kk.oneri_id = ok.oneri_id)
      AND NOT EXISTS (SELECT 1 FROM kazanilan_puanlar kp
                      WHERE kp.yayin_id = ok.yayin_id AND kp.kullanici_id = ok.kullanici_id
                        AND kp.puan_turu = 'oneri')
    FOR UPDATE SKIP LOCKED
  LOOP
    v_urun_id := public.get_urun_from_yayin(o.yayin_id);
    IF v_urun_id IS NULL THEN
      CONTINUE;  -- ürünü çözülemeyen öneriyi atla, bozuk kayıt yazma
    END IF;

    INSERT INTO oneri_kayip_kayitlari
      (kullanici_id, yayin_id, oneri_id, urun_id, kaybedilen_puan)
    VALUES
      (o.kullanici_id, o.yayin_id, o.oneri_id, v_urun_id, v_ceza)
    ON CONFLICT (oneri_id) DO NOTHING;

    v_sayi := v_sayi + 1;
  END LOOP;

  RETURN v_sayi;
END;
$fonk$;

GRANT EXECUTE ON FUNCTION public.oneri_kaybi_tara() TO service_role;

-- Doğrulama (isteğe bağlı):
--   SELECT oneri_kaybi_tara();                        -- kaç ceza yazıldı
--   SELECT count(*) FROM oneri_kayip_kayitlari;       -- toplam kayıp kaydı
--   -- td07-kazanim-kayip-simetrisi.sql boş dönmeli (simetri temiz).
