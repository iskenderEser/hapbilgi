-- ==========================================================================
-- FAZ 1C — Store, rapor ve lig okumalarını eczane snapshot'ına geçirme
-- ==========================================================================
-- Bağımlılıklar:
--   * Faz 1A: eclub_kazanilan_puanlar.eczane_id
--   * Faz 1B: puan yazma RPC'lerinin eczane_id yazması
--
-- Bu migration yalnız aşağıdaki kanonik okuma fonksiyonlarını günceller:
--   * eclub_store_onceki_deviri_hazirla
--   * get_eclub_eczane_store_ozet
--   * eclub_store_cek_talebi_olustur
--   * get_eclub_utt_rapor (rapor ve lig ortak kaynağı)
-- ==========================================================================

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('eclub-store-rapor-lig-eczane-snapshot-faz-1c', 0)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'eclub_kazanilan_puanlar'
       AND column_name = 'eczane_id'
       AND data_type = 'uuid'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION
      'Faz 1C uygulanmadı: önce Faz 1A ve Faz 1B tamamlanmalıdır.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.eclub_store_onceki_deviri_hazirla(
  p_eczane_id uuid,
  p_yayin_id uuid,
  p_hedef_donem text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_kaynak text;
  v_bas timestamptz;
  v_bit timestamptz;
  v_min integer;
  v_max integer;
  v_kazanc integer;
  v_gelen integer;
  v_toplam integer;
  v_devir integer := 0;
  v_cekli boolean;
BEGIN
  SELECT CASE
    WHEN substring(p_hedef_donem, 7, 1)::integer = 1
      THEN (substring(p_hedef_donem, 1, 4)::integer - 1)::text || '-P6'
    ELSE substring(p_hedef_donem, 1, 4) || '-P'
      || (substring(p_hedef_donem, 7, 1)::integer - 1)::text
  END
  INTO v_kaynak;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'eclub-devir:' || p_eczane_id || ':' || p_yayin_id || ':' || v_kaynak,
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.eclub_store_puan_devirleri
    WHERE eczane_id = p_eczane_id
      AND yayin_id = p_yayin_id
      AND kaynak_donem_kodu = v_kaynak
      AND iptal_edildi = false
  ) OR EXISTS (
    SELECT 1
    FROM public.eclub_store_cek_talepleri
    WHERE eczane_id = p_eczane_id
      AND yayin_id = p_yayin_id
      AND donem_kodu = v_kaynak
      AND durum <> 'iptal'
  ) THEN
    RETURN;
  END IF;

  SELECT y.cek_karsiligi_var_mi
  INTO v_cekli
  FROM public.yayin_yonetimi y
  WHERE y.yayin_id = p_yayin_id;

  IF coalesce(v_cekli, true) = false THEN
    RETURN;
  END IF;

  SELECT baslangic, bitis_haric
  INTO v_bas, v_bit
  FROM public.eclub_store_donem_sinirlari(v_kaynak);

  SELECT min((x->>'min_puan')::integer), max((x->>'max_puan')::integer)
  INTO v_min, v_max
  FROM public.yayin_yonetimi y,
       jsonb_array_elements(y.barem_tablosu) x
  WHERE y.yayin_id = p_yayin_id;

  IF v_min IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(sum(kp.puan), 0)::integer
  INTO v_kazanc
  FROM public.eclub_kazanilan_puanlar kp
  WHERE kp.eczane_id = p_eczane_id
    AND kp.yayin_id = p_yayin_id
    AND kp.created_at >= v_bas
    AND kp.created_at < v_bit
    AND kp.cek_karsiligi_var_mi = true;

  SELECT coalesce(sum(puan), 0)::integer
  INTO v_gelen
  FROM public.eclub_store_puan_devirleri
  WHERE eczane_id = p_eczane_id
    AND yayin_id = p_yayin_id
    AND hedef_donem_kodu = v_kaynak
    AND kullanildi_mi = false
    AND iptal_edildi = false;

  v_toplam := v_kazanc + v_gelen;
  IF v_toplam > 0 AND v_toplam < v_min THEN
    v_devir := v_toplam;
  ELSIF v_toplam > v_max THEN
    v_devir := v_toplam - v_max;
  END IF;

  IF v_devir > 0 THEN
    INSERT INTO public.eclub_store_puan_devirleri (
      eczane_id,
      yayin_id,
      kaynak_donem_kodu,
      hedef_donem_kodu,
      puan
    )
    VALUES (p_eczane_id, p_yayin_id, v_kaynak, p_hedef_donem, v_devir)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.eclub_store_puan_devirleri
  SET kullanildi_mi = true,
      guncellenme_at = now()
  WHERE eczane_id = p_eczane_id
    AND yayin_id = p_yayin_id
    AND hedef_donem_kodu = v_kaynak
    AND kullanildi_mi = false
    AND iptal_edildi = false;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.get_eclub_eczane_store_ozet(p_kisi_id uuid)
