-- Öğrenme Araçları Genişletmesi — Faz 2 ortak yayın görünümü.
-- `ogrenme_araclari_faz2_ortak_omurga.sql` sonrasında çalıştırılır.
-- Var olan kolonların adı ve sırası korunur; yeni ortak alanlar sona eklenir.

BEGIN;

CREATE OR REPLACE VIEW public.v_yayin_detay AS
SELECT
  ym.yayin_id,
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
  COALESCE(oap.arac_puani, vp.video_puani) AS video_puani,
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
  COALESCE(oa.sure_saniye, v.video_suresi_saniye) AS video_suresi_saniye,
  oa.arac_id,
  oad.arac_durum_id,
  COALESCE(oa.arac_turu, t.ogrenme_araci_turu, 'video') AS arac_turu,
  COALESCE(oap.arac_puani, vp.video_puani) AS ogrenme_araci_puani,
  COALESCE(oa.metadata, '{}'::jsonb) AS arac_metadata,
  oa.metadata_dogrulandi AS arac_metadata_dogrulandi,
  oa.dosya_yolu AS arac_dosya_yolu,
  oa.kapak_yolu AS arac_kapak_yolu,
  oa.mime_type AS arac_mime_type,
  oa.dosya_boyutu AS arac_dosya_boyutu,
  oa.checksum_sha256 AS arac_checksum_sha256,
  oa.sure_saniye AS arac_sure_saniye,
  oa.sayfa_sayisi AS arac_sayfa_sayisi,
  oa.genislik AS arac_genislik,
  oa.yukseklik AS arac_yukseklik
FROM public.yayin_yonetimi ym
JOIN public.soru_seti_durumu ssd
  ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
JOIN public.soru_setleri ss
  ON ss.soru_seti_id = ssd.soru_seti_id
JOIN public.talepler t
  ON t.talep_id = ss.talep_id
LEFT JOIN public.ogrenme_araci_durumu oad
  ON oad.arac_durum_id = COALESCE(ym.arac_durum_id, ss.arac_durum_id)
LEFT JOIN public.ogrenme_araclari oa
  ON oa.arac_id = oad.arac_id
LEFT JOIN public.ogrenme_araci_puanlari oap
  ON oap.arac_durum_id = oad.arac_durum_id
LEFT JOIN public.video_durumu vd
  ON vd.video_durum_id = COALESCE(ss.video_durum_id, oad.legacy_video_durum_id)
LEFT JOIN public.videolar v
  ON v.video_id = COALESCE(vd.video_id, oa.legacy_video_id)
LEFT JOIN public.senaryo_durumu sd
  ON sd.senaryo_durum_id = COALESCE(v.senaryo_durum_id, oa.senaryo_durum_id)
LEFT JOIN public.senaryolar s
  ON s.senaryo_id = sd.senaryo_id
LEFT JOIN public.urunler u
  ON u.urun_id = t.urun_id
LEFT JOIN public.teknikler tek
  ON tek.teknik_id = t.teknik_id
LEFT JOIN public.video_puanlari vp
  ON vp.video_durum_id = vd.video_durum_id
LEFT JOIN public.soru_seti_puanlari ssp
  ON ssp.soru_seti_durum_id = ym.soru_seti_durum_id
LEFT JOIN public.firmalar f
  ON f.firma_id = t.firma_id
GROUP BY
  ym.yayin_id, ym.soru_seti_durum_id, ym.durum, ym.yayin_tarihi, ym.durdurma_tarihi,
  u.urun_adi, t.urun_adi, tek.teknik_adi, t.takim_id, t.uretici_id,
  t.video_basi_soru_sayisi, t.soru_seti_buyuklugu, v.video_url, v.thumbnail_url,
  v.video_suresi_saniye, vp.video_puani, ss.sorular, s.senaryo_metni, s.senaryo_id,
  sd.senaryo_durum_id, vd.video_durum_id, ssd.soru_seti_id, t.icerik_turu,
  t.egitim_turu, t.talep_no, f.firma_adi, t.firma_id, ym.hedef_roller,
  oa.arac_id, oad.arac_durum_id, oa.arac_turu, t.ogrenme_araci_turu,
  oap.arac_puani, oa.metadata, oa.metadata_dogrulandi, oa.dosya_yolu,
  oa.kapak_yolu, oa.mime_type, oa.dosya_boyutu, oa.checksum_sha256,
  oa.sure_saniye, oa.sayfa_sayisi, oa.genislik, oa.yukseklik;

CREATE OR REPLACE VIEW public.v_yayin_kunye AS
SELECT
  ym.yayin_id,
  t.talep_id,
  t.talep_no,
  t.urun_id,
  t.teknik_id,
  t.icerik_turu,
  t.egitim_turu,
  t.firma_id,
  t.takim_id,
  t.uretici_id,
  ym.hedef_roller,
  oa.arac_id,
  oad.arac_durum_id,
  COALESCE(oa.arac_turu, t.ogrenme_araci_turu, 'video') AS arac_turu
FROM public.yayin_yonetimi ym
JOIN public.soru_seti_durumu ssd
  ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
JOIN public.soru_setleri ss
  ON ss.soru_seti_id = ssd.soru_seti_id
JOIN public.talepler t
  ON t.talep_id = ss.talep_id
LEFT JOIN public.ogrenme_araci_durumu oad
  ON oad.arac_durum_id = COALESCE(ym.arac_durum_id, ss.arac_durum_id)
LEFT JOIN public.ogrenme_araclari oa
  ON oa.arac_id = oad.arac_id;

GRANT SELECT ON public.v_yayin_detay TO service_role;
GRANT SELECT ON public.v_yayin_kunye TO service_role;

COMMIT;
