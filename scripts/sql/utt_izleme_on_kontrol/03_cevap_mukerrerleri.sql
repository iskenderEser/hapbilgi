-- 3/5 — Aynı izleme ve soru için mükerrer cevaplar.
-- SALT OKUMA — beklenen sonuç: satır yok.
SELECT izleme_id, soru_index, COUNT(*) AS adet
FROM public.soru_cevaplari
GROUP BY izleme_id, soru_index
HAVING COUNT(*) > 1
ORDER BY adet DESC, izleme_id, soru_index;
