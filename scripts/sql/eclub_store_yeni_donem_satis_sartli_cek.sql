-- E-Club iki aylık puan / hediye çeki sistemi — nihai düzeltme migrasyonu.
-- Supabase SQL Editor'da tek parça çalıştırılır.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-cek-final-v1', 0));

ALTER TABLE public.yayin_yonetimi
  ADD COLUMN IF NOT EXISTS satis_sarti_tipi text DEFAULT 'satis_sartli',
  ADD COLUMN IF NOT EXISTS gizli_sart_katlama_orani integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS barem_tablosu jsonb DEFAULT '[{"min_puan":200,"max_puan":399,"adet":10,"mal_fazlasi":1},{"min_puan":400,"max_puan":799,"adet":20,"mal_fazlasi":3},{"min_puan":800,"max_puan":1000,"adet":50,"mal_fazlasi":25}]'::jsonb,
  ADD COLUMN IF NOT EXISTS karsilik_puan integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS karsilik_tl numeric(10,2) DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.eclub_store_cek_talepleri (
  talep_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eczane_id uuid NOT NULL REFERENCES public.eclub_eczaneler(eczane_id),
  firma_id uuid NOT NULL REFERENCES public.firmalar(firma_id),
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id),
  talep_eden_kisi_id uuid NOT NULL REFERENCES public.eclub_kisiler(kisi_id),
  toplanan_puan integer NOT NULL,
  talep_edilen_cek_tl numeric(10,2) NOT NULL,
  siparis_tipi text NOT NULL,
  siparis_verildi_mi boolean NOT NULL DEFAULT false,
  siparis_adet integer NOT NULL DEFAULT 0,
  siparis_mal_fazlasi integer NOT NULL DEFAULT 0,
  durum text NOT NULL DEFAULT 'beklemede',
  utt_id uuid REFERENCES public.kullanicilar(kullanici_id),
  bm_id uuid REFERENCES public.kullanicilar(kullanici_id),
  bm_onay_tarihi timestamptz,
  cek_kodu text,
  cek_gonderim_tarihi timestamptz,
  devreden_puan integer NOT NULL DEFAULT 0,
  donem_kodu text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  guncellenme_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eclub_store_cek_talepleri
  ALTER COLUMN donem_kodu DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS eclub_cek_talep_tekil_donem_idx
  ON public.eclub_store_cek_talepleri (eczane_id, yayin_id, donem_kodu)
  WHERE durum <> 'iptal';

CREATE TABLE IF NOT EXISTS public.eclub_store_puan_devirleri (
  devir_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eczane_id uuid NOT NULL REFERENCES public.eclub_eczaneler(eczane_id),
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id),
  kaynak_donem_kodu text NOT NULL,
  hedef_donem_kodu text NOT NULL,
  puan integer NOT NULL CHECK (puan > 0),
  kaynak_talep_id uuid REFERENCES public.eclub_store_cek_talepleri(talep_id),
  kullanildi_mi boolean NOT NULL DEFAULT false,
  kullanilan_talep_id uuid REFERENCES public.eclub_store_cek_talepleri(talep_id),
  iptal_edildi boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  guncellenme_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS eclub_puan_devir_tekil_idx
  ON public.eclub_store_puan_devirleri (eczane_id, yayin_id, kaynak_donem_kodu)
  WHERE iptal_edildi = false;
CREATE INDEX IF NOT EXISTS eclub_puan_devir_hedef_idx
  ON public.eclub_store_puan_devirleri (eczane_id, yayin_id, hedef_donem_kodu)
  WHERE kullanildi_mi = false AND iptal_edildi = false;

CREATE TABLE IF NOT EXISTS public.eclub_store_cek_eposta_kuyrugu (
  is_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talep_id uuid NOT NULL REFERENCES public.eclub_store_cek_talepleri(talep_id) ON DELETE CASCADE,
  alici_eposta text NOT NULL,
  alici_adi text,
  durum text NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','isleniyor','tamamlandi','hata')),
  deneme_sayisi integer NOT NULL DEFAULT 0,
  max_deneme integer NOT NULL DEFAULT 5,
  sonraki_deneme_at timestamptz NOT NULL DEFAULT now(),
  lease_bitis timestamptz,
  son_hata_kodu text,
  created_at timestamptz NOT NULL DEFAULT now(),
  guncellenme_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (talep_id, alici_eposta)
);

DO $blok$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.eclub_bildirimler'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%kayit_turu%' LOOP
    EXECUTE format('ALTER TABLE public.eclub_bildirimler DROP CONSTRAINT %I',r.conname);
  END LOOP;
