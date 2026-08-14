-- HBStore: global katalog + firma bazlı ürün görünürlüğü.
--
-- Sözleşme:
--   * store_urunler global katalog olmaya devam eder.
--   * Ayar satırı yoksa ürün firmaya AÇIKTIR.
--   * Yalnız aktif_mi=false istisnaları saklanır.
--   * Global ürün pasifse veya firmanın HBStore'u kapalıysa sipariş verilemez.
--   * Mevcut atomik sipariş fonksiyonu çekirdek adıyla korunur; aynı imzalı
--     güvenlik sarmalayıcısı firma kuralını doğruladıktan sonra onu çağırır.

BEGIN;

CREATE TABLE IF NOT EXISTS public.store_urun_firma_ayarlari (
  urun_id uuid NOT NULL REFERENCES public.store_urunler(urun_id) ON DELETE CASCADE,
  firma_id uuid NOT NULL REFERENCES public.firmalar(firma_id) ON DELETE CASCADE,
  aktif_mi boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT store_urun_firma_ayarlari_pkey PRIMARY KEY (urun_id, firma_id)
);

CREATE INDEX IF NOT EXISTS idx_store_urun_firma_ayarlari_firma
  ON public.store_urun_firma_ayarlari (firma_id, aktif_mi);

ALTER TABLE public.store_urun_firma_ayarlari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_urun_firma_ayarlari FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.store_urun_firma_ayarlari TO service_role;

DO $govde$
BEGIN
  IF to_regprocedure('public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer)') IS NULL THEN
    IF to_regprocedure('public.store_siparis_olustur(uuid,uuid,uuid,integer)') IS NULL THEN
      RAISE EXCEPTION 'store_siparis_olustur(uuid,uuid,uuid,integer) bulunamadı';
    END IF;

    EXECUTE 'ALTER FUNCTION public.store_siparis_olustur(uuid,uuid,uuid,integer) RENAME TO store_siparis_olustur_cekirdek';
  END IF;
END
$govde$;

CREATE OR REPLACE FUNCTION public.store_siparis_olustur(
  p_kullanici_id uuid,
  p_urun_id uuid,
  p_adres_id uuid,
  p_adet integer
)
RETURNS TABLE(ok boolean, siparis_id uuid, hata text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_firma_id uuid;
  v_hbstore_aktif boolean;
  v_urun_aktif boolean;
BEGIN
  SELECT k.firma_id, f.hbstore_aktif
    INTO v_firma_id, v_hbstore_aktif
  FROM public.kullanicilar k
  LEFT JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE k.kullanici_id = p_kullanici_id;

  IF v_firma_id IS NULL OR v_hbstore_aktif IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Firmanız için HBStore kullanıma açık değil.'::text;
    RETURN;
  END IF;

  SELECT u.aktif_mi
    AND COALESCE(a.aktif_mi, true)
    INTO v_urun_aktif
  FROM public.store_urunler u
  LEFT JOIN public.store_urun_firma_ayarlari a
    ON a.urun_id = u.urun_id
   AND a.firma_id = v_firma_id
  WHERE u.urun_id = p_urun_id;

  IF v_urun_aktif IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Bu ürün firmanız için satışa açık değil.'::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sonuc.ok, sonuc.siparis_id, sonuc.hata
  FROM public.store_siparis_olustur_cekirdek(
    p_kullanici_id,
    p_urun_id,
    p_adres_id,
    p_adet
  ) AS sonuc;
END
$fonksiyon$;

REVOKE ALL ON FUNCTION public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_siparis_olustur(uuid,uuid,uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.store_siparis_olustur(uuid,uuid,uuid,integer)
  TO service_role;

COMMIT;

-- Uygulama sonrası doğrulama — üç değer de true dönmelidir.
SELECT to_regclass('public.store_urun_firma_ayarlari') IS NOT NULL AS tablo_var,
       to_regprocedure('public.store_siparis_olustur(uuid,uuid,uuid,integer)') IS NOT NULL AS sarmalayici_var,
       to_regprocedure('public.store_siparis_olustur_cekirdek(uuid,uuid,uuid,integer)') IS NOT NULL AS cekirdek_var;
