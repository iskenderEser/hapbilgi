-- Çoklu İçerik Üreticisi — Paket A salt-okuma ön kontrolü.
-- Hiçbir kayıt veya şema nesnesi değiştirmez.

WITH nesneler AS (
  SELECT 'iu_urun_atamalari'::text AS nesne
  UNION ALL SELECT 'iu_genel_atamalari'
  UNION ALL SELECT 'uretim_gorevleri'
  UNION ALL SELECT 'uretim_gorev_atama_gecmisi'
), kontroller AS (
  SELECT
    'NESNE_CAKISMASI'::text AS kontrol,
    n.nesne,
    CASE WHEN to_regclass('public.' || n.nesne) IS NULL THEN 'YOK' ELSE 'VAR' END AS sonuc
  FROM nesneler n

  UNION ALL

  SELECT
    'IU_SAYISI',
    'toplam / aktif',
    count(*)::text || ' / ' || count(*) FILTER (WHERE aktif_mi IS TRUE)::text
  FROM public.kullanicilar
  WHERE lower(rol) = 'iu'

  UNION ALL

  SELECT
    'URUN_SAYISI',
    'atanabilir ürün',
    count(*)::text
  FROM public.urunler

  UNION ALL

  SELECT
    'URUNSUZ_TALEP',
    coalesce(egitim_turu, '(boş)'),
    count(*)::text
  FROM public.talepler
  WHERE urun_id IS NULL
  GROUP BY egitim_turu
), sahiplik AS (
  SELECT 'SAHIPLIK'::text AS kontrol, 'senaryo / ' || coalesce(iu_id::text, 'null') AS nesne, count(*)::text AS sonuc
  FROM public.senaryolar
  GROUP BY iu_id

  UNION ALL

  SELECT 'SAHIPLIK', 'video / ' || coalesce(iu_id::text, 'null'), count(*)::text
  FROM public.videolar
  GROUP BY iu_id

  UNION ALL

  SELECT 'SAHIPLIK', 'soru_seti / ' || coalesce(iu_id::text, 'null'), count(*)::text
  FROM public.soru_setleri
  GROUP BY iu_id
)
SELECT kontrol, nesne, sonuc
FROM kontroller
UNION ALL
SELECT kontrol, nesne, sonuc
FROM sahiplik
ORDER BY 1, 2;
