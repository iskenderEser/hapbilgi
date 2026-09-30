-- Faz 2A: Hediye çeki talebi yalnız ana eczacı tarafından oluşturulabilir.
-- Bu dosya yalnız eclub_store_cek_talebi_olustur RPC'sini günceller.
-- Supabase SQL Editor'da tek parça olarak çalıştırılmalıdır.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('eclub-cek-talebi-ana-eczaci-faz-2a', 0)
);

DO $kontrol$
BEGIN
  IF to_regprocedure(
    'public.eclub_store_cek_talebi_olustur(uuid,uuid,boolean)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Faz 2A uygulanamadı: eclub_store_cek_talebi_olustur RPC bulunamadı.';
  END IF;

  IF to_regclass('public.eclub_kisiler') IS NULL
     OR to_regclass('public.eclub_kisi_eczane') IS NULL THEN
    RAISE EXCEPTION
      'Faz 2A uygulanamadı: E-Club kişi veya eczane üyeliği tablosu bulunamadı.';
  END IF;

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
      'Faz 2A uygulanamadı: Faz 1 eczane snapshot bağımlılığı hazır değil.';
  END IF;
END;
$kontrol$;

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
  v_rol text;
  v_aktif_eczaneler uuid[];
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
  SELECT lower(btrim(k.rol))
  INTO v_rol
  FROM public.eclub_kisiler k
  WHERE k.kisi_id = p_kisi_id
  FOR SHARE;

  IF v_rol IS NULL THEN
    RETURN QUERY
    SELECT false, NULL::uuid, 'E-Club kişi kaydı bulunamadı.', 0::numeric, 0;
    RETURN;
  END IF;

  IF v_rol <> 'eczaci' THEN
    RETURN QUERY
    SELECT false, NULL::uuid,
      'Hediye çeki talebini yalnız ana eczacı oluşturabilir.',
      0::numeric, 0;
    RETURN;
  END IF;

  PERFORM 1
  FROM public.eclub_kisi_eczane ke
  WHERE ke.kisi_id = p_kisi_id
    AND ke.aktif_mi = true
  FOR SHARE;

  SELECT array_agg(ke.eczane_id ORDER BY ke.eczane_id)
  INTO v_aktif_eczaneler
  FROM public.eclub_kisi_eczane ke
  WHERE ke.kisi_id = p_kisi_id
    AND ke.aktif_mi = true;

  IF coalesce(cardinality(v_aktif_eczaneler), 0) = 0 THEN
    RETURN QUERY
    SELECT false, NULL::uuid, 'Aktif eczane üyeliği bulunamadı.', 0::numeric, 0;
    RETURN;
  END IF;

  IF cardinality(v_aktif_eczaneler) <> 1 THEN
    RETURN QUERY
    SELECT false, NULL::uuid,
      'Çek talebi için tek bir aktif eczane üyeliği bulunmalıdır.',
      0::numeric, 0;
    RETURN;
  END IF;

  v_eczane := v_aktif_eczaneler[1];

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

  IF v_y.satis_sarti_tipi = 'siparissiz_cek'
     AND p_siparis_verilsin_mi THEN
    RETURN QUERY
    SELECT false, NULL::uuid,
      'Bu yayında sipariş seçeneği bulunmaz.',
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

REVOKE ALL ON FUNCTION public.eclub_store_cek_talebi_olustur(uuid, uuid, boolean)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_cek_talebi_olustur(uuid, uuid, boolean)
TO service_role;

COMMIT;
