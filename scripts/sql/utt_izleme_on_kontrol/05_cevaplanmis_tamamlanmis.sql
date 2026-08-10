-- 5/5 — Cevabı olan tamamlanmış izlemeler; soru hakkı backfill girdisi.
-- SALT OKUMA
SELECT COUNT(DISTINCT ik.izleme_id) AS cevaplanmis_tamamlanmis_izleme
FROM public.izleme_kayitlari ik
JOIN public.soru_cevaplari sc ON sc.izleme_id = ik.izleme_id
WHERE ik.tamamlandi_mi = true;
