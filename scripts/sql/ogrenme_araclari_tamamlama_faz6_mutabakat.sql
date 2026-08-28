-- Öğrenme Araçları Genişletmesi — Faz 6 salt okunur mutabakat
-- Hiçbir veri değiştirmez. Her sonuç kümesinde satır sayısının 0 olması beklenir.

-- 1) Puan satırı, izleme sahibi ve yayın bağı uyuşmazlıkları.
SELECT 'utt' AS kanal, p.kazanilan_puan_id AS kayit_id, p.yayin_id, p.izleme_id
FROM public.kazanilan_puanlar p
WHERE NOT EXISTS (SELECT 1 FROM public.izleme_kayitlari i WHERE i.izleme_id=p.izleme_id AND i.kullanici_id=p.kullanici_id AND i.yayin_id=p.yayin_id)
UNION ALL
SELECT 'bm', p.puan_id, p.yayin_id, p.izleme_id
FROM public.cc_kazanilan_puanlar p
WHERE (p.puan_turu IN ('izleme','cevaplama','extra') AND NOT EXISTS (
  SELECT 1 FROM public.cc_izleme_kayitlari i
  WHERE i.izleme_id=p.izleme_id AND i.bm_id=p.bm_id AND i.yayin_id=p.yayin_id
)) OR (p.puan_turu='cc_gonderme' AND NOT EXISTS (
  SELECT 1 FROM public.challenge_kayitlari c
  WHERE c.challenge_id=p.challenge_id AND c.gonderen_id=p.bm_id AND c.yayin_id=p.yayin_id
)) OR (p.puan_turu='cc_referral' AND NOT EXISTS (
  SELECT 1 FROM public.challenge_kayitlari c
  JOIN public.cc_izleme_kayitlari i ON i.izleme_id=p.izleme_id AND i.challenge_id=c.challenge_id
  WHERE c.challenge_id=p.challenge_id AND c.gonderen_id=p.bm_id AND c.alan_id=i.bm_id
    AND c.yayin_id=p.yayin_id AND i.yayin_id=p.yayin_id
))
UNION ALL
SELECT 'eclub', p.kazanilan_puan_id, p.yayin_id, p.izleme_id
FROM public.eclub_kazanilan_puanlar p
WHERE NOT EXISTS (SELECT 1 FROM public.eclub_izleme_kayitlari i WHERE i.izleme_id=p.izleme_id AND i.kisi_id=p.kisi_id AND i.yayin_id=p.yayin_id)
UNION ALL
SELECT 'eczanem', p.kayit_id, i.yayin_id, p.izleme_id
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
);

-- 2) Aynı tamamlamadan mükerrer puan.
SELECT kanal, izleme_id, puan_turu, adet
FROM (
  SELECT 'utt' kanal, izleme_id, puan_turu, COUNT(*) adet FROM public.kazanilan_puanlar WHERE puan_turu IN ('izleme','extra','oneri') GROUP BY izleme_id, puan_turu
  UNION ALL
  SELECT 'bm', izleme_id, puan_turu, COUNT(*) FROM public.cc_kazanilan_puanlar WHERE izleme_id IS NOT NULL AND puan_turu IN ('izleme','extra') GROUP BY izleme_id, puan_turu
  UNION ALL
  SELECT 'eclub', izleme_id, puan_turu, COUNT(*) FROM public.eclub_kazanilan_puanlar GROUP BY izleme_id, puan_turu
  UNION ALL
  SELECT 'eczanem', izleme_id, puan_turu, COUNT(*) FROM public.eczanem_puan_kayitlari WHERE izleme_id IS NOT NULL GROUP BY izleme_id, puan_turu
) x WHERE adet > 1;

