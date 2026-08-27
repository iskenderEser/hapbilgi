-- Öğrenme Araçları Genişletmesi — Faz 2 migration ön kontrolü.
-- Yalnız okur; ortak omurga migration'ından önce çalıştırılır.

SELECT current_database() AS veritabani, now() AS kontrol_zamani;

SELECT eksik_tablo
FROM unnest(ARRAY[
  'talepler', 'videolar', 'video_durumu', 'video_puanlari',
  'soru_setleri', 'soru_seti_durumu', 'yayin_yonetimi', 'uretim_gorevleri',
  'izleme_kayitlari', 'cc_izleme_kayitlari', 'eclub_izleme_kayitlari',
  'eczanem_izleme_kayitlari'
]) AS eksik_tablo
WHERE to_regclass('public.' || eksik_tablo) IS NULL;

-- Sonuç boş olmalıdır. Yeni durum sözleşmesine alınmamış tarihî bir değer varsa
-- migration CHECK kısıtına çarpmadan önce görünür hale gelir.
SELECT durum, count(*) AS kayit_sayisi
FROM public.video_durumu
WHERE durum NOT IN (
  'yukleme_bekliyor', 'dogrulama_bekliyor', 'inceleme bekleniyor',
  'revizyon bekleniyor', 'onaylandi', 'reddedildi', 'Iptal Edildi', 'iptal'
)
GROUP BY durum
ORDER BY durum;

-- Bilgi amaçlı başlangıç sayıları; migration sonu sıfır-sapma sorgusuyla
-- karşılaştırılır.
SELECT
  count(*) FILTER (WHERE talep_id IS NOT NULL) AS aktarilabilir_video,
  count(*) FILTER (WHERE talep_id IS NULL) AS talebi_olmayan_tarihi_video
FROM public.videolar;

SELECT
  (SELECT count(*) FROM public.video_durumu) AS video_durum_sayisi,
  (SELECT count(*) FROM public.video_puanlari) AS video_puan_sayisi,
  (SELECT count(*) FROM public.yayin_yonetimi) AS yayin_sayisi;

