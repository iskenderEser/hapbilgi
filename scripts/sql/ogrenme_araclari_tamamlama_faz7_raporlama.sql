-- Öğrenme Araçları Genişletmesi — Faz 7 ortak raporlama kaynağı
-- Supabase SQL Editor'da kullanıcı tarafından bir kez çalıştırılır.

BEGIN;

-- Eczanem'in tarihsel yapısı yalnız toplam cevap puanını saklıyordu. Bundan
-- sonraki doğru/yanlış cevaplar soru bazında ve mevcut atomik RPC içinde yazılır.
CREATE TABLE IF NOT EXISTS public.eczanem_cevap_kayitlari (
  kayit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  izleme_id uuid NOT NULL REFERENCES public.eczanem_izleme_kayitlari(izleme_id) ON DELETE CASCADE,
  musteri_id uuid NOT NULL REFERENCES public.eczanem_musteriler(musteri_id) ON DELETE CASCADE,
  yayin_id uuid NOT NULL REFERENCES public.yayin_yonetimi(yayin_id) ON DELETE CASCADE,
  soru_index integer NOT NULL CHECK (soru_index >= 0),
  dogru_mu boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT eczanem_cevap_izleme_soru_uq UNIQUE (izleme_id, soru_index)
);

DO $cekirdek$
BEGIN
  IF to_regprocedure('public.eczanem_cevaplari_kaydet_cekirdek(uuid,uuid,jsonb)') IS NULL THEN
    IF to_regprocedure('public.eczanem_cevaplari_kaydet(uuid,uuid,jsonb)') IS NULL THEN
      RAISE EXCEPTION 'eczanem_cevaplari_kaydet(uuid,uuid,jsonb) bulunamadı.';
    END IF;
    ALTER FUNCTION public.eczanem_cevaplari_kaydet(uuid,uuid,jsonb)
      RENAME TO eczanem_cevaplari_kaydet_cekirdek;
  END IF;
END;
$cekirdek$;