END $blok$;
ALTER TABLE public.eclub_bildirimler ADD CONSTRAINT eclub_bildirimler_kayit_turu_check CHECK (kayit_turu IN ('oneri','cek'));

CREATE OR REPLACE FUNCTION public.eclub_store_donem_sinirlari(p_donem_kodu text)
RETURNS TABLE(baslangic timestamptz, bitis_haric timestamptz, sonraki_donem_kodu text)
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $f$
DECLARE v_yil integer; v_p integer; v_ay integer; v_son_yil integer; v_son_p integer;
BEGIN
  IF p_donem_kodu !~ '^[0-9]{4}-P[1-6]$' THEN RAISE EXCEPTION 'Geçersiz dönem kodu'; END IF;
  v_yil := substring(p_donem_kodu,1,4)::integer;
  v_p := substring(p_donem_kodu,7,1)::integer;
  v_ay := ((v_p - 1) * 2) + 1;
  IF v_p = 6 THEN v_son_yil := v_yil + 1; v_son_p := 1; ELSE v_son_yil := v_yil; v_son_p := v_p + 1; END IF;
  RETURN QUERY SELECT
    make_timestamptz(v_yil,v_ay,1,0,0,0,'Europe/Istanbul'),
    CASE WHEN v_p=6 THEN make_timestamptz(v_yil+1,1,1,0,0,0,'Europe/Istanbul') ELSE make_timestamptz(v_yil,v_ay+2,1,0,0,0,'Europe/Istanbul') END,
    v_son_yil::text || '-P' || v_son_p::text;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_aktif_donem(p_an timestamptz DEFAULT now())