-- 3) UTT kaynak defteri ile HB Ligi günlük özeti farkı.
WITH kaynak AS (
  SELECT kullanici_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date tarih,
    SUM(puan) FILTER (WHERE puan_turu='izleme')::bigint izleme,
    SUM(puan) FILTER (WHERE puan_turu='cevaplama')::bigint cevaplama,
    SUM(puan) FILTER (WHERE puan_turu='oneri')::bigint oneri,
    SUM(puan) FILTER (WHERE puan_turu='extra')::bigint extra
  FROM public.kazanilan_puanlar GROUP BY kullanici_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date
), kayip AS (
  SELECT kullanici_id, tarih,
    SUM(ileri)::bigint ileri, SUM(yanlis)::bigint yanlis, SUM(oneri)::bigint oneri
  FROM (
    SELECT kullanici_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date tarih, kaybedilen_puan ileri, 0 yanlis, 0 oneri FROM public.ileri_sarma_kayitlari
    UNION ALL SELECT kullanici_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date, 0, kaybedilen_puan, 0 FROM public.yanlis_cevap_kayitlari
    UNION ALL SELECT kullanici_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date, 0, 0, kaybedilen_puan FROM public.oneri_kayip_kayitlari
  ) x GROUP BY kullanici_id, tarih
), beklenen AS (
  SELECT COALESCE(k.kullanici_id,l.kullanici_id) kullanici_id, COALESCE(k.tarih,l.tarih) tarih,
    COALESCE(k.izleme,0) izleme, COALESCE(k.cevaplama,0) cevaplama, COALESCE(k.oneri,0) oneri, COALESCE(k.extra,0) extra,
    COALESCE(l.ileri,0) ileri, COALESCE(l.yanlis,0) yanlis, COALESCE(l.oneri,0) oneri_kaybi
  FROM kaynak k FULL JOIN kayip l USING (kullanici_id,tarih)
)
SELECT COALESCE(b.kullanici_id,o.kullanici_id) kullanici_id, COALESCE(b.tarih,o.tarih) tarih
FROM beklenen b FULL JOIN public.hb_ligi_ozet_v2 o USING (kullanici_id,tarih)
WHERE ROW(COALESCE(b.izleme,0),COALESCE(b.cevaplama,0),COALESCE(b.oneri,0),COALESCE(b.extra,0),COALESCE(b.ileri,0),COALESCE(b.yanlis,0),COALESCE(b.oneri_kaybi,0))
   IS DISTINCT FROM ROW(COALESCE(o.izleme_puani,0),COALESCE(o.cevaplama_puani,0),COALESCE(o.oneri_puani,0),COALESCE(o.extra_puani,0),COALESCE(o.ileri_sarma_kaybi,0),COALESCE(o.yanlis_cevap_kaybi,0),COALESCE(o.oneri_kaybi,0));

-- 4) BM kaynak defteri ile CC Ligi günlük özeti farkı.
WITH hareket AS (
  SELECT bm_id kullanici_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date tarih,
    SUM(puan) FILTER (WHERE puan_turu='izleme')::bigint izleme,
    SUM(puan) FILTER (WHERE puan_turu='cevaplama')::bigint cevaplama,
    SUM(puan) FILTER (WHERE puan_turu='extra')::bigint extra,
    SUM(puan) FILTER (WHERE puan_turu='cc_gonderme')::bigint gonderme,
    SUM(puan) FILTER (WHERE puan_turu='cc_referral')::bigint referral
  FROM public.cc_kazanilan_puanlar GROUP BY bm_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date
), kayip AS (
  SELECT bm_id kullanici_id, tarih, SUM(ileri)::bigint ileri, SUM(yanlis)::bigint yanlis, SUM(challenge)::bigint challenge
  FROM (
    SELECT bm_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date tarih, kaybedilen_puan ileri, 0 yanlis, 0 challenge FROM public.cc_ileri_sarma_kayitlari
    UNION ALL SELECT bm_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date, 0, kaybedilen_puan, 0 FROM public.cc_yanlis_cevap_kayitlari
    UNION ALL SELECT kullanici_id, (created_at AT TIME ZONE 'Europe/Istanbul')::date, 0, 0, kaybedilen_puan FROM public.challenge_kayip_kayitlari
  ) x GROUP BY bm_id,tarih
), beklenen AS (
  SELECT COALESCE(h.kullanici_id,k.kullanici_id) kullanici_id, COALESCE(h.tarih,k.tarih) tarih,
    COALESCE(h.izleme,0) izleme, COALESCE(h.cevaplama,0) cevaplama, COALESCE(h.extra,0) extra, COALESCE(h.gonderme,0) gonderme, COALESCE(h.referral,0) referral,
    COALESCE(k.ileri,0) ileri, COALESCE(k.yanlis,0) yanlis, COALESCE(k.challenge,0) challenge
  FROM hareket h FULL JOIN kayip k USING (kullanici_id,tarih)
)
SELECT COALESCE(b.kullanici_id,o.kullanici_id) kullanici_id, COALESCE(b.tarih,o.tarih) tarih
FROM beklenen b FULL JOIN public.cc_ligi_ozet o USING (kullanici_id,tarih)
WHERE ROW(COALESCE(b.izleme,0),COALESCE(b.cevaplama,0),COALESCE(b.extra,0),COALESCE(b.gonderme,0),COALESCE(b.referral,0),COALESCE(b.ileri,0),COALESCE(b.yanlis,0),COALESCE(b.challenge,0))
   IS DISTINCT FROM ROW(COALESCE(o.izleme_puani,0),COALESCE(o.cevaplama_puani,0),COALESCE(o.extra_puani,0),COALESCE(o.cc_gonderme_puani,0),COALESCE(o.cc_referral_puani,0),COALESCE(o.ileri_sarma_kaybi,0),COALESCE(o.yanlis_cevap_kaybi,0),COALESCE(o.challenge_kaybi,0));

