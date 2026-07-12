-- T-D11 — Rapor-lig tutarlılığı: yıllık lig satırındaki toplam_puan ile
-- get_kullanici_ozet'in aynı yıl toplam_net_puan'ı birebir mi? Boş dönüş = temiz.
SELECT l.kullanici_id::text, l.ad, l.soyad,
       l.toplam_puan AS lig_puani, o.toplam_net_puan AS rapor_puani
FROM get_hb_ligi_yillik(EXTRACT(year FROM now())::int) l
JOIN LATERAL get_kullanici_ozet(
  date_trunc('year', now()), now(), l.kullanici_id, NULL, NULL, NULL
) o ON true
WHERE l.toplam_puan IS DISTINCT FROM o.toplam_net_puan;
