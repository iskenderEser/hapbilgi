-- Her firmadaki bütün ürünlerin indirim onaylarına okunabilir, değişmez ID atar.
-- Örnek: NORMAVAS_30_000001. UUID yalnız iç ilişkilerde kalır.
-- Supabase SQL Editor'de bu dosya bir bütün olarak kullanıcı tarafından çalıştırılır.
BEGIN;

LOCK TABLE public.eczanem_indirim_onaylari IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.firmalar IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.firmalar
  ADD COLUMN IF NOT EXISTS son_indirim_sira bigint NOT NULL DEFAULT 0;
ALTER TABLE public.eczanem_indirim_onaylari
  ADD COLUMN IF NOT EXISTS indirim_sira bigint,
  ADD COLUMN IF NOT EXISTS gorunen_indirim_id text;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.eczanem_indirim_onaylari o
    LEFT JOIN public.firmalar f ON f.firma_id = o.firma_id
    WHERE f.firma_id IS NULL OR f.firma_no IS NULL OR f.firma_no < 1
       OR NULLIF(BTRIM(o.urun_adi), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'İndirim onayının ürün adı veya pozitif firma numarası eksik.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.eczanem_indirim_onaylari
    WHERE (indirim_sira IS NULL) <> (gorunen_indirim_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Kısmi indirim ID kaydı bulundu; otomatik doldurma durduruldu.';
  END IF;
END;
$kontrol$;

WITH sirali AS (
  SELECT o.eczanem_indirim_onay_id, o.firma_id, o.urun_adi,
    ROW_NUMBER() OVER (
      PARTITION BY o.firma_id ORDER BY o.onay_tarihi, o.eczanem_indirim_onay_id
    )::bigint AS sira
  FROM public.eczanem_indirim_onaylari o
  WHERE o.indirim_sira IS NULL
)
UPDATE public.eczanem_indirim_onaylari o
SET indirim_sira = f.son_indirim_sira + s.sira,
    gorunen_indirim_id = COALESCE(NULLIF(BTRIM(regexp_replace(
      TRANSLATE(UPPER(BTRIM(s.urun_adi)), 'ÇĞİÖŞÜ', 'CGIOSU'),
      '[^A-Z0-9]+', '_', 'g'), '_'), ''), 'URUN')
      || '_' || (f.firma_no * 10)::text || '_'
      || LPAD((f.son_indirim_sira + s.sira)::text,
        GREATEST(6, LENGTH((f.son_indirim_sira + s.sira)::text)), '0')
FROM sirali s
JOIN public.firmalar f ON f.firma_id = s.firma_id
WHERE o.eczanem_indirim_onay_id = s.eczanem_indirim_onay_id;

UPDATE public.firmalar f
SET son_indirim_sira = GREATEST(f.son_indirim_sira, COALESCE((
  SELECT MAX(o.indirim_sira) FROM public.eczanem_indirim_onaylari o
  WHERE o.firma_id = f.firma_id
), 0))
WHERE EXISTS (
  SELECT 1 FROM public.eczanem_indirim_onaylari o WHERE o.firma_id = f.firma_id
);

ALTER TABLE public.eczanem_indirim_onaylari
  ALTER COLUMN indirim_sira SET NOT NULL,
  ALTER COLUMN gorunen_indirim_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS eczanem_indirim_onaylari_firma_sira_uq
  ON public.eczanem_indirim_onaylari (firma_id, indirim_sira);
CREATE UNIQUE INDEX IF NOT EXISTS eczanem_indirim_onaylari_gorunen_id_uq
  ON public.eczanem_indirim_onaylari (gorunen_indirim_id);

CREATE OR REPLACE FUNCTION public.eczanem_indirim_gorunen_id_ata()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_firma_no integer;
  v_sira bigint;
  v_urun_kodu text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.firma_id IS DISTINCT FROM OLD.firma_id
      OR NEW.urun_id IS DISTINCT FROM OLD.urun_id
      OR NEW.urun_adi IS DISTINCT FROM OLD.urun_adi
      OR NEW.indirim_sira IS DISTINCT FROM OLD.indirim_sira
      OR NEW.gorunen_indirim_id IS DISTINCT FROM OLD.gorunen_indirim_id THEN
      RAISE EXCEPTION 'İndirim onayının firma, ürün ve görünen ID bilgileri değiştirilemez.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.indirim_sira IS NOT NULL OR NEW.gorunen_indirim_id IS NOT NULL THEN
    RAISE EXCEPTION 'Görünen indirim ID elle verilemez.';
  END IF;
  IF NULLIF(BTRIM(NEW.urun_adi), '') IS NULL THEN
    RAISE EXCEPTION 'İndirim onayının ürün adı boş olamaz.';
  END IF;

  -- Firma satırını kilitleyen UPDATE aynı firmadaki eşzamanlı onayları sıralar.
  UPDATE public.firmalar
  SET son_indirim_sira = son_indirim_sira + 1
  WHERE firma_id = NEW.firma_id AND firma_no > 0
  RETURNING firma_no, son_indirim_sira INTO v_firma_no, v_sira;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İndirim onayının firma numarası bulunamadı.';
  END IF;

  v_urun_kodu := COALESCE(NULLIF(BTRIM(regexp_replace(
    TRANSLATE(UPPER(BTRIM(NEW.urun_adi)), 'ÇĞİÖŞÜ', 'CGIOSU'),
    '[^A-Z0-9]+', '_', 'g'), '_'), ''), 'URUN');
  NEW.indirim_sira := v_sira;
  NEW.gorunen_indirim_id := v_urun_kodu || '_' || (v_firma_no * 10)::text || '_'
    || LPAD(v_sira::text, GREATEST(6, LENGTH(v_sira::text)), '0');
  RETURN NEW;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_indirim_gorunen_id_ata()
FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_eczanem_indirim_gorunen_id ON public.eczanem_indirim_onaylari;
CREATE TRIGGER trg_eczanem_indirim_gorunen_id
BEFORE INSERT OR UPDATE ON public.eczanem_indirim_onaylari
FOR EACH ROW EXECUTE FUNCTION public.eczanem_indirim_gorunen_id_ata();

-- Eczane akordiyonundaki her onaya aynı görünür ID'yi ekler.
CREATE OR REPLACE FUNCTION public.eczanem_utt_mutabakat_eczane_islemleri_listele(
  p_utt_id uuid, p_donem date, p_eczane_id uuid, p_durum text DEFAULT 'tumu',
  p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_baslangic timestamptz;
  v_bitis timestamptz;
  v_toplam integer;
  v_kayitlar jsonb;
BEGIN
  IF p_eczane_id IS NULL OR p_donem IS NULL
    OR p_donem <> date_trunc('month', p_donem::timestamp)::date
    OR p_durum IS NULL OR p_durum NOT IN ('tumu', 'bekliyor', 'onay', 'beklet', 'ret')
    OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100
    OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Geçersiz mutabakat işlem parametresi.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar k
    JOIN public.firmalar f ON f.firma_id = k.firma_id
    WHERE k.kullanici_id = p_utt_id AND LOWER(k.rol) = 'utt'
      AND k.aktif_mi = true AND f.aktif = true AND f.eczanem_aktif = true
  ) THEN
    RAISE EXCEPTION 'Mutabakat erişimi yalnız yetkili UTT içindir.' USING ERRCODE = '42501';
  END IF;

  v_baslangic := make_timestamptz(EXTRACT(YEAR FROM p_donem)::integer,
    EXTRACT(MONTH FROM p_donem)::integer, 1, 0, 0, 0, 'Europe/Istanbul');
  v_bitis := make_timestamptz(EXTRACT(YEAR FROM (p_donem + INTERVAL '1 month'))::integer,
    EXTRACT(MONTH FROM (p_donem + INTERVAL '1 month'))::integer, 1, 0, 0, 0, 'Europe/Istanbul');

  SELECT COUNT(*)::integer INTO v_toplam
  FROM public.eczanem_indirim_onaylari o
  JOIN public.eczanem_utt_mutabakatlar m ON m.mutabakat_id = o.eczanem_indirim_onay_id
  WHERE o.eczane_id = p_eczane_id
    AND o.onay_tarihi >= v_baslangic AND o.onay_tarihi < v_bitis
    AND (p_durum = 'tumu' OR (p_durum = 'bekliyor' AND m.utt_karar IS NULL)
      OR m.utt_karar = p_durum)
    AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mutabakat_id', s.eczanem_indirim_onay_id,
    'gorunen_indirim_id', s.gorunen_indirim_id,
    'eczane_id', s.eczane_id, 'eczane_adi', s.eczane_adi,
    'urun_id', s.urun_id, 'urun_adi', s.urun_adi,
    'onay_tarihi', s.onay_tarihi, 'kullanilan_puan', s.kullanilan_puan,
    'indirim_tl', s.indirim_tl, 'tarife_puan', s.tarife_puan,
    'tarife_tl', s.tarife_tl, 'satis_fiyati', s.satis_fiyati,
    'utt_karar', s.utt_karar, 'utt_karar_tarihi', s.utt_karar_tarihi,
    'karar_surumu', s.karar_surumu,
    'kaynaklar', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'yayin_id', q.yayin_id, 'arac_id', q.arac_id,
      'arac_turu', q.arac_turu, 'teknik_adi', q.teknik_adi,
      'pm_ogrenme_puani', q.pm_ogrenme_puani, 'kullanilan_puan', q.kullanilan_puan
    ) ORDER BY q.yayin_id) FROM public.eczanem_indirim_onay_kaynaklari q
      WHERE q.eczanem_indirim_onay_id = s.eczanem_indirim_onay_id), '[]'::jsonb),
    'karar_gecmisi', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'surum', h.surum, 'karar', h.karar, 'karar_tarihi', h.karar_tarihi
    ) ORDER BY h.surum) FROM public.eczanem_utt_mutabakat_kararlari h
      WHERE h.mutabakat_id = s.eczanem_indirim_onay_id), '[]'::jsonb)
  ) ORDER BY s.onay_tarihi DESC, s.eczanem_indirim_onay_id DESC), '[]'::jsonb)
  INTO v_kayitlar
  FROM (
    SELECT o.*, m.utt_karar, m.utt_karar_tarihi, m.karar_surumu
    FROM public.eczanem_indirim_onaylari o
    JOIN public.eczanem_utt_mutabakatlar m ON m.mutabakat_id = o.eczanem_indirim_onay_id
    WHERE o.eczane_id = p_eczane_id
      AND o.onay_tarihi >= v_baslangic AND o.onay_tarihi < v_bitis
      AND (p_durum = 'tumu' OR (p_durum = 'bekliyor' AND m.utt_karar IS NULL)
        OR m.utt_karar = p_durum)
      AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id)
    ORDER BY o.onay_tarihi DESC, o.eczanem_indirim_onay_id DESC
    LIMIT p_limit OFFSET p_offset
  ) s;

  RETURN jsonb_build_object('toplam', v_toplam, 'kayitlar', v_kayitlar);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_utt_mutabakat_eczane_islemleri_listele(uuid,date,uuid,text,integer,integer)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_utt_mutabakat_eczane_islemleri_listele(uuid,date,uuid,text,integer,integer)
TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT f.firma_adi, f.firma_no, o.urun_adi, o.gorunen_indirim_id
FROM public.eczanem_indirim_onaylari o
JOIN public.firmalar f ON f.firma_id = o.firma_id
ORDER BY f.firma_no, o.indirim_sira;
