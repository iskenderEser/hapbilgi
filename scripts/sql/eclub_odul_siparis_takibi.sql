-- Önkoşul: ecza_depo_katalogu_sema.sql ve katalog veri yüklemesi;
-- mevcut E-Club UTT üyeliği, çek snapshot, TM onayı ve teslimat outbox migrasyonları.
-- Tek parça Supabase SQL Editor'da çalıştırılır. Eski puan RPC'leri değiştirilmez.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-odul-siparis-migrasyon', 0));

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

ALTER TABLE public.eclub_store_cek_talepleri
  ADD COLUMN IF NOT EXISTS depo_sube_id uuid REFERENCES public.ecza_depo_subeleri(depo_sube_id),
  ADD COLUMN IF NOT EXISTS depo_adi_snapshot text,
  ADD COLUMN IF NOT EXISTS depo_sube_adi_snapshot text,
  ADD COLUMN IF NOT EXISTS depo_il_snapshot text,
  ADD COLUMN IF NOT EXISTS depo_ilce_snapshot text,
  ADD COLUMN IF NOT EXISTS depo_adres_snapshot text,
  ADD COLUMN IF NOT EXISTS siparis_okundu_at timestamptz,
  ADD COLUMN IF NOT EXISTS siparis_okuyan_utt_id uuid REFERENCES public.kullanicilar(kullanici_id);
