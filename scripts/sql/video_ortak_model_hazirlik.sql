-- Video ortak model geçişi / 1. adım
-- Bu dosya uygulama deployundan ÖNCE bir kez çalıştırılır.
-- Canlı DB işlemini yalnız kullanıcı Supabase SQL Editor'da yapar.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-video-ortak-model-v1', 1));

ALTER TABLE public.ogrenme_araci_video_yukleme_oturumlari
  ADD COLUMN IF NOT EXISTS arac_id uuid;

DO $blok$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ogrenme_araci_video_yukleme_oturumlari_arac_id_fk'
      AND conrelid = 'public.ogrenme_araci_video_yukleme_oturumlari'::regclass
  ) THEN
    ALTER TABLE public.ogrenme_araci_video_yukleme_oturumlari
      ADD CONSTRAINT ogrenme_araci_video_yukleme_oturumlari_arac_id_fk
      FOREIGN KEY (arac_id) REFERENCES public.ogrenme_araclari(arac_id) ON DELETE CASCADE;
  END IF;
END
$blok$;

-- Faz-2'nin oluşturduğu ortak kayıtları bütün aktif bağlantılara taşı.
UPDATE public.uretim_gorevleri g
SET arac_id = a.arac_id
FROM public.ogrenme_araclari a
WHERE g.asama = 'video' AND g.video_id = a.legacy_video_id AND g.arac_id IS NULL;

UPDATE public.soru_setleri ss
SET arac_durum_id = ad.arac_durum_id
FROM public.ogrenme_araci_durumu ad
WHERE ss.video_durum_id = ad.legacy_video_durum_id AND ss.arac_durum_id IS NULL;

UPDATE public.yayin_yonetimi y
SET arac_durum_id = ss.arac_durum_id
FROM public.soru_seti_durumu ssd
JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
WHERE y.soru_seti_durum_id = ssd.soru_seti_durum_id AND y.arac_durum_id IS NULL;

UPDATE public.ogrenme_araci_video_yukleme_oturumlari o
SET arac_id = a.arac_id
FROM public.ogrenme_araclari a
WHERE o.video_id = a.legacy_video_id AND o.arac_id IS NULL;

UPDATE public.ogrenme_araclari a
SET metadata_dogrulandi = TRUE,
    metadata = COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object('video_dogrulandi', TRUE),
    updated_at = now()
WHERE a.arac_turu = 'video'
  AND nullif(btrim(a.dosya_yolu), '') IS NOT NULL
  AND COALESCE(a.sure_saniye, 0) > 0
  AND a.metadata_dogrulandi IS NOT TRUE;

-- Eksik eşleşme varsa hiçbir şema değişikliği kalmadan dur.
DO $blok$
DECLARE v_sayi integer;
BEGIN
  SELECT count(*) INTO v_sayi FROM public.videolar v
  LEFT JOIN public.ogrenme_araclari a ON a.legacy_video_id = v.video_id
  WHERE a.arac_id IS NULL;
  IF v_sayi > 0 THEN RAISE EXCEPTION '% video ortak modele taşınamadı.', v_sayi; END IF;

  SELECT count(*) INTO v_sayi FROM public.uretim_gorevleri g
  JOIN public.talepler t ON t.talep_id=g.talep_id
  WHERE g.asama='video' AND t.ogrenme_araci_turu='video' AND g.arac_id IS NULL;
  IF v_sayi > 0 THEN RAISE EXCEPTION '% video görevinin arac_id bağlantısı eksik.', v_sayi; END IF;

  SELECT count(*) INTO v_sayi FROM public.soru_setleri WHERE arac_durum_id IS NULL;
  IF v_sayi > 0 THEN RAISE EXCEPTION '% soru setinin arac_durum_id bağlantısı eksik.', v_sayi; END IF;

  SELECT count(*) INTO v_sayi FROM public.yayin_yonetimi WHERE arac_durum_id IS NULL;
  IF v_sayi > 0 THEN RAISE EXCEPTION '% yayının arac_durum_id bağlantısı eksik.', v_sayi; END IF;

  SELECT count(*) INTO v_sayi FROM (
    SELECT talep_id, kaynak FROM public.ogrenme_araclari
    WHERE arac_turu='video' GROUP BY talep_id, kaynak HAVING count(*)>1
  ) tekrarlar;
  IF v_sayi > 0 THEN RAISE EXCEPTION '% talep/kaynak için birden fazla Video aracı var.', v_sayi; END IF;
