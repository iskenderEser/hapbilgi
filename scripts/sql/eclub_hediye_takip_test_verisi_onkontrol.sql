-- YALNIZ OKUMA: E-Club Takımım > Hediye Takibi görünüm testinin ön kontrolü.
-- Hedef, Eczanem mutabakat görünüm testinde kullanılan UTT hesabıdır.
-- Bu dosya hiçbir kayıt eklemez, güncellemez veya silmez.

WITH hedef_utt AS (
  SELECT
    k.kullanici_id AS utt_id,
    k.ad,
    k.soyad,
    k.rol,
    k.aktif_mi,
    k.firma_id,
    k.takim_id,
    k.bolge_id,
    f.aktif AS firma_aktif,
    f.eclub_aktif,
    f.eclub_store_aktif
  FROM public.kullanicilar k
  LEFT JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE k.kullanici_id = '765b6890-183f-4518-b887-07003ff5cdc7'::uuid
),
uygun_test_eczaneleri AS (
  SELECT DISTINCT
    ef.eczane_id,
    e.gln,
    em.eczane_adi,
    public.eclub_eczane_depolari_hazir(ef.eczane_id) AS depo_hazir,
    (
      SELECT count(*)
      FROM public.eclub_kisi_eczane ke
      JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
      WHERE ke.eczane_id = ef.eczane_id
        AND ke.aktif_mi = true
        AND lower(kisi.rol) = 'eczaci'
        AND kisi.auth_user_id IS NOT NULL
        AND nullif(btrim(kisi.eposta), '') IS NOT NULL
    ) AS aktif_ana_eczaci,
    (
      SELECT count(*)
      FROM public.eclub_kisi_eczane ke
      JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
      WHERE ke.eczane_id = ef.eczane_id
        AND ke.aktif_mi = true
        AND kisi.auth_user_id IS NOT NULL
    ) AS aktif_push_hesabi
  FROM hedef_utt h
  JOIN public.eclub_utt_eczane ue
    ON ue.utt_id = h.utt_id
   AND ue.aktif_mi = true
  JOIN public.eclub_eczane_firma ef
    ON ef.id = ue.eczane_firma_id
   AND ef.firma_id = h.firma_id
   AND ef.aktif_mi = true
  JOIN public.eclub_eczaneler e ON e.eczane_id = ef.eczane_id
  JOIN public.eclub_eczane_master em
    ON em.gln = e.gln
   AND em.kaynak = 'test'
   AND em.gln LIKE '111%'
),
hiyerarsi AS (
  SELECT
    h.utt_id,
    array_agg(DISTINCT bm.kullanici_id ORDER BY bm.kullanici_id)
      FILTER (WHERE bm.kullanici_id IS NOT NULL) AS bm_idleri,
    array_agg(DISTINCT tm.kullanici_id ORDER BY tm.kullanici_id)
      FILTER (WHERE tm.kullanici_id IS NOT NULL) AS tm_idleri
  FROM hedef_utt h
  LEFT JOIN public.kullanicilar bm
    ON bm.firma_id = h.firma_id
   AND bm.takim_id IS NOT DISTINCT FROM h.takim_id
   AND bm.bolge_id IS NOT DISTINCT FROM h.bolge_id
   AND lower(bm.rol) = 'bm'
   AND bm.aktif_mi = true
  LEFT JOIN public.kullanicilar tm
    ON tm.firma_id = bm.firma_id
   AND tm.takim_id IS NOT DISTINCT FROM bm.takim_id
   AND lower(tm.rol) = 'tm'
   AND tm.aktif_mi = true
  GROUP BY h.utt_id
),
cekli_yayinlar AS (
  SELECT
    count(DISTINCT y.yayin_id) AS yayin_adedi,
    count(DISTINCT k.urun_id) AS urun_adedi
  FROM hedef_utt h
  JOIN public.v_yayin_kunye k ON k.firma_id = h.firma_id
  JOIN public.yayin_yonetimi y ON y.yayin_id = k.yayin_id
  JOIN public.urunler u ON u.urun_id = k.urun_id
  JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE y.durum = 'yayinda'
    AND y.cek_karsiligi_var_mi = true
    AND public.eclub_store_barem_gecerli(y.barem_tablosu)
    AND nullif(btrim(u.gorunen_urun_id), '') IS NOT NULL
    AND k.talep_no IS NOT NULL
    AND nullif(btrim(f.firma_adi), '') IS NOT NULL
)
SELECT
  h.*,
  coalesce((SELECT count(*) FROM uygun_test_eczaneleri), 0) AS bagli_test_eczane_sayisi,
  coalesce((SELECT count(*) FROM uygun_test_eczaneleri WHERE depo_hazir AND aktif_ana_eczaci = 1 AND aktif_push_hesabi > 0), 0)
    AS kullanilabilir_test_eczane_sayisi,
  coalesce(cardinality(x.bm_idleri), 0) AS uygun_bm_sayisi,
  coalesce(cardinality(x.tm_idleri), 0) AS uygun_tm_sayisi,
  y.yayin_adedi AS cekli_yayin_sayisi,
  y.urun_adedi AS cekli_urun_sayisi,
  coalesce((SELECT count(*) FROM uygun_test_eczaneleri WHERE depo_hazir AND aktif_ana_eczaci = 1 AND aktif_push_hesabi > 0), 0) >= 1
    AND y.urun_adedi >= 3 AS test_paketi_calistirilabilir,
  2 - coalesce((
    SELECT count(*)
    FROM public.eclub_eczane_master em
    WHERE em.gln IN ('1119000000001', '1119000000002')
      AND em.kaynak = 'test'
  ), 0) AS olusturulacak_test_eczane_sayisi
