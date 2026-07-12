-- T-D8 — Eczanem ledger: (a) kalan_puan > puan veya kalan_puan < 0;
-- (b) onaylı siparişte harcama eşleme toplamı ≠ kullanilan_puan. Boş dönüş = temiz.
SELECT 'kalan_puan_ihlali' AS tip, kayit_id::text, puan::text, kalan_puan::text
FROM eczanem_puan_kayitlari
WHERE kalan_puan > puan OR kalan_puan < 0;

SELECT 'harcama_eslesme_farki' AS tip, s.siparis_id::text,
       s.kullanilan_puan::text, COALESCE(SUM(h.dusulen_puan),0)::text AS harcanan
FROM eczanem_siparisler s
LEFT JOIN eczanem_harcama_kayitlari h ON h.siparis_id = s.siparis_id
WHERE s.durum = 'onaylandi'
GROUP BY s.siparis_id, s.kullanilan_puan
HAVING COALESCE(SUM(h.dusulen_puan),0) <> s.kullanilan_puan;
