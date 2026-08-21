-- Eczanem müşterisinin E-Club eczacı / eczane teknisyeni kimliğine kontrollü geçişi.
--
-- Kural:
--   * Talep UTT tarafından açılır, fakat E-Club kimliği müşterinin açık kararı
--     olmadan oluşturulmaz.
--   * Talep açıkken yeni puan, yeni video gönderimi ve yeni eczane üyeliği
--     üretilemez. Müşteri yalnız mevcut puanını siparişle kullanabilir.
--   * Puan kullanımı tamamlanınca veya müşteri puanlarından açıkça vazgeçince
--     müşteri kimliği kaldırılır ve AYNI auth hesabı E-Club'a atomik geçirilir.
--   * Finansal mutabakat için PII içermeyen puan kapanış ve geçiş kayıtları kalır.
--
-- Bu dosyayı İskender Supabase SQL Editor'da bir kez çalıştırır.

BEGIN;

CREATE TABLE IF NOT EXISTS public.eczanem_eclub_gecis_talepleri (
  gecis_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  musteri_id uuid NOT NULL REFERENCES public.eczanem_musteriler(musteri_id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  eczane_id uuid NOT NULL REFERENCES public.eclub_eczaneler(eczane_id),
  rol varchar NOT NULL CHECK (rol IN ('eczaci', 'ikinci_eczaci', 'yardimci_eczaci', 'eczane_teknisyeni')),
  ad varchar NOT NULL,
  soyad varchar NOT NULL,
  eposta varchar NOT NULL,
  telefon varchar NOT NULL,
  talep_eden_utt_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  durum text NOT NULL DEFAULT 'karar_bekliyor'
    CHECK (durum IN ('karar_bekliyor', 'puan_kullaniliyor')),
  karar text NULL CHECK (karar IS NULL OR karar = 'puan_kullan'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (musteri_id),
  UNIQUE (auth_user_id)
);

-- Aynı eczaneye eşzamanlı iki eczacı geçişi açılamaz. Diğer eczacı unvanları
-- eczanenin kendi kadro kurallarına göre çoğul olabilir.
CREATE UNIQUE INDEX IF NOT EXISTS ux_eczanem_eclub_gecis_bekleyen_eczaci
ON public.eczanem_eclub_gecis_talepleri (eczane_id)
WHERE rol = 'eczaci';

CREATE TABLE IF NOT EXISTS public.eczanem_eclub_gecis_kayitlari (
  gecis_id uuid PRIMARY KEY,
  kisi_id uuid NULL,
  eczane_id uuid NOT NULL REFERENCES public.eclub_eczaneler(eczane_id),
  rol varchar NOT NULL,
  talep_eden_utt_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  sonuc text NOT NULL CHECK (sonuc IN ('puan_kullanildi', 'puandan_vazgecildi', 'reddedildi')),
  vazgecilen_puan integer NOT NULL DEFAULT 0 CHECK (vazgecilen_puan >= 0),
  iptal_edilen_siparis integer NOT NULL DEFAULT 0 CHECK (iptal_edilen_siparis >= 0),
  beyan_surumu text NOT NULL DEFAULT 'eczanem-eclub-v1',
  talep_tarihi timestamptz NOT NULL,
  karar_tarihi timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eczanem_eclub_gecis_kayitlari
  ADD COLUMN IF NOT EXISTS beyan_surumu text NOT NULL DEFAULT 'eczanem-eclub-v1';

-- Kişisel veri içermez; eczane/firma/ürün ekseninde hangi puanın neden
-- kapandığını mutabakat için saklar.
CREATE TABLE IF NOT EXISTS public.eczanem_eclub_puan_kapanislari (
  kayit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gecis_id uuid NOT NULL,
  eczane_id uuid NOT NULL,
  firma_id uuid NOT NULL,
  urun_id uuid NOT NULL,
  neden text NOT NULL CHECK (neden IN ('kullanici_vazgecti', 'suresi_doldu')),
  kapanan_puan integer NOT NULL CHECK (kapanan_puan > 0),
  kazanim_satiri integer NOT NULL CHECK (kazanim_satiri > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.eczanem_eclub_gecis_talepleri FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eczanem_eclub_gecis_kayitlari FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.eczanem_eclub_puan_kapanislari FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.eczanem_eclub_gecis_talepleri TO service_role;
GRANT SELECT, INSERT ON TABLE public.eczanem_eclub_gecis_kayitlari TO service_role;
GRANT SELECT, INSERT ON TABLE public.eczanem_eclub_puan_kapanislari TO service_role;

-- Toplu dağıtımda geçişteki müşteriler diğer alıcıların işlemini bozmadan
-- "atlanan" sayılır. Aşağıdaki DB tetikleyicisi doğrudan/kaçak INSERT'i ayrıca
-- reddetmeye devam eder.
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
    WHERE NOT EXISTS (
      SELECT 1 FROM public.eczanem_eclub_gecis_talepleri g
      WHERE g.musteri_id = i.musteri_id
    )
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

REVOKE ALL ON FUNCTION public.eczanem_musterilere_video_gonder(uuid, uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_musterilere_video_gonder(uuid, uuid, uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.eczanem_eclub_gecis_puan_omru_gun()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_deger text;
BEGIN
  SELECT trim(both '"' from deger::text)
  INTO v_deger
  FROM public.sistem_ayarlari
  WHERE anahtar = 'eczanem_puan_omru_gun';

  IF v_deger ~ '^[1-9][0-9]*$' THEN
    RETURN v_deger::integer;
  END IF;
  RETURN 180;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_eclub_gecis_talebi_olustur(
  p_musteri_id uuid,
  p_auth_user_id uuid,
  p_eczane_id uuid,
  p_rol text,
  p_ad text,
  p_soyad text,
  p_eposta text,
  p_telefon text,
  p_talep_eden_utt_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri record;
  v_auth_eposta text;
  v_mevcut public.eczanem_eclub_gecis_talepleri%ROWTYPE;
  v_gecis_id uuid;
BEGIN
  IF p_rol NOT IN ('eczaci', 'ikinci_eczaci', 'yardimci_eczaci', 'eczane_teknisyeni') THEN
    RAISE EXCEPTION 'Geçersiz E-Club unvanı.' USING ERRCODE = '22023';
  END IF;

  SELECT m.musteri_id, m.auth_user_id, m.telefon, m.aktif_mi
  INTO v_musteri
  FROM public.eczanem_musteriler m
  WHERE m.musteri_id = p_musteri_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_musteri.aktif_mi OR v_musteri.auth_user_id IS NULL
     OR v_musteri.auth_user_id <> p_auth_user_id THEN
    RAISE EXCEPTION 'Aktif müşteri giriş hesabı doğrulanamadı.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(public.hapbilgi_telefon_normalize(v_musteri.telefon), 0));

  IF public.hapbilgi_telefon_normalize(v_musteri.telefon)
     IS DISTINCT FROM public.hapbilgi_telefon_normalize(p_telefon) THEN
    RAISE EXCEPTION 'Telefon bilgisi müşteri hesabıyla eşleşmiyor.' USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(email::text) INTO v_auth_eposta
  FROM auth.users
  WHERE id = p_auth_user_id;
  IF v_auth_eposta IS NULL OR v_auth_eposta <> lower(trim(p_eposta)) THEN
    RAISE EXCEPTION 'E-posta, mevcut Eczanem giriş hesabındaki e-posta ile aynı olmalıdır.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.eclub_eczane_firma ef
    WHERE ef.eczane_id = p_eczane_id
      AND ef.baglayan_utt_id = p_talep_eden_utt_id
      AND ef.aktif_mi = true
  ) THEN
    RAISE EXCEPTION 'UTT ile hedef eczane bağı doğrulanamadı.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.eclub_kisiler k
    WHERE k.auth_user_id = p_auth_user_id
       OR lower(k.eposta) = lower(trim(p_eposta))
       OR public.hapbilgi_telefon_normalize(k.telefon) = public.hapbilgi_telefon_normalize(p_telefon)
  ) THEN
    RAISE EXCEPTION 'Bu giriş hesabı zaten E-Club kimliğine bağlı.' USING ERRCODE = 'P0001';
  END IF;

  IF p_rol = 'eczaci' AND EXISTS (
    SELECT 1
    FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
    WHERE ke.eczane_id = p_eczane_id AND ke.aktif_mi = true AND k.rol = 'eczaci'
  ) THEN
    RAISE EXCEPTION 'Bu eczanede zaten aktif bir eczacı kayıtlı.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_mevcut
  FROM public.eczanem_eclub_gecis_talepleri
  WHERE musteri_id = p_musteri_id;

  IF FOUND THEN
    IF v_mevcut.eczane_id = p_eczane_id
       AND v_mevcut.rol = p_rol
       AND lower(v_mevcut.eposta) = lower(trim(p_eposta)) THEN
      RETURN jsonb_build_object('ok', true, 'gecis_id', v_mevcut.gecis_id, 'mevcut', true);
    END IF;
    RAISE EXCEPTION 'Bu müşteri için başka bir E-Club geçiş talebi zaten bekliyor.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.eczanem_eclub_gecis_talepleri (
    musteri_id, auth_user_id, eczane_id, rol, ad, soyad, eposta, telefon, talep_eden_utt_id
  ) VALUES (
    p_musteri_id, p_auth_user_id, p_eczane_id, p_rol,
    trim(p_ad), trim(p_soyad), lower(trim(p_eposta)), p_telefon, p_talep_eden_utt_id
  )
  RETURNING gecis_id INTO v_gecis_id;

  RETURN jsonb_build_object('ok', true, 'gecis_id', v_gecis_id, 'mevcut', false);
END;
$fonksiyon$;

-- Geçiş açıkken bakiye büyümesini veya müşteri bağlarının değişmesini engeller.
CREATE OR REPLACE FUNCTION public.eczanem_eclub_gecis_dondur_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri_id uuid;
BEGIN
  IF current_setting('hapbilgi.eclub_gecis_tamamlaniyor', true) = '1' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_musteri_id := OLD.musteri_id;
  ELSE
    v_musteri_id := NEW.musteri_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.eczanem_eclub_gecis_talepleri g
    WHERE g.musteri_id = v_musteri_id
  ) THEN
    IF TG_TABLE_NAME = 'eczanem_puan_kayitlari' THEN
      RAISE EXCEPTION 'E-Club üyelik geçişiniz sürerken yeni puan kazanamazsınız.' USING ERRCODE = 'P0001';
    ELSIF TG_TABLE_NAME = 'eczanem_gonderimler' THEN
      RAISE EXCEPTION 'E-Club geçişi süren müşteriye yeni video gönderilemez.' USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'E-Club üyelik geçişi sürerken eczane üyelikleri değiştirilemez.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$fonksiyon$;

DROP TRIGGER IF EXISTS trg_eczanem_eclub_gecis_puan_dondur ON public.eczanem_puan_kayitlari;
CREATE TRIGGER trg_eczanem_eclub_gecis_puan_dondur
BEFORE INSERT ON public.eczanem_puan_kayitlari
FOR EACH ROW EXECUTE FUNCTION public.eczanem_eclub_gecis_dondur_trg();

DROP TRIGGER IF EXISTS trg_eczanem_eclub_gecis_gonderim_dondur ON public.eczanem_gonderimler;
CREATE TRIGGER trg_eczanem_eclub_gecis_gonderim_dondur
BEFORE INSERT ON public.eczanem_gonderimler
FOR EACH ROW EXECUTE FUNCTION public.eczanem_eclub_gecis_dondur_trg();

DROP TRIGGER IF EXISTS trg_eczanem_eclub_gecis_uyelik_dondur ON public.eczanem_uyelikler;
CREATE TRIGGER trg_eczanem_eclub_gecis_uyelik_dondur
BEFORE INSERT OR UPDATE OR DELETE ON public.eczanem_uyelikler
FOR EACH ROW EXECUTE FUNCTION public.eczanem_eclub_gecis_dondur_trg();

-- Daha önce kurulmuş KVKK tam silme RPC'sini geçiş dondurma kuralıyla uyumlu
-- hale getirir. Silme yine hiçbir uygulama günlüğü bırakmaz; açık geçiş talebi
-- müşteri satırı silinirken ON DELETE CASCADE ile yok olur.
CREATE OR REPLACE FUNCTION public.eczanem_musteri_kendini_tam_sil(
  p_musteri_id uuid,
  p_auth_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_musteri uuid;
  v_auth_silinen integer := 0;
BEGIN
  SELECT m.musteri_id
  INTO v_musteri
  FROM public.eczanem_musteriler m
  WHERE m.musteri_id = p_musteri_id
    AND m.auth_user_id = p_auth_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Müşteri ve giriş hesabı bağı doğrulanamadı.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('hapbilgi.eclub_gecis_tamamlaniyor', '1', true);

  DELETE FROM public.eczanem_harcama_kayitlari hk
  WHERE hk.siparis_id IN (
      SELECT s.siparis_id FROM public.eczanem_siparisler s
      WHERE s.musteri_id = p_musteri_id
    )
     OR hk.kaynak_kayit_id IN (
      SELECT pk.kayit_id FROM public.eczanem_puan_kayitlari pk
      WHERE pk.musteri_id = p_musteri_id
    );

  DELETE FROM public.eczanem_puan_kayitlari WHERE musteri_id = p_musteri_id;
  DELETE FROM public.eczanem_izleme_kayitlari WHERE musteri_id = p_musteri_id;
  DELETE FROM public.eczanem_siparisler WHERE musteri_id = p_musteri_id;
  DELETE FROM public.eczanem_gonderimler WHERE musteri_id = p_musteri_id;
  DELETE FROM public.eczanem_uyelikler WHERE musteri_id = p_musteri_id;
  DELETE FROM public.eczanem_silinen_musteriler WHERE musteri_id = p_musteri_id;
  DELETE FROM public.push_gonderim_kayitlari WHERE auth_user_id = p_auth_user_id;
  DELETE FROM public.push_abonelikleri WHERE auth_user_id = p_auth_user_id;

  DELETE FROM public.eczanem_musteriler
  WHERE musteri_id = p_musteri_id AND auth_user_id = p_auth_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Müşteri hesabı silinemedi.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM auth.users WHERE id = p_auth_user_id;
  GET DIAGNOSTICS v_auth_silinen = ROW_COUNT;
  IF v_auth_silinen <> 1 THEN
    RAISE EXCEPTION 'Giriş hesabı silinemedi.' USING ERRCODE = 'P0001';
  END IF;
  RETURN true;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_musteri_kendini_tam_sil(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_musteri_kendini_tam_sil(uuid, uuid) TO service_role;

-- Yalnız aşağıdaki karar RPC'sinin çağırdığı atomik çekirdek.
CREATE OR REPLACE FUNCTION public.eczanem_eclub_gecisi_tamamla_cekirdek(
  p_gecis_id uuid,
  p_sonuc text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gecis public.eczanem_eclub_gecis_talepleri%ROWTYPE;
  v_omur integer;
  v_alt_sinir timestamptz;
  v_aktif_puan integer;
  v_bekleyen integer;
  v_vazgecilen integer := 0;
  v_iptal_edilen integer := 0;
  v_kisi_id uuid;
BEGIN
  IF p_sonuc NOT IN ('puan_kullanildi', 'puandan_vazgecildi') THEN
    RAISE EXCEPTION 'Geçersiz geçiş sonucu.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_gecis
  FROM public.eczanem_eclub_gecis_talepleri
  WHERE gecis_id = p_gecis_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E-Club geçiş talebi bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.eczanem_musteriler
  WHERE musteri_id = v_gecis.musteri_id AND auth_user_id = v_gecis.auth_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Müşteri ve giriş hesabı bağı doğrulanamadı.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(public.hapbilgi_telefon_normalize(v_gecis.telefon), 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.eclub_eczane_firma ef
    WHERE ef.eczane_id = v_gecis.eczane_id
      AND ef.baglayan_utt_id = v_gecis.talep_eden_utt_id
      AND ef.aktif_mi = true
  ) THEN
    RAISE EXCEPTION 'Talebi açan UTT ile hedef eczane bağı artık aktif değil.' USING ERRCODE = 'P0001';
  END IF;
  v_omur := public.eczanem_eclub_gecis_puan_omru_gun();
  v_alt_sinir := now() - make_interval(days => v_omur);

  SELECT COALESCE(sum(kalan_puan), 0)::integer
  INTO v_aktif_puan
  FROM public.eczanem_puan_kayitlari
  WHERE musteri_id = v_gecis.musteri_id
    AND kalan_puan > 0
    AND created_at >= v_alt_sinir;

  SELECT count(*)::integer
  INTO v_bekleyen
  FROM public.eczanem_siparisler
  WHERE musteri_id = v_gecis.musteri_id AND durum = 'bekliyor';

  IF p_sonuc = 'puan_kullanildi' THEN
    IF v_gecis.durum <> 'puan_kullaniliyor' OR v_gecis.karar <> 'puan_kullan' THEN
      RAISE EXCEPTION 'Önce puanlarınızı kullanacağınızı onaylayın.' USING ERRCODE = 'P0001';
    END IF;
    IF v_aktif_puan > 0 THEN
      RAISE EXCEPTION 'Kullanılabilir % puanınız bulunuyor; geçiş henüz tamamlanamaz.', v_aktif_puan USING ERRCODE = 'P0001';
    END IF;
    IF v_bekleyen > 0 THEN
      RAISE EXCEPTION '% siparişiniz eczane onayı bekliyor; geçiş henüz tamamlanamaz.', v_bekleyen USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_vazgecilen := v_aktif_puan;
    UPDATE public.eczanem_siparisler
    SET durum = 'dustu'
    WHERE musteri_id = v_gecis.musteri_id AND durum = 'bekliyor';
    GET DIAGNOSTICS v_iptal_edilen = ROW_COUNT;
  END IF;

  -- Aktif vazgeçilen ve daha önce süresi dolmuş bakiye ayrı nedenlerle kapanır.
  INSERT INTO public.eczanem_eclub_puan_kapanislari (
    gecis_id, eczane_id, firma_id, urun_id, neden, kapanan_puan, kazanim_satiri
  )
  SELECT
    v_gecis.gecis_id,
    pk.eczane_id,
    pk.firma_id,
    pk.urun_id,
    CASE
      WHEN pk.created_at < v_alt_sinir THEN 'suresi_doldu'
      ELSE 'kullanici_vazgecti'
    END,
    sum(pk.kalan_puan)::integer,
    count(*)::integer
  FROM public.eczanem_puan_kayitlari pk
  WHERE pk.musteri_id = v_gecis.musteri_id
    AND pk.kalan_puan > 0
    AND (p_sonuc = 'puandan_vazgecildi' OR pk.created_at < v_alt_sinir)
  GROUP BY pk.eczane_id, pk.firma_id, pk.urun_id,
    CASE WHEN pk.created_at < v_alt_sinir THEN 'suresi_doldu' ELSE 'kullanici_vazgecti' END;

  -- Sipariş/harcama mutabakatı korunur; müşteri PII bağı kaldırılır.
  UPDATE public.eczanem_harcama_kayitlari hk
  SET kaynak_kayit_id = NULL
  WHERE hk.kaynak_kayit_id IN (
    SELECT pk.kayit_id FROM public.eczanem_puan_kayitlari pk
    WHERE pk.musteri_id = v_gecis.musteri_id
  );

  UPDATE public.eczanem_siparisler
  SET musteri_id = NULL,
      musteri_etiket = 'E-Club geçişi'
  WHERE musteri_id = v_gecis.musteri_id;

  DELETE FROM public.eczanem_puan_kayitlari WHERE musteri_id = v_gecis.musteri_id;
  DELETE FROM public.eczanem_izleme_kayitlari WHERE musteri_id = v_gecis.musteri_id;
  DELETE FROM public.eczanem_gonderimler WHERE musteri_id = v_gecis.musteri_id;

  PERFORM set_config('hapbilgi.eclub_gecis_tamamlaniyor', '1', true);
  DELETE FROM public.eczanem_uyelikler WHERE musteri_id = v_gecis.musteri_id;

  DELETE FROM public.eczanem_eclub_gecis_talepleri WHERE gecis_id = v_gecis.gecis_id;
  DELETE FROM public.eczanem_musteriler
  WHERE musteri_id = v_gecis.musteri_id AND auth_user_id = v_gecis.auth_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Müşteri kimliği kaldırılamadı.' USING ERRCODE = 'P0001';
  END IF;

  IF v_gecis.rol = 'eczaci' AND EXISTS (
    SELECT 1
    FROM public.eclub_kisi_eczane ke
    JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
    WHERE ke.eczane_id = v_gecis.eczane_id AND ke.aktif_mi = true AND k.rol = 'eczaci'
  ) THEN
    RAISE EXCEPTION 'Bu eczanede eşzamanlı olarak başka bir eczacı aktif edildi.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.eclub_kisiler (rol, ad, soyad, eposta, telefon, auth_user_id)
  VALUES (v_gecis.rol, v_gecis.ad, v_gecis.soyad, v_gecis.eposta, v_gecis.telefon, v_gecis.auth_user_id)
  RETURNING kisi_id INTO v_kisi_id;

  INSERT INTO public.eclub_kisi_eczane (kisi_id, eczane_id, aktif_mi)
  VALUES (v_kisi_id, v_gecis.eczane_id, true);

  INSERT INTO public.eczanem_eclub_gecis_kayitlari (
    gecis_id, kisi_id, eczane_id, rol, talep_eden_utt_id, sonuc,
    vazgecilen_puan, iptal_edilen_siparis, talep_tarihi
  ) VALUES (
    v_gecis.gecis_id, v_kisi_id, v_gecis.eczane_id, v_gecis.rol,
    v_gecis.talep_eden_utt_id, p_sonuc, v_vazgecilen,
    v_iptal_edilen, v_gecis.created_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tamamlandi', true,
    'kisi_id', v_kisi_id,
    'vazgecilen_puan', v_vazgecilen,
    'iptal_edilen_siparis', v_iptal_edilen
  );
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.eczanem_eclub_gecis_karar_ver(
  p_gecis_id uuid,
  p_auth_user_id uuid,
  p_karar text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gecis public.eczanem_eclub_gecis_talepleri%ROWTYPE;
BEGIN
  SELECT * INTO v_gecis
  FROM public.eczanem_eclub_gecis_talepleri
  WHERE gecis_id = p_gecis_id AND auth_user_id = p_auth_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E-Club geçiş talebi bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF p_karar = 'puan_kullan' THEN
    UPDATE public.eczanem_eclub_gecis_talepleri
    SET durum = 'puan_kullaniliyor', karar = 'puan_kullan', updated_at = now()
    WHERE gecis_id = p_gecis_id;
    RETURN jsonb_build_object('ok', true, 'tamamlandi', false, 'durum', 'puan_kullaniliyor');
  ELSIF p_karar = 'puandan_vazgec' THEN
    RETURN public.eczanem_eclub_gecisi_tamamla_cekirdek(p_gecis_id, 'puandan_vazgecildi');
  ELSIF p_karar = 'puan_kullanimi_tamamlandi' THEN
    -- Hiç puanı olmayan müşteri de aynı onayla doğrudan tamamlayabilsin.
    UPDATE public.eczanem_eclub_gecis_talepleri
    SET durum = 'puan_kullaniliyor', karar = 'puan_kullan', updated_at = now()
    WHERE gecis_id = p_gecis_id;
    RETURN public.eczanem_eclub_gecisi_tamamla_cekirdek(p_gecis_id, 'puan_kullanildi');
  ELSIF p_karar = 'reddet' THEN
    INSERT INTO public.eczanem_eclub_gecis_kayitlari (
      gecis_id, kisi_id, eczane_id, rol, talep_eden_utt_id, sonuc,
      vazgecilen_puan, iptal_edilen_siparis, talep_tarihi
    ) VALUES (
      v_gecis.gecis_id, NULL, v_gecis.eczane_id, v_gecis.rol,
      v_gecis.talep_eden_utt_id, 'reddedildi', 0, 0, v_gecis.created_at
    );
    DELETE FROM public.eczanem_eclub_gecis_talepleri WHERE gecis_id = p_gecis_id;
    RETURN jsonb_build_object('ok', true, 'tamamlandi', false, 'reddedildi', true);
  END IF;

  RAISE EXCEPTION 'Geçersiz geçiş kararı.' USING ERRCODE = '22023';
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.eczanem_eclub_gecis_puan_omru_gun() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_eclub_gecis_talebi_olustur(uuid, uuid, uuid, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.eczanem_eclub_gecisi_tamamla_cekirdek(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.eczanem_eclub_gecis_karar_ver(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eczanem_eclub_gecis_talebi_olustur(uuid, uuid, uuid, text, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.eczanem_eclub_gecis_karar_ver(uuid, uuid, text) TO service_role;

COMMIT;
