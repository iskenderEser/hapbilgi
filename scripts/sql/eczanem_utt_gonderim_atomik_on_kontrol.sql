-- Eczanem UTT atomik gönderim — CANLI ÖN KONTROL.
-- İskender önce yalnız bu dosyayı çalıştırır. Sonuç boş olmalıdır.

SELECT
  g.gonderim_id,
  g.gonderen_utt_id,
  g.yayin_id,
  g.eczane_id,
  CASE
    WHEN k.kullanici_id IS NULL THEN 'UTT bulunamadı'
    WHEN k.aktif_mi IS NOT TRUE THEN 'UTT pasif'
    WHEN k.rol NOT IN ('utt', 'kd_utt') THEN 'Gönderen rolü UTT değil'
    WHEN y.yayin_id IS NULL THEN 'Yayın bulunamadı'
    WHEN y.firma_id IS DISTINCT FROM k.firma_id THEN 'Yayın başka firmaya ait'
    WHEN y.takim_id IS NOT NULL AND y.takim_id IS DISTINCT FROM k.takim_id THEN 'Yayın başka takıma ait'
    WHEN NOT ('eczanem' = ANY(COALESCE(y.hedef_roller, ARRAY[]::text[]))) THEN 'Yayın Eczanem hedefli değil'
    WHEN ef.id IS NULL THEN 'Aktif UTT-eczane sahipliği yok'
    ELSE 'Bilinmeyen kapsam hatası'
  END AS bulgu
FROM public.eczanem_eczane_gonderimleri g
LEFT JOIN public.kullanicilar k
  ON k.kullanici_id = g.gonderen_utt_id
LEFT JOIN public.v_yayin_detay y
  ON y.yayin_id = g.yayin_id
LEFT JOIN public.eclub_eczane_firma ef
  ON ef.eczane_id = g.eczane_id
 AND ef.baglayan_utt_id = g.gonderen_utt_id
 AND ef.firma_id = k.firma_id
 AND ef.aktif_mi = true
WHERE k.kullanici_id IS NULL
   OR k.aktif_mi IS NOT TRUE
   OR k.rol NOT IN ('utt', 'kd_utt')
   OR y.yayin_id IS NULL
   OR y.firma_id IS DISTINCT FROM k.firma_id
   OR (y.takim_id IS NOT NULL AND y.takim_id IS DISTINCT FROM k.takim_id)
   OR NOT ('eczanem' = ANY(COALESCE(y.hedef_roller, ARRAY[]::text[])))
   OR ef.id IS NULL;
