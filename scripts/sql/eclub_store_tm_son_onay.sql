-- Faz 2C: UTT -> BM -> TM -> Admin hediye çeki onay zinciri.
BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-tm-son-onay-faz-2c', 1));

ALTER TABLE public.eclub_store_cek_talepleri
  ADD COLUMN IF NOT EXISTS tm_id uuid REFERENCES public.kullanicilar(kullanici_id),
  ADD COLUMN IF NOT EXISTS tm_onay_tarihi timestamptz;

-- Daha önce BM son onayı sayılan bekleyen test kayıtlarını TM aşamasına taşır.
UPDATE public.eclub_store_cek_talepleri t
SET durum = 'tm_onayinda',
    tm_id = (
      SELECT tm.kullanici_id
      FROM public.kullanicilar bm
      JOIN public.kullanicilar tm
        ON tm.firma_id = bm.firma_id
       AND tm.takim_id IS NOT DISTINCT FROM bm.takim_id
       AND lower(tm.rol) = 'tm'
       AND tm.aktif_mi = true
      WHERE bm.kullanici_id = t.bm_id
      ORDER BY tm.kullanici_id
      LIMIT 1
    ),
    tm_onay_tarihi = NULL,
    guncellenme_at = now()
WHERE t.durum = 'onaylandi';

ALTER TABLE public.eclub_store_cek_talepleri
  DROP CONSTRAINT IF EXISTS eclub_store_cek_talepleri_durum_check;
ALTER TABLE public.eclub_store_cek_talepleri
  ADD CONSTRAINT eclub_store_cek_talepleri_durum_check
  CHECK (durum IN ('beklemede','bm_onayinda','tm_onayinda','onaylandi','cek_kodlari_gonderildi','iptal'));

CREATE OR REPLACE FUNCTION public.eclub_store_bm_onayla(p_bm_id uuid, p_talep_idler uuid[])
RETURNS TABLE(guncellenen_adet integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_tm_idler uuid[];
  v_tm_id uuid;
  v_adet integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar
    WHERE kullanici_id = p_bm_id AND aktif_mi = true AND lower(rol) = 'bm'
  ) THEN
    RAISE EXCEPTION 'BM yetkisi doğrulanamadı';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.eclub_store_cek_talepleri t
    WHERE t.talep_id = ANY(p_talep_idler)
      AND (t.bm_id IS DISTINCT FROM p_bm_id OR t.durum <> 'bm_onayinda')
  ) THEN
    RAISE EXCEPTION 'Yetkisiz veya geçersiz talep seçimi';
  END IF;

  SELECT array_agg(tm.kullanici_id ORDER BY tm.kullanici_id)
  INTO v_tm_idler
  FROM public.kullanicilar bm
  JOIN public.kullanicilar tm
    ON tm.firma_id = bm.firma_id
   AND tm.takim_id IS NOT DISTINCT FROM bm.takim_id
   AND lower(tm.rol) = 'tm'
   AND tm.aktif_mi = true
  WHERE bm.kullanici_id = p_bm_id;

  IF cardinality(v_tm_idler) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Takım için tek bir aktif TM atanmalıdır';
  END IF;
  v_tm_id := v_tm_idler[1];

  UPDATE public.eclub_store_cek_talepleri
  SET durum = 'tm_onayinda',
      tm_id = v_tm_id,
      bm_onay_tarihi = now(),
      tm_onay_tarihi = NULL,
      guncellenme_at = now()
  WHERE talep_id = ANY(p_talep_idler)
    AND bm_id = p_bm_id
    AND durum = 'bm_onayinda';
  GET DIAGNOSTICS v_adet = ROW_COUNT;
  RETURN QUERY SELECT v_adet;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_tm_onayla(p_tm_id uuid, p_talep_idler uuid[])
RETURNS TABLE(guncellenen_adet integer)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_adet integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar
    WHERE kullanici_id = p_tm_id AND aktif_mi = true AND lower(rol) = 'tm'
  ) THEN
    RAISE EXCEPTION 'TM yetkisi doğrulanamadı';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.eclub_store_cek_talepleri t
    WHERE t.talep_id = ANY(p_talep_idler)
      AND (t.tm_id IS DISTINCT FROM p_tm_id OR t.durum <> 'tm_onayinda')
  ) THEN
    RAISE EXCEPTION 'Yetkisiz veya geçersiz talep seçimi';
  END IF;

  UPDATE public.eclub_store_cek_talepleri
  SET durum = 'onaylandi',
      tm_onay_tarihi = now(),
      guncellenme_at = now()
  WHERE talep_id = ANY(p_talep_idler)
    AND tm_id = p_tm_id
    AND durum = 'tm_onayinda';
  GET DIAGNOSTICS v_adet = ROW_COUNT;
  RETURN QUERY SELECT v_adet;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_admin_kod_teslim(p_admin_id uuid, p_talep_id uuid, p_cek_kodu text)
