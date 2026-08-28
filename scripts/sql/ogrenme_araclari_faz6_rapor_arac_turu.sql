-- Öğrenme Araçları Genişletmesi — Faz 6 / araç türü rapor kaynağı.
BEGIN;

CREATE OR REPLACE VIEW public.v_rapor_arac_turu_ozet AS
WITH utt AS (
  SELECT yayin_id, count(*)::integer AS baslatma, count(*) FILTER (WHERE tamamlandi_mi)::integer AS tamamlama
  FROM public.izleme_kayitlari GROUP BY yayin_id
), cc AS (
  SELECT yayin_id, count(*)::integer AS baslatma, count(*) FILTER (WHERE tamamlandi_mi)::integer AS tamamlama
  FROM public.cc_izleme_kayitlari GROUP BY yayin_id
), eclub AS (
  SELECT yayin_id, count(*)::integer AS baslatma, count(*) FILTER (WHERE tamamlandi_mi)::integer AS tamamlama
  FROM public.eclub_izleme_kayitlari GROUP BY yayin_id
), eczanem AS (
  SELECT yayin_id, count(*)::integer AS baslatma, count(*) FILTER (WHERE tamamlandi_mi)::integer AS tamamlama
  FROM public.eczanem_izleme_kayitlari GROUP BY yayin_id
)
SELECT
  y.yayin_id, y.yayin_tarihi, y.durum, y.firma_id, y.takim_id, y.uretici_id,
  y.icerik_turu, y.arac_turu, COALESCE(y.ogrenme_araci_puani, 0)::integer AS arac_puani,
  COALESCE(utt.baslatma, 0) AS utt_baslatma, COALESCE(utt.tamamlama, 0) AS utt_tamamlama,
  COALESCE(cc.baslatma, 0) AS bm_baslatma, COALESCE(cc.tamamlama, 0) AS bm_tamamlama,
  COALESCE(eclub.baslatma, 0) AS eclub_baslatma, COALESCE(eclub.tamamlama, 0) AS eclub_tamamlama,
  COALESCE(eczanem.baslatma, 0) AS eczanem_baslatma, COALESCE(eczanem.tamamlama, 0) AS eczanem_tamamlama,
  COALESCE(utt.baslatma, 0) + COALESCE(cc.baslatma, 0) + COALESCE(eclub.baslatma, 0) + COALESCE(eczanem.baslatma, 0) AS toplam_baslatma,
  COALESCE(utt.tamamlama, 0) + COALESCE(cc.tamamlama, 0) + COALESCE(eclub.tamamlama, 0) + COALESCE(eczanem.tamamlama, 0) AS toplam_tamamlama
FROM public.v_yayin_detay y
LEFT JOIN utt ON utt.yayin_id = y.yayin_id
LEFT JOIN cc ON cc.yayin_id = y.yayin_id
LEFT JOIN eclub ON eclub.yayin_id = y.yayin_id
LEFT JOIN eczanem ON eczanem.yayin_id = y.yayin_id;

GRANT SELECT ON public.v_rapor_arac_turu_ozet TO service_role;
COMMIT;
SELECT to_regclass('public.v_rapor_arac_turu_ozet') IS NOT NULL AS arac_turu_rapor_kaynagi_kuruldu;