END
$blok$;

ALTER TABLE public.soru_setleri ALTER COLUMN arac_durum_id SET NOT NULL;
ALTER TABLE public.yayin_yonetimi ALTER COLUMN arac_durum_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_araci_talep_kaynak
  ON public.ogrenme_araclari (talep_id, kaynak)
  WHERE arac_turu = 'video';
CREATE INDEX IF NOT EXISTS idx_video_yukleme_oturumlari_arac
  ON public.ogrenme_araci_video_yukleme_oturumlari (arac_id)
  WHERE arac_id IS NOT NULL;

-- Takip görünümü fiziksel Video tablolarına geri düşmez. Kolon adları mevcut
-- istemci sözleşmesini bozmamak için korunur; video_id artık ortak arac_id'dir.
CREATE OR REPLACE VIEW public.v_uretici_ogrenme_araci_takip AS
SELECT t.talep_id,t.uretici_id,
  s.senaryo_id,s.iu_id AS senaryo_iu_id,sd.durum AS senaryo_durum,sd.created_at AS senaryo_durum_tarih,
  oa.arac_id,oa.iu_id AS arac_iu_id,oad.durum AS arac_durum,oad.created_at AS arac_durum_tarih,
  ss.soru_seti_id,ss.iu_id AS soru_seti_iu_id,ssd.durum AS soru_seti_durum,ssd.created_at AS soru_seti_durum_tarih,
  y.durum AS yayin_durum,y.yayin_tarihi
FROM public.talepler t
LEFT JOIN LATERAL (SELECT senaryo_id,iu_id FROM public.senaryolar WHERE talep_id=t.talep_id ORDER BY created_at DESC LIMIT 1) s ON TRUE
LEFT JOIN LATERAL (SELECT senaryo_durum_id,durum,created_at FROM public.senaryo_durumu WHERE senaryo_id=s.senaryo_id ORDER BY created_at DESC LIMIT 1) sd ON TRUE
LEFT JOIN LATERAL (SELECT arac_id,iu_id FROM public.ogrenme_araclari WHERE talep_id=t.talep_id ORDER BY created_at DESC LIMIT 1) oa ON TRUE
LEFT JOIN LATERAL (SELECT arac_durum_id,durum,created_at FROM public.ogrenme_araci_durumu WHERE arac_id=oa.arac_id ORDER BY created_at DESC LIMIT 1) oad ON TRUE
LEFT JOIN LATERAL (SELECT soru_seti_id,iu_id FROM public.soru_setleri WHERE talep_id=t.talep_id AND arac_durum_id IS NOT DISTINCT FROM oad.arac_durum_id ORDER BY created_at DESC LIMIT 1) ss ON TRUE
LEFT JOIN LATERAL (SELECT soru_seti_durum_id,durum,created_at FROM public.soru_seti_durumu WHERE soru_seti_id=ss.soru_seti_id ORDER BY created_at DESC LIMIT 1) ssd ON TRUE
LEFT JOIN LATERAL (SELECT durum,yayin_tarihi FROM public.yayin_yonetimi WHERE soru_seti_durum_id=ssd.soru_seti_durum_id ORDER BY yayin_tarihi DESC NULLS LAST,yayin_id LIMIT 1) y ON TRUE;
GRANT SELECT ON public.v_uretici_ogrenme_araci_takip TO service_role;