RETURNS TABLE(donem_kodu text, onceki_donem_kodu text, donem_baslangic timestamptz, donem_bitis_haric timestamptz, talep_baslangic timestamptz, talep_bitis_haric timestamptz, talep_acik_mi boolean)
LANGUAGE plpgsql STABLE SET search_path=public AS $f$
DECLARE v_tr timestamp; v_yil integer; v_ay integer; v_talep_ayi integer; v_kazanc_yili integer; v_p integer; v_onceki_yil integer; v_onceki_p integer;
BEGIN
  v_tr := p_an AT TIME ZONE 'Europe/Istanbul'; v_yil:=extract(year from v_tr); v_ay:=extract(month from v_tr);
  v_talep_ayi := CASE WHEN mod(v_ay,2)=1 THEN v_ay ELSE v_ay-1 END;
  IF v_talep_ayi=1 THEN v_kazanc_yili:=v_yil-1; v_p:=6; ELSE v_kazanc_yili:=v_yil; v_p:=(v_talep_ayi-1)/2; END IF;
  IF v_p=1 THEN v_onceki_yil:=v_kazanc_yili-1; v_onceki_p:=6; ELSE v_onceki_yil:=v_kazanc_yili; v_onceki_p:=v_p-1; END IF;
  RETURN QUERY SELECT v_kazanc_yili::text||'-P'||v_p, v_onceki_yil::text||'-P'||v_onceki_p,
    s.baslangic,s.bitis_haric,
    make_timestamptz(v_yil,v_talep_ayi,1,0,0,0,'Europe/Istanbul'), make_timestamptz(v_yil,v_talep_ayi,8,0,0,0,'Europe/Istanbul'),
    (v_ay=v_talep_ayi AND p_an>=make_timestamptz(v_yil,v_talep_ayi,1,0,0,0,'Europe/Istanbul') AND p_an<make_timestamptz(v_yil,v_talep_ayi,8,0,0,0,'Europe/Istanbul'))
  FROM public.eclub_store_donem_sinirlari(v_kazanc_yili::text||'-P'||v_p) s;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_barem_gecerli(p_barem jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE x jsonb; v_min integer; v_max integer; v_adet integer; v_mf integer; v_onceki_max integer; v_sira integer:=0;
BEGIN
  IF p_barem IS NULL OR jsonb_typeof(p_barem)<>'array' OR jsonb_array_length(p_barem)=0 OR jsonb_array_length(p_barem)>20 THEN RETURN false; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(p_barem) LOOP
    IF jsonb_typeof(x)<>'object' OR coalesce(x->>'min_puan','')!~'^[0-9]+$' OR coalesce(x->>'max_puan','')!~'^[0-9]+$' OR coalesce(x->>'adet','')!~'^[0-9]+$' OR coalesce(x->>'mal_fazlasi','')!~'^[0-9]+$' THEN RETURN false; END IF;
    v_min:=(x->>'min_puan')::integer; v_max:=(x->>'max_puan')::integer; v_adet:=(x->>'adet')::integer; v_mf:=(x->>'mal_fazlasi')::integer;
    IF v_max<v_min OR (v_sira>0 AND v_min<>v_onceki_max+1) THEN RETURN false; END IF;
    v_onceki_max:=v_max; v_sira:=v_sira+1;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_onceki_deviri_hazirla(p_eczane_id uuid,p_yayin_id uuid,p_hedef_donem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_kaynak text; v_bas timestamptz; v_bit timestamptz; v_min integer; v_max integer; v_kazanc integer; v_gelen integer; v_toplam integer; v_devir integer:=0;
BEGIN
  SELECT d.kaynak_donem_kodu INTO v_kaynak FROM (SELECT CASE WHEN substring(p_hedef_donem,7,1)::int=1 THEN (substring(p_hedef_donem,1,4)::int-1)::text||'-P6' ELSE substring(p_hedef_donem,1,4)||'-P'||(substring(p_hedef_donem,7,1)::int-1)::text END kaynak_donem_kodu) d;
  PERFORM pg_advisory_xact_lock(hashtextextended('eclub-devir:'||p_eczane_id||':'||p_yayin_id||':'||v_kaynak,0));
  IF EXISTS(SELECT 1 FROM public.eclub_store_puan_devirleri WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND kaynak_donem_kodu=v_kaynak AND iptal_edildi=false) OR
     EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND donem_kodu=v_kaynak AND durum<>'iptal') THEN RETURN; END IF;
  SELECT baslangic,bitis_haric INTO v_bas,v_bit FROM public.eclub_store_donem_sinirlari(v_kaynak);
  SELECT min((x->>'min_puan')::int),max((x->>'max_puan')::int) INTO v_min,v_max FROM public.yayin_yonetimi y, jsonb_array_elements(y.barem_tablosu) x WHERE y.yayin_id=p_yayin_id;
  IF v_min IS NULL THEN RETURN; END IF;
  SELECT coalesce(sum(kp.puan),0)::int INTO v_kazanc FROM public.eclub_kazanilan_puanlar kp JOIN public.eclub_kisi_eczane ke ON ke.kisi_id=kp.kisi_id AND ke.eczane_id=p_eczane_id AND ke.aktif_mi=true WHERE kp.yayin_id=p_yayin_id AND kp.created_at>=v_bas AND kp.created_at<v_bit;
  SELECT coalesce(sum(puan),0)::int INTO v_gelen FROM public.eclub_store_puan_devirleri WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_kaynak AND kullanildi_mi=false AND iptal_edildi=false;
  v_toplam:=v_kazanc+v_gelen;
  IF v_toplam>0 AND v_toplam<v_min THEN v_devir:=v_toplam;
  ELSIF v_toplam>v_max THEN v_devir:=v_toplam-v_max; END IF;
  IF v_devir>0 THEN INSERT INTO public.eclub_store_puan_devirleri(eczane_id,yayin_id,kaynak_donem_kodu,hedef_donem_kodu,puan) VALUES(p_eczane_id,p_yayin_id,v_kaynak,p_hedef_donem,v_devir) ON CONFLICT DO NOTHING; END IF;
  UPDATE public.eclub_store_puan_devirleri SET kullanildi_mi=true,guncellenme_at=now() WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_kaynak AND kullanildi_mi=false AND iptal_edildi=false;
END $f$;

DROP FUNCTION IF EXISTS public.getze_eclub_eczane_store_ozet(uuid);
DROP FUNCTION IF EXISTS public.get_eclub_eczane_store_ozet(uuid);
CREATE FUNCTION public.get_eclub_eczane_store_ozet(p_kisi_id uuid)
RETURNS TABLE(yayin_id uuid,urun_id uuid,urun_adi text,firma_id uuid,firma_adi text,eczane_id uuid,eczane_adi text,toplanan_puan integer,satis_sarti_tipi text,gizli_sart_katlama_orani integer,barem_tablosu jsonb,karsilik_puan integer,karsilik_tl numeric,uygun_adet integer,uygun_mal_fazlasi integer,hak_edilen_cek_tl numeric,katlanmis_cek_tl numeric,talep_durumu text,cek_kodu text,donem_kodu text,talep_penceresi_acik_mi boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_eczane uuid; v_ad text; v_d record; r record;
BEGIN
  SELECT ke.eczane_id,coalesce(em.eczane_adi,'Eczane') INTO v_eczane,v_ad FROM public.eclub_kisi_eczane ke JOIN public.eclub_eczaneler e ON e.eczane_id=ke.eczane_id LEFT JOIN public.eclub_eczane_master em ON em.gln=e.gln WHERE ke.kisi_id=p_kisi_id AND ke.aktif_mi=true LIMIT 1;
  IF v_eczane IS NULL THEN RETURN; END IF;
  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();
  FOR r IN SELECT y.yayin_id FROM public.yayin_yonetimi y JOIN public.v_yayin_kunye k ON k.yayin_id=y.yayin_id JOIN public.eclub_eczane_firma ef ON ef.eczane_id=v_eczane AND ef.firma_id=k.firma_id AND ef.aktif_mi=true WHERE y.barem_tablosu IS NOT NULL AND y.durum='yayinda' LOOP PERFORM public.eclub_store_onceki_deviri_hazirla(v_eczane,r.yayin_id,v_d.donem_kodu); END LOOP;
  RETURN QUERY WITH personel AS (SELECT DISTINCT kisi_id FROM public.eclub_kisi_eczane WHERE eczane_id=v_eczane AND aktif_mi=true), kazanc AS (
    SELECT kp.yayin_id,coalesce(sum(kp.puan),0)::int puan FROM public.eclub_kazanilan_puanlar kp JOIN personel p USING(kisi_id) WHERE kp.created_at>=v_d.donem_baslangic AND kp.created_at<v_d.donem_bitis_haric GROUP BY kp.yayin_id
  ), gelen AS (SELECT d.yayin_id,sum(d.puan)::int puan FROM public.eclub_store_puan_devirleri d WHERE d.eczane_id=v_eczane AND d.hedef_donem_kodu=v_d.donem_kodu AND d.kullanildi_mi=false AND d.iptal_edildi=false GROUP BY d.yayin_id)
  SELECT y.yayin_id,k.urun_id,coalesce(k.urun_adi,'Ürün')::text,k.firma_id,coalesce(f.firma_adi,'Firma')::text,v_eczane,v_ad,
    (coalesce(z.puan,0)+coalesce(g.puan,0))::int, y.satis_sarti_tipi,y.gizli_sart_katlama_orani,y.barem_tablosu,y.karsilik_puan,y.karsilik_tl,
    coalesce((SELECT (x->>'adet')::int FROM jsonb_array_elements(y.barem_tablosu) x WHERE coalesce(z.puan,0)+coalesce(g.puan,0)>=(x->>'min_puan')::int ORDER BY (x->>'min_puan')::int DESC LIMIT 1),0),
    coalesce((SELECT (x->>'mal_fazlasi')::int FROM jsonb_array_elements(y.barem_tablosu) x WHERE coalesce(z.puan,0)+coalesce(g.puan,0)>=(x->>'min_puan')::int ORDER BY (x->>'min_puan')::int DESC LIMIT 1),0),
    round(least(coalesce(z.puan,0)+coalesce(g.puan,0),(SELECT max((x->>'max_puan')::int) FROM jsonb_array_elements(y.barem_tablosu)x))*y.karsilik_tl/greatest(y.karsilik_puan,1),2),
    round(least(coalesce(z.puan,0)+coalesce(g.puan,0),(SELECT max((x->>'max_puan')::int) FROM jsonb_array_elements(y.barem_tablosu)x))*y.karsilik_tl/greatest(y.karsilik_puan,1)*(1+coalesce(y.gizli_sart_katlama_orani,0)/100.0),2),
    t.durum,t.cek_kodu,v_d.donem_kodu,v_d.talep_acik_mi
  FROM public.yayin_yonetimi y JOIN public.v_yayin_kunye k ON k.yayin_id=y.yayin_id LEFT JOIN public.firmalar f ON f.firma_id=k.firma_id LEFT JOIN kazanc z ON z.yayin_id=y.yayin_id LEFT JOIN gelen g ON g.yayin_id=y.yayin_id LEFT JOIN public.eclub_store_cek_talepleri t ON t.eczane_id=v_eczane AND t.yayin_id=y.yayin_id AND t.donem_kodu=v_d.donem_kodu AND t.durum<>'iptal'
  WHERE y.barem_tablosu IS NOT NULL AND y.durum='yayinda' AND public.eclub_store_barem_gecerli(y.barem_tablosu)
    AND EXISTS(SELECT 1 FROM public.eclub_eczane_firma ef WHERE ef.eczane_id=v_eczane AND ef.firma_id=k.firma_id AND ef.aktif_mi=true);
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_talebi_olustur(p_kisi_id uuid,p_yayin_id uuid,p_siparis_verilsin_mi boolean)
RETURNS TABLE(ok boolean,talep_id uuid,hata text,cek_tutari numeric,devreden_puan integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_eczane uuid; v_firma uuid; v_utt uuid; v_d record; v_y public.yayin_yonetimi%rowtype; v_bas numeric; v_gelen integer; v_toplam integer; v_min integer; v_max integer; v_kullan integer; v_devir integer; v_adet integer; v_mf integer; v_tl numeric; v_id uuid;
BEGIN
  SELECT ke.eczane_id INTO v_eczane FROM public.eclub_kisi_eczane ke JOIN public.eclub_kisiler k ON k.kisi_id=ke.kisi_id WHERE ke.kisi_id=p_kisi_id AND ke.aktif_mi=true AND lower(k.rol) IN ('eczaci','ikinci_eczaci','yardimci_eczaci','eczane_teknisyeni') LIMIT 1;
  IF v_eczane IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Aktif eczane üyeliği bulunamadı.',0::numeric,0; RETURN; END IF;
  SELECT * INTO v_y FROM public.yayin_yonetimi WHERE yayin_yonetimi.yayin_id=p_yayin_id FOR SHARE;
  SELECT k.firma_id INTO v_firma FROM public.v_yayin_kunye k WHERE k.yayin_id=p_yayin_id;
  IF v_firma IS NULL OR NOT public.eclub_store_barem_gecerli(v_y.barem_tablosu) THEN RETURN QUERY SELECT false,NULL::uuid,'Yayın veya barem ayarı geçersiz.',0::numeric,0; RETURN; END IF;
  SELECT ue.utt_id INTO v_utt FROM public.eclub_eczane_firma ef JOIN public.eclub_utt_eczane ue ON ue.eczane_firma_id=ef.id AND ue.aktif_mi=true JOIN public.kullanicilar u ON u.kullanici_id=ue.utt_id AND u.aktif_mi=true WHERE ef.eczane_id=v_eczane AND ef.firma_id=v_firma AND ef.aktif_mi=true ORDER BY ue.created_at DESC LIMIT 1;
  IF v_utt IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Bu yayın firması için aktif UTT bağlantısı bulunamadı.',0::numeric,0; RETURN; END IF;
  SELECT * INTO v_d FROM public.eclub_store_aktif_donem(); IF NOT v_d.talep_acik_mi THEN RETURN QUERY SELECT false,NULL::uuid,'Çek talep dönemi kapalıdır.',0::numeric,0; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('eclub-talep:'||v_eczane||':'||p_yayin_id||':'||v_d.donem_kodu,0));
  IF EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND donem_kodu=v_d.donem_kodu AND durum<>'iptal') THEN RETURN QUERY SELECT false,NULL::uuid,'Bu dönem için talep zaten oluşturuldu.',0::numeric,0; RETURN; END IF;
  PERFORM public.eclub_store_onceki_deviri_hazirla(v_eczane,p_yayin_id,v_d.donem_kodu);
  SELECT coalesce(sum(kp.puan),0) INTO v_bas FROM public.eclub_kazanilan_puanlar kp JOIN public.eclub_kisi_eczane ke ON ke.kisi_id=kp.kisi_id AND ke.eczane_id=v_eczane AND ke.aktif_mi=true WHERE kp.yayin_id=p_yayin_id AND kp.created_at>=v_d.donem_baslangic AND kp.created_at<v_d.donem_bitis_haric;
  PERFORM 1 FROM public.eclub_store_puan_devirleri WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false FOR UPDATE;
  SELECT coalesce(sum(puan),0)::int INTO v_gelen FROM public.eclub_store_puan_devirleri WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false;
  v_toplam:=v_bas::int+v_gelen; SELECT min((x->>'min_puan')::int),max((x->>'max_puan')::int) INTO v_min,v_max FROM jsonb_array_elements(v_y.barem_tablosu)x;
  IF v_toplam<v_min THEN RETURN QUERY SELECT false,NULL::uuid,('Minimum '||v_min||' puan gereklidir; bakiye sonraki döneme devreder.'),0::numeric,v_toplam; RETURN; END IF;
  IF v_y.satis_sarti_tipi='satis_sartli' AND NOT p_siparis_verilsin_mi THEN RETURN QUERY SELECT false,NULL::uuid,'Bu yayın için sipariş zorunludur.',0::numeric,0; RETURN; END IF;
  v_kullan:=least(v_toplam,v_max); v_devir:=greatest(v_toplam-v_max,0);
  SELECT (x->>'adet')::int,(x->>'mal_fazlasi')::int INTO v_adet,v_mf FROM jsonb_array_elements(v_y.barem_tablosu)x WHERE v_kullan BETWEEN (x->>'min_puan')::int AND (x->>'max_puan')::int ORDER BY (x->>'min_puan')::int DESC LIMIT 1;
  v_tl:=round(v_kullan*v_y.karsilik_tl/greatest(v_y.karsilik_puan,1),2); IF v_y.satis_sarti_tipi='serbest_siparis' AND p_siparis_verilsin_mi THEN v_tl:=round(v_tl*(1+coalesce(v_y.gizli_sart_katlama_orani,0)/100.0),2); END IF;
  INSERT INTO public.eclub_store_cek_talepleri(eczane_id,firma_id,yayin_id,talep_eden_kisi_id,toplanan_puan,talep_edilen_cek_tl,siparis_tipi,siparis_verildi_mi,siparis_adet,siparis_mal_fazlasi,durum,utt_id,devreden_puan,donem_kodu) VALUES(v_eczane,v_firma,p_yayin_id,p_kisi_id,v_kullan,v_tl,v_y.satis_sarti_tipi,p_siparis_verilsin_mi,CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_adet,0) ELSE 0 END,CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_mf,0) ELSE 0 END,'beklemede',v_utt,v_devir,v_d.donem_kodu) RETURNING eclub_store_cek_talepleri.talep_id INTO v_id;
  UPDATE public.eclub_store_puan_devirleri SET kullanildi_mi=true,kullanilan_talep_id=v_id,guncellenme_at=now() WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false;
  IF v_devir>0 THEN INSERT INTO public.eclub_store_puan_devirleri(eczane_id,yayin_id,kaynak_donem_kodu,hedef_donem_kodu,puan,kaynak_talep_id) SELECT v_eczane,p_yayin_id,v_d.donem_kodu,s.sonraki_donem_kodu,v_devir,v_id FROM public.eclub_store_donem_sinirlari(v_d.donem_kodu)s ON CONFLICT DO NOTHING; END IF;
  RETURN QUERY SELECT true,v_id,NULL::text,v_tl,v_devir;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_bm_onayina_gonder(p_utt_id uuid,p_talep_idler uuid[])
