-- Öğrenme Araçları Genişletmesi — Faz 6 puan bağı teşhisi
-- Salt okunurdur; veri değiştirmez.

SELECT 'utt' AS kanal, p.kazanilan_puan_id AS puan_kayit_id,
  p.izleme_id, p.kullanici_id AS puan_sahibi, i.kullanici_id AS izleme_sahibi,
  p.yayin_id AS puan_yayini, i.yayin_id AS izleme_yayini
FROM public.kazanilan_puanlar p
LEFT JOIN public.izleme_kayitlari i ON i.izleme_id=p.izleme_id
WHERE i.izleme_id IS NULL
   OR i.kullanici_id IS DISTINCT FROM p.kullanici_id
   OR i.yayin_id IS DISTINCT FROM p.yayin_id

UNION ALL

SELECT 'bm', p.puan_id, p.izleme_id, p.bm_id, i.bm_id, p.yayin_id, i.yayin_id
FROM public.cc_kazanilan_puanlar p
LEFT JOIN public.cc_izleme_kayitlari i ON i.izleme_id=p.izleme_id
WHERE (p.puan_turu IN ('izleme','cevaplama','extra') AND (
  i.izleme_id IS NULL OR i.bm_id IS DISTINCT FROM p.bm_id OR i.yayin_id IS DISTINCT FROM p.yayin_id
)) OR (p.puan_turu='cc_gonderme' AND NOT EXISTS (
  SELECT 1 FROM public.challenge_kayitlari c
  WHERE c.challenge_id=p.challenge_id AND c.gonderen_id=p.bm_id AND c.yayin_id=p.yayin_id
)) OR (p.puan_turu='cc_referral' AND NOT EXISTS (
  SELECT 1 FROM public.challenge_kayitlari c
  JOIN public.cc_izleme_kayitlari ci ON ci.izleme_id=p.izleme_id AND ci.challenge_id=c.challenge_id
  WHERE c.challenge_id=p.challenge_id AND c.gonderen_id=p.bm_id AND c.alan_id=ci.bm_id
    AND c.yayin_id=p.yayin_id AND ci.yayin_id=p.yayin_id
))

UNION ALL

SELECT 'eclub', p.kazanilan_puan_id, p.izleme_id, p.kisi_id, i.kisi_id,
  p.yayin_id, i.yayin_id
FROM public.eclub_kazanilan_puanlar p
LEFT JOIN public.eclub_izleme_kayitlari i ON i.izleme_id=p.izleme_id
WHERE i.izleme_id IS NULL
   OR i.kisi_id IS DISTINCT FROM p.kisi_id
   OR i.yayin_id IS DISTINCT FROM p.yayin_id

UNION ALL

SELECT 'eczanem', p.kayit_id, p.izleme_id, p.musteri_id, i.musteri_id,
  g.yayin_id, i.yayin_id
FROM public.eczanem_puan_kayitlari p
LEFT JOIN public.eczanem_izleme_kayitlari i ON i.izleme_id=p.izleme_id
LEFT JOIN public.eczanem_gonderimler g ON g.gonderim_id=i.gonderim_id
LEFT JOIN public.v_yayin_kunye ky ON ky.yayin_id=i.yayin_id
WHERE p.izleme_id IS NOT NULL AND (
  i.izleme_id IS NULL
  OR i.musteri_id IS DISTINCT FROM p.musteri_id
  OR g.yayin_id IS DISTINCT FROM i.yayin_id
  OR g.eczane_id IS DISTINCT FROM p.eczane_id
  OR ky.firma_id IS DISTINCT FROM p.firma_id
)
ORDER BY kanal, puan_kayit_id;
