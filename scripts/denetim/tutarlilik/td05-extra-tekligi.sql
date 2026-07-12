-- T-D5 — Extra kural ihlali: aynı max(ay,tur) penceresinde aynı kişi-yayın için
-- 1'den fazla 'extra' puan kaydı. Aynı ay içindeki iki extra, ancak aralarında
-- bir tur sınırı varsa meşrudur. Boş dönüş = temiz.
SELECT k1.kullanici_id::text, k1.yayin_id::text,
       k1.created_at AS ilk_extra, k2.created_at AS ikinci_extra
FROM kazanilan_puanlar k1
JOIN kazanilan_puanlar k2
  ON k1.kullanici_id = k2.kullanici_id AND k1.yayin_id = k2.yayin_id
 AND k1.puan_turu = 'extra' AND k2.puan_turu = 'extra'
 AND k1.kazanilan_puan_id < k2.kazanilan_puan_id
 AND date_trunc('month', k1.created_at) = date_trunc('month', k2.created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM yayin_tekrar_kayitlari yt
  WHERE yt.yayin_id = k1.yayin_id
    AND yt.baslangic_tarihi >  k1.created_at
    AND yt.baslangic_tarihi <= k2.created_at
);