RETURNS TABLE(guncellenen_adet integer) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_bm uuid; v_adet integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.kullanicilar WHERE kullanici_id=p_utt_id AND aktif_mi=true AND lower(rol) IN ('utt','kd_utt')) THEN RAISE EXCEPTION 'UTT yetkisi doğrulanamadı'; END IF;
  IF EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri t WHERE t.talep_id=ANY(p_talep_idler) AND (t.utt_id IS DISTINCT FROM p_utt_id OR t.durum<>'beklemede')) THEN RAISE EXCEPTION 'Yetkisiz veya geçersiz talep seçimi'; END IF;
  SELECT b.kullanici_id INTO v_bm FROM public.kullanicilar u JOIN public.kullanicilar b ON b.firma_id=u.firma_id AND b.takim_id IS NOT DISTINCT FROM u.takim_id AND b.bolge_id IS NOT DISTINCT FROM u.bolge_id AND lower(b.rol)='bm' AND b.aktif_mi=true WHERE u.kullanici_id=p_utt_id AND u.aktif_mi=true;
  IF v_bm IS NULL THEN RAISE EXCEPTION 'Aktif BM ataması bulunamadı'; END IF;
  UPDATE public.eclub_store_cek_talepleri SET durum='bm_onayinda',bm_id=v_bm,guncellenme_at=now() WHERE talep_id=ANY(p_talep_idler) AND utt_id=p_utt_id AND durum='beklemede'; GET DIAGNOSTICS v_adet=ROW_COUNT; RETURN QUERY SELECT v_adet;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_bm_onayla(p_bm_id uuid,p_talep_idler uuid[])
