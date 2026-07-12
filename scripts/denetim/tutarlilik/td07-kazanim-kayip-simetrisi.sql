-- T-D7 — Kazanım-kayıp simetrisi: süresi geçmiş, izlenmemiş öneride
-- ne öneri puanı ne kayıp kaydı var. Boş dönüş = temiz.
SELECT o.oneri_id::text, o.kullanici_id::text, o.oneri_bitis
FROM oneri_kayitlari o
WHERE o.oneri_bitis < now()
  AND o.izlendi_mi = false
  AND NOT EXISTS (SELECT 1 FROM oneri_kayip_kayitlari kk WHERE kk.oneri_id = o.oneri_id)
  AND NOT EXISTS (SELECT 1 FROM kazanilan_puanlar kp
                  WHERE kp.yayin_id = o.yayin_id
                    AND kp.kullanici_id = o.kullanici_id
                    AND kp.puan_turu = 'oneri');
