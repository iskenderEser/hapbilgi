-- Dijital Broşür modernizasyonu / Faz 2
-- Storage doğrulamasını, gerçek ölçüleri ve İÜ görev geçişini tek transaction'da kapatır.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-modernizasyon-faz2-gorsel-teslim-v1', 1));

CREATE OR REPLACE FUNCTION public.uretim_gorsel_dogrula(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_gorev_id uuid,
  p_genislik integer,
  p_yukseklik integer,
  p_islem_anahtari uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_talep public.talepler%ROWTYPE;
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_son_durum text;
  v_durum_id uuid;
  v_sonraki jsonb := NULL;
  v_sonuc jsonb;
  v_onceki jsonb;
  v_onceki_dosya_yolu text;
BEGIN
  IF p_islem_anahtari IS NULL OR p_kullanici_id IS NULL
     OR p_genislik IS NULL OR p_genislik <= 0
     OR p_yukseklik IS NULL OR p_yukseklik <= 0 THEN
    RAISE EXCEPTION 'İşlem anahtarı, kullanıcı ve pozitif sunucu ölçüleri zorunludur.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));
  SELECT i.sonuc INTO v_onceki
  FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'gorsel_dogrula';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_arac_id::text, 1));
  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'gorsel' THEN
    RAISE EXCEPTION 'Dijital Broşür bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_arac.talep_id FOR UPDATE;
  IF NOT FOUND OR v_talep.ogrenme_araci_turu <> 'gorsel' OR v_arac.dosya_yolu IS NULL THEN
    RAISE EXCEPTION 'Dijital Broşür talep veya dosya bağlantısı geçersiz.' USING ERRCODE = '23514';
  END IF;

  SELECT d.durum INTO v_son_durum
  FROM public.ogrenme_araci_durumu d
  WHERE d.arac_id = p_arac_id
  ORDER BY d.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_son_durum IS DISTINCT FROM 'dogrulama_bekliyor' THEN
    RAISE EXCEPTION 'Dijital Broşür depolama doğrulaması beklemiyor.' USING ERRCODE = '23514';
  END IF;

  IF v_arac.metadata_dogrulandi IS TRUE
     OR v_arac.mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR v_arac.dosya_boyutu IS NULL OR v_arac.dosya_boyutu <= 0
     OR v_arac.checksum_sha256 IS NULL OR v_arac.checksum_sha256 !~ '^[0-9a-f]{64}$'
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,dosya_imzasi,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,dosya_boyutu,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,mime_turu,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,checksum,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,checksum,edge_makbuzu_dogrulandi}')::boolean, false) IS NOT TRUE
     OR NULLIF(v_arac.metadata #>> '{depolama_dogrulamasi,tamamlanma_tarihi}', '') IS NULL THEN
    RAISE EXCEPTION 'Ana görselin Storage imzası, MIME, boyut veya checksum doğrulaması eksik.' USING ERRCODE = '23514';
  END IF;

  IF v_arac.kaynak = 'iu' THEN
    IF p_gorev_id IS NULL THEN
      RAISE EXCEPTION 'İçerik üreticisi görevi zorunludur.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;
    IF NOT FOUND
       OR v_gorev.talep_id <> v_arac.talep_id
       OR v_gorev.asama <> 'video'
       OR v_gorev.atanan_iu_id IS DISTINCT FROM p_kullanici_id
       OR v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor')
       OR (v_gorev.arac_id IS NOT NULL AND v_gorev.arac_id <> p_arac_id) THEN
      RAISE EXCEPTION 'Dijital Broşür üretim görevi, sahibi veya araç bağı geçersiz.' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_arac.kaynak <> 'hazir'
       OR v_talep.uretici_id IS DISTINCT FROM p_kullanici_id
       OR v_talep.hazir_video IS DISTINCT FROM true
       OR p_gorev_id IS NOT NULL THEN
      RAISE EXCEPTION 'Hazır Dijital Broşürü yalnız talebin üreticisi tamamlayabilir.' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_onceki_dosya_yolu := NULLIF(v_arac.metadata ->> 'onceki_ana_dosya_yolu', '');
  UPDATE public.ogrenme_araclari
  SET genislik = p_genislik,
      yukseklik = p_yukseklik,
      metadata_dogrulandi = true,
      metadata = (COALESCE(metadata, '{}'::jsonb) - 'onceki_ana_dosya_yolu') || jsonb_build_object(
        'olculer_dogrulandi', true,
        'olcu_kaynagi', 'sunucu_dosya_baytlari',
        'olcu_dogrulama_tarihi', now()
      ),
      updated_at = now()
  WHERE arac_id = p_arac_id;

  IF v_arac.kaynak = 'iu' THEN
    UPDATE public.uretim_gorevleri
    SET arac_id = p_arac_id,
        durum = 'inceleme_bekliyor',
        inceleme_tarihi = now(),
        son_islem_anahtari = p_islem_anahtari,
        surum = surum + 1
    WHERE gorev_id = p_gorev_id;
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (p_arac_id, 'inceleme bekleniyor', p_kullanici_id, 'Dijital Broşür üretici incelemesine gönderildi')
    RETURNING arac_durum_id INTO v_durum_id;
  ELSE
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (p_arac_id, 'onaylandi', p_kullanici_id, 'Hazır Dijital Broşür — otomatik onay')
    RETURNING arac_durum_id INTO v_durum_id;
    v_sonraki := public.uretim_podcast_soru_zinciri_ac(v_arac.talep_id, v_durum_id, p_kullanici_id, NULL);
  END IF;

  IF v_onceki_dosya_yolu IS NOT NULL AND v_onceki_dosya_yolu <> v_arac.dosya_yolu THEN
    INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu
      (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
    VALUES (p_arac_id, v_onceki_dosya_yolu, 'ana', 'dogrulanmis_gorsel_revizyonu_sonrasi_eski_dosya', 'bekliyor')
    ON CONFLICT DO NOTHING;
  END IF;

  v_sonuc := jsonb_build_object(
    'arac_id', p_arac_id,
    'talep_id', v_arac.talep_id,
    'arac_durum_id', v_durum_id,
    'genislik', p_genislik,
    'yukseklik', p_yukseklik,
    'sonraki', v_sonraki
  );
  INSERT INTO public.uretim_islem_kayitlari
    (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'gorsel_dogrula', p_gorev_id, v_arac.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_gorsel_dogrula(uuid,uuid,uuid,integer,integer,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_gorsel_dogrula(uuid,uuid,uuid,integer,integer,uuid)
  TO service_role;

COMMIT;

SELECT to_regprocedure('public.uretim_gorsel_dogrula(uuid,uuid,uuid,integer,integer,uuid)') IS NOT NULL
  AS gorsel_modern_teslim_kapisi_kuruldu;
