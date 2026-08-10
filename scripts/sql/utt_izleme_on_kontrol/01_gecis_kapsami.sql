-- 1/5 — Eski tamamlanmış, ileri sarmalı yarım ve belirsiz yarım kayıtlar.
-- SALT OKUMA
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
