-- Açılan eczanenin bütün indirimleri için ürün seçimi ve sunucu tarafı sayfalama.
-- Yalnız kullanıcı tarafından Supabase SQL Editor'de çalıştırılır.
BEGIN;

CREATE OR REPLACE FUNCTION public.eczanem_utt_mutabakat_eczane_islemleri_filtreli_listele(
  p_utt_id uuid, p_donem date, p_eczane_id uuid, p_durum text DEFAULT 'tumu',
  p_urun_id uuid DEFAULT NULL, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fonksiyon$
DECLARE
  v_baslangic timestamptz;
  v_bitis timestamptz;
  v_toplam integer;
  v_urun_secenekleri jsonb;
  v_kayitlar jsonb;
BEGIN
  IF p_eczane_id IS NULL OR p_donem IS NULL
    OR p_donem <> date_trunc('month', p_donem::timestamp)::date
    OR p_durum IS NULL OR p_durum NOT IN ('tumu', 'bekliyor', 'onay', 'beklet', 'ret')
    OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100
    OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Geçersiz mutabakat işlem parametresi.' USING ERRCODE = '22023';
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

  -- Seçenekler ürün filtresinden ve karar durumundan bağımsız kalır.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'urun_id', s.urun_id, 'urun_adi', s.urun_adi,
    'gorunen_urun_id', s.gorunen_urun_id
  ) ORDER BY s.urun_adi, s.urun_id), '[]'::jsonb)
  INTO v_urun_secenekleri
  FROM (
    SELECT o.urun_id, MAX(o.urun_adi) AS urun_adi,
      MAX(u.gorunen_urun_id) AS gorunen_urun_id
    FROM public.eczanem_indirim_onaylari o
    JOIN public.eczanem_utt_mutabakatlar m ON m.mutabakat_id = o.eczanem_indirim_onay_id
    LEFT JOIN public.urunler u ON u.urun_id = o.urun_id
    WHERE o.eczane_id = p_eczane_id
      AND o.onay_tarihi >= v_baslangic AND o.onay_tarihi < v_bitis
      AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id)
    GROUP BY o.urun_id
  ) s;

  SELECT COUNT(*)::integer INTO v_toplam
  FROM public.eczanem_indirim_onaylari o
  JOIN public.eczanem_utt_mutabakatlar m ON m.mutabakat_id = o.eczanem_indirim_onay_id
  WHERE o.eczane_id = p_eczane_id
    AND (p_urun_id IS NULL OR o.urun_id = p_urun_id)
    AND o.onay_tarihi >= v_baslangic AND o.onay_tarihi < v_bitis
    AND (p_durum = 'tumu' OR (p_durum = 'bekliyor' AND m.utt_karar IS NULL)
      OR m.utt_karar = p_durum)
    AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mutabakat_id', s.eczanem_indirim_onay_id,
    'gorunen_indirim_id', s.gorunen_indirim_id,
    'eczane_id', s.eczane_id, 'eczane_adi', s.eczane_adi,
    'urun_id', s.urun_id, 'urun_adi', s.urun_adi,
    'onay_tarihi', s.onay_tarihi, 'kullanilan_puan', s.kullanilan_puan,
    'indirim_tl', s.indirim_tl, 'tarife_puan', s.tarife_puan,
    'tarife_tl', s.tarife_tl, 'satis_fiyati', s.satis_fiyati,
    'utt_karar', s.utt_karar, 'utt_karar_tarihi', s.utt_karar_tarihi,
    'karar_surumu', s.karar_surumu,
    'kaynaklar', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'yayin_id', q.yayin_id, 'arac_id', q.arac_id,
      'arac_turu', q.arac_turu, 'teknik_adi', q.teknik_adi,
      'pm_ogrenme_puani', q.pm_ogrenme_puani, 'kullanilan_puan', q.kullanilan_puan
    ) ORDER BY q.yayin_id) FROM public.eczanem_indirim_onay_kaynaklari q
      WHERE q.eczanem_indirim_onay_id = s.eczanem_indirim_onay_id), '[]'::jsonb),
    'karar_gecmisi', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'surum', h.surum, 'karar', h.karar, 'karar_tarihi', h.karar_tarihi
    ) ORDER BY h.surum) FROM public.eczanem_utt_mutabakat_kararlari h
      WHERE h.mutabakat_id = s.eczanem_indirim_onay_id), '[]'::jsonb)
  ) ORDER BY s.onay_tarihi DESC, s.eczanem_indirim_onay_id DESC), '[]'::jsonb)
  INTO v_kayitlar
  FROM (
    SELECT o.*, m.utt_karar, m.utt_karar_tarihi, m.karar_surumu
    FROM public.eczanem_indirim_onaylari o
    JOIN public.eczanem_utt_mutabakatlar m ON m.mutabakat_id = o.eczanem_indirim_onay_id
    WHERE o.eczane_id = p_eczane_id
      AND (p_urun_id IS NULL OR o.urun_id = p_urun_id)
      AND o.onay_tarihi >= v_baslangic AND o.onay_tarihi < v_bitis
      AND (p_durum = 'tumu' OR (p_durum = 'bekliyor' AND m.utt_karar IS NULL)
        OR m.utt_karar = p_durum)
      AND public.eczanem_utt_mutabakat_yetkili_mi(p_utt_id, o.firma_id, o.takim_id, o.eczane_id)
    ORDER BY o.onay_tarihi DESC, o.eczanem_indirim_onay_id DESC
    LIMIT p_limit OFFSET p_offset
  ) s;

  RETURN jsonb_build_object(
    'toplam', v_toplam, 'urun_secenekleri', v_urun_secenekleri,
    'kayitlar', v_kayitlar
  );
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_utt_mutabakat_eczane_islemleri_filtreli_listele(uuid,date,uuid,text,uuid,integer,integer)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_utt_mutabakat_eczane_islemleri_filtreli_listele(uuid,date,uuid,text,uuid,integer,integer)
TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT to_regprocedure(
  'public.eczanem_utt_mutabakat_eczane_islemleri_filtreli_listele(uuid,date,uuid,text,uuid,integer,integer)'
) IS NOT NULL AS urun_filtresi_rpc_hazir;
