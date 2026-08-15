-- Çoklu İçerik Üreticisi — Paket B/1
-- IU/ürün uygunluğu, yük dengeli otomatik seçim, ilk görev ve görev devri.
-- İskender tarafından Supabase SQL Editor'da çalıştırılır.
-- Canlı üretim kayıtlarını taşımaz; mevcut görevlere dokunmaz.

BEGIN;

-- Aynı istemci işlemi yeniden gönderildiğinde ikinci yazımı engelleyen kalıcı
-- işlem defteri. Dış RPC'lerin tümü önce bu tabloyu kontrol eder.
CREATE TABLE IF NOT EXISTS public.uretim_islem_kayitlari (
  islem_anahtari uuid PRIMARY KEY,
  islem_turu     text NOT NULL,
  gorev_id       uuid REFERENCES public.uretim_gorevleri(gorev_id),
  talep_id       uuid REFERENCES public.talepler(talep_id),
  sonuc          jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_uretim_islem_kayitlari_talep
  ON public.uretim_islem_kayitlari (talep_id, created_at DESC);

ALTER TABLE public.uretim_islem_kayitlari ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.uretim_islem_kayitlari TO service_role;
REVOKE ALL ON public.uretim_islem_kayitlari FROM anon, authenticated;

-- Paket A'daki ortak trigger üç farklı satır tipinde çalışır. Alan erişimini
-- tabloya göre JSON üzerinden yapmak, olmayan RECORD alanının değerlendirilme
-- riskini kaldırır.
CREATE OR REPLACE FUNCTION public.uretim_aktif_iu_dogrula()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  hedef_iu uuid;
  iu_gecerli boolean;
BEGIN
  hedef_iu := nullif(
    to_jsonb(NEW) ->> (CASE
      WHEN TG_TABLE_NAME = 'uretim_gorevleri' THEN 'atanan_iu_id'
      ELSE 'iu_id'
    END),
    ''
  )::uuid;

  IF hedef_iu IS NULL THEN RETURN NEW; END IF;

  SELECT (lower(k.rol::text) = 'iu' AND k.aktif_mi IS TRUE)
    INTO iu_gecerli
  FROM public.kullanicilar k
  WHERE k.kullanici_id = hedef_iu;

  IF iu_gecerli IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Atama yalnız aktif bir içerik üreticisine yapılabilir.';
  END IF;
  RETURN NEW;
END;
$fonksiyon$;

-- Verilen IU, talebin ürün/genel havuzuna bugün itibarıyla uygun mu?
CREATE OR REPLACE FUNCTION public.uretim_iu_talep_icin_uygun(
  p_iu_id uuid,
  p_talep_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_urun_id uuid;
  v_egitim_turu text;
BEGIN
  IF p_iu_id IS NULL OR p_talep_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT t.urun_id, t.egitim_turu
    INTO v_urun_id, v_egitim_turu
  FROM public.talepler t
  WHERE t.talep_id = p_talep_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.kullanicilar k
    WHERE k.kullanici_id = p_iu_id
      AND lower(k.rol::text) = 'iu'
      AND k.aktif_mi IS TRUE
  ) THEN
    RETURN false;
  END IF;

  IF v_urun_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.iu_urun_atamalari a
      WHERE a.iu_id = p_iu_id
        AND a.urun_id = v_urun_id
        AND a.aktif_mi IS TRUE
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.iu_genel_atamalari a
    WHERE a.iu_id = p_iu_id
      AND a.egitim_turu = v_egitim_turu
      AND a.aktif_mi IS TRUE
  );
END;
$fonksiyon$;

