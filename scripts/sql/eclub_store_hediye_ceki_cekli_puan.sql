-- Migration: E-Club Hediye Çeki Hesaplarının Yalnız Çekli Puan Kullanması (Faz 8)
-- Çeksiz puanlar barem hesabına girmez, hediye çekine dönüşmez, devretmez ve doğrudan talep açılamaz.

BEGIN;

CREATE OR REPLACE FUNCTION public.eclub_store_onceki_deviri_hazirla(p_eczane_id uuid,p_yayin_id uuid,p_hedef_donem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE
  v_kaynak text;
  v_bas timestamptz;
  v_bit timestamptz;
  v_min integer;
  v_max integer;
  v_kazanc integer;
  v_gelen integer;
  v_toplam integer;
  v_devir integer:=0;
  v_cekli boolean;
BEGIN
  SELECT d.kaynak_donem_kodu INTO v_kaynak FROM (SELECT CASE WHEN substring(p_hedef_donem,7,1)::int=1 THEN (substring(p_hedef_donem,1,4)::int-1)::text||'-P6' ELSE substring(p_hedef_donem,1,4)||'-P'||(substring(p_hedef_donem,7,1)::int-1)::text END kaynak_donem_kodu) d;
  PERFORM pg_advisory_xact_lock(hashtextextended('eclub-devir:'||p_eczane_id||':'||p_yayin_id||':'||v_kaynak,0));
  IF EXISTS(SELECT 1 FROM public.eclub_store_puan_devirleri WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND kaynak_donem_kodu=v_kaynak AND iptal_edildi=false) OR
     EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri WHERE eczane_id=p_eczane_id AND yayin_id=p_yayin_id AND donem_kodu=v_kaynak AND durum<>'iptal') THEN RETURN; END IF;

  -- Çeksiz puan yayınları için dönem devri hesaplanmaz ve devir kaydı oluşturulmaz.
  SELECT y.cek_karsiligi_var_mi INTO v_cekli FROM public.yayin_yonetimi y WHERE y.yayin_id=p_yayin_id;
  IF coalesce(v_cekli, true) = false THEN RETURN; END IF;

  SELECT baslangic,bitis_haric INTO v_bas,v_bit FROM public.eclub_store_donem_sinirlari(v_kaynak);
  SELECT min((x->>'min_puan')::int),max((x->>'max_puan')::int) INTO v_min,v_max FROM public.yayin_yonetimi y, jsonb_array_elements(y.barem_tablosu) x WHERE y.yayin_id=p_yayin_id;
  IF v_min IS NULL THEN RETURN; END IF;

  -- Yalnız çekli puanlar toplanır
  SELECT coalesce(sum(kp.puan),0)::int INTO v_kazanc
  FROM public.eclub_kazanilan_puanlar kp
  JOIN public.eclub_kisi_eczane ke ON ke.kisi_id=kp.kisi_id AND ke.eczane_id=p_eczane_id AND ke.aktif_mi=true
  WHERE kp.yayin_id=p_yayin_id
    AND kp.created_at>=v_bas
    AND kp.created_at<v_bit
    AND kp.cek_karsiligi_var_mi = true;

  SELECT coalesce(sum(puan),0)::int INTO v_gelen
  FROM public.eclub_store_puan_devirleri
  WHERE eczane_id=p_eczane_id
    AND yayin_id=p_yayin_id
    AND hedef_donem_kodu=v_kaynak
    AND kullanildi_mi=false
    AND iptal_edildi=false;

  v_toplam:=v_kazanc+v_gelen;
  IF v_toplam>0 AND v_toplam<v_min THEN v_devir:=v_toplam;
  ELSIF v_toplam>v_max THEN v_devir:=v_toplam-v_max; END IF;

  IF v_devir>0 THEN
    INSERT INTO public.eclub_store_puan_devirleri(eczane_id,yayin_id,kaynak_donem_kodu,hedef_donem_kodu,puan)
    VALUES(p_eczane_id,p_yayin_id,v_kaynak,p_hedef_donem,v_devir)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.eclub_store_puan_devirleri
  SET kullanildi_mi=true,guncellenme_at=now()
  WHERE eczane_id=p_eczane_id
    AND yayin_id=p_yayin_id
    AND hedef_donem_kodu=v_kaynak
    AND kullanildi_mi=false
    AND iptal_edildi=false;
END $f$;