CREATE OR REPLACE FUNCTION public.eczanem_cevaplari_kaydet(
  p_izleme_id uuid,
  p_musteri_id uuid,
  p_sonuclar jsonb
)
RETURNS TABLE (kazanilan_puan integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_yayin_id uuid;
  v_puan integer;
BEGIN
  SELECT sonuc.kazanilan_puan INTO v_puan
  FROM public.eczanem_cevaplari_kaydet_cekirdek(p_izleme_id,p_musteri_id,p_sonuclar) sonuc;

  SELECT i.yayin_id INTO STRICT v_yayin_id
  FROM public.eczanem_izleme_kayitlari i
  WHERE i.izleme_id=p_izleme_id AND i.musteri_id=p_musteri_id;

  INSERT INTO public.eczanem_cevap_kayitlari
    (izleme_id,musteri_id,yayin_id,soru_index,dogru_mu)
  SELECT p_izleme_id,p_musteri_id,v_yayin_id,
    (sonuc->>'soru_index')::integer,(sonuc->>'dogru_mu')::boolean
  FROM jsonb_array_elements(p_sonuclar) sonuc
  ON CONFLICT (izleme_id,soru_index) DO NOTHING;

  RETURN QUERY SELECT COALESCE(v_puan,0);
END;
$fonksiyon$;

ALTER TABLE public.eczanem_cevap_kayitlari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eczanem_cevap_kayitlari FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.eczanem_cevap_kayitlari TO service_role;
REVOKE ALL ON FUNCTION public.eczanem_cevaplari_kaydet_cekirdek(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eczanem_cevaplari_kaydet(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_cevaplari_kaydet_cekirdek(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_cevaplari_kaydet(uuid,uuid,jsonb) TO service_role;

-- Yayınlanan araç sayısı ve kayıtlı araç puanı kaynağı. Eski kolon sırası
-- korunur; eğitim ailesi kimliği sona eklenir.
CREATE OR REPLACE VIEW public.v_rapor_arac_turu_ozet AS
WITH utt AS (
  SELECT yayin_id,count(*)::integer baslatma,count(*) FILTER (WHERE tamamlandi_mi)::integer tamamlama
  FROM public.izleme_kayitlari GROUP BY yayin_id
), cc AS (
  SELECT yayin_id,count(*)::integer baslatma,count(*) FILTER (WHERE tamamlandi_mi)::integer tamamlama
  FROM public.cc_izleme_kayitlari GROUP BY yayin_id
), eclub AS (
  SELECT yayin_id,count(*)::integer baslatma,count(*) FILTER (WHERE tamamlandi_mi)::integer tamamlama
  FROM public.eclub_izleme_kayitlari GROUP BY yayin_id
), eczanem AS (
  SELECT yayin_id,count(*)::integer baslatma,count(*) FILTER (WHERE tamamlandi_mi)::integer tamamlama
  FROM public.eczanem_izleme_kayitlari GROUP BY yayin_id
)
SELECT y.yayin_id,y.yayin_tarihi,y.durum,y.firma_id,y.takim_id,y.uretici_id,
  y.icerik_turu,y.arac_turu,COALESCE(y.ogrenme_araci_puani,0)::integer arac_puani,
  COALESCE(utt.baslatma,0) utt_baslatma,COALESCE(utt.tamamlama,0) utt_tamamlama,
  COALESCE(cc.baslatma,0) bm_baslatma,COALESCE(cc.tamamlama,0) bm_tamamlama,
  COALESCE(eclub.baslatma,0) eclub_baslatma,COALESCE(eclub.tamamlama,0) eclub_tamamlama,
  COALESCE(eczanem.baslatma,0) eczanem_baslatma,COALESCE(eczanem.tamamlama,0) eczanem_tamamlama,
  COALESCE(utt.baslatma,0)+COALESCE(cc.baslatma,0)+COALESCE(eclub.baslatma,0)+COALESCE(eczanem.baslatma,0) toplam_baslatma,
  COALESCE(utt.tamamlama,0)+COALESCE(cc.tamamlama,0)+COALESCE(eclub.tamamlama,0)+COALESCE(eczanem.tamamlama,0) toplam_tamamlama,
  ky.talep_id,ky.talep_no
FROM public.v_yayin_detay y
JOIN public.v_yayin_kunye ky ON ky.yayin_id=y.yayin_id
LEFT JOIN utt ON utt.yayin_id=y.yayin_id
LEFT JOIN cc ON cc.yayin_id=y.yayin_id
LEFT JOIN eclub ON eclub.yayin_id=y.yayin_id
LEFT JOIN eczanem ON eczanem.yayin_id=y.yayin_id;

-- Dönem raporları bu olay defterini olay_tarihi üzerinden süzer. `adet` davranış
-- sayısını, `puan` yalnız gerçek kazanım/kaybı taşır; kayıtlı araç puanı burada yoktur.
CREATE OR REPLACE VIEW public.v_rapor_arac_turu_olaylari AS
WITH olay AS (
  SELECT i.yayin_id,i.izleme_baslangic olay_tarihi,'baslatma'::text olay_turu,
    lower(k.rol) rol,i.kullanici_id aktor_id,1::bigint adet,0::bigint puan
  FROM public.izleme_kayitlari i JOIN public.kullanicilar k ON k.kullanici_id=i.kullanici_id
  UNION ALL SELECT i.yayin_id,i.izleme_bitis,'tamamlama',lower(k.rol),i.kullanici_id,1,0
  FROM public.izleme_kayitlari i JOIN public.kullanicilar k ON k.kullanici_id=i.kullanici_id WHERE i.tamamlandi_mi=true
  UNION ALL SELECT i.yayin_id,i.izleme_baslangic,'baslatma','bm',i.bm_id,1,0 FROM public.cc_izleme_kayitlari i
  UNION ALL SELECT i.yayin_id,i.izleme_bitis,'tamamlama','bm',i.bm_id,1,0 FROM public.cc_izleme_kayitlari i WHERE i.tamamlandi_mi=true
  UNION ALL SELECT i.yayin_id,i.izleme_baslangic,'baslatma',lower(k.rol),i.kisi_id,1,0
  FROM public.eclub_izleme_kayitlari i JOIN public.eclub_kisiler k ON k.kisi_id=i.kisi_id
  UNION ALL SELECT i.yayin_id,i.izleme_bitis,'tamamlama',lower(k.rol),i.kisi_id,1,0
  FROM public.eclub_izleme_kayitlari i JOIN public.eclub_kisiler k ON k.kisi_id=i.kisi_id WHERE i.tamamlandi_mi=true
  UNION ALL SELECT i.yayin_id,i.izleme_baslangic,'baslatma','musteri',i.musteri_id,1,0 FROM public.eczanem_izleme_kayitlari i
  UNION ALL SELECT i.yayin_id,i.izleme_bitis,'tamamlama','musteri',i.musteri_id,1,0 FROM public.eczanem_izleme_kayitlari i WHERE i.tamamlandi_mi=true

  UNION ALL SELECT i.yayin_id,c.created_at,CASE WHEN c.dogru_mu THEN 'dogru_cevap' ELSE 'yanlis_cevap' END,lower(k.rol),c.kullanici_id,1,0
  FROM public.soru_cevaplari c JOIN public.izleme_kayitlari i ON i.izleme_id=c.izleme_id JOIN public.kullanicilar k ON k.kullanici_id=c.kullanici_id
  UNION ALL SELECT p.yayin_id,p.created_at,'dogru_cevap','bm',p.bm_id,1,0 FROM public.cc_kazanilan_puanlar p WHERE p.puan_turu='cevaplama'
  UNION ALL SELECT p.yayin_id,p.created_at,'yanlis_cevap','bm',p.bm_id,1,0 FROM public.cc_yanlis_cevap_kayitlari p
  UNION ALL SELECT p.yayin_id,p.created_at,'dogru_cevap',lower(k.rol),p.kisi_id,1,0 FROM public.eclub_dogru_cevap_kayitlari p JOIN public.eclub_kisiler k ON k.kisi_id=p.kisi_id
  UNION ALL SELECT p.yayin_id,p.created_at,'yanlis_cevap',lower(k.rol),p.kisi_id,1,0 FROM public.eclub_yanlis_cevap_kayitlari p JOIN public.eclub_kisiler k ON k.kisi_id=p.kisi_id
  UNION ALL SELECT p.yayin_id,p.created_at,CASE WHEN p.dogru_mu THEN 'dogru_cevap' ELSE 'yanlis_cevap' END,'musteri',p.musteri_id,1,0 FROM public.eczanem_cevap_kayitlari p

  UNION ALL SELECT p.yayin_id,p.created_at,'kazanilan_puan',lower(k.rol),p.kullanici_id,0,p.puan FROM public.kazanilan_puanlar p JOIN public.kullanicilar k ON k.kullanici_id=p.kullanici_id
  UNION ALL SELECT p.yayin_id,p.created_at,'kazanilan_puan','bm',p.bm_id,0,p.puan FROM public.cc_kazanilan_puanlar p
  UNION ALL SELECT p.yayin_id,p.created_at,'kazanilan_puan',lower(k.rol),p.kisi_id,0,p.puan FROM public.eclub_kazanilan_puanlar p JOIN public.eclub_kisiler k ON k.kisi_id=p.kisi_id
  UNION ALL SELECT i.yayin_id,p.created_at,'kazanilan_puan','musteri',p.musteri_id,0,p.puan FROM public.eczanem_puan_kayitlari p JOIN public.eczanem_izleme_kayitlari i ON i.izleme_id=p.izleme_id

  UNION ALL SELECT p.yayin_id,p.created_at,'kaybedilen_puan',lower(k.rol),p.kullanici_id,0,p.kaybedilen_puan FROM public.ileri_sarma_kayitlari p JOIN public.kullanicilar k ON k.kullanici_id=p.kullanici_id
  UNION ALL SELECT p.yayin_id,p.created_at,'kaybedilen_puan',lower(k.rol),p.kullanici_id,0,p.kaybedilen_puan FROM public.yanlis_cevap_kayitlari p JOIN public.kullanicilar k ON k.kullanici_id=p.kullanici_id
  UNION ALL SELECT p.yayin_id,p.created_at,'kaybedilen_puan',lower(k.rol),p.kullanici_id,0,p.kaybedilen_puan FROM public.oneri_kayip_kayitlari p JOIN public.kullanicilar k ON k.kullanici_id=p.kullanici_id
  UNION ALL SELECT p.yayin_id,p.created_at,'kaybedilen_puan','bm',p.bm_id,0,p.kaybedilen_puan FROM public.cc_ileri_sarma_kayitlari p
  UNION ALL SELECT p.yayin_id,p.created_at,'kaybedilen_puan','bm',p.bm_id,0,p.kaybedilen_puan FROM public.cc_yanlis_cevap_kayitlari p
  UNION ALL SELECT p.yayin_id,p.created_at,'kaybedilen_puan','bm',p.kullanici_id,0,p.kaybedilen_puan FROM public.challenge_kayip_kayitlari p
  UNION ALL SELECT p.yayin_id,p.created_at,'kaybedilen_puan',lower(k.rol),p.kisi_id,0,p.kaybedilen_puan FROM public.eclub_ileri_sarma_kayitlari p JOIN public.eclub_kisiler k ON k.kisi_id=p.kisi_id

  UNION ALL SELECT o.yayin_id,COALESCE(o.created_at,o.oneri_baslangic),'oneri_gonderildi',lower(k.rol),o.kullanici_id,1,0 FROM public.oneri_kayitlari o JOIN public.kullanicilar k ON k.kullanici_id=o.kullanici_id
  UNION ALL SELECT o.yayin_id,i.izleme_bitis,'oneri_tamamlandi',lower(k.rol),o.kullanici_id,1,0 FROM public.oneri_kayitlari o JOIN public.izleme_kayitlari i ON i.oneri_id=o.oneri_id AND i.tamamlandi_mi=true JOIN public.kullanicilar k ON k.kullanici_id=o.kullanici_id
  UNION ALL SELECT c.yayin_id,c.created_at,'challenge_gonderildi','bm',c.gonderen_id,1,0 FROM public.challenge_kayitlari c
  UNION ALL SELECT c.yayin_id,i.izleme_bitis,'challenge_tamamlandi','bm',c.gonderen_id,1,0 FROM public.challenge_kayitlari c JOIN public.cc_izleme_kayitlari i ON i.challenge_id=c.challenge_id AND i.tamamlandi_mi=true
  UNION ALL SELECT o.yayin_id,COALESCE(o.created_at,o.oneri_baslangic),'eclub_dagitim',COALESCE(lower(k.rol),'utt'),o.oneren_id,1,0 FROM public.eclub_oneri_kayitlari o LEFT JOIN public.kullanicilar k ON k.kullanici_id=o.oneren_id
  UNION ALL SELECT o.yayin_id,i.izleme_bitis,'eclub_dagitim_tamamlandi',COALESCE(lower(k.rol),'utt'),o.oneren_id,1,0 FROM public.eclub_oneri_kayitlari o JOIN public.eclub_izleme_kayitlari i ON i.oneri_id=o.oneri_id AND i.tamamlandi_mi=true LEFT JOIN public.kullanicilar k ON k.kullanici_id=o.oneren_id
  UNION ALL SELECT g.yayin_id,g.created_at,'eczanem_dagitim',COALESCE(lower(k.rol),'eczaci'),g.gonderen_kisi_id,1,0 FROM public.eczanem_gonderimler g LEFT JOIN public.eclub_kisiler k ON k.kisi_id=g.gonderen_kisi_id
  UNION ALL SELECT g.yayin_id,i.izleme_bitis,'eczanem_dagitim_tamamlandi',COALESCE(lower(k.rol),'eczaci'),g.gonderen_kisi_id,1,0 FROM public.eczanem_gonderimler g JOIN public.eczanem_izleme_kayitlari i ON i.gonderim_id=g.gonderim_id AND i.tamamlandi_mi=true LEFT JOIN public.eclub_kisiler k ON k.kisi_id=g.gonderen_kisi_id
)
SELECT o.yayin_id,o.olay_tarihi,o.olay_turu,o.rol,o.aktor_id,o.adet,o.puan,
  ky.talep_id,ky.talep_no,ky.firma_id,ky.takim_id,ky.uretici_id,ky.arac_turu
FROM olay o JOIN public.v_yayin_kunye ky ON ky.yayin_id=o.yayin_id
WHERE o.olay_tarihi IS NOT NULL;

REVOKE ALL ON public.v_rapor_arac_turu_ozet,public.v_rapor_arac_turu_olaylari FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_rapor_arac_turu_ozet,public.v_rapor_arac_turu_olaylari TO service_role;

COMMIT;

SELECT
  to_regclass('public.eczanem_cevap_kayitlari') IS NOT NULL AS eczanem_cevap_detayi_kuruldu,
  to_regclass('public.v_rapor_arac_turu_olaylari') IS NOT NULL AS ortak_rapor_olaylari_kuruldu,
  to_regprocedure('public.eczanem_cevaplari_kaydet(uuid,uuid,jsonb)') IS NOT NULL AS eczanem_cevap_rpc_sarildi;