-- 5) HBStore puan/kayıp/harcama defteri ile kanonik kasa bakiyesi farkı.
WITH sinir AS (
  SELECT date_trunc('quarter',clock_timestamp()) baslangic,
    date_trunc('quarter',clock_timestamp())+interval '3 months' bitis
), utt AS (
  SELECT kullanici_id, SUM(delta)::bigint net
  FROM (
    SELECT kullanici_id, puan::bigint delta FROM public.kazanilan_puanlar,sinir WHERE created_at>=baslangic AND created_at<bitis
    UNION ALL SELECT kullanici_id, -kaybedilen_puan FROM public.ileri_sarma_kayitlari,sinir WHERE created_at>=baslangic AND created_at<bitis
    UNION ALL SELECT kullanici_id, -kaybedilen_puan FROM public.yanlis_cevap_kayitlari,sinir WHERE created_at>=baslangic AND created_at<bitis
    UNION ALL SELECT kullanici_id, -kaybedilen_puan FROM public.oneri_kayip_kayitlari,sinir WHERE created_at>=baslangic AND created_at<bitis
  ) x GROUP BY kullanici_id
), bm AS (
  SELECT kullanici_id, SUM(delta)::bigint net
  FROM (
    SELECT bm_id kullanici_id, puan::bigint delta FROM public.cc_kazanilan_puanlar,sinir WHERE created_at>=baslangic AND created_at<bitis
    UNION ALL SELECT bm_id, -kaybedilen_puan FROM public.cc_ileri_sarma_kayitlari,sinir WHERE created_at>=baslangic AND created_at<bitis
    UNION ALL SELECT bm_id, -kaybedilen_puan FROM public.cc_yanlis_cevap_kayitlari,sinir WHERE created_at>=baslangic AND created_at<bitis
    UNION ALL SELECT kullanici_id, -kaybedilen_puan FROM public.challenge_kayip_kayitlari,sinir WHERE created_at>=baslangic AND created_at<bitis
  ) x GROUP BY kullanici_id
), harcama AS (
  SELECT kullanici_id, SUM(CASE WHEN tur='harcama' THEN puan_miktari WHEN tur='iade' THEN -puan_miktari ELSE 0 END)::bigint net
  FROM public.store_puan_harcamalari,sinir WHERE created_at>=baslangic AND created_at<bitis GROUP BY kullanici_id
), beklenen AS (
  SELECT k.kullanici_id,
    CASE WHEN k.rol='bm' THEN COALESCE(b.net,0) ELSE COALESCE(u.net,0) END-COALESCE(h.net,0) bakiye
  FROM public.kullanicilar k
  LEFT JOIN utt u USING (kullanici_id)
  LEFT JOIN bm b USING (kullanici_id)
  LEFT JOIN harcama h USING (kullanici_id)
  WHERE k.rol IN ('utt','kd_utt','bm')
)
SELECT b.kullanici_id, GREATEST(b.bakiye,0) beklenen_bakiye, public.get_harcama_bakiyesi(b.kullanici_id) kanonik_bakiye
FROM beklenen b
WHERE GREATEST(b.bakiye,0) IS DISTINCT FROM public.get_harcama_bakiyesi(b.kullanici_id);