DROP FUNCTION IF EXISTS public.get_eclub_eczane_store_ozet(uuid);
CREATE FUNCTION public.get_eclub_eczane_store_ozet(p_kisi_id uuid)
RETURNS TABLE(
  yayin_id uuid,
  urun_id uuid,
  urun_adi text,
  firma_id uuid,
  firma_adi text,
  eczane_id uuid,
  eczane_adi text,
  toplanan_puan integer,
  satis_sarti_tipi text,
  gizli_sart_katlama_orani integer,
  barem_tablosu jsonb,
  karsilik_puan integer,
  karsilik_tl numeric,
  uygun_adet integer,
  uygun_mal_fazlasi integer,
  hak_edilen_cek_tl numeric,
  katlanmis_cek_tl numeric,
  talep_durumu text,
  cek_kodu text,
  donem_kodu text,
  talep_penceresi_acik_mi boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE
  v_eczane uuid;
  v_ad text;
  v_d record;
  r record;
BEGIN
  SELECT ke.eczane_id,coalesce(em.eczane_adi,'Eczane') INTO v_eczane,v_ad
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_eczaneler e ON e.eczane_id=ke.eczane_id
  LEFT JOIN public.eclub_eczane_master em ON em.gln=e.gln
  WHERE ke.kisi_id=p_kisi_id AND ke.aktif_mi=true
  LIMIT 1;

  IF v_eczane IS NULL THEN RETURN; END IF;
  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();

  -- Yalnız çek karşılığı olan yayınlar için devir hazırlanır
  FOR r IN
    SELECT y.yayin_id
    FROM public.yayin_yonetimi y
    JOIN public.v_yayin_kunye k ON k.yayin_id=y.yayin_id
    JOIN public.eclub_eczane_firma ef ON ef.eczane_id=v_eczane AND ef.firma_id=k.firma_id AND ef.aktif_mi=true
    WHERE y.barem_tablosu IS NOT NULL
      AND y.durum='yayinda'
      AND y.cek_karsiligi_var_mi = true
  LOOP
    PERFORM public.eclub_store_onceki_deviri_hazirla(v_eczane,r.yayin_id,v_d.donem_kodu);
  END LOOP;

  RETURN QUERY WITH personel AS (
    SELECT DISTINCT kisi_id
    FROM public.eclub_kisi_eczane
    WHERE eczane_id=v_eczane AND aktif_mi=true
  ), kazanc AS (
    SELECT kp.yayin_id,coalesce(sum(kp.puan),0)::int puan
    FROM public.eclub_kazanilan_puanlar kp
    JOIN personel p USING(kisi_id)
    WHERE kp.created_at>=v_d.donem_baslangic
      AND kp.created_at<v_d.donem_bitis_haric
      AND kp.cek_karsiligi_var_mi = true
    GROUP BY kp.yayin_id
  ), gelen AS (
    SELECT d.yayin_id,sum(d.puan)::int puan
    FROM public.eclub_store_puan_devirleri d
    WHERE d.eczane_id=v_eczane
      AND d.hedef_donem_kodu=v_d.donem_kodu
      AND d.kullanildi_mi=false
      AND d.iptal_edildi=false
    GROUP BY d.yayin_id
  )
  SELECT
    y.yayin_id,
    k.urun_id,
    coalesce(k.urun_adi,'Ürün')::text,
    k.firma_id,
    coalesce(f.firma_adi,'Firma')::text,
    v_eczane,
    v_ad,
    (coalesce(z.puan,0)+coalesce(g.puan,0))::int,
    y.satis_sarti_tipi,
    y.gizli_sart_katlama_orani,
    y.barem_tablosu,
    y.karsilik_puan,
    y.karsilik_tl,
    coalesce((SELECT (x->>'adet')::int FROM jsonb_array_elements(y.barem_tablosu) x WHERE coalesce(z.puan,0)+coalesce(g.puan,0)>=(x->>'min_puan')::int ORDER BY (x->>'min_puan')::int DESC LIMIT 1),0),
    coalesce((SELECT (x->>'mal_fazlasi')::int FROM jsonb_array_elements(y.barem_tablosu) x WHERE coalesce(z.puan,0)+coalesce(g.puan,0)>=(x->>'min_puan')::int ORDER BY (x->>'min_puan')::int DESC LIMIT 1),0),
    round(least(coalesce(z.puan,0)+coalesce(g.puan,0),(SELECT max((x->>'max_puan')::int) FROM jsonb_array_elements(y.barem_tablosu)x))*y.karsilik_tl/greatest(y.karsilik_puan,1),2),
    round(least(coalesce(z.puan,0)+coalesce(g.puan,0),(SELECT max((x->>'max_puan')::int) FROM jsonb_array_elements(y.barem_tablosu)x))*y.karsilik_tl/greatest(y.karsilik_puan,1)*(1+coalesce(y.gizli_sart_katlama_orani,0)/100.0),2),
    t.durum,
    t.cek_kodu,
    v_d.donem_kodu,
    v_d.talep_acik_mi
  FROM public.yayin_yonetimi y
  JOIN public.v_yayin_kunye k ON k.yayin_id=y.yayin_id
  LEFT JOIN public.firmalar f ON f.firma_id=k.firma_id
  LEFT JOIN kazanc z ON z.yayin_id=y.yayin_id
  LEFT JOIN gelen g ON g.yayin_id=y.yayin_id
  LEFT JOIN public.eclub_store_cek_talepleri t ON t.eczane_id=v_eczane AND t.yayin_id=y.yayin_id AND t.donem_kodu=v_d.donem_kodu AND t.durum<>'iptal'
  WHERE y.barem_tablosu IS NOT NULL
    AND y.durum='yayinda'
    AND public.eclub_store_barem_gecerli(y.barem_tablosu)
    AND y.cek_karsiligi_var_mi = true
    AND EXISTS(SELECT 1 FROM public.eclub_eczane_firma ef WHERE ef.eczane_id=v_eczane AND ef.firma_id=k.firma_id AND ef.aktif_mi=true);
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_talebi_olustur(p_kisi_id uuid,p_yayin_id uuid,p_siparis_verilsin_mi boolean)
RETURNS TABLE(ok boolean,talep_id uuid,hata text,cek_tutari numeric,devreden_puan integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $f$
DECLARE
  v_eczane uuid;
  v_firma uuid;
  v_utt uuid;
  v_d record;
  v_y public.yayin_yonetimi%rowtype;
  v_bas numeric;
  v_gelen integer;
  v_toplam integer;
  v_min integer;
  v_max integer;
  v_kullan integer;
  v_devir integer;
  v_adet integer;
  v_mf integer;
  v_tl numeric;
  v_id uuid;
BEGIN
  SELECT ke.eczane_id INTO v_eczane
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler k ON k.kisi_id=ke.kisi_id
  WHERE ke.kisi_id=p_kisi_id AND ke.aktif_mi=true AND lower(k.rol) IN ('eczaci','ikinci_eczaci','yardimci_eczaci','eczane_teknisyeni')
  LIMIT 1;

  IF v_eczane IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Aktif eczane üyeliği bulunamadı.',0::numeric,0; RETURN; END IF;

  SELECT * INTO v_y FROM public.yayin_yonetimi WHERE yayin_yonetimi.yayin_id=p_yayin_id FOR SHARE;
  IF v_y.yayin_id IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Yayın bulunamadı.',0::numeric,0; RETURN; END IF;

  -- Çeksiz puan yayınları için doğrudan RPC çağrısı ile hediye çeki talebi açılamaz
  IF v_y.cek_karsiligi_var_mi = false THEN
    RETURN QUERY SELECT false,NULL::uuid,'Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz.',0::numeric,0;
    RETURN;
  END IF;

  SELECT k.firma_id INTO v_firma FROM public.v_yayin_kunye k WHERE k.yayin_id=p_yayin_id;
  IF v_firma IS NULL OR NOT public.eclub_store_barem_gecerli(v_y.barem_tablosu) THEN RETURN QUERY SELECT false,NULL::uuid,'Yayın veya barem ayarı geçersiz.',0::numeric,0; RETURN; END IF;

  SELECT ue.utt_id INTO v_utt
  FROM public.eclub_eczane_firma ef
  JOIN public.eclub_utt_eczane ue ON ue.eczane_firma_id=ef.id AND ue.aktif_mi=true
  JOIN public.kullanicilar u ON u.kullanici_id=ue.utt_id AND u.aktif_mi=true
  WHERE ef.eczane_id=v_eczane AND ef.firma_id=v_firma AND ef.aktif_mi=true
  ORDER BY ue.created_at DESC
  LIMIT 1;

  IF v_utt IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,'Bu yayın firması için aktif UTT bağlantısı bulunamadı.',0::numeric,0; RETURN; END IF;

  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();
  IF NOT v_d.talep_acik_mi THEN RETURN QUERY SELECT false,NULL::uuid,'Çek talep dönemi kapalıdır.',0::numeric,0; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('eclub-talep:'||v_eczane||':'||p_yayin_id||':'||v_d.donem_kodu,0));
  IF EXISTS(SELECT 1 FROM public.eclub_store_cek_talepleri WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND donem_kodu=v_d.donem_kodu AND durum<>'iptal') THEN
    RETURN QUERY SELECT false,NULL::uuid,'Bu dönem için talep zaten oluşturuldu.',0::numeric,0;
    RETURN;
  END IF;

  PERFORM public.eclub_store_onceki_deviri_hazirla(v_eczane,p_yayin_id,v_d.donem_kodu);

  -- Yalnız çekli puanlar toplanır
  SELECT coalesce(sum(kp.puan),0) INTO v_bas
  FROM public.eclub_kazanilan_puanlar kp
  JOIN public.eclub_kisi_eczane ke ON ke.kisi_id=kp.kisi_id AND ke.eczane_id=v_eczane AND ke.aktif_mi=true
  WHERE kp.yayin_id=p_yayin_id
    AND kp.created_at>=v_d.donem_baslangic
    AND kp.created_at<v_d.donem_bitis_haric
    AND kp.cek_karsiligi_var_mi = true;

  PERFORM 1 FROM public.eclub_store_puan_devirleri
  WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false FOR UPDATE;

  SELECT coalesce(sum(puan),0)::int INTO v_gelen
  FROM public.eclub_store_puan_devirleri
  WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false;

  v_toplam:=v_bas::int+v_gelen;
  SELECT min((x->>'min_puan')::int),max((x->>'max_puan')::int) INTO v_min,v_max
  FROM jsonb_array_elements(v_y.barem_tablosu) x;

  IF v_toplam<v_min THEN
    RETURN QUERY SELECT false,NULL::uuid,('Minimum '||v_min||' puan gereklidir; bakiye sonraki döneme devreder.'),0::numeric,v_toplam;
    RETURN;
  END IF;

  IF v_y.satis_sarti_tipi='satis_sartli' AND NOT p_siparis_verilsin_mi THEN
    RETURN QUERY SELECT false,NULL::uuid,'Bu yayın için sipariş zorunludur.',0::numeric,0;
    RETURN;
  END IF;

  v_kullan:=least(v_toplam,v_max);
  v_devir:=greatest(v_toplam-v_max,0);

  SELECT (x->>'adet')::int,(x->>'mal_fazlasi')::int INTO v_adet,v_mf
  FROM jsonb_array_elements(v_y.barem_tablosu) x
  WHERE v_kullan BETWEEN (x->>'min_puan')::int AND (x->>'max_puan')::int
  ORDER BY (x->>'min_puan')::int DESC
  LIMIT 1;

  v_tl:=round(v_kullan*v_y.karsilik_tl/greatest(v_y.karsilik_puan,1),2);
  IF v_y.satis_sarti_tipi='serbest_siparis' AND p_siparis_verilsin_mi THEN
    v_tl:=round(v_tl*(1+coalesce(v_y.gizli_sart_katlama_orani,0)/100.0),2);
  END IF;

  INSERT INTO public.eclub_store_cek_talepleri(
    eczane_id,firma_id,yayin_id,talep_eden_kisi_id,toplanan_puan,talep_edilen_cek_tl,
    siparis_tipi,siparis_verildi_mi,siparis_adet,siparis_mal_fazlasi,durum,utt_id,devreden_puan,donem_kodu
  ) VALUES (
    v_eczane,v_firma,p_yayin_id,p_kisi_id,v_kullan,v_tl,
    v_y.satis_sarti_tipi,p_siparis_verilsin_mi,
    CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_adet,0) ELSE 0 END,
    CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_mf,0) ELSE 0 END,
    'beklemede',v_utt,v_devir,v_d.donem_kodu
  ) RETURNING eclub_store_cek_talepleri.talep_id INTO v_id;

  UPDATE public.eclub_store_puan_devirleri
  SET kullanildi_mi=true,kullanilan_talep_id=v_id,guncellenme_at=now()
  WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND hedef_donem_kodu=v_d.donem_kodu AND kullanildi_mi=false AND iptal_edildi=false;

  IF v_devir>0 THEN
    INSERT INTO public.eclub_store_puan_devirleri(eczane_id,yayin_id,kaynak_donem_kodu,hedef_donem_kodu,puan,kaynak_talep_id)
    SELECT v_eczane,p_yayin_id,v_d.donem_kodu,s.sonraki_donem_kodu,v_devir,v_id
    FROM public.eclub_store_donem_sinirlari(v_d.donem_kodu) s
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT true,v_id,NULL::text,v_tl,v_devir;
END $f$;

REVOKE ALL ON FUNCTION public.get_eclub_eczane_store_ozet(uuid),public.eclub_store_cek_talebi_olustur(uuid,uuid,boolean),public.eclub_store_onceki_deviri_hazirla(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_eclub_eczane_store_ozet(uuid),public.eclub_store_cek_talebi_olustur(uuid,uuid,boolean),public.eclub_store_onceki_deviri_hazirla(uuid,uuid,text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
