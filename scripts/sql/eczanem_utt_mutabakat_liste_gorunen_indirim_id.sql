-- Düz mutabakat tablosunun ana liste RPC'sine mevcut, atomik İndirim ID'yi ekler.
-- Test ve gerçek kayıtlar için aynı eczanem_indirim_onaylari.gorunen_indirim_id
-- alanı kullanılır; yeni ID üretmez ve mevcut veriyi değiştirmez.
-- Supabase SQL Editor'de bu dosya bir bütün olarak kullanıcı tarafından çalıştırılır.

BEGIN;

DO $kontrol$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'eczanem_indirim_onaylari'
      AND column_name = 'gorunen_indirim_id'
  ) THEN
    RAISE EXCEPTION 'gorunen_indirim_id alanı bulunamadı; önce eczanem_indirim_gorunen_id_atomik.sql çalıştırılmalıdır.';
  END IF;
END;
$kontrol$;

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
    'gorunen_indirim_id', s.gorunen_indirim_id,
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

REVOKE ALL ON FUNCTION public.eczanem_utt_mutabakat_listele(uuid, date, text, integer, integer)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_utt_mutabakat_listele(uuid, date, text, integer, integer)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'eczanem_indirim_onaylari'
      AND column_name = 'gorunen_indirim_id'
  ) AS indirim_id_alani_hazir,
  pg_get_functiondef('public.eczanem_utt_mutabakat_listele(uuid,date,text,integer,integer)'::regprocedure)
    LIKE '%' || quote_literal('gorunen_indirim_id') || '%' AS liste_rpc_indirim_id_hazir;