ALTER TABLE public.eclub_store_cek_talepleri DROP CONSTRAINT IF EXISTS eclub_siparis_okundu_butunluk;
ALTER TABLE public.eclub_store_cek_talepleri ADD CONSTRAINT eclub_siparis_okundu_butunluk CHECK (
  (siparis_okundu_at IS NULL AND siparis_okuyan_utt_id IS NULL AND depo_sube_id IS NULL)
  OR (siparis_verildi_mi AND siparis_okundu_at IS NOT NULL AND siparis_okuyan_utt_id IS NOT NULL
      AND depo_sube_id IS NOT NULL AND depo_adi_snapshot IS NOT NULL
      AND depo_il_snapshot IS NOT NULL AND depo_ilce_snapshot IS NOT NULL AND depo_adres_snapshot IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS eclub_odul_siparis_utt_idx
  ON public.eclub_store_cek_talepleri (firma_id, utt_id, created_at DESC) WHERE siparis_verildi_mi = true;

CREATE TABLE IF NOT EXISTS public.eclub_odul_siparis_outbox (
  outbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talep_id uuid NOT NULL REFERENCES public.eclub_store_cek_talepleri(talep_id),
  eczane_id uuid NOT NULL REFERENCES public.eclub_eczaneler(eczane_id),
  alici_kisi_id uuid NOT NULL REFERENCES public.eclub_kisiler(kisi_id),
  kanal text NOT NULL CHECK (kanal IN ('eposta','push')),
  alici_eposta text,
  mesaj text NOT NULL,
  durum text NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','isleniyor','tamamlandi','basarisiz')),
  deneme_sayisi integer NOT NULL DEFAULT 0,
  max_deneme integer NOT NULL DEFAULT 5,
  sonraki_deneme_at timestamptz NOT NULL DEFAULT now(),
  lease_bitis timestamptz,
  claim_token uuid,
  son_hata_kodu text,
  tamamlanma_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (talep_id, kanal, alici_kisi_id)
);
CREATE INDEX IF NOT EXISTS eclub_odul_siparis_outbox_is_idx
  ON public.eclub_odul_siparis_outbox (durum, sonraki_deneme_at, created_at);

ALTER TABLE public.eclub_eczane_depo_tercihleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eclub_depo_tercih_gecmisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eclub_odul_siparis_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eclub_eczane_depo_tercihleri, public.eclub_depo_tercih_gecmisi,
  public.eclub_odul_siparis_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eclub_eczane_depo_tercihleri TO service_role;
GRANT SELECT ON TABLE public.eclub_depo_tercih_gecmisi TO service_role;
GRANT SELECT, UPDATE ON TABLE public.eclub_odul_siparis_outbox TO service_role;

INSERT INTO public.sistem_ayarlari (anahtar, deger, aciklama)
VALUES ('eclub_depo_info_eposta', '"info@mill.gen.tr"'::jsonb, 'Depo düzeltme/ekleme talebi alıcısı.')
ON CONFLICT (anahtar) DO NOTHING;

ALTER TABLE public.eclub_bildirimler DROP CONSTRAINT IF EXISTS eclub_bildirimler_kayit_turu_check;
ALTER TABLE public.eclub_bildirimler ADD CONSTRAINT eclub_bildirimler_kayit_turu_check
  CHECK (kayit_turu IN ('oneri','cek','odul_siparis'));

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

-- Puan hesaplayan mevcut RPC'yi değiştirmeden INSERT anında zorunlu tercih doğrulaması.
CREATE OR REPLACE FUNCTION public.eclub_siparis_depo_kapisi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.siparis_verildi_mi THEN
    PERFORM 1 FROM eclub_eczaneler WHERE eczane_id = NEW.eczane_id FOR UPDATE;
    IF NOT eclub_eczane_depolari_hazir(NEW.eczane_id) THEN
      RAISE EXCEPTION 'Depo tercihlerinizi UTT temsilcinizin tamamlaması gerekiyor.';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.durum = 'teslimat_bekliyor'
    AND OLD.durum IS DISTINCT FROM NEW.durum AND NEW.siparis_verildi_mi
    AND (NEW.siparis_okundu_at IS NULL OR NEW.siparis_okuyan_utt_id IS NULL OR NEW.depo_sube_id IS NULL) THEN
    RAISE EXCEPTION 'Sipariş Okundu olmadan çek kodu teslim edilemez.';
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS eclub_siparis_depo_kapisi_trg ON public.eclub_store_cek_talepleri;
CREATE TRIGGER eclub_siparis_depo_kapisi_trg BEFORE INSERT OR UPDATE OF durum
  ON public.eclub_store_cek_talepleri FOR EACH ROW EXECUTE FUNCTION public.eclub_siparis_depo_kapisi();

CREATE OR REPLACE FUNCTION public.eclub_odul_siparis_oku(p_utt_id uuid, p_talep_id uuid, p_konum uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_t eclub_store_cek_talepleri%rowtype;
  v_s ecza_depo_subeleri%rowtype;
  v_eczane uuid;
  v_depo text; v_utt text; v_firma text; v_urun text; v_m text; v_email text;
BEGIN
  SELECT eczane_id INTO v_eczane FROM eclub_store_cek_talepleri WHERE talep_id = p_talep_id;
  IF v_eczane IS NULL THEN RAISE EXCEPTION 'Sipariş bulunamadı.'; END IF;
  PERFORM 1 FROM eclub_eczaneler WHERE eczane_id = v_eczane FOR UPDATE;
  SELECT * INTO v_t FROM eclub_store_cek_talepleri WHERE talep_id = p_talep_id FOR UPDATE;
  SELECT btrim(k.ad || ' ' || k.soyad), f.firma_adi INTO v_utt,v_firma
    FROM kullanicilar k JOIN firmalar f ON f.firma_id = k.firma_id
    WHERE k.kullanici_id = p_utt_id AND k.aktif_mi AND lower(k.rol) IN ('utt','kd_utt')
      AND k.firma_id = v_t.firma_id AND k.kullanici_id = v_t.utt_id AND f.eclub_aktif AND f.eclub_store_aktif;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bu siparişi Okundu yapma yetkiniz yok.'; END IF;
  IF NOT v_t.siparis_verildi_mi OR v_t.durum = 'iptal' THEN RAISE EXCEPTION 'Siparişsiz veya iptal edilmiş talep okunamaz.'; END IF;
  IF v_t.siparis_okundu_at IS NOT NULL THEN
    IF v_t.depo_sube_id IS DISTINCT FROM p_konum THEN RAISE EXCEPTION 'Okunmuş siparişin hedef deposu değiştirilemez.'; END IF;
    RETURN jsonb_build_object('ok',true,'tekrar',true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM eclub_eczane_depo_tercihleri
    WHERE eczane_id = v_t.eczane_id AND depo_sube_id = p_konum) OR NOT eclub_depo_konumu_uygun(p_konum) THEN
    RAISE EXCEPTION 'Eczanenin kayıtlı aktif depo/şube tercihlerinden birini seçin.';
  END IF;
  SELECT * INTO v_s FROM ecza_depo_subeleri WHERE depo_sube_id = p_konum;
  SELECT depo_adi INTO v_depo FROM ecza_depolari WHERE depo_id = v_s.depo_id;
  SELECT u.urun_adi INTO v_urun FROM v_yayin_kunye y JOIN urunler u ON u.urun_id = y.urun_id WHERE y.yayin_id = v_t.yayin_id LIMIT 1;
  IF nullif(btrim(v_urun),'') IS NULL THEN RAISE EXCEPTION 'Siparişin ürün adı bulunamadı.'; END IF;
  v_m := format('HapBilgi''de kazandığınız puanların hediye çekine dönmesi için %s adet%s şartıyla %s için onayladığınız sipariş, %s ürün tanıtım temsilcisi %s tarafından tercih ettiğiniz %s%s okunmuştur.',
    v_t.siparis_adet, CASE WHEN v_t.siparis_mal_fazlasi > 0 THEN format(' + %s mal fazlası',v_t.siparis_mal_fazlasi) ELSE '' END,
    v_urun,v_firma,v_utt,v_depo,CASE WHEN v_s.sube_adi IS NOT NULL THEN ' / '||v_s.sube_adi||' şubesine' ELSE ' deposuna' END);
  UPDATE eclub_store_cek_talepleri SET depo_sube_id = p_konum, depo_adi_snapshot = v_depo,
    depo_sube_adi_snapshot = v_s.sube_adi, depo_il_snapshot = v_s.il, depo_ilce_snapshot = v_s.ilce,
    depo_adres_snapshot = v_s.adres, siparis_okundu_at = now(), siparis_okuyan_utt_id = p_utt_id, guncellenme_at = now()
    WHERE talep_id = p_talep_id;
  INSERT INTO eclub_bildirimler (alici_kisi_id,gonderen_id,kayit_turu,kayit_id,mesaj,goruldu_mu)
    VALUES (v_t.talep_eden_kisi_id,p_utt_id,'odul_siparis',p_talep_id,v_m,false);
  SELECT eposta INTO v_email FROM eclub_kisiler WHERE kisi_id = v_t.talep_eden_kisi_id;
  INSERT INTO eclub_odul_siparis_outbox (talep_id,eczane_id,alici_kisi_id,kanal,alici_eposta,mesaj)
    VALUES (p_talep_id,v_t.eczane_id,v_t.talep_eden_kisi_id,'eposta',v_email,v_m),
           (p_talep_id,v_t.eczane_id,v_t.talep_eden_kisi_id,'push',NULL,v_m);
  RETURN jsonb_build_object('ok',true,'tekrar',false);
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_odul_siparis_isi_al(p_kanal text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_is eclub_odul_siparis_outbox%rowtype; v_token uuid := gen_random_uuid(); v_auth uuid;
BEGIN
  UPDATE eclub_odul_siparis_outbox SET durum = 'basarisiz', son_hata_kodu = 'LEASE_DENEME_TUKENDI',
    claim_token = NULL, lease_bitis = NULL
    WHERE kanal = p_kanal AND durum = 'isleniyor' AND lease_bitis < now() AND deneme_sayisi >= max_deneme;
  SELECT * INTO v_is FROM eclub_odul_siparis_outbox
    WHERE kanal = p_kanal AND deneme_sayisi < max_deneme AND sonraki_deneme_at <= now()
      AND (durum IN ('bekliyor','basarisiz') OR (durum = 'isleniyor' AND lease_bitis < now()))
    ORDER BY created_at, outbox_id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT k.auth_user_id INTO v_auth FROM eclub_kisiler k JOIN eclub_kisi_eczane ke USING (kisi_id)
    WHERE k.kisi_id = v_is.alici_kisi_id AND k.rol = 'eczaci' AND ke.eczane_id = v_is.eczane_id AND ke.aktif_mi LIMIT 1;
  UPDATE eclub_odul_siparis_outbox SET durum = 'isleniyor',deneme_sayisi = deneme_sayisi + 1,
    lease_bitis = now() + interval '120 seconds',claim_token = v_token WHERE outbox_id = v_is.outbox_id;
  RETURN to_jsonb(v_is) || jsonb_build_object('claim_token',v_token,'alici_auth_user_id',v_auth);
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_odul_siparis_isi_bitir(p_outbox_id uuid,p_token uuid,p_hata text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  UPDATE eclub_odul_siparis_outbox SET
    durum = CASE WHEN p_hata IS NULL THEN 'tamamlandi' ELSE 'basarisiz' END,
    son_hata_kodu = left(p_hata,80), lease_bitis = NULL,claim_token = NULL,
    tamamlanma_at = CASE WHEN p_hata IS NULL THEN now() ELSE NULL END,
    sonraki_deneme_at = now() + make_interval(secs => least(3600,(60 * power(2,greatest(deneme_sayisi-1,0)))::integer))
    WHERE outbox_id = p_outbox_id AND claim_token = p_token AND durum = 'isleniyor';
  RETURN FOUND;
END $f$;

REVOKE ALL ON FUNCTION public.eclub_depo_konumu_uygun(uuid),
  public.eclub_eczane_depolari_hazir(uuid), public.eclub_eczaci_kayit_depo_kapisi(),
  public.eclub_depo_tercihlerini_kaydet(uuid,uuid,uuid[]),
  public.eclub_utt_eczaneye_depolar_ile_bagla(uuid,text,uuid[]),
  public.eclub_siparis_depo_kapisi(), public.eclub_odul_siparis_oku(uuid,uuid,uuid),
  public.eclub_odul_siparis_isi_al(text), public.eclub_odul_siparis_isi_bitir(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_depo_tercihlerini_kaydet(uuid,uuid,uuid[]),
  public.eclub_eczane_depolari_hazir(uuid),
  public.eclub_utt_eczaneye_depolar_ile_bagla(uuid,text,uuid[]),public.eclub_odul_siparis_oku(uuid,uuid,uuid),
  public.eclub_odul_siparis_isi_al(text),public.eclub_odul_siparis_isi_bitir(uuid,uuid,text)
  TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