RETURNS TABLE(guncellenen_adet integer) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_adet integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.kullanicilar WHERE kullanici_id=p_bm_id AND aktif_mi=true AND lower(rol)='bm') THEN RAISE EXCEPTION 'BM yetkisi doğrulanamadı'; END IF;
  IF EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri t WHERE t.talep_id=ANY(p_talep_idler) AND (t.bm_id IS DISTINCT FROM p_bm_id OR t.durum<>'bm_onayinda')) THEN RAISE EXCEPTION 'Yetkisiz veya geçersiz talep seçimi'; END IF;
  UPDATE public.eclub_store_cek_talepleri SET durum='onaylandi',bm_onay_tarihi=now(),guncellenme_at=now() WHERE talep_id=ANY(p_talep_idler) AND bm_id=p_bm_id AND durum='bm_onayinda'; GET DIAGNOSTICS v_adet=ROW_COUNT; RETURN QUERY SELECT v_adet;
END $f$;

DROP FUNCTION IF EXISTS public.eclub_store_admin_kod_teslim(uuid,text);
CREATE FUNCTION public.eclub_store_admin_kod_teslim(p_admin_id uuid,p_talep_id uuid,p_cek_kodu text)
RETURNS TABLE(ok boolean,hata text) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_t public.eclub_store_cek_talepleri%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.kullanicilar WHERE kullanici_id=p_admin_id AND lower(rol)='admin' AND aktif_mi=true) THEN RETURN QUERY SELECT false,'Admin yetkisi doğrulanamadı.'; RETURN; END IF;
  IF p_cek_kodu IS NULL OR length(trim(p_cek_kodu))<3 OR length(trim(p_cek_kodu))>200 THEN RETURN QUERY SELECT false,'Çek kodu geçersiz.'; RETURN; END IF;
  SELECT * INTO v_t FROM public.eclub_store_cek_talepleri WHERE talep_id=p_talep_id FOR UPDATE;
  IF v_t.durum<>'onaylandi' THEN RETURN QUERY SELECT false,'Talep BM tarafından onaylanmış değil.'; RETURN; END IF;
  UPDATE public.eclub_store_cek_talepleri SET durum='cek_kodlari_gonderildi',cek_kodu=trim(p_cek_kodu),cek_gonderim_tarihi=now(),guncellenme_at=now() WHERE talep_id=p_talep_id;
  INSERT INTO public.eclub_bildirimler(alici_kisi_id,gonderen_id,kayit_turu,kayit_id,mesaj,goruldu_mu)
    SELECT ke.kisi_id,p_admin_id,'cek',p_talep_id,'Migros hediye çekiniz teslim edildi.',false FROM public.eclub_kisi_eczane ke WHERE ke.eczane_id=v_t.eczane_id AND ke.aktif_mi=true;
  INSERT INTO public.eclub_store_cek_eposta_kuyrugu(talep_id,alici_eposta,alici_adi)
    SELECT p_talep_id,k.eposta,trim(k.ad||' '||k.soyad) FROM public.eclub_kisi_eczane ke JOIN public.eclub_kisiler k ON k.kisi_id=ke.kisi_id WHERE ke.eczane_id=v_t.eczane_id AND ke.aktif_mi=true AND lower(k.rol) IN ('eczaci','ikinci_eczaci','yardimci_eczaci') AND nullif(trim(k.eposta),'') IS NOT NULL ORDER BY CASE lower(k.rol) WHEN 'eczaci' THEN 0 WHEN 'ikinci_eczaci' THEN 1 ELSE 2 END LIMIT 1 ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT true,NULL::text;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_talebi_iptal(p_talep_id uuid,p_kisi_id uuid,p_admin_mi boolean DEFAULT false)
