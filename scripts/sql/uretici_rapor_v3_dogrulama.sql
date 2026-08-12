-- Merve Duran için yeni üretici raporu ile kaynak tabloların mutabakatı.
WITH parametre AS (
  SELECT
    k.kullanici_id AS uretici_id,
    k.takim_id,
    date_trunc('month', now()) AS baslangic,
    now() AS bitis
  FROM public.kullanicilar k
  WHERE lower(k.ad) = 'merve'
    AND lower(k.soyad) = 'duran'
  LIMIT 1
),
rpc AS (
  SELECT r.*
  FROM parametre p
  CROSS JOIN LATERAL public.get_uretici_rapor_ozet_v3(
    p.uretici_id, p.baslangic, p.bitis
  ) r
),
ham AS (
  SELECT
    COUNT(*) FILTER (
      WHERE t.created_at >= p.baslangic AND t.created_at <= p.bitis
    )::integer AS toplam_talep,
    COUNT(*) FILTER (
      WHERE t.created_at >= p.baslangic
        AND t.created_at <= p.bitis
        AND vit.soru_seti_durum = 'onaylandi'
    )::integer AS tamamlanan_talep
  FROM parametre p
  LEFT JOIN public.talepler t ON t.uretici_id = p.uretici_id
  LEFT JOIN public.v_uretici_icerik_takip vit ON vit.talep_id = t.talep_id
),
yayin AS (
  SELECT
    COUNT(*) FILTER (WHERE lower(yy.durum::text) = 'yayinda')::integer AS yayindaki_video,
    COUNT(*) FILTER (WHERE lower(yy.durum::text) = 'durduruldu')::integer AS durdurulan_video
  FROM parametre p
  LEFT JOIN public.yayin_yonetimi yy ON yy.uretici_id = p.uretici_id
),
saha AS (
  SELECT
    COALESCE(SUM(o.izlenme_sayisi), 0)::integer AS tamamlanan_izleme,
    COUNT(*) FILTER (WHERE o.izlenme_sayisi > 0)::integer AS aktif_utt,
    COALESCE(SUM(o.toplam_net_puan), 0)::integer AS toplam_puan
  FROM parametre p
  LEFT JOIN LATERAL public.get_kullanici_ozet(
    p.baslangic, p.bitis, NULL, NULL, p.takim_id, NULL
  ) o ON true
)
SELECT
  rpc.toplam_talep,
  ham.toplam_talep AS ham_toplam_talep,
  rpc.toplam_talep = ham.toplam_talep AS toplam_esit,
  rpc.tamamlanan_talep,
  ham.tamamlanan_talep AS ham_tamamlanan_talep,
  rpc.tamamlanan_talep = ham.tamamlanan_talep AS tamamlanan_esit,
  rpc.yayindaki_video,
  yayin.yayindaki_video AS ham_yayindaki_video,
  rpc.yayindaki_video = yayin.yayindaki_video AS yayinda_esit,
  rpc.durdurulan_video,
  yayin.durdurulan_video AS ham_durdurulan_video,
  rpc.durdurulan_video = yayin.durdurulan_video AS durdurulan_esit,
  saha.tamamlanan_izleme,
  saha.aktif_utt,
  saha.toplam_puan,
  CASE
    WHEN rpc.toplam_talep = ham.toplam_talep
      AND rpc.tamamlanan_talep = ham.tamamlanan_talep
      AND rpc.yayindaki_video = yayin.yayindaki_video
      AND rpc.durdurulan_video = yayin.durdurulan_video
    THEN 'TEMİZ'
    ELSE 'FARK VAR'
  END AS sonuc
FROM rpc
CROSS JOIN ham
CROSS JOIN yayin
CROSS JOIN saha;