FROM hedef_utt h
LEFT JOIN hiyerarsi x ON x.utt_id = h.utt_id
CROSS JOIN cekli_yayinlar y;

WITH hedef_utt AS (
  SELECT kullanici_id AS utt_id, firma_id
  FROM public.kullanicilar
  WHERE kullanici_id = '765b6890-183f-4518-b887-07003ff5cdc7'::uuid
)
SELECT DISTINCT
  ef.eczane_id,
  e.gln,
  em.eczane_adi,
  public.eclub_eczane_depolari_hazir(ef.eczane_id) AS depo_hazir,
  (
    SELECT count(*)
    FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
    WHERE ke.eczane_id = ef.eczane_id
      AND ke.aktif_mi = true
      AND lower(kisi.rol) = 'eczaci'
      AND kisi.auth_user_id IS NOT NULL
      AND nullif(btrim(kisi.eposta), '') IS NOT NULL
  ) AS aktif_ana_eczaci,
  (
    SELECT count(*)
    FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
    WHERE ke.eczane_id = ef.eczane_id
      AND ke.aktif_mi = true
      AND kisi.auth_user_id IS NOT NULL
  ) AS aktif_push_hesabi
FROM hedef_utt h
JOIN public.eclub_utt_eczane ue
  ON ue.utt_id = h.utt_id
 AND ue.aktif_mi = true
JOIN public.eclub_eczane_firma ef
  ON ef.id = ue.eczane_firma_id
 AND ef.firma_id = h.firma_id
 AND ef.aktif_mi = true
JOIN public.eclub_eczaneler e ON e.eczane_id = ef.eczane_id
JOIN public.eclub_eczane_master em
  ON em.gln = e.gln
 AND em.kaynak = 'test'
 AND em.gln LIKE '111%'
ORDER BY em.eczane_adi, ef.eczane_id;

WITH hedef_utt AS (
  SELECT firma_id
  FROM public.kullanicilar
  WHERE kullanici_id = '765b6890-183f-4518-b887-07003ff5cdc7'::uuid
), uygun_urunler AS (
  SELECT DISTINCT ON (k.urun_id)
    y.yayin_id,
    u.urun_adi,
    u.gorunen_urun_id,
    f.firma_adi,
    k.talep_no
  FROM hedef_utt h
  JOIN public.v_yayin_kunye k ON k.firma_id = h.firma_id
  JOIN public.yayin_yonetimi y ON y.yayin_id = k.yayin_id
  JOIN public.urunler u ON u.urun_id = k.urun_id
  JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE y.durum = 'yayinda'
    AND y.cek_karsiligi_var_mi = true
    AND public.eclub_store_barem_gecerli(y.barem_tablosu)
    AND nullif(btrim(u.gorunen_urun_id), '') IS NOT NULL
    AND k.talep_no IS NOT NULL
    AND nullif(btrim(f.firma_adi), '') IS NOT NULL
  ORDER BY k.urun_id, y.yayin_id
)
SELECT
  yayin_id,
  urun_adi,
  gorunen_urun_id,
  concat_ws('_', firma_adi, talep_no::text) AS gorunen_talep_id
FROM uygun_urunler
ORDER BY gorunen_urun_id, yayin_id
LIMIT 3;