RETURNS TABLE(ok boolean,hata text) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_t public.eclub_store_cek_talepleri%rowtype;
BEGIN
  SELECT * INTO v_t FROM public.eclub_store_cek_talepleri WHERE talep_id=p_talep_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false,'Talep bulunamadı.'; RETURN; END IF;
  IF p_admin_mi AND NOT EXISTS(SELECT 1 FROM public.kullanicilar WHERE kullanici_id=p_kisi_id AND aktif_mi=true AND lower(rol)='admin') THEN RETURN QUERY SELECT false,'Admin yetkisi doğrulanamadı.'; RETURN; END IF;
  IF NOT p_admin_mi AND v_t.talep_eden_kisi_id<>p_kisi_id THEN RETURN QUERY SELECT false,'Yetkisiz işlem.'; RETURN; END IF;
  IF v_t.durum NOT IN ('beklemede','bm_onayinda','onaylandi') THEN RETURN QUERY SELECT false,'Bu talep artık iptal edilemez.'; RETURN; END IF;
  UPDATE public.eclub_store_cek_talepleri SET durum='iptal',guncellenme_at=now() WHERE talep_id=p_talep_id;
  UPDATE public.eclub_store_puan_devirleri SET kullanildi_mi=false,kullanilan_talep_id=NULL,guncellenme_at=now() WHERE kullanilan_talep_id=p_talep_id;
  UPDATE public.eclub_store_puan_devirleri SET iptal_edildi=true,guncellenme_at=now() WHERE kaynak_talep_id=p_talep_id;
  RETURN QUERY SELECT true,NULL::text;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_eposta_isi_al(p_lease_saniye integer DEFAULT 120)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE v_is public.eclub_store_cek_eposta_kuyrugu%rowtype; v_t public.eclub_store_cek_talepleri%rowtype;