-- Yayın görünümü de bütün araç türleri için yalnız ortak omurgadan beslenir.
CREATE OR REPLACE VIEW public.v_yayin_detay AS
SELECT ym.yayin_id,ym.soru_seti_durum_id,ym.durum,ym.yayin_tarihi,ym.durdurma_tarihi,
  COALESCE(u.urun_adi,t.urun_adi::text) AS urun_adi,tek.teknik_adi,t.takim_id,t.uretici_id,
  t.video_basi_soru_sayisi,t.soru_seti_buyuklugu,
  CASE WHEN oa.arac_turu='video' THEN oa.dosya_yolu ELSE NULL END AS video_url,
  NULL::text AS thumbnail_url,oap.arac_puani AS video_puani,avg(ssp.soru_puani)::integer AS soru_puani,
  ss.sorular,s.senaryo_metni,s.senaryo_id,sd.senaryo_durum_id,
  oad.arac_durum_id AS video_durum_id,ssd.soru_seti_id,t.icerik_turu,t.talep_no,f.firma_adi,
  t.egitim_turu,t.firma_id,ym.hedef_roller,oa.sure_saniye AS video_suresi_saniye,
  oa.arac_id,oad.arac_durum_id,oa.arac_turu,oap.arac_puani AS ogrenme_araci_puani,
  COALESCE(oa.metadata,'{}'::jsonb) AS arac_metadata,oa.metadata_dogrulandi AS arac_metadata_dogrulandi,
  oa.dosya_yolu AS arac_dosya_yolu,oa.kapak_yolu AS arac_kapak_yolu,oa.mime_type AS arac_mime_type,
  oa.dosya_boyutu AS arac_dosya_boyutu,oa.checksum_sha256 AS arac_checksum_sha256,
  oa.sure_saniye AS arac_sure_saniye,oa.sayfa_sayisi AS arac_sayfa_sayisi,
  oa.genislik AS arac_genislik,oa.yukseklik AS arac_yukseklik
FROM public.yayin_yonetimi ym
JOIN public.soru_seti_durumu ssd ON ssd.soru_seti_durum_id=ym.soru_seti_durum_id
JOIN public.soru_setleri ss ON ss.soru_seti_id=ssd.soru_seti_id
JOIN public.talepler t ON t.talep_id=ss.talep_id
JOIN public.ogrenme_araci_durumu oad ON oad.arac_durum_id=ym.arac_durum_id
JOIN public.ogrenme_araclari oa ON oa.arac_id=oad.arac_id
LEFT JOIN public.ogrenme_araci_puanlari oap ON oap.arac_durum_id=oad.arac_durum_id
LEFT JOIN public.senaryo_durumu sd ON sd.senaryo_durum_id=oa.senaryo_durum_id
LEFT JOIN public.senaryolar s ON s.senaryo_id=sd.senaryo_id
LEFT JOIN public.urunler u ON u.urun_id=t.urun_id LEFT JOIN public.teknikler tek ON tek.teknik_id=t.teknik_id
LEFT JOIN public.soru_seti_puanlari ssp ON ssp.soru_seti_durum_id=ym.soru_seti_durum_id
LEFT JOIN public.firmalar f ON f.firma_id=t.firma_id
GROUP BY ym.yayin_id,ym.soru_seti_durum_id,ym.durum,ym.yayin_tarihi,ym.durdurma_tarihi,
  u.urun_adi,t.urun_adi,tek.teknik_adi,t.takim_id,t.uretici_id,t.video_basi_soru_sayisi,
  t.soru_seti_buyuklugu,oa.dosya_yolu,oa.arac_turu,oap.arac_puani,ss.sorular,s.senaryo_metni,
  s.senaryo_id,sd.senaryo_durum_id,oad.arac_durum_id,ssd.soru_seti_id,t.icerik_turu,t.talep_no,
  f.firma_adi,t.egitim_turu,t.firma_id,ym.hedef_roller,oa.sure_saniye,oa.arac_id,oa.metadata,
  oa.metadata_dogrulandi,oa.kapak_yolu,oa.mime_type,oa.dosya_boyutu,oa.checksum_sha256,
  oa.sayfa_sayisi,oa.genislik,oa.yukseklik;