-- 6) E-Club Store firma puanı/kaybı/harcaması ile kanonik bakiye farkı.
WITH kazanc AS (
  SELECT p.kisi_id, ky.firma_id, SUM(p.puan)::bigint kazanilan
  FROM public.eclub_kazanilan_puanlar p JOIN public.v_yayin_kunye ky ON ky.yayin_id=p.yayin_id
  GROUP BY p.kisi_id,ky.firma_id
), kayip AS (
  SELECT p.kisi_id, ky.firma_id, SUM(p.kaybedilen_puan)::bigint kaybedilen
  FROM public.eclub_ileri_sarma_kayitlari p JOIN public.v_yayin_kunye ky ON ky.yayin_id=p.yayin_id
  GROUP BY p.kisi_id,ky.firma_id
), harcama AS (
  SELECT s.kisi_id,p.firma_id,SUM(p.kullanilan_puan)::bigint harcanan
  FROM public.eclub_store_siparis_firma_puan p JOIN public.eclub_store_siparisler s ON s.siparis_id=p.siparis_id
  WHERE s.durum<>'iptal' GROUP BY s.kisi_id,p.firma_id
), anahtar AS (
  SELECT kisi_id,firma_id FROM kazanc UNION SELECT kisi_id,firma_id FROM kayip UNION SELECT kisi_id,firma_id FROM harcama
), ham_beklenen AS (
  SELECT a.kisi_id,a.firma_id,COALESCE(k.kazanilan,0)-COALESCE(y.kaybedilen,0)-COALESCE(h.harcanan,0) bakiye
  FROM anahtar a LEFT JOIN kazanc k USING(kisi_id,firma_id) LEFT JOIN kayip y USING(kisi_id,firma_id) LEFT JOIN harcama h USING(kisi_id,firma_id)
), beklenen AS (
  SELECT h.* FROM ham_beklenen h
  JOIN public.firmalar f USING(firma_id)
  WHERE f.eclub_store_aktif=true AND h.bakiye>0
), gercek AS (
  SELECT k.kisi_id,b.firma_id,b.bakiye
  FROM (SELECT DISTINCT kisi_id FROM anahtar) k CROSS JOIN LATERAL public.get_eclub_store_firma_bakiye(k.kisi_id) b
)
SELECT COALESCE(b.kisi_id,g.kisi_id) kisi_id,COALESCE(b.firma_id,g.firma_id) firma_id,b.bakiye beklenen_bakiye,g.bakiye kanonik_bakiye
FROM beklenen b FULL JOIN gercek g USING(kisi_id,firma_id)
WHERE COALESCE(b.bakiye,0) IS DISTINCT FROM COALESCE(g.bakiye,0);

-- 7) Eczanem FIFO: kaynak kalan puanı ve onaylı sipariş harcaması farkları.
SELECT 'kaynak_kalan' tur, p.kayit_id kimlik
FROM public.eczanem_puan_kayitlari p
LEFT JOIN (
  SELECT kaynak_kayit_id, SUM(dusulen_puan)::integer dusulen
  FROM public.eczanem_harcama_kayitlari GROUP BY kaynak_kayit_id
) h ON h.kaynak_kayit_id=p.kayit_id
WHERE p.kalan_puan IS DISTINCT FROM p.puan-COALESCE(h.dusulen,0)
  AND p.created_at >= clock_timestamp()-interval '180 days'
UNION ALL
SELECT 'siparis_harcama', s.siparis_id
FROM public.eczanem_siparisler s
LEFT JOIN (
  SELECT siparis_id, SUM(dusulen_puan)::integer dusulen
  FROM public.eczanem_harcama_kayitlari GROUP BY siparis_id
) h ON h.siparis_id=s.siparis_id
WHERE (s.durum='onaylandi' AND COALESCE(h.dusulen,0)<>s.kullanilan_puan)
   OR (s.durum<>'onaylandi' AND COALESCE(h.dusulen,0)<>0)
UNION ALL
SELECT 'indirim_tl', s.siparis_id
FROM public.eczanem_siparisler s
WHERE COALESCE((s.tarife_snapshot->>'puan')::numeric,0)<=0
   OR s.indirim_tl IS DISTINCT FROM ROUND(s.kullanilan_puan*(s.tarife_snapshot->>'tl')::numeric/NULLIF((s.tarife_snapshot->>'puan')::numeric,0),2);

-- 8) İptal edilmiş HBStore siparişinde kapatılmamış net harcama.
SELECT s.siparis_id
FROM public.store_siparisler s
JOIN public.store_puan_harcamalari h ON h.siparis_id=s.siparis_id
WHERE s.durum='iptal'
GROUP BY s.siparis_id
HAVING SUM(CASE WHEN h.tur='harcama' THEN h.puan_miktari WHEN h.tur='iade' THEN -h.puan_miktari ELSE 0 END)<>0;
