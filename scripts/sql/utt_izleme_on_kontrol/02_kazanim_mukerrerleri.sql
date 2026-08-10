-- 2/5 — Yeni unique indexi engelleyecek izleme/extra/öneri mükerrerleri.
-- SALT OKUMA — beklenen sonuç: satır yok.
SELECT izleme_id, puan_turu, COUNT(*) AS adet
FROM public.kazanilan_puanlar
WHERE puan_turu IN ('izleme', 'extra', 'oneri')
GROUP BY izleme_id, puan_turu
HAVING COUNT(*) > 1
ORDER BY adet DESC, izleme_id;
