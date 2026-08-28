-- Öğrenme Araçları Genişletmesi — Faz 6 puan bütünlüğü
-- Supabase SQL Editor'da kullanıcı tarafından bir kez çalıştırılır.
-- Mevcut puan formüllerini değiştirmez; puan satırının izleme sahibi ve yayın
-- kimliğiyle eşleşmesini zorunlu kılar, Eczanem tekrar yazımını DB'de tekilleştirir.

BEGIN;

DO $on_kontrol$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.eczanem_puan_kayitlari
    WHERE izleme_id IS NOT NULL AND puan_turu IN ('izleme', 'cevap')
    GROUP BY izleme_id, puan_turu HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Eczanem puanlarında mükerrer izleme/cevap satırı var; Faz 6 paketi kurulmadı.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.kazanilan_puanlar p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.izleme_kayitlari i
      WHERE i.izleme_id = p.izleme_id AND i.kullanici_id = p.kullanici_id AND i.yayin_id = p.yayin_id
    )
  ) OR EXISTS (
    SELECT 1 FROM public.cc_kazanilan_puanlar p
    WHERE
      (p.puan_turu IN ('izleme', 'cevaplama', 'extra') AND NOT EXISTS (
        SELECT 1 FROM public.cc_izleme_kayitlari i
        WHERE i.izleme_id = p.izleme_id AND i.bm_id = p.bm_id AND i.yayin_id = p.yayin_id
      ))
      OR (p.puan_turu = 'cc_gonderme' AND NOT EXISTS (
        SELECT 1 FROM public.challenge_kayitlari c
        WHERE c.challenge_id = p.challenge_id AND c.gonderen_id = p.bm_id AND c.yayin_id = p.yayin_id
      ))
      OR (p.puan_turu = 'cc_referral' AND NOT EXISTS (
        SELECT 1
        FROM public.challenge_kayitlari c
        JOIN public.cc_izleme_kayitlari i
          ON i.izleme_id = p.izleme_id AND i.challenge_id = c.challenge_id
        WHERE c.challenge_id = p.challenge_id
          AND c.gonderen_id = p.bm_id
          AND c.alan_id = i.bm_id
          AND c.yayin_id = p.yayin_id
          AND i.yayin_id = p.yayin_id
      ))
  ) OR EXISTS (
    SELECT 1 FROM public.eclub_kazanilan_puanlar p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.eclub_izleme_kayitlari i
      WHERE i.izleme_id = p.izleme_id AND i.kisi_id = p.kisi_id AND i.yayin_id = p.yayin_id
    )
  ) OR EXISTS (
    SELECT 1 FROM public.eczanem_puan_kayitlari p
    WHERE p.izleme_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.eczanem_izleme_kayitlari i
      JOIN public.eczanem_gonderimler g ON g.gonderim_id = i.gonderim_id
      JOIN public.v_yayin_kunye ky ON ky.yayin_id = i.yayin_id
      WHERE i.izleme_id = p.izleme_id
        AND i.musteri_id = p.musteri_id
        AND i.yayin_id = g.yayin_id
        AND g.eczane_id = p.eczane_id
        AND ky.firma_id = p.firma_id
    )
  ) THEN
    RAISE EXCEPTION 'Puan defterinde izleme sahibi veya yayın bağı uyuşmayan satır var; Faz 6 paketi kurulmadı.';
  END IF;
END;
$on_kontrol$;

CREATE UNIQUE INDEX IF NOT EXISTS eczanem_puan_izleme_turu_uq
  ON public.eczanem_puan_kayitlari (izleme_id, puan_turu)
  WHERE izleme_id IS NOT NULL AND puan_turu IN ('izleme', 'cevap');