-- Önce önceki aşamanın IU'sunu korur; uygun değilse en az aktif işi olan
-- aday seçilir. Eşitlikte en uzun süredir iş almayan IU öne gelir.
CREATE OR REPLACE FUNCTION public.uretim_iu_adayi_sec(
  p_talep_id uuid,
  p_oncelikli_iu_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_urun_id uuid;
  v_egitim_turu text;
  v_iu_id uuid;
BEGIN
  -- Farklı talepler aynı anda açıldığında ikisinin de aynı eski yük sayımını
  -- kullanmasını engeller. Üretim talebi hacmi için kısa, güvenli bir kilittir.
  PERFORM pg_advisory_xact_lock(hashtextextended('uretim_iu_otomatik_atama', 0));

  IF public.uretim_iu_talep_icin_uygun(p_oncelikli_iu_id, p_talep_id) THEN
    RETURN p_oncelikli_iu_id;
  END IF;

  SELECT t.urun_id, t.egitim_turu
    INTO v_urun_id, v_egitim_turu
  FROM public.talepler t
  WHERE t.talep_id = p_talep_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF v_urun_id IS NOT NULL THEN
    SELECT a.iu_id
      INTO v_iu_id
    FROM public.iu_urun_atamalari a
    JOIN public.kullanicilar k
      ON k.kullanici_id = a.iu_id
     AND lower(k.rol::text) = 'iu'
     AND k.aktif_mi IS TRUE
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS aktif_is
      FROM public.uretim_gorevleri g
      WHERE g.atanan_iu_id = a.iu_id
        AND g.durum IN ('hazirlaniyor', 'inceleme_bekliyor', 'revizyon_bekliyor')
    ) yuk ON true
    WHERE a.urun_id = v_urun_id
      AND a.aktif_mi IS TRUE
    ORDER BY yuk.aktif_is ASC,
             a.son_atama_tarihi ASC NULLS FIRST,
             a.baslangic_tarihi ASC,
             a.iu_id ASC
    LIMIT 1;
  ELSE
    SELECT a.iu_id
      INTO v_iu_id
    FROM public.iu_genel_atamalari a
    JOIN public.kullanicilar k
      ON k.kullanici_id = a.iu_id
     AND lower(k.rol::text) = 'iu'
     AND k.aktif_mi IS TRUE
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS aktif_is
      FROM public.uretim_gorevleri g
      WHERE g.atanan_iu_id = a.iu_id
        AND g.durum IN ('hazirlaniyor', 'inceleme_bekliyor', 'revizyon_bekliyor')
    ) yuk ON true
    WHERE a.egitim_turu = v_egitim_turu
      AND a.aktif_mi IS TRUE
    ORDER BY yuk.aktif_is ASC,
             a.son_atama_tarihi ASC NULLS FIRST,
             a.baslangic_tarihi ASC,
             a.iu_id ASC
    LIMIT 1;
  END IF;

  RETURN v_iu_id;
END;
$fonksiyon$;

