-- HBStore: BM Ekip Sipariş Takibi kapsam düzeltmesi.
--
-- BM'nin kişisel siparişleri yalnız /store/siparislerim altında kalır.
-- Bu fonksiyon BM için yalnız kendi bölgesindeki UTT/KD_UTT siparişlerini döndürür.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_kapsamli_siparisler(
  p_kullanici_id uuid,
  p_firma_id uuid DEFAULT NULL::uuid,
  p_takim_id uuid DEFAULT NULL::uuid,
  p_bolge_id uuid DEFAULT NULL::uuid,
  p_kullanici_id_filtre uuid DEFAULT NULL::uuid,
  p_durum text DEFAULT NULL::text,
  p_tarih_baslangic timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tarih_bitis timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_rol text;
  v_firma_id uuid;
  v_takim_id uuid;
  v_bolge_id uuid;
  v_izinli_kullanici_ids uuid[];
  v_toplam integer;
  v_siparisler jsonb;
BEGIN
  SELECT lower(rol), firma_id, takim_id, bolge_id
  INTO v_rol, v_firma_id, v_takim_id, v_bolge_id
  FROM kullanicilar
  WHERE kullanici_id = p_kullanici_id;

  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('hata', 'Kullanıcı bulunamadı');
  END IF;

  IF v_rol = 'bm' THEN
    SELECT array_agg(kullanici_id)
    INTO v_izinli_kullanici_ids
    FROM kullanicilar
    WHERE bolge_id = v_bolge_id
      AND lower(rol) IN ('utt', 'kd_utt');
  ELSIF v_rol = 'tm' THEN
    SELECT array_agg(k.kullanici_id)
    INTO v_izinli_kullanici_ids
    FROM kullanicilar k
    JOIN bolgeler b ON b.bolge_id = k.bolge_id
    WHERE b.takim_id = v_takim_id
      AND lower(k.rol) IN ('bm', 'utt', 'kd_utt');
  ELSIF v_rol = 'admin' THEN
    SELECT array_agg(kullanici_id)
    INTO v_izinli_kullanici_ids
    FROM kullanicilar
    WHERE lower(rol) IN ('bm', 'utt', 'kd_utt');
  ELSIF v_rol IN (
    'pm', 'jr_pm', 'kd_pm', 'med_md', 'egt_md', 'egt_uzm', 'egt_uzm_jr',
    'ik_md', 'ik_uzm', 'ik_uzm_jr', 'gm', 'gm_yrd', 'drk', 'paz_md',
    'blm_md', 'grp_pm', 'sm'
  ) THEN
    SELECT array_agg(kullanici_id)
    INTO v_izinli_kullanici_ids
    FROM kullanicilar
    WHERE firma_id = v_firma_id
      AND lower(rol) IN ('bm', 'utt', 'kd_utt');
  ELSE
    RETURN jsonb_build_object('hata', 'Bu sayfaya erişim yetkiniz yok');
  END IF;

  IF v_izinli_kullanici_ids IS NULL
     OR array_length(v_izinli_kullanici_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('siparisler', '[]'::jsonb, 'toplam', 0);
  END IF;

  IF p_kullanici_id_filtre IS NOT NULL THEN
    IF NOT (p_kullanici_id_filtre = ANY(v_izinli_kullanici_ids)) THEN
      RETURN jsonb_build_object('siparisler', '[]'::jsonb, 'toplam', 0);
    END IF;
    v_izinli_kullanici_ids := ARRAY[p_kullanici_id_filtre];
  END IF;

  IF p_bolge_id IS NOT NULL THEN
    SELECT array_agg(kullanici_id)
    INTO v_izinli_kullanici_ids
    FROM kullanicilar
    WHERE kullanici_id = ANY(v_izinli_kullanici_ids)
      AND bolge_id = p_bolge_id;

    IF v_izinli_kullanici_ids IS NULL THEN
      RETURN jsonb_build_object('siparisler', '[]'::jsonb, 'toplam', 0);
    END IF;
  END IF;

  IF p_takim_id IS NOT NULL THEN
    SELECT array_agg(k.kullanici_id)
    INTO v_izinli_kullanici_ids
    FROM kullanicilar k
    JOIN bolgeler b ON b.bolge_id = k.bolge_id
    WHERE k.kullanici_id = ANY(v_izinli_kullanici_ids)
      AND b.takim_id = p_takim_id;

    IF v_izinli_kullanici_ids IS NULL THEN
      RETURN jsonb_build_object('siparisler', '[]'::jsonb, 'toplam', 0);
    END IF;
  END IF;

  IF p_firma_id IS NOT NULL THEN
    SELECT array_agg(kullanici_id)
    INTO v_izinli_kullanici_ids
    FROM kullanicilar
    WHERE kullanici_id = ANY(v_izinli_kullanici_ids)
      AND firma_id = p_firma_id;

    IF v_izinli_kullanici_ids IS NULL THEN
      RETURN jsonb_build_object('siparisler', '[]'::jsonb, 'toplam', 0);
    END IF;
  END IF;

  SELECT count(*)::integer
  INTO v_toplam
  FROM store_siparisler s
  WHERE s.kullanici_id = ANY(v_izinli_kullanici_ids)
    AND (p_durum IS NULL OR s.durum = p_durum)
    AND (p_tarih_baslangic IS NULL OR s.created_at >= p_tarih_baslangic)
    AND (p_tarih_bitis IS NULL OR s.created_at <= p_tarih_bitis);

  SELECT COALESCE(
    jsonb_agg(satir ORDER BY (satir->>'created_at') DESC),
    '[]'::jsonb
  )
  INTO v_siparisler
  FROM (
    SELECT jsonb_build_object(
      'siparis_id', s.siparis_id,
      'kullanici_id', s.kullanici_id,
      'urun_id', s.urun_id,
      'adres_snapshot', s.adres_snapshot,
      'adet', s.adet,
      'puan_birim_fiyat', s.puan_birim_fiyat,
      'toplam_puan', s.toplam_puan,
      'durum', s.durum,
      'kargo_firmasi', s.kargo_firmasi,
      'kargo_takip_no', s.kargo_takip_no,
      'iptal_sebebi', s.iptal_sebebi,
      'created_at', s.created_at,
      'guncellenme_at', s.guncellenme_at,
      'teslim_alma_at', s.teslim_alma_at,
      'urun_adi', u.ad,
      'urun_gorsel_url', u.gorsel_url,
      'alici_ad', k.ad,
      'alici_soyad', k.soyad,
      'alici_rol', k.rol,
      'alici_eposta', k.eposta
    ) AS satir
    FROM store_siparisler s
    JOIN store_urunler u ON u.urun_id = s.urun_id
    JOIN kullanicilar k ON k.kullanici_id = s.kullanici_id
    WHERE s.kullanici_id = ANY(v_izinli_kullanici_ids)
      AND (p_durum IS NULL OR s.durum = p_durum)
      AND (p_tarih_baslangic IS NULL OR s.created_at >= p_tarih_baslangic)
      AND (p_tarih_bitis IS NULL OR s.created_at <= p_tarih_bitis)
    ORDER BY s.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) alt;

  RETURN jsonb_build_object('siparisler', v_siparisler, 'toplam', v_toplam);
END;
$function$;

COMMIT;

-- Uygulama sonrası doğrulama: iki değer de true dönmelidir.
SELECT
  to_regprocedure(
    'public.get_kapsamli_siparisler(uuid,uuid,uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer)'
  ) IS NOT NULL AS fonksiyon_var,
  position(
    'WHERE bolge_id = v_bolge_id' IN pg_get_functiondef(
      'public.get_kapsamli_siparisler(uuid,uuid,uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer)'::regprocedure
    )
  ) > 0 AS bm_sadece_bolge_utt_kd_utt;
