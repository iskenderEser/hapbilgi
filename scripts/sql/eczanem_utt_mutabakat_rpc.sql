-- Yeni Eczanem Mutabakat sayfasının yalnız UTT okuma ve karar RPC'leri.
-- eczanem_utt_mutabakat_kayit.sql başarıyla kurulduktan sonra yalnız İskender
-- tarafından Supabase SQL Editor'de çalıştırılır.

BEGIN;

CREATE OR REPLACE FUNCTION public.eczanem_utt_mutabakat_yetkili_mi(
  p_utt_id uuid,
  p_firma_id uuid,
  p_takim_id uuid,
  p_eczane_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
  SELECT EXISTS (
    SELECT 1
    FROM public.kullanicilar k
    JOIN public.firmalar f ON f.firma_id = k.firma_id
    JOIN public.eclub_utt_eczane ue ON ue.utt_id = k.kullanici_id AND ue.aktif_mi = true
    JOIN public.eclub_eczane_firma ef
      ON ef.id = ue.eczane_firma_id AND ef.aktif_mi = true
    WHERE k.kullanici_id = p_utt_id
      AND LOWER(k.rol) = 'utt'
      AND k.aktif_mi = true
      AND f.aktif = true
      AND f.eczanem_aktif = true
      AND k.firma_id = p_firma_id
      AND ef.firma_id = p_firma_id
      AND ef.eczane_id = p_eczane_id
      AND (p_takim_id IS NULL OR p_takim_id = k.takim_id)
  );
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_utt_mutabakat_listele(
  p_utt_id uuid,
  p_donem date,
  p_durum text DEFAULT 'tumu',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_baslangic timestamptz;
  v_bitis timestamptz;
  v_simdi_tr timestamp;
  v_ay_basi_tr timestamp;
  v_karar_acik boolean;
  v_toplam integer;
  v_toplam_puan bigint;
  v_toplam_indirim_tl numeric;
  v_kayitlar jsonb;
BEGIN
  IF p_donem IS NULL OR p_donem <> date_trunc('month', p_donem::timestamp)::date
     OR p_durum IS NULL OR p_durum NOT IN ('tumu', 'bekliyor', 'onay', 'beklet', 'ret')
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Geçersiz mutabakat liste parametresi.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar k
    JOIN public.firmalar f ON f.firma_id = k.firma_id
    WHERE k.kullanici_id = p_utt_id AND LOWER(k.rol) = 'utt'
      AND k.aktif_mi = true AND f.aktif = true AND f.eczanem_aktif = true
  ) THEN
    RAISE EXCEPTION 'Mutabakat erişimi yalnız yetkili UTT içindir.' USING ERRCODE = '42501';
  END IF;

  v_baslangic := make_timestamptz(EXTRACT(YEAR FROM p_donem)::integer,
    EXTRACT(MONTH FROM p_donem)::integer, 1, 0, 0, 0, 'Europe/Istanbul');
  v_bitis := make_timestamptz(EXTRACT(YEAR FROM (p_donem + INTERVAL '1 month'))::integer,
    EXTRACT(MONTH FROM (p_donem + INTERVAL '1 month'))::integer, 1, 0, 0, 0, 'Europe/Istanbul');
  v_simdi_tr := timezone('Europe/Istanbul', clock_timestamp());
  v_ay_basi_tr := date_trunc('month', v_simdi_tr);
  v_karar_acik := p_donem = (v_ay_basi_tr - INTERVAL '1 month')::date
    AND v_simdi_tr < v_ay_basi_tr + INTERVAL '7 days';

  SELECT COUNT(*)::integer, COALESCE(SUM(o.kullanilan_puan), 0), COALESCE(SUM(o.indirim_tl), 0)
  INTO v_toplam, v_toplam_puan, v_toplam_indirim_tl
  FROM public.eczanem_indirim_onaylari o
  JOIN public.eczanem_utt_mutabakatlar m ON m.mutabakat_id = o.eczanem_indirim_onay_id
  WHERE o.onay_tarihi >= v_baslangic AND o.onay_tarihi < v_bitis
    AND (p_durum = 'tumu'
      OR (p_durum = 'bekliyor' AND m.utt_karar IS NULL)
      OR m.utt_karar = p_durum)
    AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mutabakat_id', s.eczanem_indirim_onay_id,
    'eczane_id', s.eczane_id,
    'eczane_adi', s.eczane_adi,
    'urun_id', s.urun_id,
    'urun_adi', s.urun_adi,
    'onay_tarihi', s.onay_tarihi,
    'kullanilan_puan', s.kullanilan_puan,
    'indirim_tl', s.indirim_tl,
    'tarife_puan', s.tarife_puan,
    'tarife_tl', s.tarife_tl,
    'satis_fiyati', s.satis_fiyati,
    'utt_karar', s.utt_karar,
    'utt_karar_tarihi', s.utt_karar_tarihi,
    'karar_surumu', s.karar_surumu,
    'kaynaklar', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'yayin_id', q.yayin_id,
        'arac_id', q.arac_id,
        'arac_turu', q.arac_turu,
        'teknik_adi', q.teknik_adi,
        'pm_ogrenme_puani', q.pm_ogrenme_puani,
        'kullanilan_puan', q.kullanilan_puan
      ) ORDER BY q.yayin_id)
      FROM public.eczanem_indirim_onay_kaynaklari q
      WHERE q.eczanem_indirim_onay_id = s.eczanem_indirim_onay_id
    ), '[]'::jsonb),
    'karar_gecmisi', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'surum', h.surum, 'karar', h.karar, 'karar_tarihi', h.karar_tarihi
      ) ORDER BY h.surum)
      FROM public.eczanem_utt_mutabakat_kararlari h
      WHERE h.mutabakat_id = s.eczanem_indirim_onay_id
    ), '[]'::jsonb)
  ) ORDER BY s.onay_tarihi DESC, s.eczanem_indirim_onay_id DESC), '[]'::jsonb)
  INTO v_kayitlar
  FROM (
    SELECT o.*, m.utt_karar, m.utt_karar_tarihi, m.karar_surumu
    FROM public.eczanem_indirim_onaylari o
    JOIN public.eczanem_utt_mutabakatlar m ON m.mutabakat_id = o.eczanem_indirim_onay_id
    WHERE o.onay_tarihi >= v_baslangic AND o.onay_tarihi < v_bitis
      AND (p_durum = 'tumu'
        OR (p_durum = 'bekliyor' AND m.utt_karar IS NULL)
        OR m.utt_karar = p_durum)
      AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id)
    ORDER BY o.onay_tarihi DESC, o.eczanem_indirim_onay_id DESC
    LIMIT p_limit OFFSET p_offset
  ) s;

  RETURN jsonb_build_object(
    'donem', to_char(p_donem, 'YYYY-MM'),
    'karar_penceresi_acik', v_karar_acik,
    'toplam', v_toplam,
    'toplam_puan', v_toplam_puan,
    'toplam_indirim_tl', v_toplam_indirim_tl,
    'kayitlar', v_kayitlar
  );
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_utt_mutabakat_karar_ver(
  p_utt_id uuid,
  p_mutabakat_id uuid,
  p_karar text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_onay public.eczanem_indirim_onaylari%ROWTYPE;
  v_mutabakat public.eczanem_utt_mutabakatlar%ROWTYPE;
  v_simdi timestamptz := clock_timestamp();
  v_simdi_tr timestamp;
  v_ay_basi_tr timestamp;
BEGIN
  IF p_karar IS NULL OR p_karar NOT IN ('onay', 'beklet', 'ret') OR p_mutabakat_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz UTT mutabakat kararı.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_mutabakat FROM public.eczanem_utt_mutabakatlar
  WHERE mutabakat_id = p_mutabakat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mutabakat bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_onay FROM public.eczanem_indirim_onaylari
  WHERE eczanem_indirim_onay_id = p_mutabakat_id;
  IF NOT public.eczanem_utt_mutabakat_yetkili_mi(
    p_utt_id, v_onay.firma_id, v_onay.takim_id, v_onay.eczane_id
  ) THEN
    RAISE EXCEPTION 'Bu mutabakat işleminde UTT yetkiniz yok.' USING ERRCODE = '42501';
  END IF;

  v_simdi_tr := timezone('Europe/Istanbul', v_simdi);
  v_ay_basi_tr := date_trunc('month', v_simdi_tr);
  IF v_simdi_tr >= v_ay_basi_tr + INTERVAL '7 days'
     OR timezone('Europe/Istanbul', v_onay.onay_tarihi) < v_ay_basi_tr - INTERVAL '1 month'
     OR timezone('Europe/Istanbul', v_onay.onay_tarihi) >= v_ay_basi_tr THEN
    RAISE EXCEPTION 'Karar yalnız önceki ay işlemleri için ayın ilk yedi günü verilebilir.' USING ERRCODE = 'P0001';
  END IF;

  IF v_mutabakat.utt_karar IS NOT DISTINCT FROM p_karar THEN
    RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
      'karar_tarihi', v_mutabakat.utt_karar_tarihi, 'surum', v_mutabakat.karar_surumu);
  END IF;

  UPDATE public.eczanem_utt_mutabakatlar
  SET utt_karar = p_karar,
      utt_karar_veren_id = p_utt_id,
      utt_karar_tarihi = v_simdi,
      karar_surumu = karar_surumu + 1
  WHERE mutabakat_id = p_mutabakat_id
  RETURNING * INTO v_mutabakat;

  INSERT INTO public.eczanem_utt_mutabakat_kararlari
    (mutabakat_id, surum, karar, karar_veren_id, karar_tarihi)
  VALUES (p_mutabakat_id, v_mutabakat.karar_surumu, p_karar, p_utt_id, v_simdi);

  RETURN jsonb_build_object('mutabakat_id', p_mutabakat_id, 'karar', p_karar,
    'karar_tarihi', v_simdi, 'surum', v_mutabakat.karar_surumu);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_utt_mutabakat_yetkili_mi(uuid, uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.eczanem_utt_mutabakat_listele(uuid, date, text, integer, integer)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.eczanem_utt_mutabakat_karar_ver(uuid, uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.eczanem_utt_mutabakat_listele(uuid, date, text, integer, integer)
TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_utt_mutabakat_karar_ver(uuid, uuid, text)
TO service_role;

DO $kontrol$
BEGIN
  IF to_regprocedure('public.eczanem_utt_mutabakat_listele(uuid,date,text,integer,integer)') IS NULL
     OR to_regprocedure('public.eczanem_utt_mutabakat_karar_ver(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Eczanem UTT mutabakat RPC paketi eksik kuruldu.';
  END IF;
END;
$kontrol$;

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT
  to_regprocedure('public.eczanem_utt_mutabakat_listele(uuid,date,text,integer,integer)') IS NOT NULL AS liste_rpc_hazir,
  to_regprocedure('public.eczanem_utt_mutabakat_karar_ver(uuid,uuid,text)') IS NOT NULL AS karar_rpc_hazir;
