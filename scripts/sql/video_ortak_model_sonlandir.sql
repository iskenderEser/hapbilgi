-- Video ortak model geçişi / 2. adım
-- Bu dosya yeni uygulama sürümü başarıyla deploy edildikten SONRA çalıştırılır.
-- Eski tablolar yalnız tarihî arşiv olarak kalır; INSERT/UPDATE kapatılır.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-video-ortak-model-final-v1', 1));

DO $blok$
DECLARE v_sayi integer;
BEGIN
  SELECT count(*) INTO v_sayi FROM public.uretim_gorevleri g
  JOIN public.talepler t ON t.talep_id=g.talep_id
  WHERE g.asama='video' AND t.ogrenme_araci_turu='video' AND g.arac_id IS NULL;
  IF v_sayi>0 THEN RAISE EXCEPTION 'Sonlandırma durduruldu: % video görevi ortak araca bağlı değil.',v_sayi; END IF;
  SELECT count(*) INTO v_sayi FROM public.soru_setleri WHERE arac_durum_id IS NULL;
  IF v_sayi>0 THEN RAISE EXCEPTION 'Sonlandırma durduruldu: % soru seti ortak duruma bağlı değil.',v_sayi; END IF;
  SELECT count(*) INTO v_sayi FROM public.yayin_yonetimi WHERE arac_durum_id IS NULL;
  IF v_sayi>0 THEN RAISE EXCEPTION 'Sonlandırma durduruldu: % yayın ortak duruma bağlı değil.',v_sayi; END IF;
END
$blok$;

-- Eski → ortak çift yazmayı kesin olarak kapat.
DROP TRIGGER IF EXISTS videolar_ogrenme_araci_trg ON public.videolar;
DROP TRIGGER IF EXISTS video_durumu_ogrenme_araci_trg ON public.video_durumu;
DROP TRIGGER IF EXISTS video_puanlari_ogrenme_araci_trg ON public.video_puanlari;
DROP TRIGGER IF EXISTS soru_setleri_arac_durumu_trg ON public.soru_setleri;
DROP TRIGGER IF EXISTS uretim_gorevleri_arac_trg ON public.uretim_gorevleri;

