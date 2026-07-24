-- scripts/sql/v_yayin_detay_urun_adi_fallback.sql
--
-- Ürün adı isteğe/serbest ad düzenlemesi (İskender 24.07.2026).
-- Ürün de teknik de olmayan türlerde (medikal_egitim, ik_egitimi) izleyici başlığı
-- talepler.urun_adi serbest metninden gelir. Bu view eskiden urun_adi'nı yalnız
-- urunler join'inden (u.urun_adi) alıyordu → ürünsüz taleplerde başlık boştu.
--
-- DEĞİŞİKLİKLER:
--  1) u.urun_adi → COALESCE(u.urun_adi, t.urun_adi); t.urun_adi GROUP BY'a eklendi.
--  2) t.egitim_turu eklendi (24.07 ikinci tur) — yayın kartlarında içerik/eğitim
--     türü etiketi için (bekleyenlerle simetri). GROUP BY'a da eklendi.
-- Diğer tüm alanlar ve join'ler aynen korunmuştur.
--
-- KOŞUM: Supabase SQL editöründe bir kez. Yeniden koşum güvenli (CREATE OR REPLACE VIEW).

CREATE OR REPLACE VIEW public.v_yayin_detay AS
 SELECT ym.yayin_id,
    ym.soru_seti_durum_id,
    ym.durum,
    ym.yayin_tarihi,
    ym.durdurma_tarihi,
    COALESCE(u.urun_adi, t.urun_adi) AS urun_adi,
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
    t.hedef_rol,
    t.talep_no,
    f.firma_adi,
    t.egitim_turu
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
  GROUP BY ym.yayin_id, ym.soru_seti_durum_id, ym.durum, ym.yayin_tarihi, ym.durdurma_tarihi,
    u.urun_adi, t.urun_adi, tek.teknik_adi, t.takim_id, t.uretici_id, t.video_basi_soru_sayisi,
    t.soru_seti_buyuklugu, v.video_url, v.thumbnail_url, vp.video_puani, ss.sorular,
    s.senaryo_metni, s.senaryo_id, sd.senaryo_durum_id, vd.video_durum_id, ssd.soru_seti_id,
    t.icerik_turu, t.egitim_turu, t.hedef_rol, t.talep_no, f.firma_adi;
