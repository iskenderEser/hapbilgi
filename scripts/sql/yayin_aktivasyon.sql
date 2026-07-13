-- scripts/sql/yayin_aktivasyon.sql
--
-- Tarih bazlı yayınlama — aktivasyon fonksiyonu + pg_cron kaydı.
-- (İş 2, 13.07.2026 — plan: docs/kalite_bulgu_raporu.md sonrası iş listesi)
--
-- Model: yayına alma ekranında gün seçilirse yayın durum='planlandi' ve
-- yayin_tarihi = seçilen gün 07:00 (Europe/Istanbul) olarak kaydedilir.
-- Tüm tüketici ekranları durum='yayinda' süzdüğünden planlı yayın tarihi
-- gelmeden yapısal olarak görünmez. Bu fonksiyon tarihi gelenleri aktive
-- eder: durum -> 'yayinda', tur-1 kaydı, hedef kullanıcılara bildirim —
-- app'in "hemen yayınla" akışında yaptıklarının birebir SQL karşılığı.
--
-- İki çağrı modu:
--   SELECT yayin_planlananlari_aktive();            -- cron: tarihi gelenler
--   SELECT yayin_planlananlari_aktive('<yayin_id>');-- hemen yayınla: tarih beklenmez
--
-- Cron: her gün 04:00 ve 04:10 GMT (= 07:00 / 07:10 TR; TR sabit UTC+3).
-- İkinci koşum güvenlik payıdır; fonksiyon mükerrer-korumalıdır (durum
-- süzgeci + tur-1 ON CONFLICT). Mevcut jobların (oneri_kaybi_tarama,
-- challenge_kaybi_tarama) deseniyle aynıdır.
--
-- KOŞUM: Supabase SQL editöründe bu dosyanın tamamı bir kez çalıştırılır.
-- Yeniden çalıştırmak güvenlidir (CREATE OR REPLACE + unschedule/schedule).

CREATE OR REPLACE FUNCTION public.yayin_planlananlari_aktive(p_yayin_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  aktive_sayisi integer := 0;
  y RECORD;
  v_tarih timestamptz;
  v_takim_id uuid;
  v_urun_adi text;
BEGIN
  FOR y IN
    SELECT yayin_id, uretici_id, hedef_roller, yayin_tarihi
    FROM yayin_yonetimi
    WHERE durum = 'planlandi'
      AND (
        (p_yayin_id IS NULL AND yayin_tarihi <= now())  -- cron modu: tarihi gelenler
        OR yayin_id = p_yayin_id                         -- hemen modu: tarih beklenmez
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Hemen modunda ileri tarih şimdiye çekilir; cron modunda tarih zaten geçmiştir.
    v_tarih := LEAST(y.yayin_tarihi, now());

    UPDATE yayin_yonetimi
    SET durum = 'yayinda', yayin_tarihi = v_tarih
    WHERE yayin_id = y.yayin_id;

    -- Tur-1 — app'teki turKaydiAc(tur_no=1, 'ilk_yayin') karşılığı.
    -- UNIQUE(yayin_id, tur_no) mükerrer açılışı yapısal olarak engeller.
    INSERT INTO yayin_tekrar_kayitlari (yayin_id, tur_no, acilis_turu, baslangic_tarihi)
    VALUES (y.yayin_id, 1, 'ilk_yayin', v_tarih)
    ON CONFLICT (yayin_id, tur_no) DO NOTHING;

    -- Bildirimler — app'teki yayına alma bildiriminin karşılığı:
    -- yayının takımındaki bölgelerde, hedef rollerdeki aktif kullanıcılar.
    SELECT v.takim_id, COALESCE(v.urun_adi, '-')
    INTO v_takim_id, v_urun_adi
    FROM v_yayin_detay v
    WHERE v.yayin_id = y.yayin_id;

    IF v_takim_id IS NOT NULL THEN
      INSERT INTO bildirimler (alici_id, gonderen_id, kayit_turu, kayit_id, mesaj, goruldu_mu)
      SELECT k.kullanici_id, y.uretici_id, 'yayin', y.yayin_id,
             'Yeni video yayında: ' || v_urun_adi, false
      FROM kullanicilar k
      JOIN bolgeler b ON b.bolge_id = k.bolge_id
      WHERE b.takim_id = v_takim_id
        AND k.rol = ANY(COALESCE(y.hedef_roller, ARRAY['utt']))
        AND k.aktif_mi = true;
    END IF;

    aktive_sayisi := aktive_sayisi + 1;
  END LOOP;

  RETURN aktive_sayisi;
END;
$fonk$;

-- Uygulama (service_role) "hemen yayınla" için çağırabilsin.
GRANT EXECUTE ON FUNCTION public.yayin_planlananlari_aktive(uuid) TO service_role;

-- Cron kaydı — yeniden koşumda çift kayıt oluşmasın diye önce kaldırılır.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'yayin_aktivasyon') THEN
    PERFORM cron.unschedule('yayin_aktivasyon');
  END IF;
END $$;

SELECT cron.schedule(
  'yayin_aktivasyon',
  '0,10 4 * * *',  -- 07:00 + 07:10 TR (GMT+3; cron.timezone = GMT)
  $$SELECT public.yayin_planlananlari_aktive();$$
);

-- Doğrulama (isteğe bağlı): kayıt oluştu mu?
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'yayin_aktivasyon';
