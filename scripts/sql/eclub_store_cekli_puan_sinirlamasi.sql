-- scripts/sql/eclub_store_cekli_puan_sinirlamasi.sql
--
-- Faz 7 — Store Puanının Yalnız Çekli Puandan Oluşması: get_eclub_store_firma_bakiye
-- Supabase SQL Editor'da İskender tarafından çalıştırılır.
--
-- Kurallar:
--   * Store'da kullanılabilir bütün puan hesapları yalnız Çekli Puan (cek_karsiligi_var_mi = true) ile sınırlandırılır.
--   * Çeksiz Puan (cek_karsiligi_var_mi = false) Store Puanına eklenmez, fiziksel Store ürünlerinde harcanamaz.
--   * Çeksiz yayın kaynaklı ileri sarma kaybı Çekli Puan bakiyesinden düşülmez (ks.cek_karsiligi_var_mi = true).
--   * Harcanan puan hesabı ve iptal iadesi mevcut davranışını korur.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_eclub_store_firma_bakiye(p_kisi_id uuid)
 RETURNS TABLE(firma_id uuid, firma_adi character varying, kazanilan bigint, harcanan bigint, bakiye bigint)
 LANGUAGE sql
 STABLE
AS $function$
  WITH kazanc AS (
    SELECT ky.firma_id, COALESCE(SUM(kp.puan), 0) AS kazanilan
    FROM public.eclub_kazanilan_puanlar kp
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kisi_id = p_kisi_id
      AND kp.cek_karsiligi_var_mi = true
    GROUP BY ky.firma_id
  ),
  kayip AS (
    SELECT ky.firma_id, COALESCE(SUM(ks.kaybedilen_puan), 0) AS kaybedilen
    FROM public.eclub_ileri_sarma_kayitlari ks
    JOIN public.v_yayin_kunye ky ON ky.yayin_id = ks.yayin_id
    WHERE ks.kisi_id = p_kisi_id
      AND ks.cek_karsiligi_var_mi = true
    GROUP BY ky.firma_id
  ),
  harcama AS (
    SELECT sfp.firma_id, COALESCE(SUM(sfp.kullanilan_puan), 0) AS harcanan
    FROM public.eclub_store_siparis_firma_puan sfp
    JOIN public.eclub_store_siparisler s ON s.siparis_id = sfp.siparis_id
    WHERE s.kisi_id = p_kisi_id
      AND s.durum <> 'iptal'
    GROUP BY sfp.firma_id
  )
  SELECT
    f.firma_id,
    f.firma_adi,
    COALESCE(k.kazanilan, 0),
    COALESCE(h.harcanan, 0),
    (
      COALESCE(k.kazanilan, 0)
      - COALESCE(ka.kaybedilen, 0)
      - COALESCE(h.harcanan, 0)
    ) AS bakiye
  FROM public.firmalar f
  JOIN kazanc k ON k.firma_id = f.firma_id
  LEFT JOIN kayip ka ON ka.firma_id = f.firma_id
  LEFT JOIN harcama h ON h.firma_id = f.firma_id
  WHERE f.eclub_store_aktif = true
    AND (
      COALESCE(k.kazanilan, 0)
      - COALESCE(ka.kaybedilen, 0)
      - COALESCE(h.harcanan, 0)
    ) > 0
  ORDER BY bakiye DESC;
$function$;

COMMIT;