-- İç orkestrasyon fonksiyonu. Aday yoksa işi kaybetmez; açıkça
-- "atama_bekliyor" görevi oluşturur.
CREATE OR REPLACE FUNCTION public.uretim_gorev_ac(
  p_talep_id uuid,
  p_asama text,
  p_atayan_id uuid,
  p_oncelikli_iu_id uuid DEFAULT NULL,
  p_atama_kaynagi text DEFAULT 'otomatik',
  p_senaryo_id uuid DEFAULT NULL,
  p_video_id uuid DEFAULT NULL,
  p_soru_seti_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_iu_id uuid;
  v_durum text;
BEGIN
  IF p_asama NOT IN ('senaryo', 'video', 'soru_seti') THEN
    RAISE EXCEPTION 'Geçersiz üretim aşaması: %', p_asama USING ERRCODE = '22023';
  END IF;
  IF p_atama_kaynagi NOT IN ('otomatik', 'manuel', 'devir', 'gecis') THEN
    RAISE EXCEPTION 'Geçersiz atama kaynağı.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.talepler t WHERE t.talep_id = p_talep_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_gorev
  FROM public.uretim_gorevleri g
  WHERE g.talep_id = p_talep_id AND g.asama = p_asama;

  IF FOUND THEN
    IF v_gorev.senaryo_id IS DISTINCT FROM p_senaryo_id
       OR v_gorev.video_id IS DISTINCT FROM p_video_id
       OR v_gorev.soru_seti_id IS DISTINCT FROM p_soru_seti_id THEN
      RAISE EXCEPTION 'Aşamanın mevcut görevi farklı bir içerik kaydına bağlı.' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'gorev_id', v_gorev.gorev_id,
      'talep_id', v_gorev.talep_id,
      'asama', v_gorev.asama,
      'atanan_iu_id', v_gorev.atanan_iu_id,
      'durum', v_gorev.durum,
      'mevcut', true
    );
  END IF;

  IF p_atama_kaynagi IN ('manuel', 'devir') AND p_oncelikli_iu_id IS NOT NULL THEN
    IF NOT public.uretim_iu_talep_icin_uygun(p_oncelikli_iu_id, p_talep_id) THEN
      RAISE EXCEPTION 'Seçilen IU bu talebin ürün/genel havuzunda aktif değil.' USING ERRCODE = '23514';
    END IF;
    v_iu_id := p_oncelikli_iu_id;
  ELSE
    v_iu_id := public.uretim_iu_adayi_sec(p_talep_id, p_oncelikli_iu_id);
  END IF;

  v_durum := CASE WHEN v_iu_id IS NULL THEN 'atama_bekliyor' ELSE 'hazirlaniyor' END;

  INSERT INTO public.uretim_gorevleri (
    talep_id, asama, senaryo_id, video_id, soru_seti_id,
    atanan_iu_id, durum, atama_kaynagi, atayan_id, atama_tarihi, baslama_tarihi
  ) VALUES (
    p_talep_id, p_asama, p_senaryo_id, p_video_id, p_soru_seti_id,
    v_iu_id, v_durum,
    CASE WHEN v_iu_id IS NULL THEN NULL ELSE p_atama_kaynagi END,
    CASE WHEN v_iu_id IS NULL THEN NULL ELSE p_atayan_id END,
    CASE WHEN v_iu_id IS NULL THEN NULL ELSE now() END,
    CASE WHEN v_iu_id IS NULL THEN NULL ELSE now() END
  )
  RETURNING * INTO v_gorev;

  IF v_iu_id IS NOT NULL THEN
    INSERT INTO public.uretim_gorev_atama_gecmisi (
      gorev_id, onceki_iu_id, yeni_iu_id, islem, atama_kaynagi, islemi_yapan_id
    ) VALUES (
      v_gorev.gorev_id, NULL, v_iu_id, 'atandi', p_atama_kaynagi, p_atayan_id
    );

    UPDATE public.iu_urun_atamalari a
       SET son_atama_tarihi = now()
     WHERE a.iu_id = v_iu_id
       AND a.urun_id = (SELECT t.urun_id FROM public.talepler t WHERE t.talep_id = p_talep_id)
       AND a.aktif_mi IS TRUE;

    UPDATE public.iu_genel_atamalari a
       SET son_atama_tarihi = now()
     WHERE a.iu_id = v_iu_id
       AND a.egitim_turu = (SELECT t.egitim_turu FROM public.talepler t WHERE t.talep_id = p_talep_id)
       AND (SELECT t.urun_id FROM public.talepler t WHERE t.talep_id = p_talep_id) IS NULL
       AND a.aktif_mi IS TRUE;
  END IF;

  RETURN jsonb_build_object(
    'gorev_id', v_gorev.gorev_id,
    'talep_id', v_gorev.talep_id,
    'asama', v_gorev.asama,
    'atanan_iu_id', v_gorev.atanan_iu_id,
    'durum', v_gorev.durum,
    'mevcut', false
  );
END;
$fonksiyon$;

