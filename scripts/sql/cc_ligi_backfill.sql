-- scripts/sql/cc_ligi_backfill.sql
--
-- CC Ligi ölçek — cc_ligi_ozet günlük backfill.
-- Mevcut 4 besleyen tablodan kişi × gün kovalarını tek seferde doldurur.
-- Yetkili tam-hesap (SET): trigger aktifken en son koşulur, tekrar güvenli.

INSERT INTO public.cc_ligi_ozet AS o
  (kullanici_id, tarih,
   izleme_puani, cevaplama_puani, extra_puani, cc_gonderme_puani, cc_referral_puani,
   ileri_sarma_kaybi, yanlis_cevap_kaybi, challenge_kaybi, guncellenme)
SELECT
  t.kullanici_id, (t.created_at)::date,
  SUM(t.izleme), SUM(t.cevaplama), SUM(t.extra), SUM(t.ccg), SUM(t.ccr),
  SUM(t.ileri), SUM(t.yanlis), SUM(t.challenge), now()
FROM (
  SELECT kullanici_id, created_at,
    CASE WHEN puan_turu='izleme'      THEN puan ELSE 0 END AS izleme,
    CASE WHEN puan_turu='cevaplama'   THEN puan ELSE 0 END AS cevaplama,
    CASE WHEN puan_turu='extra'       THEN puan ELSE 0 END AS extra,
    CASE WHEN puan_turu='cc_gonderme' THEN puan ELSE 0 END AS ccg,
    CASE WHEN puan_turu='cc_referral' THEN puan ELSE 0 END AS ccr,
    0 AS ileri, 0 AS yanlis, 0 AS challenge
  FROM kazanilan_puanlar
  UNION ALL
  SELECT kullanici_id, created_at, 0,0,0,0,0, kaybedilen_puan, 0, 0 FROM ileri_sarma_kayitlari
  UNION ALL
  SELECT kullanici_id, created_at, 0,0,0,0,0, 0, kaybedilen_puan, 0 FROM yanlis_cevap_kayitlari
  UNION ALL
  SELECT kullanici_id, created_at, 0,0,0,0,0, 0, 0, kaybedilen_puan FROM challenge_kayip_kayitlari
) t
GROUP BY t.kullanici_id, (t.created_at)::date
ON CONFLICT (kullanici_id, tarih) DO UPDATE SET
  izleme_puani       = EXCLUDED.izleme_puani,
  cevaplama_puani    = EXCLUDED.cevaplama_puani,
  extra_puani        = EXCLUDED.extra_puani,
  cc_gonderme_puani  = EXCLUDED.cc_gonderme_puani,
  cc_referral_puani  = EXCLUDED.cc_referral_puani,
  ileri_sarma_kaybi  = EXCLUDED.ileri_sarma_kaybi,
  yanlis_cevap_kaybi = EXCLUDED.yanlis_cevap_kaybi,
  challenge_kaybi    = EXCLUDED.challenge_kaybi,
  guncellenme        = now();