-- Mevcut çeyreklik HBStore formülünü korur; BM dalının yanlışlıkla UTT
-- defterlerini okumasını düzeltir.
CREATE OR REPLACE FUNCTION public.get_harcama_bakiyesi(p_kullanici_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $fonksiyon$
DECLARE
  v_rol text;
  v_kazanim integer := 0;
  v_kayip integer := 0;
  v_harcama integer := 0;
  v_iade integer := 0;
  v_ceyrek_bas timestamptz := date_trunc('quarter', clock_timestamp());
  v_ceyrek_bit timestamptz := date_trunc('quarter', clock_timestamp()) + interval '3 months';
BEGIN
  SELECT k.rol INTO v_rol
  FROM public.kullanicilar k
  WHERE k.kullanici_id = p_kullanici_id;

  IF v_rol NOT IN ('utt', 'kd_utt', 'bm') OR v_rol IS NULL THEN
    RETURN 0;
  END IF;

  IF v_rol IN ('utt', 'kd_utt') THEN
    SELECT COALESCE(SUM(p.puan), 0)::integer INTO v_kazanim
    FROM public.kazanilan_puanlar p
    WHERE p.kullanici_id = p_kullanici_id
      AND p.puan_turu IN ('izleme', 'cevaplama', 'oneri', 'extra')
      AND p.created_at >= v_ceyrek_bas AND p.created_at < v_ceyrek_bit;

    SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::integer INTO v_kayip
    FROM (
      SELECT kaybedilen_puan, created_at FROM public.ileri_sarma_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.yanlis_cevap_kayitlari WHERE kullanici_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.oneri_kayip_kayitlari WHERE kullanici_id = p_kullanici_id
    ) x
    WHERE x.created_at >= v_ceyrek_bas AND x.created_at < v_ceyrek_bit;
  ELSE
    SELECT COALESCE(SUM(p.puan), 0)::integer INTO v_kazanim
    FROM public.cc_kazanilan_puanlar p
    WHERE p.bm_id = p_kullanici_id
      AND p.puan_turu IN ('izleme', 'cevaplama', 'extra', 'cc_gonderme', 'cc_referral')
      AND p.created_at >= v_ceyrek_bas AND p.created_at < v_ceyrek_bit;

    SELECT COALESCE(SUM(x.kaybedilen_puan), 0)::integer INTO v_kayip
    FROM (
      SELECT kaybedilen_puan, created_at FROM public.cc_ileri_sarma_kayitlari WHERE bm_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.cc_yanlis_cevap_kayitlari WHERE bm_id = p_kullanici_id
      UNION ALL
      SELECT kaybedilen_puan, created_at FROM public.challenge_kayip_kayitlari WHERE kullanici_id = p_kullanici_id
    ) x
    WHERE x.created_at >= v_ceyrek_bas AND x.created_at < v_ceyrek_bit;
  END IF;

  SELECT
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'harcama'), 0)::integer,
    COALESCE(SUM(h.puan_miktari) FILTER (WHERE h.tur = 'iade'), 0)::integer
  INTO v_harcama, v_iade
  FROM public.store_puan_harcamalari h
  WHERE h.kullanici_id = p_kullanici_id
    AND h.created_at >= v_ceyrek_bas AND h.created_at < v_ceyrek_bit;

  RETURN v_kazanim - v_kayip - v_harcama + v_iade;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.ogrenme_puani_izleme_bagini_dogrula()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fonksiyon$