RETURNS TABLE(
  yayin_id uuid,
  urun_id uuid,
  urun_adi text,
  firma_id uuid,
  firma_adi text,
  eczane_id uuid,
  eczane_adi text,
  toplanan_puan integer,
  satis_sarti_tipi text,
  gizli_sart_katlama_orani integer,
  barem_tablosu jsonb,
  karsilik_puan integer,
  karsilik_tl numeric,
  uygun_adet integer,
  uygun_mal_fazlasi integer,
  hak_edilen_cek_tl numeric,
  katlanmis_cek_tl numeric,
  talep_durumu text,
  cek_kodu text,
  donem_kodu text,
  talep_penceresi_acik_mi boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_eczane uuid;
  v_ad text;
  v_d record;
  r record;
BEGIN
  SELECT ke.eczane_id, coalesce(em.eczane_adi, 'Eczane')
  INTO v_eczane, v_ad
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_eczaneler e ON e.eczane_id = ke.eczane_id
  LEFT JOIN public.eclub_eczane_master em ON em.gln = e.gln
  WHERE ke.kisi_id = p_kisi_id
    AND ke.aktif_mi = true
  LIMIT 1;

  IF v_eczane IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();

  FOR r IN
    SELECT y.yayin_id
    FROM public.yayin_yonetimi y
    JOIN public.v_yayin_kunye k ON k.yayin_id = y.yayin_id
    JOIN public.eclub_eczane_firma ef
      ON ef.eczane_id = v_eczane
     AND ef.firma_id = k.firma_id
     AND ef.aktif_mi = true
    WHERE y.barem_tablosu IS NOT NULL
      AND y.durum = 'yayinda'
      AND y.cek_karsiligi_var_mi = true
  LOOP
    PERFORM public.eclub_store_onceki_deviri_hazirla(
      v_eczane,
      r.yayin_id,
      v_d.donem_kodu
    );
  END LOOP;

  RETURN QUERY
  WITH kazanc AS (
    SELECT kp.yayin_id, coalesce(sum(kp.puan), 0)::integer AS puan
    FROM public.eclub_kazanilan_puanlar kp
    WHERE kp.eczane_id = v_eczane
      AND kp.created_at >= v_d.donem_baslangic
      AND kp.created_at < v_d.donem_bitis_haric
      AND kp.cek_karsiligi_var_mi = true
    GROUP BY kp.yayin_id
  ),
  gelen AS (
    SELECT d.yayin_id, sum(d.puan)::integer AS puan
    FROM public.eclub_store_puan_devirleri d
    WHERE d.eczane_id = v_eczane
      AND d.hedef_donem_kodu = v_d.donem_kodu
      AND d.kullanildi_mi = false
      AND d.iptal_edildi = false
    GROUP BY d.yayin_id
  )
  SELECT
    y.yayin_id,
    k.urun_id,
    coalesce(k.urun_adi, 'Ürün')::text,
    k.firma_id,
    coalesce(f.firma_adi, 'Firma')::text,
    v_eczane,
    v_ad,
    (coalesce(z.puan, 0) + coalesce(g.puan, 0))::integer,
    y.satis_sarti_tipi,
    y.gizli_sart_katlama_orani,
    y.barem_tablosu,
    y.karsilik_puan,
    y.karsilik_tl,
    coalesce((
      SELECT (x->>'adet')::integer
      FROM jsonb_array_elements(y.barem_tablosu) x
      WHERE coalesce(z.puan, 0) + coalesce(g.puan, 0)
        >= (x->>'min_puan')::integer
      ORDER BY (x->>'min_puan')::integer DESC
      LIMIT 1
    ), 0),
    coalesce((
      SELECT (x->>'mal_fazlasi')::integer
      FROM jsonb_array_elements(y.barem_tablosu) x
      WHERE coalesce(z.puan, 0) + coalesce(g.puan, 0)
        >= (x->>'min_puan')::integer
      ORDER BY (x->>'min_puan')::integer DESC
      LIMIT 1
    ), 0),
    round(
      least(
        coalesce(z.puan, 0) + coalesce(g.puan, 0),
        (SELECT max((x->>'max_puan')::integer)
         FROM jsonb_array_elements(y.barem_tablosu) x)
      ) * y.karsilik_tl / greatest(y.karsilik_puan, 1),
      2
    ),
    round(
      least(
        coalesce(z.puan, 0) + coalesce(g.puan, 0),
        (SELECT max((x->>'max_puan')::integer)
         FROM jsonb_array_elements(y.barem_tablosu) x)
      ) * y.karsilik_tl / greatest(y.karsilik_puan, 1)
        * (1 + coalesce(y.gizli_sart_katlama_orani, 0) / 100.0),
      2
    ),
    t.durum,
    t.cek_kodu,
    v_d.donem_kodu,
    v_d.talep_acik_mi
  FROM public.yayin_yonetimi y
  JOIN public.v_yayin_kunye k ON k.yayin_id = y.yayin_id
  LEFT JOIN public.firmalar f ON f.firma_id = k.firma_id
  LEFT JOIN kazanc z ON z.yayin_id = y.yayin_id
  LEFT JOIN gelen g ON g.yayin_id = y.yayin_id
  LEFT JOIN public.eclub_store_cek_talepleri t
    ON t.eczane_id = v_eczane
   AND t.yayin_id = y.yayin_id
   AND t.donem_kodu = v_d.donem_kodu
   AND t.durum <> 'iptal'
  WHERE y.barem_tablosu IS NOT NULL
    AND y.durum = 'yayinda'
    AND public.eclub_store_barem_gecerli(y.barem_tablosu)
    AND y.cek_karsiligi_var_mi = true
    AND EXISTS (
      SELECT 1
      FROM public.eclub_eczane_firma ef
      WHERE ef.eczane_id = v_eczane
        AND ef.firma_id = k.firma_id
        AND ef.aktif_mi = true
    );
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_talebi_olustur(
  p_kisi_id uuid,
  p_yayin_id uuid,
  p_siparis_verilsin_mi boolean
)
RETURNS TABLE(
  ok boolean,
  talep_id uuid,
  hata text,
  cek_tutari numeric,
  devreden_puan integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_eczane uuid;
  v_firma uuid;
  v_utt uuid;
  v_d record;
  v_y public.yayin_yonetimi%ROWTYPE;
  v_bas numeric;
  v_gelen integer;
  v_toplam integer;
  v_min integer;
  v_max integer;
  v_kullan integer;
  v_devir integer;
  v_adet integer;
  v_mf integer;
  v_tl numeric;
  v_id uuid;
BEGIN
  SELECT ke.eczane_id
  INTO v_eczane
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
  WHERE ke.kisi_id = p_kisi_id
    AND ke.aktif_mi = true
    AND lower(k.rol) IN (
      'eczaci',
      'ikinci_eczaci',
      'yardimci_eczaci',
      'eczane_teknisyeni'
    )
  LIMIT 1;

  IF v_eczane IS NULL THEN
    RETURN QUERY
    SELECT false, NULL::uuid, 'Aktif eczane üyeliği bulunamadı.', 0::numeric, 0;
    RETURN;
  END IF;

  SELECT *
  INTO v_y
  FROM public.yayin_yonetimi
  WHERE yayin_yonetimi.yayin_id = p_yayin_id
  FOR SHARE;

  IF v_y.yayin_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Yayın bulunamadı.', 0::numeric, 0;
    RETURN;
  END IF;

  IF v_y.cek_karsiligi_var_mi = false THEN
    RETURN QUERY
    SELECT false, NULL::uuid,
      'Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz.',
      0::numeric, 0;
    RETURN;
  END IF;

  SELECT k.firma_id
  INTO v_firma
  FROM public.v_yayin_kunye k
  WHERE k.yayin_id = p_yayin_id;

  IF v_firma IS NULL
     OR NOT public.eclub_store_barem_gecerli(v_y.barem_tablosu) THEN
    RETURN QUERY
    SELECT false, NULL::uuid, 'Yayın veya barem ayarı geçersiz.', 0::numeric, 0;
    RETURN;
  END IF;

  SELECT ue.utt_id
  INTO v_utt
  FROM public.eclub_eczane_firma ef
  JOIN public.eclub_utt_eczane ue
    ON ue.eczane_firma_id = ef.id
   AND ue.aktif_mi = true
  JOIN public.kullanicilar u
    ON u.kullanici_id = ue.utt_id
   AND u.aktif_mi = true
  WHERE ef.eczane_id = v_eczane
    AND ef.firma_id = v_firma
    AND ef.aktif_mi = true
  ORDER BY ue.created_at DESC
  LIMIT 1;

  IF v_utt IS NULL THEN
    RETURN QUERY
    SELECT false, NULL::uuid,
      'Bu yayın firması için aktif UTT bağlantısı bulunamadı.',
      0::numeric, 0;
    RETURN;
  END IF;

  SELECT * INTO v_d FROM public.eclub_store_aktif_donem();
  IF NOT v_d.talep_acik_mi THEN
    RETURN QUERY
    SELECT false, NULL::uuid, 'Çek talep dönemi kapalıdır.', 0::numeric, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'eclub-talep:' || v_eczane || ':' || p_yayin_id || ':' || v_d.donem_kodu,
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.eclub_store_cek_talepleri
    WHERE eczane_id = v_eczane
      AND yayin_id = p_yayin_id
      AND donem_kodu = v_d.donem_kodu
      AND durum <> 'iptal'
  ) THEN
    RETURN QUERY
    SELECT false, NULL::uuid, 'Bu dönem için talep zaten oluşturuldu.', 0::numeric, 0;
    RETURN;
  END IF;

  PERFORM public.eclub_store_onceki_deviri_hazirla(
    v_eczane,
    p_yayin_id,
    v_d.donem_kodu
  );

  SELECT coalesce(sum(kp.puan), 0)
  INTO v_bas
  FROM public.eclub_kazanilan_puanlar kp
  WHERE kp.eczane_id = v_eczane
    AND kp.yayin_id = p_yayin_id
    AND kp.created_at >= v_d.donem_baslangic
    AND kp.created_at < v_d.donem_bitis_haric
    AND kp.cek_karsiligi_var_mi = true;

  PERFORM 1
  FROM public.eclub_store_puan_devirleri
  WHERE eczane_id = v_eczane
    AND yayin_id = p_yayin_id
    AND hedef_donem_kodu = v_d.donem_kodu
    AND kullanildi_mi = false
    AND iptal_edildi = false
  FOR UPDATE;

  SELECT coalesce(sum(puan), 0)::integer
  INTO v_gelen
  FROM public.eclub_store_puan_devirleri
  WHERE eczane_id = v_eczane
    AND yayin_id = p_yayin_id
    AND hedef_donem_kodu = v_d.donem_kodu
    AND kullanildi_mi = false
    AND iptal_edildi = false;

  v_toplam := v_bas::integer + v_gelen;

  SELECT min((x->>'min_puan')::integer), max((x->>'max_puan')::integer)
  INTO v_min, v_max
  FROM jsonb_array_elements(v_y.barem_tablosu) x;

  IF v_toplam < v_min THEN
    RETURN QUERY
    SELECT false, NULL::uuid,
      'Minimum ' || v_min || ' puan gereklidir; bakiye sonraki döneme devreder.',
      0::numeric, v_toplam;
    RETURN;
  END IF;

  IF v_y.satis_sarti_tipi = 'satis_sartli'
     AND NOT p_siparis_verilsin_mi THEN
    RETURN QUERY
    SELECT false, NULL::uuid, 'Bu yayın için sipariş zorunludur.', 0::numeric, 0;
    RETURN;
  END IF;

  v_kullan := least(v_toplam, v_max);
  v_devir := greatest(v_toplam - v_max, 0);

  SELECT (x->>'adet')::integer, (x->>'mal_fazlasi')::integer
  INTO v_adet, v_mf
  FROM jsonb_array_elements(v_y.barem_tablosu) x
  WHERE v_kullan BETWEEN (x->>'min_puan')::integer AND (x->>'max_puan')::integer
  ORDER BY (x->>'min_puan')::integer DESC
  LIMIT 1;

  v_tl := round(
    v_kullan * v_y.karsilik_tl / greatest(v_y.karsilik_puan, 1),
    2
  );
  IF v_y.satis_sarti_tipi = 'serbest_siparis'
     AND p_siparis_verilsin_mi THEN
    v_tl := round(
      v_tl * (1 + coalesce(v_y.gizli_sart_katlama_orani, 0) / 100.0),
      2
    );
  END IF;

  INSERT INTO public.eclub_store_cek_talepleri (
    eczane_id,
    firma_id,
    yayin_id,
    talep_eden_kisi_id,
    toplanan_puan,
    talep_edilen_cek_tl,
    siparis_tipi,
    siparis_verildi_mi,
    siparis_adet,
    siparis_mal_fazlasi,
    durum,
    utt_id,
    devreden_puan,
    donem_kodu
  )
  VALUES (
    v_eczane,
    v_firma,
    p_yayin_id,
    p_kisi_id,
    v_kullan,
    v_tl,
    v_y.satis_sarti_tipi,
    p_siparis_verilsin_mi,
    CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_adet, 0) ELSE 0 END,
    CASE WHEN p_siparis_verilsin_mi THEN coalesce(v_mf, 0) ELSE 0 END,
    'beklemede',
    v_utt,
    v_devir,
    v_d.donem_kodu
  )
  RETURNING eclub_store_cek_talepleri.talep_id INTO v_id;

  UPDATE public.eclub_store_puan_devirleri
  SET kullanildi_mi = true,
      kullanilan_talep_id = v_id,
      guncellenme_at = now()
  WHERE eczane_id = v_eczane
    AND yayin_id = p_yayin_id
    AND hedef_donem_kodu = v_d.donem_kodu
    AND kullanildi_mi = false
    AND iptal_edildi = false;

  IF v_devir > 0 THEN
    INSERT INTO public.eclub_store_puan_devirleri (
      eczane_id,
      yayin_id,
      kaynak_donem_kodu,
      hedef_donem_kodu,
      puan,
      kaynak_talep_id
    )
    SELECT
      v_eczane,
      p_yayin_id,
      v_d.donem_kodu,
      s.sonraki_donem_kodu,
      v_devir,
      v_id
    FROM public.eclub_store_donem_sinirlari(v_d.donem_kodu) s
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY SELECT true, v_id, NULL::text, v_tl, v_devir;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.get_eclub_utt_rapor(
  p_utt_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz
)
RETURNS TABLE(
  eczane_id uuid,
  gln character varying,
  eczane_adi character varying,
  kisi_id uuid,
  kisi_ad character varying,
  kisi_soyad character varying,
  kisi_rol character varying,
  icerik_anahtari text,
  icerik_adi text,
  gonderilen_sayisi bigint,
  tamamlanan_izleme bigint,
  dogru_cevap bigint,
  yanlis_cevap bigint,
  izleme_puani bigint,
  cevaplama_puani bigint,
  cekli_puan bigint,
  ceksiz_puan bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
  WITH kapsam_eczaneler AS (
    SELECT DISTINCT ef.eczane_id
    FROM public.eclub_utt_eczane ue
    JOIN public.eclub_eczane_firma ef ON ef.id = ue.eczane_firma_id
    WHERE ue.utt_id = p_utt_id
      AND ue.aktif_mi = true
      AND ef.aktif_mi = true
  ),
  yayin_bilgi AS (
    SELECT DISTINCT ON (ky.yayin_id)
      ky.yayin_id,
      coalesce(
        ky.urun_id::text,
        ky.teknik_id::text,
        ky.yayin_id::text
      ) AS icerik_anahtari,
      coalesce(vd.urun_adi, vd.teknik_adi, 'Diğer')::text AS icerik_adi
    FROM public.v_yayin_kunye ky
    LEFT JOIN public.v_yayin_detay vd ON vd.yayin_id = ky.yayin_id
    ORDER BY ky.yayin_id
  ),
  tum_oneriler AS (
    SELECT
      o.oneri_id,
      o.kisi_id,
      o.yayin_id,
      uyelik.eczane_id,
      coalesce(yb.icerik_anahtari, o.yayin_id::text) AS icerik_anahtari,
      coalesce(yb.icerik_adi, 'Diğer') AS icerik_adi,
      coalesce(o.created_at, o.oneri_baslangic) AS created_at
    FROM public.eclub_oneri_kayitlari o
    LEFT JOIN yayin_bilgi yb ON yb.yayin_id = o.yayin_id
    LEFT JOIN LATERAL (
      SELECT ke.eczane_id
      FROM public.eclub_kisi_eczane ke
      JOIN kapsam_eczaneler kapsam ON kapsam.eczane_id = ke.eczane_id
      WHERE ke.kisi_id = o.kisi_id
        AND coalesce(o.created_at, o.oneri_baslangic)
          >= coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz)
        AND coalesce(o.created_at, o.oneri_baslangic)
          < coalesce(ke.bitis_tarihi, 'infinity'::timestamptz)
      ORDER BY
        coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz) DESC,
        ke.created_at DESC NULLS LAST
      LIMIT 1
    ) uyelik ON true
    WHERE o.oneren_id = p_utt_id
  ),
  donem_oneri AS (
    SELECT
      o.eczane_id,
      o.kisi_id,
      o.icerik_anahtari,
      o.icerik_adi,
      count(*) AS gonderilen_sayisi
    FROM tum_oneriler o
    WHERE o.created_at >= p_baslangic
      AND o.created_at < p_bitis
      AND o.eczane_id IS NOT NULL
    GROUP BY o.eczane_id, o.kisi_id, o.icerik_anahtari, o.icerik_adi
  ),
  donem_izleme AS (
    SELECT
      iz.izleme_id,
      coalesce(puan_eczane.eczane_id, uyelik.eczane_id, o.eczane_id) AS eczane_id,
      o.kisi_id,
      o.icerik_anahtari,
      o.icerik_adi
    FROM public.eclub_izleme_kayitlari iz
    JOIN tum_oneriler o ON o.oneri_id = iz.oneri_id
    LEFT JOIN LATERAL (
      SELECT kp.eczane_id
      FROM public.eclub_kazanilan_puanlar kp
      WHERE kp.izleme_id = iz.izleme_id
        AND kp.puan_turu = 'izleme'
      ORDER BY kp.created_at, kp.kazanilan_puan_id
      LIMIT 1
    ) puan_eczane ON true
    LEFT JOIN LATERAL (
      SELECT ke.eczane_id
      FROM public.eclub_kisi_eczane ke
      JOIN kapsam_eczaneler kapsam ON kapsam.eczane_id = ke.eczane_id
      WHERE ke.kisi_id = o.kisi_id
        AND iz.izleme_bitis
          >= coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz)
        AND iz.izleme_bitis
          < coalesce(ke.bitis_tarihi, 'infinity'::timestamptz)
      ORDER BY
        coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz) DESC,
        ke.created_at DESC NULLS LAST
      LIMIT 1
    ) uyelik ON true
    WHERE iz.tamamlandi_mi = true
      AND iz.izleme_bitis >= p_baslangic
      AND iz.izleme_bitis < p_bitis
      AND EXISTS (
        SELECT 1
        FROM kapsam_eczaneler kapsam
        WHERE kapsam.eczane_id
          = coalesce(puan_eczane.eczane_id, uyelik.eczane_id, o.eczane_id)
      )
  ),
  izleme AS (
    SELECT
      di.eczane_id,
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      count(*) AS tamamlanan_izleme
    FROM donem_izleme di
    GROUP BY di.eczane_id, di.kisi_id, di.icerik_anahtari, di.icerik_adi
  ),
  dogru AS (
    SELECT
      coalesce(puan_eczane.eczane_id, uyelik.eczane_id, di.eczane_id) AS eczane_id,
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      count(*) AS dogru_cevap
    FROM public.eclub_dogru_cevap_kayitlari dc
    JOIN donem_izleme di ON di.izleme_id = dc.izleme_id
    LEFT JOIN LATERAL (
      SELECT kp.eczane_id
      FROM public.eclub_kazanilan_puanlar kp
      WHERE kp.izleme_id = dc.izleme_id
        AND kp.puan_turu = 'cevaplama'
      ORDER BY kp.created_at, kp.kazanilan_puan_id
      LIMIT 1
    ) puan_eczane ON true
    LEFT JOIN LATERAL (
      SELECT ke.eczane_id
      FROM public.eclub_kisi_eczane ke
      JOIN kapsam_eczaneler kapsam ON kapsam.eczane_id = ke.eczane_id
      WHERE ke.kisi_id = di.kisi_id
        AND dc.created_at
          >= coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz)
        AND dc.created_at
          < coalesce(ke.bitis_tarihi, 'infinity'::timestamptz)
      ORDER BY
        coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz) DESC,
        ke.created_at DESC NULLS LAST
      LIMIT 1
    ) uyelik ON true
    WHERE EXISTS (
      SELECT 1
      FROM kapsam_eczaneler kapsam
      WHERE kapsam.eczane_id
        = coalesce(puan_eczane.eczane_id, uyelik.eczane_id, di.eczane_id)
    )
    GROUP BY
      coalesce(puan_eczane.eczane_id, uyelik.eczane_id, di.eczane_id),
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi
  ),
  yanlis AS (
    SELECT
      coalesce(puan_eczane.eczane_id, uyelik.eczane_id, di.eczane_id) AS eczane_id,
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      count(*) AS yanlis_cevap
    FROM public.eclub_yanlis_cevap_kayitlari yc
    JOIN donem_izleme di ON di.izleme_id = yc.izleme_id
    LEFT JOIN LATERAL (
      SELECT kp.eczane_id
      FROM public.eclub_kazanilan_puanlar kp
      WHERE kp.izleme_id = yc.izleme_id
        AND kp.puan_turu = 'cevaplama'
      ORDER BY kp.created_at, kp.kazanilan_puan_id
      LIMIT 1
    ) puan_eczane ON true
    LEFT JOIN LATERAL (
      SELECT ke.eczane_id
      FROM public.eclub_kisi_eczane ke
      JOIN kapsam_eczaneler kapsam ON kapsam.eczane_id = ke.eczane_id
      WHERE ke.kisi_id = di.kisi_id
        AND yc.created_at
          >= coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz)
        AND yc.created_at
          < coalesce(ke.bitis_tarihi, 'infinity'::timestamptz)
      ORDER BY
        coalesce(ke.baslangic_tarihi, ke.created_at, '-infinity'::timestamptz) DESC,
        ke.created_at DESC NULLS LAST
      LIMIT 1
    ) uyelik ON true
    WHERE EXISTS (
      SELECT 1
      FROM kapsam_eczaneler kapsam
      WHERE kapsam.eczane_id
        = coalesce(puan_eczane.eczane_id, uyelik.eczane_id, di.eczane_id)
    )
    GROUP BY
      coalesce(puan_eczane.eczane_id, uyelik.eczane_id, di.eczane_id),
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi
  ),
  puan AS (
    SELECT
      kp.eczane_id,
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      coalesce(sum(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::bigint
        AS izleme_puani,
      coalesce(sum(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::bigint
        AS cevaplama_puani,
      coalesce(sum(kp.puan) FILTER (
        WHERE coalesce(kp.cek_karsiligi_var_mi, true) = true
      ), 0)::bigint AS cekli_puan,
      coalesce(sum(kp.puan) FILTER (
        WHERE kp.cek_karsiligi_var_mi = false
      ), 0)::bigint AS ceksiz_puan
    FROM public.eclub_kazanilan_puanlar kp
    JOIN donem_izleme di ON di.izleme_id = kp.izleme_id
    JOIN kapsam_eczaneler kapsam ON kapsam.eczane_id = kp.eczane_id
    GROUP BY kp.eczane_id, di.kisi_id, di.icerik_anahtari, di.icerik_adi
  ),
  anahtar AS (
    SELECT eczane_id, kisi_id, icerik_anahtari, icerik_adi FROM donem_oneri
    UNION
    SELECT eczane_id, kisi_id, icerik_anahtari, icerik_adi FROM izleme
    UNION
    SELECT eczane_id, kisi_id, icerik_anahtari, icerik_adi FROM dogru
    UNION
    SELECT eczane_id, kisi_id, icerik_anahtari, icerik_adi FROM yanlis
    UNION
    SELECT eczane_id, kisi_id, icerik_anahtari, icerik_adi FROM puan
  ),
  temel AS (
    SELECT
      kapsam.eczane_id,
      e.gln,
      m.eczane_adi,
      k.kisi_id,
      k.ad AS kisi_ad,
      k.soyad AS kisi_soyad,
      k.rol AS kisi_rol
    FROM kapsam_eczaneler kapsam
    JOIN public.eclub_eczaneler e ON e.eczane_id = kapsam.eczane_id
    LEFT JOIN public.eclub_eczane_master m ON m.gln = e.gln
    LEFT JOIN public.eclub_kisi_eczane ke
      ON ke.eczane_id = kapsam.eczane_id
     AND ke.aktif_mi = true
    LEFT JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id

    UNION

    SELECT
      a.eczane_id,
      e.gln,
      m.eczane_adi,
      k.kisi_id,
      k.ad AS kisi_ad,
      k.soyad AS kisi_soyad,
      k.rol AS kisi_rol
    FROM anahtar a
    JOIN public.eclub_eczaneler e ON e.eczane_id = a.eczane_id
    LEFT JOIN public.eclub_eczane_master m ON m.gln = e.gln
    JOIN public.eclub_kisiler k ON k.kisi_id = a.kisi_id
  )
  SELECT
    t.eczane_id,
    t.gln,
    t.eczane_adi,
    t.kisi_id,
    t.kisi_ad,
    t.kisi_soyad,
    t.kisi_rol,
    a.icerik_anahtari,
    a.icerik_adi,
    coalesce(o.gonderilen_sayisi, 0)::bigint,
    coalesce(i.tamamlanan_izleme, 0)::bigint,
    coalesce(d.dogru_cevap, 0)::bigint,
    coalesce(y.yanlis_cevap, 0)::bigint,
    coalesce(p.izleme_puani, 0)::bigint,
    coalesce(p.cevaplama_puani, 0)::bigint,
    coalesce(p.cekli_puan, 0)::bigint,
    coalesce(p.ceksiz_puan, 0)::bigint
  FROM temel t
  LEFT JOIN anahtar a
    ON a.eczane_id = t.eczane_id
   AND a.kisi_id = t.kisi_id
  LEFT JOIN donem_oneri o
    ON o.eczane_id = a.eczane_id
   AND o.kisi_id = a.kisi_id
   AND o.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN izleme i
    ON i.eczane_id = a.eczane_id
   AND i.kisi_id = a.kisi_id
   AND i.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN dogru d
    ON d.eczane_id = a.eczane_id
   AND d.kisi_id = a.kisi_id
   AND d.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN yanlis y
    ON y.eczane_id = a.eczane_id
   AND y.kisi_id = a.kisi_id
   AND y.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN puan p
    ON p.eczane_id = a.eczane_id
   AND p.kisi_id = a.kisi_id
   AND p.icerik_anahtari = a.icerik_anahtari
  ORDER BY t.eczane_adi, t.kisi_ad, t.kisi_soyad, a.icerik_adi;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eclub_store_onceki_deviri_hazirla(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_onceki_deviri_hazirla(uuid, uuid, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_eclub_eczane_store_ozet(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_eclub_eczane_store_ozet(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.eclub_store_cek_talebi_olustur(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_cek_talebi_olustur(uuid, uuid, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_eclub_utt_rapor(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_eclub_utt_rapor(uuid, timestamptz, timestamptz)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
