-- T-D3 — Rol-izleme uyumu: hedef_roller X olan yayını X-dışı rolün izleme kaydı
-- (sızıntının VERİ tarafı; kd_utt≡utt eşdeğerliği uygulanır — B-01/B-02 kararı).
-- Boş dönüş = temiz.
SELECT ik.izleme_id::text, k.rol, yy.hedef_roller, ik.izleme_baslangic
FROM izleme_kayitlari ik
JOIN kullanicilar k    ON k.kullanici_id = ik.kullanici_id
JOIN yayin_yonetimi yy ON yy.yayin_id    = ik.yayin_id
WHERE NOT (
  CASE WHEN k.rol = 'kd_utt' THEN 'utt' ELSE k.rol END
  = ANY(COALESCE(yy.hedef_roller, ARRAY['utt']))
);