BEGIN
  IF TG_TABLE_NAME = 'kazanilan_puanlar' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.izleme_kayitlari i
      WHERE i.izleme_id = NEW.izleme_id AND i.kullanici_id = NEW.kullanici_id AND i.yayin_id = NEW.yayin_id
    ) THEN RAISE EXCEPTION 'UTT puanı izleme sahibi/yayın bağıyla eşleşmiyor.' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'cc_kazanilan_puanlar' THEN
    IF NEW.puan_turu IN ('izleme', 'cevaplama', 'extra') AND NOT EXISTS (
      SELECT 1 FROM public.cc_izleme_kayitlari i
      WHERE i.izleme_id = NEW.izleme_id AND i.bm_id = NEW.bm_id AND i.yayin_id = NEW.yayin_id
    ) THEN
      RAISE EXCEPTION 'BM puanı izleme sahibi/yayın bağıyla eşleşmiyor.' USING ERRCODE = '23514';
    ELSIF NEW.puan_turu = 'cc_gonderme' AND NOT EXISTS (
      SELECT 1 FROM public.challenge_kayitlari c
      WHERE c.challenge_id = NEW.challenge_id AND c.gonderen_id = NEW.bm_id AND c.yayin_id = NEW.yayin_id
    ) THEN
      RAISE EXCEPTION 'BM gönderme puanı challenge gönderen/yayın bağıyla eşleşmiyor.' USING ERRCODE = '23514';
    ELSIF NEW.puan_turu = 'cc_referral' AND NOT EXISTS (
      SELECT 1
      FROM public.challenge_kayitlari c
      JOIN public.cc_izleme_kayitlari i
        ON i.izleme_id = NEW.izleme_id AND i.challenge_id = c.challenge_id
      WHERE c.challenge_id = NEW.challenge_id
        AND c.gonderen_id = NEW.bm_id
        AND c.alan_id = i.bm_id
        AND c.yayin_id = NEW.yayin_id
        AND i.yayin_id = NEW.yayin_id
    ) THEN
      RAISE EXCEPTION 'BM referral puanı challenge gönderen/alıcı/yayın bağıyla eşleşmiyor.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'eclub_kazanilan_puanlar' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.eclub_izleme_kayitlari i
      WHERE i.izleme_id = NEW.izleme_id AND i.kisi_id = NEW.kisi_id AND i.yayin_id = NEW.yayin_id
    ) THEN RAISE EXCEPTION 'E-Club puanı izleme sahibi/yayın bağıyla eşleşmiyor.' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'eczanem_puan_kayitlari' AND NEW.izleme_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.eczanem_izleme_kayitlari i
      JOIN public.eczanem_gonderimler g ON g.gonderim_id = i.gonderim_id
      JOIN public.v_yayin_kunye ky ON ky.yayin_id = i.yayin_id
      WHERE i.izleme_id = NEW.izleme_id
        AND i.musteri_id = NEW.musteri_id
        AND g.yayin_id = i.yayin_id
        AND g.eczane_id = NEW.eczane_id
        AND ky.firma_id = NEW.firma_id
    ) THEN RAISE EXCEPTION 'Eczanem puanı izleme/gönderim sahibi bağıyla eşleşmiyor.' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS trg_ogrenme_puani_bag_utt ON public.kazanilan_puanlar;
CREATE TRIGGER trg_ogrenme_puani_bag_utt
BEFORE INSERT OR UPDATE OF kullanici_id, yayin_id, izleme_id ON public.kazanilan_puanlar
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_puani_izleme_bagini_dogrula();

DROP TRIGGER IF EXISTS trg_ogrenme_puani_bag_bm ON public.cc_kazanilan_puanlar;
CREATE TRIGGER trg_ogrenme_puani_bag_bm
BEFORE INSERT OR UPDATE OF bm_id, yayin_id, izleme_id, challenge_id, puan_turu ON public.cc_kazanilan_puanlar
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_puani_izleme_bagini_dogrula();

DROP TRIGGER IF EXISTS trg_ogrenme_puani_bag_eclub ON public.eclub_kazanilan_puanlar;
CREATE TRIGGER trg_ogrenme_puani_bag_eclub
BEFORE INSERT OR UPDATE OF kisi_id, yayin_id, izleme_id ON public.eclub_kazanilan_puanlar
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_puani_izleme_bagini_dogrula();

DROP TRIGGER IF EXISTS trg_ogrenme_puani_bag_eczanem ON public.eczanem_puan_kayitlari;
CREATE TRIGGER trg_ogrenme_puani_bag_eczanem
BEFORE INSERT OR UPDATE OF musteri_id, eczane_id, firma_id, izleme_id ON public.eczanem_puan_kayitlari
FOR EACH ROW EXECUTE FUNCTION public.ogrenme_puani_izleme_bagini_dogrula();

REVOKE ALL ON FUNCTION public.ogrenme_puani_izleme_bagini_dogrula() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ogrenme_puani_izleme_bagini_dogrula() TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.ogrenme_puani_izleme_bagini_dogrula()') IS NOT NULL AS puan_bag_kapisi_kuruldu,
  to_regclass('public.eczanem_puan_izleme_turu_uq') IS NOT NULL AS eczanem_puan_tekilligi_kuruldu,
  pg_get_functiondef('public.get_harcama_bakiyesi(uuid)'::regprocedure)
    LIKE '%public.cc_kazanilan_puanlar%' AS hbstore_bm_kaynagi_duzeltildi;
