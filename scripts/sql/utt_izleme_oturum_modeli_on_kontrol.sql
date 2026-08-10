-- UTT izleme oturum modeli — SALT OKUMA ön kontrolü.
-- Canlı DB'de yalnız İskender tarafından, uygulama SQL'inden ÖNCE çalıştırılır.
-- Hiçbir satır veya şema değiştirmez.

-- 1) Geçiş kapsamı: eski tamamlanmış / ileri sarmalı yarım / belirsiz yarım kayıtlar.
SELECT
  COUNT(*) FILTER (WHERE ik.tamamlandi_mi = true) AS tamamlanmis,
  COUNT(*) FILTER (
    WHERE COALESCE(ik.tamamlandi_mi, false) = false
      AND EXISTS (
        SELECT 1 FROM public.ileri_sarma_kayitlari isk
        WHERE isk.izleme_id = ik.izleme_id
      )
  ) AS ileri_sarmali_yarim,
  COUNT(*) FILTER (
    WHERE COALESCE(ik.tamamlandi_mi, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM public.ileri_sarma_kayitlari isk
        WHERE isk.izleme_id = ik.izleme_id
      )
  ) AS eski_belirsiz_yarim
FROM public.izleme_kayitlari ik;

-- 2) Yeni unique indexi engelleyecek izleme/extra/öneri mükerrerleri.
SELECT izleme_id, puan_turu, COUNT(*) AS adet
FROM public.kazanilan_puanlar
WHERE puan_turu IN ('izleme', 'extra', 'oneri')
GROUP BY izleme_id, puan_turu
HAVING COUNT(*) > 1
ORDER BY adet DESC, izleme_id;

-- 3) Aynı izleme+soru için mükerrer cevaplar.
SELECT izleme_id, soru_index, COUNT(*) AS adet
FROM public.soru_cevaplari
GROUP BY izleme_id, soru_index
HAVING COUNT(*) > 1
ORDER BY adet DESC, izleme_id, soru_index;

-- 4) Aynı izleme+soru için mükerrer yanlış cevap kayıpları.
SELECT izleme_id, soru_index, COUNT(*) AS adet
FROM public.yanlis_cevap_kayitlari
GROUP BY izleme_id, soru_index
HAVING COUNT(*) > 1
ORDER BY adet DESC, izleme_id, soru_index;

-- 5) Cevabı olan tamamlanmış izleme sayısı (soru hakkı backfill girdisi).
SELECT COUNT(DISTINCT ik.izleme_id) AS cevaplanmis_tamamlanmis_izleme
FROM public.izleme_kayitlari ik
JOIN public.soru_cevaplari sc ON sc.izleme_id = ik.izleme_id
WHERE ik.tamamlandi_mi = true;