-- Yeni talebin gerçek ilk IU işini açar. Hazır video talebi, üreticinin video
-- yüklemesini beklediği için bu noktada IU görevi üretmez.
CREATE OR REPLACE FUNCTION public.uretim_talep_ilk_gorevini_ac(
  p_talep_id uuid,
  p_uretici_id uuid,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_talep public.talepler%ROWTYPE;
  v_onceki jsonb;
  v_sonuc jsonb;
BEGIN
  IF p_islem_anahtari IS NULL THEN
    RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));

  SELECT i.sonuc INTO v_onceki
  FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari
    AND i.islem_turu = 'talep_ilk_gorev';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_talep
  FROM public.talepler t
  WHERE t.talep_id = p_talep_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id THEN
    RAISE EXCEPTION 'İlk görevi yalnız talebi açan üretici başlatabilir.' USING ERRCODE = '42501';
  END IF;

  IF v_talep.hazir_video IS TRUE THEN
    v_sonuc := jsonb_build_object(
      'talep_id', p_talep_id,
      'gorev_acildi', false,
      'beklenen', 'hazir_video_yukleme'
    );
  ELSE
    v_sonuc := public.uretim_gorev_ac(
      p_talep_id, 'senaryo', p_uretici_id, NULL, 'otomatik', NULL, NULL, NULL
    ) || jsonb_build_object('gorev_acildi', true);
  END IF;

  INSERT INTO public.uretim_islem_kayitlari (
    islem_anahtari, islem_turu, gorev_id, talep_id, sonuc
  ) VALUES (
    p_islem_anahtari,
    'talep_ilk_gorev',
    NULLIF(v_sonuc->>'gorev_id', '')::uuid,
    p_talep_id,
    v_sonuc
  );
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Aktif bir işi başka IU'ya devreder; içerik kaydını değiştirmez. Yeni IU'nun
-- ürün/genel havuzunda aktif olması zorunludur. Bu iş yalnız admin tarafından
-- yürütülür ve neden kaydı zorunludur.
CREATE OR REPLACE FUNCTION public.uretim_gorev_devret(
  p_gorev_id uuid,
  p_yeni_iu_id uuid,
  p_islemi_yapan_id uuid,
  p_neden text,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_onceki jsonb;
  v_sonuc jsonb;
  v_islem text;
  v_onceki_iu_id uuid;
BEGIN
  IF p_islem_anahtari IS NULL THEN RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023'; END IF;
  IF p_yeni_iu_id IS NULL THEN RAISE EXCEPTION 'Yeni IU zorunludur.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(p_neden), '') IS NULL THEN RAISE EXCEPTION 'Görev devri nedeni zorunludur.' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar k
    WHERE k.kullanici_id = p_islemi_yapan_id AND lower(k.rol::text) = 'admin' AND k.aktif_mi IS TRUE
  ) THEN
    RAISE EXCEPTION 'Görev devrini yalnız admin yapabilir.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));
  SELECT i.sonuc INTO v_onceki
  FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'gorev_devri';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_gorev
  FROM public.uretim_gorevleri g
  WHERE g.gorev_id = p_gorev_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Üretim görevi bulunamadı.' USING ERRCODE = 'P0002'; END IF;
  IF v_gorev.durum NOT IN ('atama_bekliyor', 'hazirlaniyor', 'revizyon_bekliyor') THEN
    RAISE EXCEPTION 'İncelemedeki, tamamlanmış veya iptal edilmiş iş devredilemez.' USING ERRCODE = '23514';
  END IF;
  IF v_gorev.atanan_iu_id IS NOT DISTINCT FROM p_yeni_iu_id THEN
    RAISE EXCEPTION 'Görev zaten seçilen IU''ya atanmış.' USING ERRCODE = '23514';
  END IF;
  IF NOT public.uretim_iu_talep_icin_uygun(p_yeni_iu_id, v_gorev.talep_id) THEN
    RAISE EXCEPTION 'Yeni IU bu talebin ürün/genel havuzunda aktif değil.' USING ERRCODE = '23514';
  END IF;

  v_onceki_iu_id := v_gorev.atanan_iu_id;
  v_islem := CASE WHEN v_gorev.atanan_iu_id IS NULL THEN 'atandi' ELSE 'devredildi' END;

  UPDATE public.uretim_gorevleri g
     SET atanan_iu_id = p_yeni_iu_id,
         durum = CASE WHEN g.durum = 'atama_bekliyor' THEN 'hazirlaniyor' ELSE g.durum END,
         atama_kaynagi = CASE WHEN v_islem = 'atandi' THEN 'manuel' ELSE 'devir' END,
         atayan_id = p_islemi_yapan_id,
         atama_tarihi = now(),
         baslama_tarihi = COALESCE(g.baslama_tarihi, now()),
         son_islem_anahtari = p_islem_anahtari,
         surum = g.surum + 1
   WHERE g.gorev_id = p_gorev_id
  RETURNING * INTO v_gorev;

  INSERT INTO public.uretim_gorev_atama_gecmisi (
    gorev_id, onceki_iu_id, yeni_iu_id, islem, atama_kaynagi, islemi_yapan_id, neden
  ) VALUES (
    v_gorev.gorev_id,
    v_onceki_iu_id,
    p_yeni_iu_id,
    v_islem,
    CASE WHEN v_islem = 'atandi' THEN 'manuel' ELSE 'devir' END,
    p_islemi_yapan_id,
    btrim(p_neden)
  );

  UPDATE public.iu_urun_atamalari a
     SET son_atama_tarihi = now()
   WHERE a.iu_id = p_yeni_iu_id
     AND a.urun_id = (SELECT t.urun_id FROM public.talepler t WHERE t.talep_id = v_gorev.talep_id)
     AND a.aktif_mi IS TRUE;
  UPDATE public.iu_genel_atamalari a
     SET son_atama_tarihi = now()
   WHERE a.iu_id = p_yeni_iu_id
     AND a.egitim_turu = (SELECT t.egitim_turu FROM public.talepler t WHERE t.talep_id = v_gorev.talep_id)
     AND (SELECT t.urun_id FROM public.talepler t WHERE t.talep_id = v_gorev.talep_id) IS NULL
     AND a.aktif_mi IS TRUE;

  v_sonuc := jsonb_build_object(
    'gorev_id', v_gorev.gorev_id,
    'talep_id', v_gorev.talep_id,
    'asama', v_gorev.asama,
    'atanan_iu_id', v_gorev.atanan_iu_id,
    'durum', v_gorev.durum,
    'islem', v_islem
  );
  INSERT INTO public.uretim_islem_kayitlari (
    islem_anahtari, islem_turu, gorev_id, talep_id, sonuc
  ) VALUES (p_islem_anahtari, 'gorev_devri', p_gorev_id, v_gorev.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

-- Adaylık yönetimi. Pasife alma mevcut görevleri taşımaz; yalnız yeni görev
-- seçimlerini etkiler. Aktif işi taşımak için uretim_gorev_devret kullanılır.
CREATE OR REPLACE FUNCTION public.iu_urun_atamasi_ayarla(
  p_iu_id uuid,
  p_urun_id uuid,
  p_aktif_mi boolean,
  p_islemi_yapan_id uuid,
  p_aciklama text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_atama_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar k
    WHERE k.kullanici_id = p_islemi_yapan_id AND lower(k.rol::text) = 'admin' AND k.aktif_mi IS TRUE
  ) THEN RAISE EXCEPTION 'IU adaylığını yalnız admin yönetebilir.' USING ERRCODE = '42501'; END IF;

  IF p_aktif_mi THEN
    SELECT a.atama_id INTO v_atama_id
    FROM public.iu_urun_atamalari a
    WHERE a.iu_id = p_iu_id AND a.urun_id = p_urun_id AND a.aktif_mi IS TRUE;
    IF FOUND THEN RETURN v_atama_id; END IF;

    INSERT INTO public.iu_urun_atamalari (iu_id, urun_id, atayan_id, aciklama)
    VALUES (p_iu_id, p_urun_id, p_islemi_yapan_id, nullif(btrim(p_aciklama), ''))
    RETURNING atama_id INTO v_atama_id;
  ELSE
    UPDATE public.iu_urun_atamalari a
       SET aktif_mi = false,
           bitis_tarihi = now(),
           pasife_alan_id = p_islemi_yapan_id,
           aciklama = COALESCE(nullif(btrim(p_aciklama), ''), a.aciklama)
     WHERE a.iu_id = p_iu_id AND a.urun_id = p_urun_id AND a.aktif_mi IS TRUE
    RETURNING a.atama_id INTO v_atama_id;
  END IF;
  RETURN v_atama_id;
END;
$fonksiyon$;

CREATE OR REPLACE FUNCTION public.iu_genel_atamasi_ayarla(
  p_iu_id uuid,
  p_egitim_turu text,
  p_aktif_mi boolean,
  p_islemi_yapan_id uuid,
  p_aciklama text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_atama_id uuid;
BEGIN
  IF p_egitim_turu NOT IN ('urun_egitimi', 'satis_teknikleri', 'medikal_egitim', 'urun_medikal_egitim', 'ik_egitimi') THEN
    RAISE EXCEPTION 'Geçersiz eğitim türü.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kullanicilar k
    WHERE k.kullanici_id = p_islemi_yapan_id AND lower(k.rol::text) = 'admin' AND k.aktif_mi IS TRUE
  ) THEN RAISE EXCEPTION 'IU adaylığını yalnız admin yönetebilir.' USING ERRCODE = '42501'; END IF;

  IF p_aktif_mi THEN
    SELECT a.atama_id INTO v_atama_id
    FROM public.iu_genel_atamalari a
    WHERE a.iu_id = p_iu_id AND a.egitim_turu = p_egitim_turu AND a.aktif_mi IS TRUE;
    IF FOUND THEN RETURN v_atama_id; END IF;

    INSERT INTO public.iu_genel_atamalari (iu_id, egitim_turu, atayan_id, aciklama)
    VALUES (p_iu_id, p_egitim_turu, p_islemi_yapan_id, nullif(btrim(p_aciklama), ''))
    RETURNING atama_id INTO v_atama_id;
  ELSE
    UPDATE public.iu_genel_atamalari a
       SET aktif_mi = false,
           bitis_tarihi = now(),
           pasife_alan_id = p_islemi_yapan_id,
           aciklama = COALESCE(nullif(btrim(p_aciklama), ''), a.aciklama)
     WHERE a.iu_id = p_iu_id AND a.egitim_turu = p_egitim_turu AND a.aktif_mi IS TRUE
    RETURNING a.atama_id INTO v_atama_id;
  END IF;
  RETURN v_atama_id;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_iu_talep_icin_uygun(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_iu_adayi_sec(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_gorev_ac(uuid, text, uuid, uuid, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_talep_ilk_gorevini_ac(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.uretim_gorev_devret(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.iu_urun_atamasi_ayarla(uuid, uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.iu_genel_atamasi_ayarla(uuid, text, boolean, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.uretim_iu_talep_icin_uygun(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_iu_adayi_sec(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_gorev_ac(uuid, text, uuid, uuid, text, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_talep_ilk_gorevini_ac(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uretim_gorev_devret(uuid, uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.iu_urun_atamasi_ayarla(uuid, uuid, boolean, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.iu_genel_atamasi_ayarla(uuid, text, boolean, uuid, text) TO service_role;

COMMIT;

WITH beklenen(nesne, tur) AS (
  VALUES
    ('uretim_islem_kayitlari', 'tablo'),
    ('uretim_iu_talep_icin_uygun', 'fonksiyon'),
    ('uretim_iu_adayi_sec', 'fonksiyon'),
    ('uretim_gorev_ac', 'fonksiyon'),
    ('uretim_talep_ilk_gorevini_ac', 'fonksiyon'),
    ('uretim_gorev_devret', 'fonksiyon'),
    ('iu_urun_atamasi_ayarla', 'fonksiyon'),
    ('iu_genel_atamasi_ayarla', 'fonksiyon')
)
SELECT
  b.nesne,
  b.tur,
  CASE
    WHEN b.tur = 'tablo' THEN to_regclass('public.' || b.nesne) IS NOT NULL
    ELSE to_regprocedure(
      CASE b.nesne
        WHEN 'uretim_iu_talep_icin_uygun' THEN 'public.uretim_iu_talep_icin_uygun(uuid,uuid)'
        WHEN 'uretim_iu_adayi_sec' THEN 'public.uretim_iu_adayi_sec(uuid,uuid)'
        WHEN 'uretim_gorev_ac' THEN 'public.uretim_gorev_ac(uuid,text,uuid,uuid,text,uuid,uuid,uuid)'
        WHEN 'uretim_talep_ilk_gorevini_ac' THEN 'public.uretim_talep_ilk_gorevini_ac(uuid,uuid,uuid)'
        WHEN 'uretim_gorev_devret' THEN 'public.uretim_gorev_devret(uuid,uuid,uuid,text,uuid)'
        WHEN 'iu_urun_atamasi_ayarla' THEN 'public.iu_urun_atamasi_ayarla(uuid,uuid,boolean,uuid,text)'
        WHEN 'iu_genel_atamasi_ayarla' THEN 'public.iu_genel_atamasi_ayarla(uuid,text,boolean,uuid,text)'
      END
    ) IS NOT NULL
  END AS kuruldu_mu
FROM beklenen b
ORDER BY b.tur DESC, b.nesne;