BEGIN
  SELECT * INTO v_is FROM public.eclub_store_cek_eposta_kuyrugu
   WHERE (durum='bekliyor' OR (durum='isleniyor' AND lease_bitis<now()) OR (durum='hata' AND deneme_sayisi<max_deneme))
     AND sonraki_deneme_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.eclub_store_cek_eposta_kuyrugu SET durum='isleniyor',deneme_sayisi=deneme_sayisi+1,lease_bitis=now()+make_interval(secs=>greatest(30,p_lease_saniye)),guncellenme_at=now() WHERE is_id=v_is.is_id;
  SELECT * INTO v_t FROM public.eclub_store_cek_talepleri WHERE talep_id=v_is.talep_id;
  RETURN jsonb_build_object('is_id',v_is.is_id,'talep_id',v_is.talep_id,'alici_eposta',v_is.alici_eposta,'alici_adi',v_is.alici_adi,'cek_kodu',v_t.cek_kodu,'cek_tutari_tl',v_t.talep_edilen_cek_tl);
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_eposta_tamamla(p_is_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
  UPDATE public.eclub_store_cek_eposta_kuyrugu SET durum='tamamlandi',lease_bitis=NULL,son_hata_kodu=NULL,guncellenme_at=now() WHERE is_id=p_is_id AND durum='isleniyor';
$f$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_eposta_hata(p_is_id uuid,p_hata_kodu text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
  UPDATE public.eclub_store_cek_eposta_kuyrugu SET durum='hata',lease_bitis=NULL,son_hata_kodu=left(coalesce(p_hata_kodu,'EMAIL_ERROR'),80),sonraki_deneme_at=now()+make_interval(mins=>least(60,greatest(1,power(2,deneme_sayisi)::int))),guncellenme_at=now() WHERE is_id=p_is_id AND durum='isleniyor';
$f$;

ALTER TABLE public.eclub_store_cek_talepleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eclub_store_puan_devirleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eclub_store_cek_eposta_kuyrugu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eclub_store_cek_talepleri,public.eclub_store_puan_devirleri,public.eclub_store_cek_eposta_kuyrugu FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.eclub_store_cek_talepleri,public.eclub_store_puan_devirleri,public.eclub_store_cek_eposta_kuyrugu TO service_role;
REVOKE ALL ON FUNCTION public.get_eclub_eczane_store_ozet(uuid),public.eclub_store_cek_talebi_olustur(uuid,uuid,boolean),public.eclub_store_bm_onayina_gonder(uuid,uuid[]),public.eclub_store_bm_onayla(uuid,uuid[]),public.eclub_store_admin_kod_teslim(uuid,uuid,text),public.eclub_store_cek_talebi_iptal(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_eclub_eczane_store_ozet(uuid),public.eclub_store_cek_talebi_olustur(uuid,uuid,boolean),public.eclub_store_bm_onayina_gonder(uuid,uuid[]),public.eclub_store_bm_onayla(uuid,uuid[]),public.eclub_store_admin_kod_teslim(uuid,uuid,text),public.eclub_store_cek_talebi_iptal(uuid,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.eclub_store_donem_sinirlari(text),public.eclub_store_aktif_donem(timestamptz),public.eclub_store_barem_gecerli(jsonb),public.eclub_store_onceki_deviri_hazirla(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_donem_sinirlari(text),public.eclub_store_aktif_donem(timestamptz),public.eclub_store_barem_gecerli(jsonb),public.eclub_store_onceki_deviri_hazirla(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.eclub_store_cek_eposta_isi_al(integer),public.eclub_store_cek_eposta_tamamla(uuid),public.eclub_store_cek_eposta_hata(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_cek_eposta_isi_al(integer),public.eclub_store_cek_eposta_tamamla(uuid),public.eclub_store_cek_eposta_hata(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
