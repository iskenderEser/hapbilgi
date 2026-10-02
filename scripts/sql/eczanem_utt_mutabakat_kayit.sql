-- Yeni Eczanem UTT mutabakatının işlem snapshot'ı.
-- Yalnız İskender tarafından Supabase SQL Editor'de çalıştırılır.
-- Eski döküm/mutabakat nesnelerini geri getirmez; mevcut onaylı kayıtlar
-- temizlendiğinden geriye dönük veri üretmez. Yalnız gelecek onayları yakalar.

BEGIN;

DO $on_kontrol$
BEGIN
  IF EXISTS (SELECT 1 FROM public.eczanem_siparisler WHERE durum = 'onaylandi') THEN
    RAISE EXCEPTION 'Kurulum öncesi onaylı indirim bulundu; snapshot olmadan geçmiş veri bırakılamaz.';
  END IF;
END;
$on_kontrol$;

CREATE TABLE IF NOT EXISTS public.eczanem_indirim_onaylari (
  eczanem_indirim_onay_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kaynak_siparis_id uuid NOT NULL UNIQUE,
  eczane_id uuid NOT NULL,
  eczane_adi text,
  firma_id uuid NOT NULL,
  takim_id uuid,
  urun_id uuid NOT NULL,
  urun_adi text NOT NULL,
  onay_tarihi timestamptz NOT NULL,
  kullanilan_puan integer NOT NULL CHECK (kullanilan_puan > 0),
  indirim_tl numeric NOT NULL CHECK (indirim_tl >= 0),
  tarife_puan integer NOT NULL CHECK (tarife_puan > 0),
  tarife_tl numeric NOT NULL CHECK (tarife_tl >= 0),
  satis_fiyati numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eczanem_indirim_onay_kaynaklari (
  kaynak_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eczanem_indirim_onay_id uuid NOT NULL REFERENCES public.eczanem_indirim_onaylari(eczanem_indirim_onay_id) ON DELETE RESTRICT,
  yayin_id uuid NOT NULL,
  arac_id uuid NOT NULL,
  arac_turu text NOT NULL CHECK (arac_turu IN ('video', 'podcast', 'gorsel', 'flip_pdf')),
  teknik_adi text,
  pm_ogrenme_puani integer,
  kullanilan_puan integer NOT NULL CHECK (kullanilan_puan > 0),
  UNIQUE (eczanem_indirim_onay_id, yayin_id, arac_id)
);

CREATE TABLE IF NOT EXISTS public.eczanem_utt_mutabakatlar (
  mutabakat_id uuid PRIMARY KEY REFERENCES public.eczanem_indirim_onaylari(eczanem_indirim_onay_id) ON DELETE RESTRICT,
  utt_karar text CHECK (utt_karar IN ('onay', 'beklet', 'ret')),
  utt_karar_veren_id uuid,
  utt_karar_tarihi timestamptz,
  karar_surumu integer NOT NULL DEFAULT 0 CHECK (karar_surumu >= 0),
  CHECK ((utt_karar IS NULL AND utt_karar_veren_id IS NULL AND utt_karar_tarihi IS NULL)
      OR (utt_karar IS NOT NULL AND utt_karar_veren_id IS NOT NULL AND utt_karar_tarihi IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.eczanem_utt_mutabakat_kararlari (
  karar_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mutabakat_id uuid NOT NULL REFERENCES public.eczanem_utt_mutabakatlar(mutabakat_id) ON DELETE RESTRICT,
  surum integer NOT NULL CHECK (surum > 0),
  karar text NOT NULL CHECK (karar IN ('onay', 'beklet', 'ret')),
  karar_veren_id uuid NOT NULL,
  karar_tarihi timestamptz NOT NULL,
  UNIQUE (mutabakat_id, surum)
);

CREATE INDEX IF NOT EXISTS idx_eczanem_indirim_onaylari_donem
  ON public.eczanem_indirim_onaylari (onay_tarihi DESC, eczanem_indirim_onay_id);
CREATE INDEX IF NOT EXISTS idx_eczanem_indirim_onaylari_kapsam
  ON public.eczanem_indirim_onaylari (firma_id, eczane_id, onay_tarihi DESC);
CREATE INDEX IF NOT EXISTS idx_eczanem_indirim_onay_kaynaklari_onay
  ON public.eczanem_indirim_onay_kaynaklari (eczanem_indirim_onay_id);
CREATE INDEX IF NOT EXISTS idx_eczanem_utt_mutabakat_kararlari_islem
  ON public.eczanem_utt_mutabakat_kararlari (mutabakat_id, surum DESC);

ALTER TABLE public.eczanem_indirim_onaylari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eczanem_indirim_onay_kaynaklari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eczanem_utt_mutabakatlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eczanem_utt_mutabakat_kararlari ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.eczanem_indirim_onaylari,
  public.eczanem_indirim_onay_kaynaklari,
  public.eczanem_utt_mutabakatlar,
  public.eczanem_utt_mutabakat_kararlari
FROM PUBLIC, anon, authenticated, service_role;

-- İstemciler tablolara doğrudan erişemez. Sunucu yalnız UTT RPC'lerini çağırır.
-- Snapshot üretimi SECURITY DEFINER trigger ile aynı onay transaction'ında olur.

CREATE OR REPLACE FUNCTION public.eczanem_utt_mutabakat_onay_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_firma_id uuid;
  v_takim_id uuid;
  v_urun_adi text;
  v_eczane_adi text;
  v_onay_id uuid;
  v_harcama_sayisi integer;
  v_harcama_puani bigint;
  v_hata_sayisi integer;
BEGIN
  IF NEW.durum <> 'onaylandi' OR OLD.durum IS NOT DISTINCT FROM NEW.durum THEN
    RETURN NEW;
  END IF;
  IF NEW.onay_tarihi IS NULL OR NEW.musteri_id IS NULL
     OR NEW.kullanilan_puan <= 0 OR NEW.tarife_snapshot IS NULL
     OR jsonb_typeof(NEW.tarife_snapshot->'puan') <> 'number'
     OR jsonb_typeof(NEW.tarife_snapshot->'tl') <> 'number' THEN
    RAISE EXCEPTION 'Eczanem indirim onayı mutabakat snapshot koşullarını sağlamıyor.';
  END IF;

  SELECT u.firma_id, u.takim_id, u.urun_adi
  INTO v_firma_id, v_takim_id, v_urun_adi
  FROM public.urunler u WHERE u.urun_id = NEW.urun_id;
  IF v_firma_id IS NULL OR NULLIF(BTRIM(v_urun_adi), '') IS NULL THEN
    RAISE EXCEPTION 'İndirim onayının ürün/firma kimliği bulunamadı.';
  END IF;

  SELECT em.eczane_adi INTO v_eczane_adi
  FROM public.eclub_eczaneler e
  LEFT JOIN public.eclub_eczane_master em ON em.gln = e.gln
  WHERE e.eczane_id = NEW.eczane_id;

  SELECT COUNT(*)::integer, COALESCE(SUM(h.dusulen_puan), 0),
    COUNT(*) FILTER (WHERE h.kaynak_kayit_id IS NULL OR h.dusulen_puan <= 0
      OR p.kayit_id IS NULL OR p.izleme_id IS NULL
      OR p.musteri_id IS DISTINCT FROM NEW.musteri_id
      OR p.eczane_id IS DISTINCT FROM NEW.eczane_id
      OR p.urun_id IS DISTINCT FROM NEW.urun_id
      OR p.firma_id IS DISTINCT FROM v_firma_id
      OR i.izleme_id IS NULL OR i.musteri_id IS DISTINCT FROM NEW.musteri_id
      OR g.gonderim_id IS NULL OR g.eczane_id IS DISTINCT FROM NEW.eczane_id
      OR g.musteri_id IS DISTINCT FROM NEW.musteri_id
      OR g.yayin_id IS DISTINCT FROM i.yayin_id
      OR ky.yayin_id IS NULL OR ky.urun_id IS DISTINCT FROM NEW.urun_id
      OR vyd.yayin_id IS NULL OR vyd.firma_id IS DISTINCT FROM v_firma_id
      OR vyd.arac_id IS NULL
      OR vyd.arac_turu IS NULL
      OR vyd.arac_turu NOT IN ('video', 'podcast', 'gorsel', 'flip_pdf'))::integer
  INTO v_harcama_sayisi, v_harcama_puani, v_hata_sayisi
  FROM public.eczanem_harcama_kayitlari h
  LEFT JOIN public.eczanem_puan_kayitlari p ON p.kayit_id = h.kaynak_kayit_id
  LEFT JOIN public.eczanem_izleme_kayitlari i ON i.izleme_id = p.izleme_id
  LEFT JOIN public.eczanem_gonderimler g ON g.gonderim_id = i.gonderim_id
  LEFT JOIN public.v_yayin_kunye ky ON ky.yayin_id = i.yayin_id
  LEFT JOIN public.v_yayin_detay vyd ON vyd.yayin_id = i.yayin_id
  WHERE h.siparis_id = NEW.siparis_id;

  IF v_harcama_sayisi = 0 OR v_harcama_puani <> NEW.kullanilan_puan OR v_hata_sayisi > 0 THEN
    RAISE EXCEPTION 'İndirim puanları kesin yayın kaynaklarına bağlanamadı; onay geri alındı.';
  END IF;

  INSERT INTO public.eczanem_indirim_onaylari (
    kaynak_siparis_id, eczane_id, eczane_adi, firma_id, takim_id, urun_id, urun_adi,
    onay_tarihi, kullanilan_puan, indirim_tl, tarife_puan, tarife_tl, satis_fiyati
  ) VALUES (
    NEW.siparis_id, NEW.eczane_id, v_eczane_adi, v_firma_id, v_takim_id, NEW.urun_id, v_urun_adi,
    NEW.onay_tarihi, NEW.kullanilan_puan, NEW.indirim_tl,
    (NEW.tarife_snapshot->>'puan')::integer,
    (NEW.tarife_snapshot->>'tl')::numeric,
    NULLIF(NEW.tarife_snapshot->>'satis_fiyati', '')::numeric
  )
  ON CONFLICT (kaynak_siparis_id) DO NOTHING
  RETURNING eczanem_indirim_onay_id INTO v_onay_id;

  IF v_onay_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.eczanem_indirim_onay_kaynaklari (
    eczanem_indirim_onay_id, yayin_id, arac_id, arac_turu,
    teknik_adi, pm_ogrenme_puani, kullanilan_puan
  )
  SELECT v_onay_id, i.yayin_id, vyd.arac_id, vyd.arac_turu,
    MAX(vyd.teknik_adi), MAX(COALESCE(vyd.ogrenme_araci_puani, vyd.video_puani)),
    SUM(h.dusulen_puan)::integer
  FROM public.eczanem_harcama_kayitlari h
  JOIN public.eczanem_puan_kayitlari p ON p.kayit_id = h.kaynak_kayit_id
  JOIN public.eczanem_izleme_kayitlari i ON i.izleme_id = p.izleme_id
  JOIN public.v_yayin_detay vyd ON vyd.yayin_id = i.yayin_id
  WHERE h.siparis_id = NEW.siparis_id
  GROUP BY i.yayin_id, vyd.arac_id, vyd.arac_turu;

  INSERT INTO public.eczanem_utt_mutabakatlar (mutabakat_id) VALUES (v_onay_id);
  RETURN NEW;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_utt_mutabakat_onay_snapshot() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_eczanem_utt_mutabakat_onay_snapshot ON public.eczanem_siparisler;
CREATE CONSTRAINT TRIGGER trg_eczanem_utt_mutabakat_onay_snapshot
AFTER UPDATE ON public.eczanem_siparisler
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
WHEN (NEW.durum = 'onaylandi' AND OLD.durum IS DISTINCT FROM NEW.durum)
EXECUTE FUNCTION public.eczanem_utt_mutabakat_onay_snapshot();

DO $kontrol$
BEGIN
  IF to_regclass('public.eczanem_indirim_onaylari') IS NULL
     OR to_regclass('public.eczanem_indirim_onay_kaynaklari') IS NULL
     OR to_regclass('public.eczanem_utt_mutabakatlar') IS NULL
     OR to_regclass('public.eczanem_utt_mutabakat_kararlari') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid = 'public.eczanem_siparisler'::regclass
         AND tgname = 'trg_eczanem_utt_mutabakat_onay_snapshot'
         AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Eczanem UTT mutabakat kayıt paketi eksik kuruldu.';
  END IF;
END;
$kontrol$;

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT
  (SELECT COUNT(*) FROM public.eczanem_indirim_onaylari) AS yeni_indirim_onayi,
  (SELECT COUNT(*) FROM public.eczanem_utt_mutabakatlar) AS yeni_mutabakat,
  (SELECT COUNT(*) FROM public.eczanem_indirim_onay_kaynaklari) AS yayin_kaynagi;
