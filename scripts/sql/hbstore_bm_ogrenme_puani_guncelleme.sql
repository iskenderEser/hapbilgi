-- ============================================================================
-- HBStore: BM Öğrenme Puanı Hesabının Ortak RPC'ye Bağlanması (Dar Güncelleme)
-- Dosya: scripts/sql/hbstore_bm_ogrenme_puani_guncelleme.sql
--
-- KAPSAM:
--   * Yalnız public.get_harcama_bakiyesi_tarihli(uuid, timestamptz) fonksiyonunu
--     CREATE OR REPLACE ile günceller.
--   * BM öğrenme puanını public.get_bm_puan_ozet ortak fonksiyonundan çeker.
--   * UTT hesabını, dönem/çeyrek seçimini, harcama ve iade eşleştirmesini,
--     negatif bakiye davranışını ve mevcut izinleri eksiksiz korur.
--   * Sipariş tablosuna, takvim kilitlerine ve sipariş oluşturma fonksiyonlarına
--     dokunmaz; sıfır sipariş şartı içermez.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_harcama_bakiyesi_tarihli(
  p_kullanici_id uuid,
  p_zaman timestamptz DEFAULT clock_timestamp()
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_rol text;
  v_kazanim integer := 0;
  v_kayip integer := 0;
  v_harcama integer := 0;
  v_iade integer := 0;

  v_yerel timestamp;
  v_yil integer;
  v_ay integer;
  v_gun integer;
  v_magaza_acik boolean;

  v_kazanim_bas timestamptz;
  v_kazanim_bit timestamptz;
BEGIN
  SELECT k.rol INTO v_rol
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_kullanici_id;

  IF v_rol NOT IN ('utt', 'kd_utt', 'bm') OR v_rol IS NULL THEN
    RETURN 0;
  END IF;

  -- Anlık Türkiye saati bileşenleri
  v_yerel := p_zaman AT TIME ZONE 'Europe/Istanbul';
  v_yil := EXTRACT(YEAR FROM v_yerel)::integer;
  v_ay := EXTRACT(MONTH FROM v_yerel)::integer;
  v_gun := EXTRACT(DAY FROM v_yerel)::integer;

  -- Mağaza sipariş günlerinde mi? (1–7 Nisan, 1–7 Temmuz, 1–7 Ekim, 1–7 Ocak)
  v_magaza_acik := (
    (v_ay = 4 AND v_gun >= 1 AND v_gun <= 7) OR
    (v_ay = 7 AND v_gun >= 1 AND v_gun <= 7) OR
    (v_ay = 10 AND v_gun >= 1 AND v_gun <= 7) OR
    (v_ay = 1 AND v_gun >= 1 AND v_gun <= 7)
  );

  IF v_magaza_acik THEN
    -- ─── MAĞAZA AÇIKKEN (SİPARİŞ HAFTASI) ───────────────────────────────────
    -- Hemen önce tamamlanan çeyreğin kazanımları ve o kaynak çeyreğe ait harcamalar
    IF v_ay = 4 THEN
      -- Q1 (Ocak–Mart) kazanımları -> 1–7 Nisan siparişi
      v_kazanim_bas := make_timestamptz(v_yil, 1, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay = 7 THEN
      -- Q2 (Nisan–Haziran) kazanımları -> 1–7 Temmuz siparişi
      v_kazanim_bas := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay = 10 THEN
      -- Q3 (Temmuz–Eylül) kazanımları -> 1–7 Ekim siparişi
      v_kazanim_bas := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 10, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSE -- v_ay = 1
      -- Q4 (Ekim–Aralık [yil-1]) kazanımları -> 1–7 Ocak [yil] siparişi
      v_kazanim_bas := make_timestamptz(v_yil - 1, 10, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 1, 1, 0, 0, 0, 'Europe/Istanbul');
    END IF;
  ELSE
    -- ─── MAĞAZA KAPALIYKEN (BİRİKİM DÖNEMİ) ─────────────────────────────────
    -- Kullanıcının bir sonraki sipariş dönemi için o an biriktirmekte olduğu çeyrek
    -- Kullanılmayan eski puanlar devretmez (kural: sonraki döneme taşınmaz)
    IF v_ay IN (1, 2, 3) THEN
      -- 8 Ocak - 31 Mart: 1–7 Nisan siparişi için Q1 (Ocak–Mart) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 1, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay IN (4, 5, 6) THEN
      -- 8 Nisan - 30 Haziran: 1–7 Temmuz siparişi için Q2 (Nisan–Haziran) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 4, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSIF v_ay IN (7, 8, 9) THEN
      -- 8 Temmuz - 30 Eylül: 1–7 Ekim siparişi için Q3 (Temmuz–Eylül) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 7, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil, 10, 1, 0, 0, 0, 'Europe/Istanbul');
    ELSE -- v_ay IN (10, 11, 12)
      -- 8 Ekim - 31 Aralık: 1–7 Ocak [yil+1] siparişi için Q4 (Ekim–Aralık) puanı birikir
      v_kazanim_bas := make_timestamptz(v_yil, 10, 1, 0, 0, 0, 'Europe/Istanbul');
      v_kazanim_bit := make_timestamptz(v_yil + 1, 1, 1, 0, 0, 0, 'Europe/Istanbul');
    END IF;
  END IF;

  -- 1. Kazanımlar ve kayıplar (yalnızca kaynak çeyrek aralığında)
  IF v_rol IN ('utt', 'kd_utt') THEN
    SELECT COALESCE(SUM(p.puan), 0)::integer INTO v_kazanim
    FROM public.kazanilan_puanlar p
    WHERE p.kullanici_id = p_kullanici_id
      AND p.puan_turu IN ('izleme', 'cevaplama', 'oneri', 'extra')
      AND p.created_at >= v_kazanim_bas AND p.created_at < v_kazanim_bit;

    SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::integer INTO v_kayip
    FROM (
      SELECT kaybedilen_puan, created_at FROM public.ileri_sarma_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.yanlis_cevap_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.oneri_kayip_kayitlari WHERE kullanici_id = p_kullanici_id
    ) x
    WHERE x.created_at >= v_kazanim_bas AND x.created_at < v_kazanim_bit;

    -- UTT/KD_UTT'nin E-Club kazanımı aynı çeyrekte harcanabilir bakiyeye dahildir.
    SELECT v_kazanim + COALESCE(SUM(ep.puan), 0)::integer INTO v_kazanim
    FROM public.eclub_utt_puanlari ep
    WHERE ep.utt_id = p_kullanici_id
      AND ep.created_at >= v_kazanim_bas AND ep.created_at < v_kazanim_bit;
  ELSE
    -- BM: Ortak öğrenme puanı fonksiyonunu (get_bm_puan_ozet) çağır
    SELECT COALESCE(b.toplam_kazanc, 0)::integer, COALESCE(b.toplam_kayip, 0)::integer
    INTO v_kazanim, v_kayip
    FROM public.get_bm_puan_ozet(
      p_kullanici_id,
      v_kazanim_bas,
      v_kazanim_bit - interval '1 microsecond'
    ) b;
  END IF;

  -- 2. Harcama ve İade:
  -- Her sipariş ve harcama s.kaynak_ceyrek_baslangici üzerinden ilgili kaynak
  -- çeyreğe (v_kazanim_bas) kesin olarak bağlanır.
  SELECT
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'harcama'), 0)::integer,
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'iade'), 0)::integer
  INTO v_harcama, v_iade
  FROM public.store_puan_harcamalari h
  JOIN public.store_siparisler s ON s.siparis_id = h.siparis_id
  WHERE h.kullanici_id = p_kullanici_id
    AND s.kaynak_ceyrek_baslangici = v_kazanim_bas;

  -- Mevcut negatif bakiye davranışı korunur
  RETURN v_kazanim - v_kayip - v_harcama + v_iade;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_harcama_bakiyesi_tarihli(uuid, timestamptz)
  TO authenticated, service_role;

-- 2b. Standart parametresiz sarmalayıcı fonksiyon (mevcut sözleşmeyi korur)
CREATE OR REPLACE FUNCTION public.get_harcama_bakiyesi(p_kullanici_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.get_harcama_bakiyesi_tarihli(p_kullanici_id, clock_timestamp());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_harcama_bakiyesi(uuid)
  TO authenticated, service_role;

COMMIT;
