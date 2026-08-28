-- Öğrenme Araçları Genişletmesi — Faz 6 HBStore bakiye teşhisi
-- Salt okunurdur; yalnız mutabakatta fark veren iki kullanıcıyı inceler.

WITH kullanici AS (
  SELECT k.kullanici_id,k.rol,k.aktif_mi,k.firma_id,f.hbstore_aktif
  FROM public.kullanicilar k
  LEFT JOIN public.firmalar f ON f.firma_id=k.firma_id
  WHERE k.kullanici_id IN (
    'fc5beafe-38f7-4abd-9a46-52baa872fedd'::uuid,
    'f86079f2-8cf2-4c56-82f8-1e79bc4ab48d'::uuid
  )
), sinir AS (
  SELECT
    (date_trunc('quarter', clock_timestamp() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul') AS baslangic,
    ((date_trunc('quarter', clock_timestamp() AT TIME ZONE 'Europe/Istanbul') + interval '3 months') AT TIME ZONE 'Europe/Istanbul') AS bitis
), kazanc AS (
  SELECT bm_id kullanici_id,
    SUM(puan)::bigint toplam,
    SUM(puan) FILTER (WHERE created_at>=s.baslangic AND created_at<s.bitis)::bigint donem
  FROM public.cc_kazanilan_puanlar CROSS JOIN sinir s GROUP BY bm_id
), kayip AS (
  SELECT kullanici_id,SUM(puan)::bigint toplam,SUM(puan) FILTER (WHERE created_at>=s.baslangic AND created_at<s.bitis)::bigint donem
  FROM (
    SELECT bm_id kullanici_id,kaybedilen_puan puan,created_at FROM public.cc_ileri_sarma_kayitlari
    UNION ALL SELECT bm_id,kaybedilen_puan,created_at FROM public.cc_yanlis_cevap_kayitlari
    UNION ALL SELECT kullanici_id,kaybedilen_puan,created_at FROM public.challenge_kayip_kayitlari
  ) x CROSS JOIN sinir s GROUP BY kullanici_id
), harcama AS (
  SELECT kullanici_id,
    SUM(CASE WHEN tur='harcama' THEN puan_miktari WHEN tur='iade' THEN -puan_miktari ELSE 0 END)::bigint toplam,
    SUM(CASE WHEN created_at>=s.baslangic AND created_at<s.bitis THEN
      CASE WHEN tur='harcama' THEN puan_miktari WHEN tur='iade' THEN -puan_miktari ELSE 0 END ELSE 0 END)::bigint donem
  FROM public.store_puan_harcamalari CROSS JOIN sinir s GROUP BY kullanici_id
)
SELECT k.kullanici_id,k.rol,k.aktif_mi,k.hbstore_aktif,
  COALESCE(a.toplam,0) toplam_kazanc,COALESCE(y.toplam,0) toplam_kayip,COALESCE(h.toplam,0) toplam_harcama,
  COALESCE(a.donem,0) donem_kazanc,COALESCE(y.donem,0) donem_kayip,COALESCE(h.donem,0) donem_harcama,
  public.get_harcama_bakiyesi(k.kullanici_id) kanonik_bakiye
FROM kullanici k
LEFT JOIN kazanc a USING(kullanici_id)
LEFT JOIN kayip y USING(kullanici_id)
LEFT JOIN harcama h USING(kullanici_id)
ORDER BY k.kullanici_id;
