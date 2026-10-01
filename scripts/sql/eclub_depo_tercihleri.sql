-- Önkoşul: ecza_depo_katalogu_sema.sql ve katalog veri yüklemesi.
-- E-Club eczanelerinin depo tercihlerini kurar; sipariş takip akışı içermez.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-depo-tercihleri', 0));

CREATE TABLE IF NOT EXISTS public.eclub_eczane_depo_tercihleri (
  eczane_id uuid NOT NULL REFERENCES public.eclub_eczaneler(eczane_id),
  depo_sube_id uuid NOT NULL REFERENCES public.ecza_depo_subeleri(depo_sube_id),
  kaydeden_utt_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (eczane_id, depo_sube_id)
);
CREATE TABLE IF NOT EXISTS public.eclub_depo_tercih_gecmisi (
  kayit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eczane_id uuid NOT NULL REFERENCES public.eclub_eczaneler(eczane_id),
  utt_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  onceki uuid[] NOT NULL,
  yeni uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eclub_eczane_depo_tercihleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eclub_depo_tercih_gecmisi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eclub_eczane_depo_tercihleri, public.eclub_depo_tercih_gecmisi
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eclub_eczane_depo_tercihleri TO service_role;
GRANT SELECT ON TABLE public.eclub_depo_tercih_gecmisi TO service_role;

INSERT INTO public.sistem_ayarlari (anahtar, deger, aciklama)
VALUES ('eclub_depo_info_eposta', '"info@mill.gen.tr"'::jsonb, 'Depo düzeltme/ekleme talebi alıcısı.')
ON CONFLICT (anahtar) DO NOTHING;

-- Adsız satırı merkez saymaz. Şubeli depoda adlandırılmış aktif şube zorunludur.
CREATE OR REPLACE FUNCTION public.eclub_depo_konumu_uygun(p_konum uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $f$
  SELECT EXISTS (
    SELECT 1 FROM ecza_depo_subeleri s JOIN ecza_depolari d USING (depo_id)
    WHERE s.depo_sube_id = p_konum AND s.aktif_mi AND d.aktif_mi
      AND (CASE WHEN EXISTS (
        SELECT 1 FROM ecza_depo_subeleri x WHERE x.depo_id = s.depo_id AND nullif(btrim(x.sube_adi),'') IS NOT NULL
      ) THEN nullif(btrim(s.sube_adi),'') IS NOT NULL
      ELSE (SELECT count(*) FROM ecza_depo_subeleri x WHERE x.depo_id = s.depo_id) = 1 END)
  );
$f$;

CREATE OR REPLACE FUNCTION public.eclub_eczane_depolari_hazir(p_eczane uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $f$
  SELECT count(*) BETWEEN 1 AND 3 AND count(*) FILTER (WHERE eclub_depo_konumu_uygun(depo_sube_id)) > 0
  FROM eclub_eczane_depo_tercihleri WHERE eczane_id = p_eczane;
$f$;

CREATE OR REPLACE FUNCTION public.eclub_eczaci_kayit_depo_kapisi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF NEW.aktif_mi AND EXISTS (SELECT 1 FROM eclub_kisiler WHERE kisi_id = NEW.kisi_id AND rol = 'eczaci') THEN
    PERFORM 1 FROM eclub_eczaneler WHERE eczane_id = NEW.eczane_id FOR UPDATE;
    IF NOT eclub_eczane_depolari_hazir(NEW.eczane_id) THEN
      RAISE EXCEPTION 'Eczacı kaydından önce eczanenin 1–3 depo tercihini tamamlayın.';
    END IF;
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS eclub_eczaci_kayit_depo_kapisi_trg ON public.eclub_kisi_eczane;
CREATE TRIGGER eclub_eczaci_kayit_depo_kapisi_trg BEFORE INSERT OR UPDATE OF aktif_mi, eczane_id
  ON public.eclub_kisi_eczane FOR EACH ROW EXECUTE FUNCTION public.eclub_eczaci_kayit_depo_kapisi();

CREATE OR REPLACE FUNCTION public.eclub_depo_tercihlerini_kaydet(p_utt_id uuid, p_eczane_id uuid, p_konumlar uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_onceki uuid[];
BEGIN
  IF cardinality(p_konumlar) IS NULL OR cardinality(p_konumlar) NOT BETWEEN 1 AND 3
    OR EXISTS (SELECT 1 FROM unnest(p_konumlar) x WHERE x IS NULL)
    OR (SELECT count(DISTINCT x) FROM unnest(p_konumlar) x) <> cardinality(p_konumlar) THEN
    RAISE EXCEPTION 'En az 1, en fazla 3 farklı depo/şube seçin.';
  END IF;
  PERFORM 1 FROM eclub_eczaneler WHERE eczane_id = p_eczane_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Eczane bulunamadı.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM kullanicilar k JOIN eclub_utt_eczane ue ON ue.utt_id = k.kullanici_id
    JOIN eclub_eczane_firma ef ON ef.id = ue.eczane_firma_id
    WHERE k.kullanici_id = p_utt_id AND k.aktif_mi AND lower(k.rol) IN ('utt','kd_utt')
      AND ef.firma_id = k.firma_id AND ef.eczane_id = p_eczane_id AND ef.aktif_mi AND ue.aktif_mi
  ) THEN RAISE EXCEPTION 'Eczane depo tercihlerini değiştirme yetkiniz yok.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_konumlar) x WHERE NOT eclub_depo_konumu_uygun(x)) THEN
    RAISE EXCEPTION 'Depo/şube pasif, şube seçimi eksik veya konum belirsiz.';
  END IF;
  SELECT coalesce(array_agg(depo_sube_id ORDER BY depo_sube_id),'{}'::uuid[]) INTO v_onceki
    FROM eclub_eczane_depo_tercihleri WHERE eczane_id = p_eczane_id;
  DELETE FROM eclub_eczane_depo_tercihleri WHERE eczane_id = p_eczane_id;
  INSERT INTO eclub_eczane_depo_tercihleri (eczane_id, depo_sube_id, kaydeden_utt_id)
    SELECT p_eczane_id, x, p_utt_id FROM unnest(p_konumlar) x;
  INSERT INTO eclub_depo_tercih_gecmisi (eczane_id, utt_id, onceki, yeni)
    VALUES (p_eczane_id,p_utt_id,v_onceki,p_konumlar);
END $f$;

-- Bağlama + tercihler tek transaction; tercih hatasında yeni üyelik de geri alınır.
CREATE OR REPLACE FUNCTION public.eclub_utt_eczaneye_depolar_ile_bagla(p_utt_id uuid, p_gln text, p_konumlar uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_bag record;
BEGIN
  SELECT * INTO v_bag FROM eclub_utt_eczaneye_bagla(p_utt_id,p_gln);
  IF NOT v_bag.ok THEN RETURN to_jsonb(v_bag); END IF;
  PERFORM eclub_depo_tercihlerini_kaydet(p_utt_id,v_bag.eczane_id,p_konumlar);
  RETURN to_jsonb(v_bag);
END $f$;

-- Siparişli çek talebinde kayıtlı depo tercihi bulunmasını zorunlu tutar.
CREATE OR REPLACE FUNCTION public.eclub_siparis_depo_kapisi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.siparis_verildi_mi THEN
    PERFORM 1 FROM eclub_eczaneler WHERE eczane_id = NEW.eczane_id FOR UPDATE;
    IF NOT eclub_eczane_depolari_hazir(NEW.eczane_id) THEN
      RAISE EXCEPTION 'Depo tercihlerinizi UTT temsilcinizin tamamlaması gerekiyor.';
    END IF;
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS eclub_siparis_depo_kapisi_trg ON public.eclub_store_cek_talepleri;
CREATE TRIGGER eclub_siparis_depo_kapisi_trg BEFORE INSERT
  ON public.eclub_store_cek_talepleri FOR EACH ROW EXECUTE FUNCTION public.eclub_siparis_depo_kapisi();

REVOKE ALL ON FUNCTION public.eclub_depo_konumu_uygun(uuid),
  public.eclub_eczane_depolari_hazir(uuid), public.eclub_eczaci_kayit_depo_kapisi(),
  public.eclub_depo_tercihlerini_kaydet(uuid,uuid,uuid[]),
  public.eclub_utt_eczaneye_depolar_ile_bagla(uuid,text,uuid[]),
  public.eclub_siparis_depo_kapisi()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_depo_tercihlerini_kaydet(uuid,uuid,uuid[]),
  public.eclub_eczane_depolari_hazir(uuid),
  public.eclub_utt_eczaneye_depolar_ile_bagla(uuid,text,uuid[])
  TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
