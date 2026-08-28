-- Faz 6 — puan tekillik mutabakatı (salt okunur)
SELECT kanal, izleme_id, puan_turu, adet
FROM (
  SELECT 'utt' AS kanal, izleme_id, puan_turu, COUNT(*) AS adet
  FROM public.kazanilan_puanlar
  WHERE puan_turu IN ('izleme','extra','oneri')
  GROUP BY izleme_id, puan_turu

  UNION ALL

  SELECT 'bm' AS kanal, izleme_id, puan_turu, COUNT(*) AS adet
  FROM public.cc_kazanilan_puanlar
  WHERE izleme_id IS NOT NULL AND puan_turu IN ('izleme','extra')
  GROUP BY izleme_id, puan_turu

  UNION ALL

  SELECT 'eclub' AS kanal, izleme_id, puan_turu, COUNT(*) AS adet
  FROM public.eclub_kazanilan_puanlar
  GROUP BY izleme_id, puan_turu

  UNION ALL

  SELECT 'eczanem' AS kanal, izleme_id, puan_turu, COUNT(*) AS adet
  FROM public.eczanem_puan_kayitlari
  WHERE izleme_id IS NOT NULL
  GROUP BY izleme_id, puan_turu
) AS puanlar
WHERE adet > 1;
