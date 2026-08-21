-- Eczanem eczane yönetim paketi
--
-- 1) Aynı eczanedeki eczacı/ikinci eczacı/teknisyen işlemlerini kişi bazında izler.
-- 2) Müşteri bağlama ve üyelik durumunu atomik RPC'lere taşır.
-- 3) Sipariş onay/red kararını mevcut FIFO onay RPC'sini bozmadan kişiyle kaydeder.
-- 4) Eczane işlem dökümünü PostgreSQL tarafında ürün bazında toplar.
-- 5) Eczane -> müşteri video dağıtımını yarışa dayanıklı ve tekrar çalıştırılabilir yapar.
--
-- Bu dosyayı yalnız İskender, Supabase SQL Editor'da çalıştırır.

BEGIN;

CREATE TABLE IF NOT EXISTS public.eczanem_personel_islemleri (
  islem_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eczane_id uuid NOT NULL,
  kisi_id uuid NOT NULL,
  islem_turu text NOT NULL CHECK (islem_turu IN (
    'musteri_olusturuldu',
    'musteri_baglandi',
    'musteri_yeniden_aktiflestirildi',
    'musteri_aktiflestirildi',
    'musteri_pasife_alindi',
    'siparis_onaylandi',
    'siparis_reddedildi'
  )),
  hedef_turu text NOT NULL CHECK (hedef_turu IN ('musteri', 'uyelik', 'siparis')),
  hedef_id uuid NOT NULL,
  detay jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eczanem_personel_islemleri_eczane_tarih
ON public.eczanem_personel_islemleri (eczane_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eczanem_personel_islemleri_hedef
ON public.eczanem_personel_islemleri (hedef_turu, hedef_id);

ALTER TABLE public.eczanem_uyelikler
  ADD COLUMN IF NOT EXISTS son_islem_yapan_kisi_id uuid NULL,
  ADD COLUMN IF NOT EXISTS son_islem_tarihi timestamptz NULL;

ALTER TABLE public.eczanem_siparisler
  ADD COLUMN IF NOT EXISTS islem_yapan_kisi_id uuid NULL,
  ADD COLUMN IF NOT EXISTS karar_tarihi timestamptz NULL;

-- Bu üç tablo sunucu orkestrasyonu ve atomik RPC dışında doğrudan erişime
-- kapalıdır. Canlı denetimde anon/authenticated rollerinde TRUNCATE dahil geniş
-- varsayılan yetkiler görüldü; RLS bu tablo-geneli yetkiyi engellemez.
REVOKE ALL ON TABLE
  public.eczanem_siparisler,
  public.eczanem_puan_kayitlari,
  public.eczanem_harcama_kayitlari
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.eczanem_siparisler,
  public.eczanem_puan_kayitlari,
  public.eczanem_harcama_kayitlari
TO service_role;

REVOKE ALL ON TABLE public.eczanem_personel_islemleri FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.eczanem_personel_islemleri TO service_role;

CREATE OR REPLACE FUNCTION public.eczanem_personel_eczane_yetkili_mi(
  p_kisi_id uuid,
  p_eczane_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
  SELECT EXISTS (
    SELECT 1
    FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
    WHERE ke.kisi_id = p_kisi_id
      AND ke.eczane_id = p_eczane_id
      AND ke.aktif_mi = true
      AND k.rol IN ('eczaci', 'ikinci_eczaci', 'yardimci_eczaci', 'eczane_teknisyeni')
  );
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_musteri_bagla_atomik(
  p_musteri_id uuid,
  p_eczane_id uuid,
  p_islem_yapan_kisi_id uuid
)
RETURNS TABLE(ok boolean, hata text, yeniden_aktif boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_mevcut_uyelik uuid;
  v_mevcut_aktif boolean;
  v_musteri_aktif boolean;
  v_auth_user_id uuid;
  v_uyelik_id uuid;
BEGIN
  IF NOT public.eczanem_personel_eczane_yetkili_mi(p_islem_yapan_kisi_id, p_eczane_id) THEN
    RETURN QUERY SELECT false, 'Bu eczanede aktif işlem yetkiniz yok.', false;
    RETURN;
  END IF;

  SELECT m.aktif_mi, m.auth_user_id
  INTO v_musteri_aktif, v_auth_user_id
  FROM public.eczanem_musteriler m
  WHERE m.musteri_id = p_musteri_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Müşteri bulunamadı.', false;
    RETURN;
  END IF;
  IF NOT v_musteri_aktif OR v_auth_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Müşterinin genel hesabı aktif değil; eczane üyeliği kurulamadı.', false;
    RETURN;
  END IF;

  SELECT u.uyelik_id, u.aktif_mi
  INTO v_mevcut_uyelik, v_mevcut_aktif
  FROM public.eczanem_uyelikler u
  WHERE u.musteri_id = p_musteri_id AND u.eczane_id = p_eczane_id
  FOR UPDATE;

  IF v_mevcut_uyelik IS NOT NULL AND v_mevcut_aktif THEN
    RETURN QUERY SELECT false, 'Bu müşteri zaten eczanenizin aktif üyesi.', false;
    RETURN;
  END IF;

  INSERT INTO public.eczanem_uyelikler (
    musteri_id, eczane_id, aktif_mi, son_islem_yapan_kisi_id, son_islem_tarihi
  ) VALUES (
    p_musteri_id, p_eczane_id, true, p_islem_yapan_kisi_id, now()
  )
  ON CONFLICT (musteri_id, eczane_id) DO UPDATE
  SET aktif_mi = true,
      son_islem_yapan_kisi_id = EXCLUDED.son_islem_yapan_kisi_id,
      son_islem_tarihi = EXCLUDED.son_islem_tarihi
  RETURNING uyelik_id INTO v_uyelik_id;

  INSERT INTO public.eczanem_personel_islemleri (
    eczane_id, kisi_id, islem_turu, hedef_turu, hedef_id
  ) VALUES (
    p_eczane_id,
    p_islem_yapan_kisi_id,
    CASE WHEN v_mevcut_uyelik IS NULL THEN 'musteri_baglandi' ELSE 'musteri_yeniden_aktiflestirildi' END,
    'uyelik',
    v_uyelik_id
  );

  RETURN QUERY SELECT true, NULL::text, v_mevcut_uyelik IS NOT NULL;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_musteri_durum_degistir(
  p_musteri_id uuid,
  p_eczane_id uuid,
  p_islem_yapan_kisi_id uuid,
  p_aktif_mi boolean
)
RETURNS TABLE(ok boolean, hata text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_uyelik_id uuid;
BEGIN
  IF NOT public.eczanem_personel_eczane_yetkili_mi(p_islem_yapan_kisi_id, p_eczane_id) THEN
    RETURN QUERY SELECT false, 'Bu eczanede aktif işlem yetkiniz yok.';
    RETURN;
  END IF;

  UPDATE public.eczanem_uyelikler
  SET aktif_mi = p_aktif_mi,
      son_islem_yapan_kisi_id = p_islem_yapan_kisi_id,
      son_islem_tarihi = now()
  WHERE musteri_id = p_musteri_id
    AND eczane_id = p_eczane_id
  RETURNING uyelik_id INTO v_uyelik_id;

  IF v_uyelik_id IS NULL THEN
    RETURN QUERY SELECT false, 'Bu müşteri eczane listenizde değil.';
    RETURN;
  END IF;

  INSERT INTO public.eczanem_personel_islemleri (
    eczane_id, kisi_id, islem_turu, hedef_turu, hedef_id
  ) VALUES (
    p_eczane_id,
    p_islem_yapan_kisi_id,
    CASE WHEN p_aktif_mi THEN 'musteri_aktiflestirildi' ELSE 'musteri_pasife_alindi' END,
    'uyelik',
    v_uyelik_id
  );

  RETURN QUERY SELECT true, NULL::text;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(
  p_telefon text,
  p_ad_soyad text,
  p_auth_user_id uuid,
  p_eczane_id uuid,
  p_islem_yapan_kisi_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri_id uuid;
  v_uyelik_id uuid;
BEGIN
  IF NOT public.eczanem_personel_eczane_yetkili_mi(p_islem_yapan_kisi_id, p_eczane_id) THEN
    RAISE EXCEPTION 'Bu eczanede aktif işlem yetkiniz yok.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.eczanem_musteriler (
    telefon, ad_soyad, kvkk_onay_tarihi, aktif_mi, auth_user_id
  ) VALUES (
    p_telefon, p_ad_soyad, now(), true, p_auth_user_id
  ) RETURNING musteri_id INTO v_musteri_id;

  INSERT INTO public.eczanem_uyelikler (
    musteri_id, eczane_id, aktif_mi, son_islem_yapan_kisi_id, son_islem_tarihi
  ) VALUES (
    v_musteri_id, p_eczane_id, true, p_islem_yapan_kisi_id, now()
  ) RETURNING uyelik_id INTO v_uyelik_id;

  INSERT INTO public.eczanem_personel_islemleri (
    eczane_id, kisi_id, islem_turu, hedef_turu, hedef_id,
    detay
  ) VALUES (
    p_eczane_id, p_islem_yapan_kisi_id, 'musteri_olusturuldu', 'musteri', v_musteri_id,
    jsonb_build_object('uyelik_id', v_uyelik_id)
  );

  RETURN v_musteri_id;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_siparis_personel_islemi(
  p_siparis_id uuid,
  p_eczane_id uuid,
  p_islem_yapan_kisi_id uuid,
  p_aksiyon text
)
RETURNS TABLE(ok boolean, hata text, islem_kodu text, indirim_tl numeric, kullanilan_puan integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_siparis public.eczanem_siparisler%ROWTYPE;
  v_onay record;
BEGIN
  IF p_aksiyon NOT IN ('onayla', 'reddet') THEN
    RETURN QUERY SELECT false, 'Geçersiz sipariş işlemi.', NULL::text, NULL::numeric, NULL::integer;
    RETURN;
  END IF;
  IF NOT public.eczanem_personel_eczane_yetkili_mi(p_islem_yapan_kisi_id, p_eczane_id) THEN
    RETURN QUERY SELECT false, 'Bu eczanede aktif işlem yetkiniz yok.', NULL::text, NULL::numeric, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO v_siparis
  FROM public.eczanem_siparisler
  WHERE siparis_id = p_siparis_id AND eczane_id = p_eczane_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Sipariş bulunamadı.', NULL::text, NULL::numeric, NULL::integer;
    RETURN;
  END IF;
  IF v_siparis.durum <> 'bekliyor' THEN
    RETURN QUERY SELECT false, 'Sipariş daha önce işlenmiş.', NULL::text, NULL::numeric, NULL::integer;
    RETURN;
  END IF;

  IF p_aksiyon = 'reddet' THEN
    UPDATE public.eczanem_siparisler
    SET durum = 'dustu',
        islem_yapan_kisi_id = p_islem_yapan_kisi_id,
        karar_tarihi = now()
    WHERE siparis_id = p_siparis_id;

    INSERT INTO public.eczanem_personel_islemleri (
      eczane_id, kisi_id, islem_turu, hedef_turu, hedef_id
    ) VALUES (
      p_eczane_id, p_islem_yapan_kisi_id, 'siparis_reddedildi', 'siparis', p_siparis_id
    );

    RETURN QUERY SELECT true, NULL::text, NULL::text, v_siparis.indirim_tl, v_siparis.kullanilan_puan;
    RETURN;
  END IF;

  SELECT * INTO v_onay FROM public.eczanem_siparis_onayla(p_siparis_id);
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Sipariş onay sonucu alınamadı.', NULL::text, NULL::numeric, NULL::integer;
    RETURN;
  END IF;
  IF NOT COALESCE(v_onay.ok, false) THEN
    RETURN QUERY SELECT false, COALESCE(v_onay.hata, 'Sipariş onaylanamadı.'), NULL::text, NULL::numeric, NULL::integer;
    RETURN;
  END IF;

  UPDATE public.eczanem_siparisler
  SET islem_yapan_kisi_id = p_islem_yapan_kisi_id,
      karar_tarihi = COALESCE(onay_tarihi, now())
  WHERE siparis_id = p_siparis_id;

  INSERT INTO public.eczanem_personel_islemleri (
    eczane_id, kisi_id, islem_turu, hedef_turu, hedef_id,
    detay
  ) VALUES (
    p_eczane_id, p_islem_yapan_kisi_id, 'siparis_onaylandi', 'siparis', p_siparis_id,
    jsonb_build_object('islem_kodu', v_onay.islem_kodu)
  );

  RETURN QUERY SELECT true, NULL::text, v_onay.islem_kodu::text, v_onay.indirim_tl::numeric, v_onay.kullanilan_puan::integer;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_eczane_dokumu(
  p_eczane_id uuid,
  p_baslangic timestamptz,
  p_bitis timestamptz,
  p_firma_idler uuid[] DEFAULT NULL
)
RETURNS TABLE(urun_id uuid, urun_adi text, kutu bigint, indirim_tl numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
  SELECT
    s.urun_id,
    COALESCE(u.urun_adi, '-')::text,
    SUM(s.adet)::bigint,
    ROUND(SUM(s.indirim_tl)::numeric, 2)
  FROM public.eczanem_siparisler s
  JOIN public.urunler u ON u.urun_id = s.urun_id
  WHERE s.eczane_id = p_eczane_id
    AND s.durum = 'onaylandi'
    AND s.onay_tarihi >= p_baslangic
    AND s.onay_tarihi <= p_bitis
    AND (p_firma_idler IS NULL OR u.firma_id = ANY(p_firma_idler))
  GROUP BY s.urun_id, u.urun_adi
  ORDER BY SUM(s.indirim_tl) DESC, u.urun_adi ASC;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_musterilere_video_gonder(
  p_eczane_id uuid,
  p_gonderen_kisi_id uuid,
  p_yayin_id uuid,
  p_musteri_idler uuid[]
)
RETURNS TABLE(ok boolean, hata text, gonderilen integer, atlanan integer, gonderilen_musteri_idler uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_istenen integer;
  v_gonderilen integer;
  v_gonderilen_musteri_idler uuid[];
BEGIN
  SELECT count(*)::integer INTO v_istenen
  FROM (SELECT DISTINCT unnest(p_musteri_idler) AS musteri_id) x;

  IF v_istenen = 0 THEN
    RETURN QUERY SELECT false, 'En az bir müşteri seçin.', 0, 0, ARRAY[]::uuid[];
    RETURN;
  END IF;
  IF v_istenen > 100 THEN
    RETURN QUERY SELECT false, 'Tek işlemde en fazla 100 müşteriye gönderim yapılabilir.', 0, v_istenen, ARRAY[]::uuid[];
    RETURN;
  END IF;
  IF NOT public.eczanem_personel_eczane_yetkili_mi(p_gonderen_kisi_id, p_eczane_id) THEN
    RETURN QUERY SELECT false, 'Bu eczanede aktif işlem yetkiniz yok.', 0, v_istenen, ARRAY[]::uuid[];
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.eczanem_eczane_gonderimleri eg
    WHERE eg.eczane_id = p_eczane_id AND eg.yayin_id = p_yayin_id
  ) THEN
    RETURN QUERY SELECT false, 'Bu video eczanenize gönderilmemiş.', 0, v_istenen, ARRAY[]::uuid[];
    RETURN;
  END IF;

  WITH istenen AS (
    SELECT DISTINCT unnest(p_musteri_idler) AS musteri_id
  ), uygun AS (
    SELECT i.musteri_id
    FROM istenen i
    JOIN public.eczanem_uyelikler uy
      ON uy.musteri_id = i.musteri_id
     AND uy.eczane_id = p_eczane_id
     AND uy.aktif_mi = true
    JOIN public.eczanem_musteriler m
      ON m.musteri_id = i.musteri_id
     AND m.aktif_mi = true
  ), eklenen AS (
    INSERT INTO public.eczanem_gonderimler (
      yayin_id, eczane_id, musteri_id, gonderen_kisi_id
    )
    SELECT p_yayin_id, p_eczane_id, u.musteri_id, p_gonderen_kisi_id
    FROM uygun u
    ON CONFLICT (yayin_id, musteri_id, eczane_id) DO NOTHING
    RETURNING musteri_id
  )
  SELECT count(*)::integer, COALESCE(array_agg(musteri_id), ARRAY[]::uuid[])
  INTO v_gonderilen, v_gonderilen_musteri_idler
  FROM eklenen;

  RETURN QUERY SELECT true, NULL::text, v_gonderilen, v_istenen - v_gonderilen, v_gonderilen_musteri_idler;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_personel_eczane_yetkili_mi(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_musteri_bagla_atomik(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_musteri_durum_degistir(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(text, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_siparis_personel_islemi(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_eczane_dokumu(uuid, timestamptz, timestamptz, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_musterilere_video_gonder(uuid, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
-- Çekirdek FIFO RPC yalnız yukarıdaki kişi/eczane doğrulamalı sarmalayıcıdan
-- çağrılır. Doğrudan istemci çağrısı personel izini ve eczane yetkisini atlayamaz.
REVOKE ALL ON FUNCTION public.eczanem_siparis_onayla(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.eczanem_personel_eczane_yetkili_mi(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_musteri_bagla_atomik(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_musteri_durum_degistir(uuid, uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_yeni_musteri_provizyonu_izli(text, text, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_siparis_personel_islemi(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_eczane_dokumu(uuid, timestamptz, timestamptz, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_musterilere_video_gonder(uuid, uuid, uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_siparis_onayla(uuid) TO service_role;

-- Paket eksik bir nesneyle yarım kalırsa transaction bütünüyle geri alınır.
DO $dogrulama$
BEGIN
  IF to_regclass('public.eczanem_personel_islemleri') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'eczanem_siparisler'
         AND column_name = 'islem_yapan_kisi_id'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'eczanem_siparisler'
         AND column_name = 'karar_tarihi'
     )
     OR to_regprocedure('public.eczanem_siparis_personel_islemi(uuid,uuid,uuid,text)') IS NULL
     OR to_regprocedure('public.eczanem_eczane_dokumu(uuid,timestamptz,timestamptz,uuid[])') IS NULL
     OR to_regprocedure('public.eczanem_musterilere_video_gonder(uuid,uuid,uuid,uuid[])') IS NULL
  THEN
    RAISE EXCEPTION 'Eczanem eczane yönetim paketi eksik kuruldu; işlem geri alındı.';
  END IF;
END;
$dogrulama$;

-- PostgREST yeni kolon ve fonksiyon imzalarını commit sonrasında yeniden okur.
NOTIFY pgrst, 'reload schema';

COMMIT;