RETURNS TABLE(ok boolean, hata text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_t public.eclub_store_cek_talepleri%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.kullanicilar WHERE kullanici_id = p_admin_id AND lower(rol) = 'admin' AND aktif_mi = true) THEN RETURN QUERY SELECT false,'Admin yetkisi doğrulanamadı.'; RETURN; END IF;
  IF p_cek_kodu IS NULL OR length(trim(p_cek_kodu)) < 3 OR length(trim(p_cek_kodu)) > 200 THEN RETURN QUERY SELECT false,'Çek kodu geçersiz.'; RETURN; END IF;
  SELECT * INTO v_t FROM public.eclub_store_cek_talepleri WHERE talep_id = p_talep_id FOR UPDATE;
  IF v_t.durum <> 'onaylandi' OR v_t.tm_id IS NULL OR v_t.tm_onay_tarihi IS NULL THEN RETURN QUERY SELECT false,'Talep TM tarafından onaylanmış değil.'; RETURN; END IF;
  UPDATE public.eclub_store_cek_talepleri SET durum='cek_kodlari_gonderildi',cek_kodu=trim(p_cek_kodu),cek_gonderim_tarihi=now(),guncellenme_at=now() WHERE talep_id=p_talep_id;
  INSERT INTO public.eclub_bildirimler(alici_kisi_id,gonderen_id,kayit_turu,kayit_id,mesaj,goruldu_mu)
    SELECT ke.kisi_id,p_admin_id,'cek',p_talep_id,'Migros hediye çekiniz teslim edildi.',false FROM public.eclub_kisi_eczane ke WHERE ke.eczane_id=v_t.eczane_id AND ke.aktif_mi=true;
  INSERT INTO public.eclub_store_cek_eposta_kuyrugu(talep_id,alici_eposta,alici_adi)
    SELECT p_talep_id,k.eposta,trim(k.ad||' '||k.soyad) FROM public.eclub_kisi_eczane ke JOIN public.eclub_kisiler k ON k.kisi_id=ke.kisi_id WHERE ke.eczane_id=v_t.eczane_id AND ke.aktif_mi=true AND lower(k.rol) IN ('eczaci','ikinci_eczaci','yardimci_eczaci') AND nullif(trim(k.eposta),'') IS NOT NULL ORDER BY CASE lower(k.rol) WHEN 'eczaci' THEN 0 WHEN 'ikinci_eczaci' THEN 1 ELSE 2 END LIMIT 1 ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT true,NULL::text;
END $f$;

CREATE OR REPLACE FUNCTION public.eclub_store_cek_talebi_iptal(p_talep_id uuid, p_kisi_id uuid, p_admin_mi boolean DEFAULT false)
RETURNS TABLE(ok boolean, hata text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_t public.eclub_store_cek_talepleri%rowtype;
BEGIN
  SELECT * INTO v_t FROM public.eclub_store_cek_talepleri WHERE talep_id=p_talep_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false,'Talep bulunamadı.'; RETURN; END IF;
  IF p_admin_mi AND NOT EXISTS(SELECT 1 FROM public.kullanicilar WHERE kullanici_id=p_kisi_id AND aktif_mi=true AND lower(rol)='admin') THEN RETURN QUERY SELECT false,'Admin yetkisi doğrulanamadı.'; RETURN; END IF;
  IF NOT p_admin_mi AND v_t.talep_eden_kisi_id<>p_kisi_id THEN RETURN QUERY SELECT false,'Yetkisiz işlem.'; RETURN; END IF;
  IF v_t.durum NOT IN ('beklemede','bm_onayinda','tm_onayinda','onaylandi') THEN RETURN QUERY SELECT false,'Bu talep artık iptal edilemez.'; RETURN; END IF;
  UPDATE public.eclub_store_cek_talepleri SET durum='iptal',guncellenme_at=now() WHERE talep_id=p_talep_id;
  UPDATE public.eclub_store_puan_devirleri SET kullanildi_mi=false,kullanilan_talep_id=NULL,guncellenme_at=now() WHERE kullanilan_talep_id=p_talep_id;
  UPDATE public.eclub_store_puan_devirleri SET iptal_edildi=true,guncellenme_at=now() WHERE kaynak_talep_id=p_talep_id;
  RETURN QUERY SELECT true,NULL::text;
END $f$;

REVOKE ALL ON FUNCTION public.eclub_store_bm_onayla(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_store_tm_onayla(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_store_admin_kod_teslim(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eclub_store_cek_talebi_iptal(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eclub_store_bm_onayla(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_store_tm_onayla(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_store_admin_kod_teslim(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.eclub_store_cek_talebi_iptal(uuid, uuid, boolean) TO service_role;

COMMIT;
