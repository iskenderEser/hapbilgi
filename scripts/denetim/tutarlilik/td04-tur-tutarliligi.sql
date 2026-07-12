-- T-D4 — Tur tutarlılığı: (a) UNIQUE dışı anomali, (b) tur-1'i olmayan yayın,
-- (c) tur_no artarken baslangic_tarihi artmayan. Boş dönüş = temiz.
SELECT 'cift_tur' AS tip, yayin_id::text, tur_no::text, COUNT(*)::text AS adet
FROM yayin_tekrar_kayitlari GROUP BY yayin_id, tur_no HAVING COUNT(*) > 1;

SELECT DISTINCT 'tur1_eksik' AS tip, yt.yayin_id::text, NULL AS tur_no, NULL AS adet
FROM yayin_tekrar_kayitlari yt
WHERE NOT EXISTS (SELECT 1 FROM yayin_tekrar_kayitlari t1
                  WHERE t1.yayin_id = yt.yayin_id AND t1.tur_no = 1);

SELECT 'sira_bozuk' AS tip, a.yayin_id::text, a.tur_no::text, b.tur_no::text AS sonraki
FROM yayin_tekrar_kayitlari a
JOIN yayin_tekrar_kayitlari b
  ON b.yayin_id = a.yayin_id AND b.tur_no = a.tur_no + 1
 AND b.baslangic_tarihi <= a.baslangic_tarihi;