-- Yayın adayı çözümü artık yalnız ortak öğrenme aracı zinciridir.
CREATE OR REPLACE FUNCTION public.yayin_oncesi_silme_baslat(p_soru_seti_durum_id uuid,p_uretici_id uuid,p_islem_anahtari uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE v_talep public.talepler%ROWTYPE; v_soru_seti_id uuid; v_arac_id uuid; v_dosya_yolu text; v_talep_id uuid; v_son_durum_id uuid;
BEGIN
  IF p_soru_seti_durum_id IS NULL OR p_uretici_id IS NULL OR p_islem_anahtari IS NULL THEN RAISE EXCEPTION 'Silme kimlikleri zorunludur.' USING ERRCODE='22023'; END IF;
  SELECT t.talep_id,ss.soru_seti_id,a.arac_id,a.dosya_yolu INTO v_talep_id,v_soru_seti_id,v_arac_id,v_dosya_yolu
  FROM public.soru_seti_durumu ssd JOIN public.soru_setleri ss ON ss.soru_seti_id=ssd.soru_seti_id
  JOIN public.ogrenme_araci_durumu ad ON ad.arac_durum_id=ss.arac_durum_id
  JOIN public.ogrenme_araclari a ON a.arac_id=ad.arac_id JOIN public.talepler t ON t.talep_id=a.talep_id
  WHERE ssd.soru_seti_durum_id=p_soru_seti_durum_id AND ssd.durum='onaylandi';
  IF NOT FOUND THEN RAISE EXCEPTION 'Yayına hazır içerik bulunamadı.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id=v_talep_id FOR UPDATE;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN RAISE EXCEPTION 'Yalnız kendi yayın adayınızı silebilirsiniz.' USING ERRCODE='42501'; END IF;
  SELECT soru_seti_durum_id INTO v_son_durum_id FROM public.soru_seti_durumu WHERE soru_seti_id=v_soru_seti_id ORDER BY created_at DESC NULLS LAST,soru_seti_durum_id DESC LIMIT 1;
  IF v_son_durum_id IS DISTINCT FROM p_soru_seti_durum_id THEN RAISE EXCEPTION 'Yalnız güncel onaylı soru seti silinebilir.' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.yayin_yonetimi WHERE soru_seti_durum_id=p_soru_seti_durum_id) THEN RAISE EXCEPTION 'Yayına alınmış içerik bu işlemle silinemez.' USING ERRCODE='23514'; END IF;
  UPDATE public.talepler SET yayin_oncesi_silme_durumu='isleniyor',yayin_oncesi_silme_anahtari=p_islem_anahtari,yayin_oncesi_silen_id=p_uretici_id,yayin_oncesi_silme_tarihi=now() WHERE talep_id=v_talep_id;
  RETURN jsonb_build_object(
    'talep_id',v_talep_id,'soru_seti_id',v_soru_seti_id,'arac_id',v_arac_id,
    'dosya_yolu',v_dosya_yolu,
    'tam_silme',v_talep.hazir_video IS TRUE AND v_talep.hazir_soru_seti IS TRUE
  );
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.yayin_oncesi_silme_tamamla(p_talep_id uuid,p_soru_seti_durum_id uuid,p_uretici_id uuid,p_islem_anahtari uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE; v_sonuc jsonb; v_tam_silme boolean;
  v_arac_idler uuid[]; v_arac_durum_idler uuid[]; v_soru_idler uuid[]; v_soru_durum_idler uuid[];
  v_gorev_idler uuid[]; v_senaryo_idler uuid[]; v_senaryo_durum_idler uuid[];
  v_legacy_video_idler uuid[]; v_legacy_durum_idler uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text,7));
  SELECT sonuc INTO v_sonuc FROM public.uretim_islem_kayitlari WHERE islem_anahtari=p_islem_anahtari AND islem_turu='yayin_oncesi_silme';
  IF FOUND THEN RETURN v_sonuc; END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id=p_talep_id FOR UPDATE;
  IF NOT FOUND OR v_talep.uretici_id IS DISTINCT FROM p_uretici_id OR v_talep.yayin_oncesi_silme_anahtari IS DISTINCT FROM p_islem_anahtari OR v_talep.yayin_oncesi_silme_durumu<>'isleniyor' THEN RAISE EXCEPTION 'Geçerli silme hazırlığı bulunamadı.' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.yayin_yonetimi y JOIN public.soru_seti_durumu sd ON sd.soru_seti_durum_id=y.soru_seti_durum_id JOIN public.soru_setleri s ON s.soru_seti_id=sd.soru_seti_id WHERE s.talep_id=p_talep_id) THEN RAISE EXCEPTION 'Yayına alınmış içerik bu işlemle silinemez.' USING ERRCODE='23514'; END IF;

  v_tam_silme:=v_talep.hazir_video IS TRUE AND v_talep.hazir_soru_seti IS TRUE;

  v_arac_idler:=ARRAY(SELECT arac_id FROM public.ogrenme_araclari WHERE talep_id=p_talep_id);
  v_arac_durum_idler:=ARRAY(SELECT arac_durum_id FROM public.ogrenme_araci_durumu WHERE arac_id=ANY(v_arac_idler));
  v_soru_idler:=ARRAY(SELECT soru_seti_id FROM public.soru_setleri WHERE talep_id=p_talep_id);
  v_soru_durum_idler:=ARRAY(SELECT soru_seti_durum_id FROM public.soru_seti_durumu WHERE soru_seti_id=ANY(v_soru_idler));
  v_gorev_idler:=ARRAY(SELECT gorev_id FROM public.uretim_gorevleri WHERE talep_id=p_talep_id);
  v_senaryo_idler:=ARRAY(SELECT senaryo_id FROM public.senaryolar WHERE talep_id=p_talep_id);
  v_senaryo_durum_idler:=ARRAY(SELECT senaryo_durum_id FROM public.senaryo_durumu WHERE senaryo_id=ANY(v_senaryo_idler));
  v_legacy_video_idler:=ARRAY(SELECT video_id FROM public.videolar WHERE talep_id=p_talep_id);
  v_legacy_durum_idler:=ARRAY(SELECT video_durum_id FROM public.video_durumu WHERE video_id=ANY(v_legacy_video_idler));

  -- Puanlama taslakları her varyantta kaldırılır; aday artık listelenmez.
  DELETE FROM public.soru_seti_puanlari WHERE soru_seti_durum_id=p_soru_seti_durum_id;
  DELETE FROM public.ogrenme_araci_puanlari
  WHERE arac_durum_id=(SELECT arac_durum_id FROM public.soru_setleri WHERE soru_seti_id=(SELECT soru_seti_id FROM public.soru_seti_durumu WHERE soru_seti_durum_id=p_soru_seti_durum_id));

  IF v_tam_silme THEN
    DELETE FROM public.bildirimler WHERE talep_id=p_talep_id OR gorev_id=ANY(v_gorev_idler);
    DELETE FROM public.ogrenme_araci_video_yukleme_oturumlari WHERE talep_id=p_talep_id OR arac_id=ANY(v_arac_idler);
    DELETE FROM public.uretim_gorev_atama_gecmisi WHERE gorev_id=ANY(v_gorev_idler);
    DELETE FROM public.uretim_islem_kayitlari WHERE gorev_id=ANY(v_gorev_idler) OR talep_id=p_talep_id;
    DELETE FROM public.uretim_gorevleri WHERE gorev_id=ANY(v_gorev_idler);
    DELETE FROM public.soru_seti_puanlari WHERE soru_seti_durum_id=ANY(v_soru_durum_idler);
    DELETE FROM public.soru_seti_durumu WHERE soru_seti_id=ANY(v_soru_idler);
    DELETE FROM public.soru_setleri WHERE soru_seti_id=ANY(v_soru_idler);
    DELETE FROM public.ogrenme_araci_puanlari WHERE arac_durum_id=ANY(v_arac_durum_idler);
    DELETE FROM public.ogrenme_araci_durumu WHERE arac_id=ANY(v_arac_idler);
    DELETE FROM public.ogrenme_araclari WHERE arac_id=ANY(v_arac_idler);
    -- Geçiş öncesinden kalan arşiv eşleri de kişisel veri bırakmamak için temizlenir.
    DELETE FROM public.video_puanlari WHERE video_durum_id=ANY(v_legacy_durum_idler);
    DELETE FROM public.video_durumu WHERE video_id=ANY(v_legacy_video_idler);
    DELETE FROM public.videolar WHERE video_id=ANY(v_legacy_video_idler);
    DELETE FROM public.senaryo_durumu WHERE senaryo_id=ANY(v_senaryo_idler);
    DELETE FROM public.senaryolar WHERE senaryo_id=ANY(v_senaryo_idler);
    UPDATE public.talepler SET hazir_video_url=NULL,hazir_soru_seti_verisi=NULL WHERE talep_id=p_talep_id;
  END IF;
  UPDATE public.talepler SET yayin_oncesi_silme_durumu='tamamlandi',yayin_oncesi_silme_tarihi=now() WHERE talep_id=p_talep_id;
  v_sonuc:=jsonb_build_object('talep_id',p_talep_id,'tam_silme',v_tam_silme,'durum','tamamlandi');
  INSERT INTO public.uretim_islem_kayitlari(islem_anahtari,islem_turu,gorev_id,talep_id,sonuc) VALUES(p_islem_anahtari,'yayin_oncesi_silme',NULL,p_talep_id,v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Eski tablolar artık kaynak değildir. Kazara yeniden çift yazmayı DB engeller;
-- DELETE, tarihî kayıtların güvenli temizlenebilmesi için açık kalır.
CREATE OR REPLACE FUNCTION public.legacy_video_yazimini_engelle() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $fonksiyon$ BEGIN RAISE EXCEPTION 'Eski Video tablosuna yazılamaz; ogrenme_araclari ortak modelini kullanın.' USING ERRCODE='55000'; END; $fonksiyon$;
DROP TRIGGER IF EXISTS trg_legacy_videolar_yazma_engeli ON public.videolar;
CREATE TRIGGER trg_legacy_videolar_yazma_engeli BEFORE INSERT OR UPDATE ON public.videolar FOR EACH ROW EXECUTE FUNCTION public.legacy_video_yazimini_engelle();
DROP TRIGGER IF EXISTS trg_legacy_video_durumu_yazma_engeli ON public.video_durumu;
CREATE TRIGGER trg_legacy_video_durumu_yazma_engeli BEFORE INSERT OR UPDATE ON public.video_durumu FOR EACH ROW EXECUTE FUNCTION public.legacy_video_yazimini_engelle();
DROP TRIGGER IF EXISTS trg_legacy_video_puanlari_yazma_engeli ON public.video_puanlari;
CREATE TRIGGER trg_legacy_video_puanlari_yazma_engeli BEFORE INSERT OR UPDATE ON public.video_puanlari FOR EACH ROW EXECUTE FUNCTION public.legacy_video_yazimini_engelle();

COMMIT;
SELECT TRUE AS video_ortak_model_sonlandirildi;
