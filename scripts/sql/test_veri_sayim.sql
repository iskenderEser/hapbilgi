-- scripts/sql/test_veri_sayim.sql
--
-- Toplu/Tekil Silme — Aşama 2: ÖNİZLEME (docs/toplu_tekil_silme_is_plani.md).
-- test_veri_temizle'nin ikizi: AYNI kapsam çözümü, ama HİÇBİR ŞEY SİLMEZ — yalnız
-- "kaç kayıt silinecek / kaç sipariş korunacak" sayılarını döndürür. Modal'da
-- "son onay"dan önce gösterilir. Kapsam (v_yayin/v_kul/kimlik dizileri/sipariş
-- kümeleri) test_veri_temizle ile BİREBİR aynıdır → sayılar gerçek silmeyle uyuşur.
--
-- STABLE + salt-okuma. Yetki fonksiyon içinde YOK; route'ta adminGirisKontrol.
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.
-- ÇAĞRI (zararsız): SELECT public.test_veri_sayim('firma', '<firma_id>');

CREATE OR REPLACE FUNCTION public.test_veri_sayim(
  p_mod text, p_firma_id uuid DEFAULT NULL, p_talep_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_hepsi boolean := (p_mod = 'tum');
  v_yayin uuid[]; v_kul uuid[]; v_talep uuid[];
  v_senaryo uuid[]; v_video uuid[]; v_soru_seti uuid[];
  v_oneri_id uuid[]; v_eclub_oneri_id uuid[]; v_challenge_id uuid[];
  v_sipS uuid[]; v_sipE uuid[]; v_sipZ uuid[];
  v_izleme int; v_puan int; v_gonderim int; v_push int; v_bildirim int; v_sip_koru int;
BEGIN
  -- 0) Girdi doğrulama (temizle ile aynı)
  IF p_mod NOT IN ('tum','firma','tekil') THEN RETURN jsonb_build_object('durum','gecersiz_mod'); END IF;
  IF p_mod='firma' AND p_firma_id IS NULL THEN RETURN jsonb_build_object('durum','firma_id_gerekli'); END IF;
  IF p_mod='tekil' AND p_talep_id IS NULL THEN RETURN jsonb_build_object('durum','talep_id_gerekli'); END IF;
  IF p_mod='firma' AND NOT EXISTS (SELECT 1 FROM firmalar WHERE firma_id = p_firma_id)
    THEN RETURN jsonb_build_object('durum','firma_bulunamadi'); END IF;
  IF p_mod='tekil' AND NOT EXISTS (SELECT 1 FROM talepler WHERE talep_id = p_talep_id)
    THEN RETURN jsonb_build_object('durum','talep_bulunamadi'); END IF;

  -- 1) Kapsam kümeleri (test_veri_temizle ile BİREBİR aynı)
  v_talep := CASE p_mod
    WHEN 'firma' THEN ARRAY(SELECT t.talep_id FROM talepler t JOIN urunler u ON u.urun_id=t.urun_id WHERE u.firma_id=p_firma_id)
    WHEN 'tekil' THEN ARRAY[p_talep_id]
    ELSE NULL END;
  v_yayin := CASE p_mod
    WHEN 'tum' THEN ARRAY(SELECT yayin_id FROM yayin_yonetimi)
    ELSE ARRAY(
      SELECT y.yayin_id FROM yayin_yonetimi y
      JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = y.soru_seti_durum_id
      JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
      WHERE ss.talep_id = ANY(v_talep))
  END;
  v_senaryo   := ARRAY(SELECT senaryo_id  FROM senaryolar   WHERE v_hepsi OR talep_id = ANY(v_talep));
  v_video     := ARRAY(SELECT video_id    FROM videolar     WHERE v_hepsi OR talep_id = ANY(v_talep));
  v_soru_seti := ARRAY(SELECT soru_seti_id FROM soru_setleri WHERE v_hepsi OR talep_id = ANY(v_talep));
  v_oneri_id       := ARRAY(SELECT oneri_id     FROM oneri_kayitlari       WHERE yayin_id = ANY(v_yayin));
  v_eclub_oneri_id := ARRAY(SELECT oneri_id     FROM eclub_oneri_kayitlari WHERE yayin_id = ANY(v_yayin));
  v_challenge_id   := ARRAY(SELECT challenge_id FROM challenge_kayitlari    WHERE yayin_id = ANY(v_yayin));
  v_kul := CASE WHEN p_mod='firma'
    THEN ARRAY(SELECT kullanici_id FROM kullanicilar WHERE firma_id = p_firma_id) ELSE NULL END;

  IF p_mod <> 'tekil' THEN
    v_sipS := ARRAY(SELECT siparis_id FROM store_siparisler
      WHERE durum <> 'teslim_edildi' AND (v_hepsi OR kullanici_id = ANY(v_kul)));
    v_sipE := ARRAY(SELECT s.siparis_id FROM eclub_store_siparisler s
      WHERE s.durum <> 'teslim_edildi' AND (v_hepsi OR s.siparis_id IN
        (SELECT siparis_id FROM eclub_store_siparis_firma_puan WHERE firma_id = p_firma_id)));
    v_sipZ := ARRAY(SELECT siparis_id FROM eczanem_siparisler
      WHERE durum <> 'onaylandi' AND (v_hepsi OR urun_id IN
        (SELECT urun_id FROM urunler WHERE firma_id = p_firma_id)));
  END IF;

  -- 2) SAYIMLAR (silme YOK)
  v_izleme :=
      (SELECT count(*) FROM izleme_kayitlari         WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM cc_izleme_kayitlari      WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eclub_izleme_kayitlari   WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin));

  v_puan :=
      (SELECT count(*) FROM kazanilan_puanlar           WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM cc_kazanilan_puanlar        WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eclub_kazanilan_puanlar     WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eclub_utt_puanlari          WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eclub_dogru_cevap_kayitlari WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eczanem_puan_kayitlari WHERE izleme_id IN
        (SELECT izleme_id FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin)))
    + (SELECT count(*) FROM ileri_sarma_kayitlari       WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM cc_ileri_sarma_kayitlari    WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM yanlis_cevap_kayitlari      WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM cc_yanlis_cevap_kayitlari   WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eclub_yanlis_cevap_kayitlari WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM oneri_kayip_kayitlari       WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eclub_oneri_kayip_kayitlari WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM challenge_kayip_kayitlari   WHERE yayin_id = ANY(v_yayin));

  v_gonderim :=
      (SELECT count(*) FROM eczanem_gonderimler         WHERE yayin_id = ANY(v_yayin))
    + (SELECT count(*) FROM eczanem_eczane_gonderimleri WHERE yayin_id = ANY(v_yayin));

  v_push := CASE WHEN p_mod = 'tekil' THEN 0 ELSE
      (SELECT count(*) FROM push_abonelikleri       WHERE v_hepsi OR auth_user_id = ANY(v_kul))
    + (SELECT count(*) FROM push_gonderim_kayitlari WHERE v_hepsi OR auth_user_id = ANY(v_kul)) END;

  v_bildirim :=
      (SELECT count(*) FROM bildirimler WHERE v_hepsi
         OR alici_id = ANY(v_kul) OR gonderen_id = ANY(v_kul)
         OR (kayit_turu='talep'     AND kayit_id = ANY(v_talep))
         OR (kayit_turu='senaryo'   AND kayit_id = ANY(v_senaryo))
         OR (kayit_turu='video'     AND kayit_id = ANY(v_video))
         OR (kayit_turu='soru_seti' AND kayit_id = ANY(v_soru_seti))
         OR (kayit_turu='yayin'     AND kayit_id = ANY(v_yayin))
         OR (kayit_turu='oneri'     AND kayit_id = ANY(v_oneri_id))
         OR (kayit_turu='challenge' AND kayit_id = ANY(v_challenge_id)))
    + (SELECT count(*) FROM eclub_bildirimler WHERE v_hepsi
         OR gonderen_id = ANY(v_kul)
         OR (kayit_turu='oneri' AND kayit_id = ANY(v_eclub_oneri_id)));

  -- Korunacak (bitmiş) siparişler
  v_sip_koru := CASE WHEN p_mod='tekil' THEN 0 ELSE
      (SELECT count(*) FROM store_siparisler WHERE durum='teslim_edildi' AND (v_hepsi OR kullanici_id = ANY(v_kul)))
    + (SELECT count(*) FROM eclub_store_siparisler s WHERE s.durum='teslim_edildi' AND (v_hepsi OR s.siparis_id IN
        (SELECT siparis_id FROM eclub_store_siparis_firma_puan WHERE firma_id = p_firma_id)))
    + (SELECT count(*) FROM eczanem_siparisler WHERE durum='onaylandi' AND (v_hepsi OR urun_id IN
        (SELECT urun_id FROM urunler WHERE firma_id = p_firma_id))) END;

  RETURN jsonb_build_object(
    'durum', 'onizleme', 'mod', p_mod,
    'yayin', COALESCE(array_length(v_yayin,1),0),
    'izleme', v_izleme,
    'puan_kaydi', v_puan,
    'oneri', COALESCE(array_length(v_oneri_id,1),0) + COALESCE(array_length(v_eclub_oneri_id,1),0),
    'challenge', COALESCE(array_length(v_challenge_id,1),0),
    'gonderim', v_gonderim,
    'push', v_push,
    'bildirim', v_bildirim,
    'siparis_silinecek', COALESCE(array_length(v_sipS,1),0)+COALESCE(array_length(v_sipE,1),0)+COALESCE(array_length(v_sipZ,1),0),
    'siparis_korunacak', v_sip_koru
  );
END;
$fonk$;

GRANT EXECUTE ON FUNCTION public.test_veri_sayim(text, uuid, uuid) TO service_role;
