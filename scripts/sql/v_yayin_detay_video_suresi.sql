-- v_yayin_detay'a video_suresi_saniye eklenir (görünürlük kapısı — Faz 1).
-- Amaç: tüketici video listeleri "süresi hazır" videoları süzebilsin; süresi NULL
-- (encode'u bitmemiş) video izleyiciye gösterilmesin → kimse "Video süresi
-- doğrulanmamış" hatasına düşmesin. videolar (alias v) zaten join'li; yeni join
-- yok — yalnız kolon SELECT'e ve GROUP BY'a eklenir. Mevcut tüketiciler etkilenmez.

CREATE OR REPLACE VIEW public.v_yayin_detay AS
 SELECT ym.yayin_id,
    ym.soru_seti_durum_id,
    ym.durum,
    ym.yayin_tarihi,
    ym.durdurma_tarihi,
    COALESCE(u.urun_adi, t.urun_adi::text) AS urun_adi,
    tek.teknik_adi,
    t.takim_id,
    t.uretici_id,
    t.video_basi_soru_sayisi,
    t.soru_seti_buyuklugu,
    v.video_url,
    v.thumbnail_url,
    vp.video_puani,
    avg(ssp.soru_puani)::integer AS soru_puani,
    ss.sorular,
    s.senaryo_metni,
    s.senaryo_id,
    sd.senaryo_durum_id,
    vd.video_durum_id,
    ssd.soru_seti_id,
    t.icerik_turu,
    t.talep_no,
    f.firma_adi,
    t.egitim_turu,
    t.firma_id,
    ym.hedef_roller,
    v.video_suresi_saniye
   FROM yayin_yonetimi ym
     JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
     JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
     JOIN video_durumu vd ON vd.video_durum_id = ss.video_durum_id
     JOIN videolar v ON v.video_id = vd.video_id
     JOIN talepler t ON t.talep_id = v.talep_id
     LEFT JOIN senaryo_durumu sd ON sd.senaryo_durum_id = v.senaryo_durum_id
     LEFT JOIN senaryolar s ON s.senaryo_id = sd.senaryo_id
     LEFT JOIN urunler u ON u.urun_id = t.urun_id
     LEFT JOIN teknikler tek ON tek.teknik_id = t.teknik_id
     LEFT JOIN video_puanlari vp ON vp.video_durum_id = vd.video_durum_id
     LEFT JOIN soru_seti_puanlari ssp ON ssp.soru_seti_durum_id = ym.soru_seti_durum_id
     LEFT JOIN firmalar f ON f.firma_id = t.firma_id
  GROUP BY ym.yayin_id, ym.soru_seti_durum_id, ym.durum, ym.yayin_tarihi, ym.durdurma_tarihi, u.urun_adi, t.urun_adi, tek.teknik_adi, t.takim_id, t.uretici_id, t.video_basi_soru_sayisi, t.soru_seti_buyuklugu, v.video_url, v.thumbnail_url, v.video_suresi_saniye, vp.video_puani, ss.sorular, s.senaryo_metni, s.senaryo_id, sd.senaryo_durum_id, vd.video_durum_id, ssd.soru_seti_id, t.icerik_turu, t.egitim_turu, t.talep_no, f.firma_adi, t.firma_id, ym.hedef_roller;
