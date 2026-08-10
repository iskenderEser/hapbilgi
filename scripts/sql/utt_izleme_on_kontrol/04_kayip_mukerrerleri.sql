-- 4/5 — Aynı izleme ve soru için mükerrer yanlış cevap kayıpları.
-- SALT OKUMA — beklenen sonuç: satır yok.
SELECT izleme_id, soru_index, COUNT(*) AS adet
FROM public.yanlis_cevap_kayitlari
GROUP BY izleme_id, soru_index
HAVING COUNT(*) > 1
ORDER BY adet DESC, izleme_id, soru_index;
