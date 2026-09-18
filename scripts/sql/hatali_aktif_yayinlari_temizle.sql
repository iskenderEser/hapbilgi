-- scripts/sql/hatali_aktif_yayinlari_temizle.sql
--
-- Geçmiş video ve öğrenme aracı testlerinden kalan 8 aktif yayını
-- (30028, 30051, 30058, 30059, 30060, 30066, 30067, 30069)
-- ve bunlara bağlı tüm alt kayıtları (görevler, oturumlar, sorular,
-- videolar, araçlar, senaryolar, bildirimler) atomik olarak siler.

DO $$
DECLARE
  v_talep_nolar integer[] := ARRAY[30028, 30051, 30058, 30059, 30060, 30066, 30067, 30069];
  v_talep_idler uuid[];
  v_senaryo_idler uuid[];
  v_video_idler uuid[];
  v_soru_seti_idler uuid[];
  v_arac_idler uuid[];
  v_gorev_idler uuid[];
BEGIN
  -- 1) Hedef talepleri topla
  SELECT ARRAY_AGG(talep_id) INTO v_talep_idler 
  FROM public.talepler 
  WHERE talep_no = ANY(v_talep_nolar);

  IF v_talep_idler IS NULL OR array_length(v_talep_idler, 1) = 0 THEN
    RAISE NOTICE 'Silinecek talep bulunamadı.';
    RETURN;
  END IF;

  -- 2) Bağlı nesne ID'lerini topla
  SELECT ARRAY_AGG(senaryo_id) INTO v_senaryo_idler FROM public.senaryolar WHERE talep_id = ANY(v_talep_idler);
  SELECT ARRAY_AGG(video_id) INTO v_video_idler FROM public.videolar WHERE talep_id = ANY(v_talep_idler);
  SELECT ARRAY_AGG(soru_seti_id) INTO v_soru_seti_idler FROM public.soru_setleri WHERE talep_id = ANY(v_talep_idler);
  SELECT ARRAY_AGG(arac_id) INTO v_arac_idler FROM public.ogrenme_araclari WHERE talep_id = ANY(v_talep_idler);
  SELECT ARRAY_AGG(gorev_id) INTO v_gorev_idler FROM public.uretim_gorevleri WHERE talep_id = ANY(v_talep_idler);

  -- 3) Bildirimler ve İşlem Kayıtları
  DELETE FROM public.bildirimler 
  WHERE talep_id = ANY(v_talep_idler) 
     OR gorev_id = ANY(v_gorev_idler)
     OR (kayit_turu = 'talep' AND kayit_id = ANY(v_talep_idler))
     OR (kayit_turu = 'senaryo' AND kayit_id = ANY(v_senaryo_idler))
     OR (kayit_turu = 'video' AND kayit_id = ANY(v_video_idler))
     OR (kayit_turu = 'soru_seti' AND kayit_id = ANY(v_soru_seti_idler));

  DELETE FROM public.uretim_islem_kayitlari WHERE talep_id = ANY(v_talep_idler) OR gorev_id = ANY(v_gorev_idler);
  DELETE FROM public.uretim_gorev_atama_gecmisi WHERE gorev_id = ANY(v_gorev_idler);
  DELETE FROM public.uretim_gorevleri WHERE talep_id = ANY(v_talep_idler);

  -- 4) Yarım yükleme oturumları ve depolama kuyruğu
  DELETE FROM public.ogrenme_araci_video_yukleme_oturumlari WHERE talep_id = ANY(v_talep_idler);
  DELETE FROM public.ogrenme_araci_depolama_temizleme_kuyrugu WHERE arac_id = ANY(v_arac_idler);

  -- 5) Soru Setleri ve Puanları
  DELETE FROM public.soru_seti_puanlari WHERE soru_seti_durum_id IN (SELECT soru_seti_durum_id FROM public.soru_seti_durumu WHERE soru_seti_id = ANY(v_soru_seti_idler));
  DELETE FROM public.soru_seti_durumu WHERE soru_seti_id = ANY(v_soru_seti_idler);
  DELETE FROM public.soru_setleri WHERE talep_id = ANY(v_talep_idler);

  -- 6) Öğrenme Araçları (Modern Model)
  DELETE FROM public.ogrenme_araci_puanlari WHERE arac_durum_id IN (SELECT arac_durum_id FROM public.ogrenme_araci_durumu WHERE arac_id = ANY(v_arac_idler));
  DELETE FROM public.ogrenme_araci_durumu WHERE arac_id = ANY(v_arac_idler);
  DELETE FROM public.ogrenme_araclari WHERE talep_id = ANY(v_talep_idler);

  -- 7) Videolar (Legacy Model)
  DELETE FROM public.video_puanlari WHERE video_durum_id IN (SELECT video_durum_id FROM public.video_durumu WHERE video_id = ANY(v_video_idler));
  DELETE FROM public.video_durumu WHERE video_id = ANY(v_video_idler);
  DELETE FROM public.videolar WHERE talep_id = ANY(v_talep_idler);

  -- 8) Senaryolar
  DELETE FROM public.senaryo_durumu WHERE senaryo_id = ANY(v_senaryo_idler);
  DELETE FROM public.senaryolar WHERE talep_id = ANY(v_talep_idler);

  -- 9) Kök Kayıt: Talepler
  DELETE FROM public.talepler WHERE talep_id = ANY(v_talep_idler);

  RAISE NOTICE '8 aktif yayın ve tüm ilişkili kayıtları başarıyla silindi.';
END $$;
