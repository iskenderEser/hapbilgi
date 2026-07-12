-- T-D6 — Puansız pencere ihlali: puan penceresi dışında (TR saati — B-12 ile
-- kod da Europe/Istanbul'a sabit) başlayan izlemeye bağlı kazanım kaydı.
-- Pencere: Pzt-Cum 07:00-20:29 (420-1229 dk). Boş dönüş = temiz.
SELECT kp.kazanilan_puan_id::text, kp.puan_turu, ik.izleme_baslangic
FROM kazanilan_puanlar kp
JOIN izleme_kayitlari ik ON ik.izleme_id = kp.izleme_id
WHERE EXTRACT(dow FROM ik.izleme_baslangic AT TIME ZONE 'Europe/Istanbul') IN (0, 6)
   OR (EXTRACT(hour   FROM ik.izleme_baslangic AT TIME ZONE 'Europe/Istanbul') * 60
     + EXTRACT(minute FROM ik.izleme_baslangic AT TIME ZONE 'Europe/Istanbul'))
      NOT BETWEEN 420 AND 1229;
