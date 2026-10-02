-- Yalnız okuma: ekleme SQL'inin hedef UTT ve aktif eczane sayısını doğrular.
-- Hedef hesap ekranda kullanılan UTT değilse ekleme SQL'ini çalıştırmayın.
SELECT
  k.kullanici_id AS hedef_utt_id,
  k.ad,
  k.soyad,
  k.rol,
  k.aktif_mi,
  k.firma_id,
  k.takim_id,
  f.aktif AS firma_aktif,
  f.eczanem_aktif,
  COUNT(DISTINCT ef.eczane_id) FILTER (
    WHERE ue.aktif_mi = true AND ef.aktif_mi = true AND ef.firma_id = k.firma_id
  ) AS aktif_bagli_eczane
FROM public.kullanicilar k
LEFT JOIN public.firmalar f ON f.firma_id = k.firma_id
LEFT JOIN public.eclub_utt_eczane ue ON ue.utt_id = k.kullanici_id
LEFT JOIN public.eclub_eczane_firma ef ON ef.id = ue.eczane_firma_id
WHERE k.kullanici_id = '765b6890-183f-4518-b887-07003ff5cdc7'::uuid
GROUP BY k.kullanici_id, k.ad, k.soyad, k.rol, k.aktif_mi,
  k.firma_id, k.takim_id, f.aktif, f.eczanem_aktif;