GRANT SELECT ON public.v_yayin_detay TO service_role;

-- Görev açma artık Video dahil bütün öğrenme araçlarında arac_id yazar.
CREATE OR REPLACE FUNCTION public.uretim_gorev_ac(
  p_talep_id uuid, p_asama text, p_atayan_id uuid,
  p_oncelikli_iu_id uuid DEFAULT NULL, p_atama_kaynagi text DEFAULT 'otomatik',
  p_senaryo_id uuid DEFAULT NULL, p_video_id uuid DEFAULT NULL,
  p_soru_seti_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE v_gorev public.uretim_gorevleri%ROWTYPE; v_iu_id uuid; v_durum text;
BEGIN
  IF p_asama NOT IN ('senaryo','video','soru_seti') THEN RAISE EXCEPTION 'Geçersiz üretim aşaması.' USING ERRCODE='22023'; END IF;
  -- Parametre adı, mevcut fonksiyon imzasını yerinde değiştirebilmek için korunur;
  -- değeri artık eski video_id değil ortak arac_id'dir.
  PERFORM 1 FROM public.talepler WHERE talep_id=p_talep_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE talep_id=p_talep_id AND asama=p_asama;
  IF FOUND THEN
    IF v_gorev.senaryo_id IS DISTINCT FROM p_senaryo_id OR v_gorev.arac_id IS DISTINCT FROM p_video_id OR v_gorev.soru_seti_id IS DISTINCT FROM p_soru_seti_id THEN
      RAISE EXCEPTION 'Aşamanın mevcut görevi farklı içerik kaydına bağlı.' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('gorev_id',v_gorev.gorev_id,'talep_id',v_gorev.talep_id,'asama',v_gorev.asama,'atanan_iu_id',v_gorev.atanan_iu_id,'durum',v_gorev.durum,'mevcut',true);
  END IF;
  IF p_atama_kaynagi IN ('manuel','devir') AND p_oncelikli_iu_id IS NOT NULL THEN
    IF NOT public.uretim_iu_talep_icin_uygun(p_oncelikli_iu_id,p_talep_id) THEN RAISE EXCEPTION 'Seçilen IU uygun değil.' USING ERRCODE='23514'; END IF;
    v_iu_id:=p_oncelikli_iu_id;
  ELSE v_iu_id:=public.uretim_iu_adayi_sec(p_talep_id,p_oncelikli_iu_id); END IF;
  v_durum:=CASE WHEN v_iu_id IS NULL THEN 'atama_bekliyor' ELSE 'hazirlaniyor' END;
  INSERT INTO public.uretim_gorevleri(talep_id,asama,senaryo_id,arac_id,soru_seti_id,atanan_iu_id,durum,atama_kaynagi,atayan_id,atama_tarihi,baslama_tarihi)
  VALUES(p_talep_id,p_asama,p_senaryo_id,p_video_id,p_soru_seti_id,v_iu_id,v_durum,CASE WHEN v_iu_id IS NULL THEN NULL ELSE p_atama_kaynagi END,CASE WHEN v_iu_id IS NULL THEN NULL ELSE p_atayan_id END,CASE WHEN v_iu_id IS NULL THEN NULL ELSE now() END,CASE WHEN v_iu_id IS NULL THEN NULL ELSE now() END)
  RETURNING * INTO v_gorev;
  IF v_iu_id IS NOT NULL THEN
    INSERT INTO public.uretim_gorev_atama_gecmisi(gorev_id,onceki_iu_id,yeni_iu_id,islem,atama_kaynagi,islemi_yapan_id)
    VALUES(v_gorev.gorev_id,NULL,v_iu_id,'atandi',p_atama_kaynagi,p_atayan_id);
  END IF;
  RETURN jsonb_build_object('gorev_id',v_gorev.gorev_id,'talep_id',v_gorev.talep_id,'asama',v_gorev.asama,'atanan_iu_id',v_gorev.atanan_iu_id,'durum',v_gorev.durum,'mevcut',false);
END;
$fonksiyon$;

-- İÜ Video teslimi yalnız ortak aracı ve ortak durum geçmişini yazar.
CREATE OR REPLACE FUNCTION public.uretim_video_teslim_et(p_gorev_id uuid,p_iu_id uuid,p_video_url text,p_thumbnail_url text,p_islem_anahtari uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE v_gorev public.uretim_gorevleri%ROWTYPE; v_durum_id uuid; v_onceki jsonb; v_sonuc jsonb;
BEGIN
  IF p_islem_anahtari IS NULL OR nullif(btrim(p_video_url),'') IS NULL THEN RAISE EXCEPTION 'İşlem anahtarı ve video adresi zorunludur.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text,1));
  SELECT sonuc INTO v_onceki FROM public.uretim_islem_kayitlari WHERE islem_anahtari=p_islem_anahtari AND islem_turu='video_teslim';
  IF FOUND THEN RETURN v_onceki; END IF;
  SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id=p_gorev_id FOR UPDATE;
  IF NOT FOUND OR v_gorev.asama<>'video' OR v_gorev.arac_id IS NULL THEN RAISE EXCEPTION 'Geçerli video görevi bulunamadı.' USING ERRCODE='23514'; END IF;
  IF v_gorev.atanan_iu_id IS DISTINCT FROM p_iu_id OR v_gorev.durum NOT IN ('hazirlaniyor','revizyon_bekliyor') THEN RAISE EXCEPTION 'Video görevi teslim edilemez.' USING ERRCODE='42501'; END IF;
  UPDATE public.ogrenme_araclari SET dosya_yolu=btrim(p_video_url),kapak_yolu=nullif(btrim(p_thumbnail_url),''),iu_id=p_iu_id,metadata_dogrulandi=FALSE,updated_at=now()
  WHERE arac_id=v_gorev.arac_id AND arac_turu='video';
  IF NOT FOUND THEN RAISE EXCEPTION 'Göreve bağlı video aracı bulunamadı.' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.ogrenme_araci_durumu(arac_id,durum,degistiren_id,notlar) VALUES(v_gorev.arac_id,'inceleme bekleniyor',p_iu_id,NULL) RETURNING arac_durum_id INTO v_durum_id;
  UPDATE public.uretim_gorevleri SET durum='inceleme_bekliyor',inceleme_tarihi=now(),baslama_tarihi=COALESCE(baslama_tarihi,now()),son_islem_anahtari=p_islem_anahtari,surum=surum+1 WHERE gorev_id=p_gorev_id;
  v_sonuc:=jsonb_build_object('gorev_id',p_gorev_id,'talep_id',v_gorev.talep_id,'asama','video','arac_id',v_gorev.arac_id,'arac_durum_id',v_durum_id,'durum','inceleme_bekliyor');
  INSERT INTO public.uretim_islem_kayitlari(islem_anahtari,islem_turu,gorev_id,talep_id,sonuc) VALUES(p_islem_anahtari,'video_teslim',p_gorev_id,v_gorev.talep_id,v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Hazır Video da ortak aracı oluşturur ve ortak soru zincirini açar.
CREATE OR REPLACE FUNCTION public.uretim_hazir_video_kaydet(p_talep_id uuid,p_uretici_id uuid,p_video_url text,p_islem_anahtari uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE v_talep public.talepler%ROWTYPE; v_arac_id uuid; v_durum_id uuid; v_sonraki jsonb; v_onceki jsonb; v_sonuc jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text,1));
  SELECT sonuc INTO v_onceki FROM public.uretim_islem_kayitlari WHERE islem_anahtari=p_islem_anahtari AND islem_turu='hazir_video_kaydet';
  IF FOUND THEN RETURN v_onceki; END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id=p_talep_id FOR UPDATE;
  IF NOT FOUND OR v_talep.uretici_id IS DISTINCT FROM p_uretici_id OR v_talep.hazir_video IS DISTINCT FROM TRUE OR v_talep.ogrenme_araci_turu<>'video' THEN RAISE EXCEPTION 'Hazır video talebi geçersiz.' USING ERRCODE='23514'; END IF;
  UPDATE public.talepler SET hazir_video_url=btrim(p_video_url) WHERE talep_id=p_talep_id;
  SELECT arac_id INTO v_arac_id FROM public.ogrenme_araclari WHERE talep_id=p_talep_id AND arac_turu='video' AND kaynak='hazir' ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_arac_id IS NULL THEN
    INSERT INTO public.ogrenme_araclari(talep_id,arac_turu,kaynak,dosya_yolu,metadata,metadata_dogrulandi)
    VALUES(p_talep_id,'video','hazir',btrim(p_video_url),jsonb_build_object('video_dogrulandi',TRUE),TRUE) RETURNING arac_id INTO v_arac_id;
  ELSE UPDATE public.ogrenme_araclari SET dosya_yolu=btrim(p_video_url),metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('video_dogrulandi',TRUE),metadata_dogrulandi=TRUE,updated_at=now() WHERE arac_id=v_arac_id; END IF;
  SELECT arac_durum_id INTO v_durum_id FROM public.ogrenme_araci_durumu WHERE arac_id=v_arac_id AND durum='onaylandi' ORDER BY created_at LIMIT 1;
  IF v_durum_id IS NULL THEN INSERT INTO public.ogrenme_araci_durumu(arac_id,durum,degistiren_id,notlar) VALUES(v_arac_id,'onaylandi',p_uretici_id,'Hazır video — otomatik onay') RETURNING arac_durum_id INTO v_durum_id; END IF;
  v_sonraki:=public.uretim_podcast_soru_zinciri_ac(p_talep_id,v_durum_id,p_uretici_id,NULL);
  v_sonuc:=jsonb_build_object('talep_id',p_talep_id,'arac_id',v_arac_id,'arac_durum_id',v_durum_id,'soru_seti_id',v_sonraki->>'soru_seti_id','sonraki',v_sonraki);
  INSERT INTO public.uretim_islem_kayitlari(islem_anahtari,islem_turu,gorev_id,talep_id,sonuc) VALUES(p_islem_anahtari,'hazir_video_kaydet',NULLIF(v_sonraki->>'gorev_id','')::uuid,p_talep_id,v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Video kararı diğer araçlar gibi ortak durum ve ortak soru zincirini kullanır.
CREATE OR REPLACE FUNCTION public.uretim_video_uretici_karar_ver(p_gorev_id uuid,p_uretici_id uuid,p_karar text,p_notlar text,p_islem_anahtari uuid,p_beklenen_surum integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE v_gorev public.uretim_gorevleri%ROWTYPE; v_talep public.talepler%ROWTYPE; v_durum_id uuid; v_revizyon integer; v_sonraki jsonb:=NULL; v_onceki jsonb; v_sonuc jsonb;
BEGIN
  IF p_karar NOT IN ('onaylandi','revizyon bekleniyor','Iptal Edildi') THEN RAISE EXCEPTION 'Geçersiz karar.' USING ERRCODE='22023'; END IF;
  IF p_karar='revizyon bekleniyor' AND nullif(btrim(p_notlar),'') IS NULL THEN RAISE EXCEPTION 'Revizyon notu zorunludur.' USING ERRCODE='22023'; END IF;
  v_onceki:=public.uretim_karar_surum_kapisi(p_gorev_id,p_beklenen_surum,p_islem_anahtari,'video_uretici_karari'); IF v_onceki IS NOT NULL THEN RETURN v_onceki; END IF;
  SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id=p_gorev_id FOR UPDATE;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id=v_gorev.talep_id FOR UPDATE;
  IF v_gorev.asama<>'video' OR v_gorev.arac_id IS NULL OR v_gorev.durum<>'inceleme_bekliyor' OR v_talep.uretici_id IS DISTINCT FROM p_uretici_id OR v_talep.ogrenme_araci_turu<>'video' THEN RAISE EXCEPTION 'Video karar yetkisi yok.' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_revizyon FROM public.ogrenme_araci_durumu WHERE arac_id=v_gorev.arac_id AND durum='revizyon bekleniyor';
  IF p_karar='revizyon bekleniyor' AND v_revizyon>=2 THEN RAISE EXCEPTION 'Maksimum revizyon hakkı (2) kullanıldı.' USING ERRCODE='23514'; END IF;
  INSERT INTO public.ogrenme_araci_durumu(arac_id,durum,degistiren_id,notlar) VALUES(v_gorev.arac_id,p_karar,p_uretici_id,nullif(btrim(p_notlar),'')) RETURNING arac_durum_id INTO v_durum_id;
  UPDATE public.uretim_gorevleri SET durum=CASE p_karar WHEN 'onaylandi' THEN 'tamamlandi' WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor' ELSE 'iptal' END,tamamlanma_tarihi=CASE WHEN p_karar='onaylandi' THEN now() ELSE tamamlanma_tarihi END,iptal_tarihi=CASE WHEN p_karar='Iptal Edildi' THEN now() ELSE iptal_tarihi END,son_islem_anahtari=p_islem_anahtari,surum=surum+1 WHERE gorev_id=p_gorev_id;
  IF p_karar='onaylandi' THEN v_sonraki:=public.uretim_podcast_soru_zinciri_ac(v_gorev.talep_id,v_durum_id,p_uretici_id,v_gorev.atanan_iu_id); END IF;
  v_sonuc:=jsonb_build_object('gorev_id',p_gorev_id,'talep_id',v_gorev.talep_id,'asama','video','karar',p_karar,'durum_id',v_durum_id,'sonraki',v_sonraki);
  INSERT INTO public.uretim_islem_kayitlari(islem_anahtari,islem_turu,gorev_id,talep_id,sonuc) VALUES(p_islem_anahtari,'video_uretici_karari',p_gorev_id,v_gorev.talep_id,v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Senaryo ve soru seti kararları korunur; senaryo onayından sonraki Video kabuğu
-- artık videolar tablosunda değil ortak öğrenme aracı tablosunda açılır.
CREATE OR REPLACE FUNCTION public.uretim_uretici_karar_ver(p_gorev_id uuid,p_uretici_id uuid,p_karar text,p_notlar text,p_islem_anahtari uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE; v_talep public.talepler%ROWTYPE;
  v_onceki jsonb; v_sonuc jsonb; v_sonraki jsonb:=NULL; v_durum_id uuid;
  v_arac_id uuid; v_soru_seti_id uuid; v_revizyon integer; v_gorev_durumu text;
BEGIN
  IF p_islem_anahtari IS NULL OR p_karar NOT IN ('onaylandi','revizyon bekleniyor','Iptal Edildi') THEN RAISE EXCEPTION 'Geçersiz karar.' USING ERRCODE='22023'; END IF;
  IF p_karar='revizyon bekleniyor' AND nullif(btrim(p_notlar),'') IS NULL THEN RAISE EXCEPTION 'Revizyon notu zorunludur.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text,1));
  SELECT sonuc INTO v_onceki FROM public.uretim_islem_kayitlari WHERE islem_anahtari=p_islem_anahtari AND islem_turu='uretici_karari';
  IF FOUND THEN RETURN v_onceki; END IF;
  SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id=p_gorev_id FOR UPDATE;
  IF NOT FOUND OR v_gorev.durum<>'inceleme_bekliyor' OR v_gorev.asama='video' THEN RAISE EXCEPTION 'Bu karar ortak olmayan geçerli bir aşamaya ait değil.' USING ERRCODE='23514'; END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id=v_gorev.talep_id FOR UPDATE;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN RAISE EXCEPTION 'Kararı yalnız talebi açan üretici verebilir.' USING ERRCODE='42501'; END IF;
  IF p_karar='revizyon bekleniyor' THEN
    IF v_gorev.asama='senaryo' THEN SELECT count(*) INTO v_revizyon FROM public.senaryo_durumu WHERE senaryo_id=v_gorev.senaryo_id AND durum='revizyon bekleniyor';
    ELSE SELECT count(*) INTO v_revizyon FROM public.soru_seti_durumu WHERE soru_seti_id=v_gorev.soru_seti_id AND durum='revizyon bekleniyor'; END IF;
    IF v_revizyon>=2 THEN RAISE EXCEPTION 'Maksimum revizyon hakkı (2) kullanıldı.' USING ERRCODE='23514'; END IF;
  END IF;
  IF v_gorev.asama='senaryo' THEN
    INSERT INTO public.senaryo_durumu(senaryo_id,durum,degistiren_id,notlar) VALUES(v_gorev.senaryo_id,p_karar,p_uretici_id,nullif(btrim(p_notlar),'')) RETURNING senaryo_durum_id INTO v_durum_id;
  ELSE
    INSERT INTO public.soru_seti_durumu(soru_seti_id,durum,degistiren_id,notlar) VALUES(v_gorev.soru_seti_id,p_karar,p_uretici_id,nullif(btrim(p_notlar),'')) RETURNING soru_seti_durum_id INTO v_durum_id;
  END IF;
  v_gorev_durumu:=CASE p_karar WHEN 'onaylandi' THEN 'tamamlandi' WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor' ELSE 'iptal' END;
  UPDATE public.uretim_gorevleri SET durum=v_gorev_durumu,tamamlanma_tarihi=CASE WHEN p_karar='onaylandi' THEN now() ELSE tamamlanma_tarihi END,iptal_tarihi=CASE WHEN p_karar='Iptal Edildi' THEN now() ELSE iptal_tarihi END,son_islem_anahtari=p_islem_anahtari,surum=surum+1 WHERE gorev_id=p_gorev_id;
  IF p_karar='onaylandi' AND v_gorev.asama='senaryo' THEN
    INSERT INTO public.ogrenme_araclari(talep_id,senaryo_durum_id,arac_turu,kaynak,iu_id,dosya_yolu,metadata,metadata_dogrulandi)
    VALUES(v_gorev.talep_id,v_durum_id,'video','iu',NULL,NULL,'{}'::jsonb,FALSE) RETURNING arac_id INTO v_arac_id;
    v_sonraki:=public.uretim_gorev_ac(v_gorev.talep_id,'video',p_uretici_id,v_gorev.atanan_iu_id,'otomatik',NULL,v_arac_id,NULL);
  END IF;
  v_sonuc:=jsonb_build_object('gorev_id',p_gorev_id,'talep_id',v_gorev.talep_id,'asama',v_gorev.asama,'karar',p_karar,'durum',v_gorev_durumu,'durum_id',v_durum_id,'sonraki',v_sonraki);
  INSERT INTO public.uretim_islem_kayitlari(islem_anahtari,islem_turu,gorev_id,talep_id,sonuc) VALUES(p_islem_anahtari,'uretici_karari',p_gorev_id,v_gorev.talep_id,v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_video_uretici_karar_ver(uuid,uuid,text,text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_video_uretici_karar_ver(uuid,uuid,text,text,uuid,integer) TO service_role;

COMMIT;
SELECT TRUE AS video_ortak_model_hazirlandi;
