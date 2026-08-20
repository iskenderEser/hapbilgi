-- Eczanem UTT → eczane gönderimini tek transaction'a alır.
-- Kapsam: aktif UTT + açık firma + aynı firma/takım yayını + aktif sahiplik +
-- aktif üye eşiği + ömür boyu yayın/eczane tekliği.
-- Bu dosyayı İskender Supabase SQL Editor'da, ön kontrol boş döndükten sonra çalıştırır.

CREATE OR REPLACE FUNCTION public.eczanem_utt_eczaneye_gonder(
  p_utt_id uuid,
  p_yayin_id uuid,
  p_eczane_id uuid
)
RETURNS TABLE(ok boolean, hata text, gonderim_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_firma_id uuid;
  v_takim_id uuid;
  v_yayin_firma_id uuid;
  v_yayin_takim_id uuid;
  v_yayin_durum text;
  v_hedef_roller text[];
  v_esik integer := 10;
  v_aktif_uye integer := 0;
  v_gonderim_id uuid;
BEGIN
  IF p_utt_id IS NULL OR p_yayin_id IS NULL OR p_eczane_id IS NULL THEN
    RETURN QUERY SELECT false, 'UTT, yayın ve eczane zorunludur.', NULL::uuid;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('eczanem_utt_gonderim:' || p_yayin_id::text || ':' || p_eczane_id::text, 0)
  );

  SELECT k.firma_id, k.takim_id
  INTO v_firma_id, v_takim_id
  FROM public.kullanicilar k
  JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE k.kullanici_id = p_utt_id
    AND k.rol IN ('utt', 'kd_utt')
    AND k.aktif_mi = true
    AND f.aktif = true
    AND f.eczanem_aktif = true;

  IF NOT FOUND OR v_firma_id IS NULL THEN
    RETURN QUERY SELECT false, 'UTT veya Eczanem firma erişimi geçerli değil.', NULL::uuid;
    RETURN;
  END IF;

  SELECT y.firma_id, y.takim_id, y.durum, y.hedef_roller
  INTO v_yayin_firma_id, v_yayin_takim_id, v_yayin_durum, v_hedef_roller
  FROM public.v_yayin_detay y
  WHERE y.yayin_id = p_yayin_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Yayın bulunamadı.', NULL::uuid;
    RETURN;
  END IF;
  IF v_yayin_durum IS DISTINCT FROM 'yayinda' THEN
    RETURN QUERY SELECT false, 'Bu yayın şu an yayında değil.', NULL::uuid;
    RETURN;
  END IF;
  IF NOT ('eczanem' = ANY(COALESCE(v_hedef_roller, ARRAY[]::text[]))) THEN
    RETURN QUERY SELECT false, 'Bu yayın Eczanem kanalına ait değil.', NULL::uuid;
    RETURN;
  END IF;
  IF v_yayin_firma_id IS DISTINCT FROM v_firma_id
     OR (v_yayin_takim_id IS NOT NULL AND v_yayin_takim_id IS DISTINCT FROM v_takim_id) THEN
    RETURN QUERY SELECT false, 'Bu yayın firma veya takım kapsamınızda değil.', NULL::uuid;
    RETURN;
  END IF;

  PERFORM 1
  FROM public.eclub_eczane_firma ef
  WHERE ef.baglayan_utt_id = p_utt_id
    AND ef.eczane_id = p_eczane_id
    AND ef.firma_id = v_firma_id
    AND ef.aktif_mi = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Bu eczane aktif listenizde değil.', NULL::uuid;
    RETURN;
  END IF;

  SELECT CASE
    WHEN (sa.deger #>> '{}') ~ '^[0-9]+$' THEN (sa.deger #>> '{}')::integer
    ELSE 10
  END
  INTO v_esik
  FROM public.sistem_ayarlari sa
  WHERE sa.anahtar = 'eczanem_aktif_uye_esigi';
  v_esik := COALESCE(v_esik, 10);

  -- Aktif üyelik satırlarını kilitlemek, sayım ile INSERT arasındaki pasife
  -- alma/silme yarışını kapatır. Yeni aktif üye eklenmesi yalnız sayıyı artırır.
  PERFORM 1
  FROM public.eczanem_uyelikler u
  WHERE u.eczane_id = p_eczane_id
    AND u.aktif_mi = true
  FOR UPDATE;

  SELECT count(*)::integer
  INTO v_aktif_uye
  FROM public.eczanem_uyelikler u
  WHERE u.eczane_id = p_eczane_id
    AND u.aktif_mi = true;

  IF v_aktif_uye < v_esik THEN
    RETURN QUERY SELECT false, format('Bu eczane eşiğin altında (%s/%s aktif üye).', v_aktif_uye, v_esik), NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.eczanem_eczane_gonderimleri (yayin_id, eczane_id, gonderen_utt_id)
  VALUES (p_yayin_id, p_eczane_id, p_utt_id)
  ON CONFLICT (yayin_id, eczane_id) DO NOTHING
  RETURNING eczanem_eczane_gonderimleri.gonderim_id INTO v_gonderim_id;

  IF v_gonderim_id IS NULL THEN
    RETURN QUERY SELECT false, 'Bu video bu eczaneye daha önce gönderilmiş.', NULL::uuid;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, v_gonderim_id;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_utt_eczaneye_gonder(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_utt_eczaneye_gonder(uuid, uuid, uuid)
TO service_role;
