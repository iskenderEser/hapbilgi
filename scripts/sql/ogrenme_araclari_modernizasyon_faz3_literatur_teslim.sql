-- Literatür modernizasyonu / Faz 3
-- PDF, isteğe bağlı kapak, sunucu metadata'sı ve görev geçişini atomik kaydeder.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-modernizasyon-faz3-literatur-teslim-v1', 1));

DROP FUNCTION IF EXISTS public.uretim_flip_pdf_dogrula(uuid,uuid,uuid,integer,uuid);

CREATE FUNCTION public.uretim_flip_pdf_dogrula(
  p_arac_id uuid,
  p_kullanici_id uuid,
  p_gorev_id uuid,
  p_sayfa_sayisi integer,
  p_arama_metni text,
  p_arama_metni_durumu text,
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
  v_kapak_kaynagi text;
  v_onceki_dosya_yolu text;
BEGIN
  IF p_islem_anahtari IS NULL OR p_kullanici_id IS NULL
     OR p_sayfa_sayisi IS NULL OR p_sayfa_sayisi <= 0
     OR p_arama_metni IS NULL OR length(p_arama_metni) > 100000
     OR p_arama_metni_durumu NOT IN ('tam', 'kismi', 'metin_yok') THEN
    RAISE EXCEPTION 'Literatür sunucu doğrulama metadata bilgisi geçersiz.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));
  SELECT i.sonuc INTO v_onceki
  FROM public.uretim_islem_kayitlari i
  WHERE i.islem_anahtari = p_islem_anahtari AND i.islem_turu = 'flip_pdf_dogrula';
  IF FOUND THEN RETURN v_onceki; END IF;
  IF EXISTS (SELECT 1 FROM public.uretim_islem_kayitlari i WHERE i.islem_anahtari = p_islem_anahtari) THEN
    RAISE EXCEPTION 'İşlem anahtarı başka bir işlemde kullanılmış.' USING ERRCODE = '23505';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_arac_id::text, 1));
  SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = p_arac_id FOR UPDATE;
  IF NOT FOUND OR v_arac.arac_turu <> 'flip_pdf' THEN
    RAISE EXCEPTION 'Literatür bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_arac.talep_id FOR UPDATE;
  IF NOT FOUND OR v_talep.ogrenme_araci_turu <> 'flip_pdf' OR v_arac.dosya_yolu IS NULL THEN
    RAISE EXCEPTION 'Literatür talep veya dosya bağlantısı geçersiz.' USING ERRCODE = '23514';
  END IF;

  SELECT d.durum INTO v_son_durum
  FROM public.ogrenme_araci_durumu d
  WHERE d.arac_id = p_arac_id
  ORDER BY d.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_son_durum IS DISTINCT FROM 'dogrulama_bekliyor' THEN
    RAISE EXCEPTION 'Literatür depolama doğrulaması beklemiyor.' USING ERRCODE = '23514';
  END IF;

  IF v_arac.metadata_dogrulandi IS TRUE
     OR v_arac.mime_type <> 'application/pdf'
     OR v_arac.dosya_boyutu IS NULL OR v_arac.dosya_boyutu <= 0
     OR v_arac.checksum_sha256 IS NULL OR v_arac.checksum_sha256 !~ '^[0-9a-f]{64}$'
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,dosya_imzasi,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,dosya_boyutu,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,mime_turu,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,checksum,dogrulandi}')::boolean, false) IS NOT TRUE
     OR COALESCE((v_arac.metadata #>> '{depolama_dogrulamasi,checksum,edge_makbuzu_dogrulandi}')::boolean, false) IS NOT TRUE
     OR NULLIF(v_arac.metadata #>> '{depolama_dogrulamasi,tamamlanma_tarihi}', '') IS NULL THEN
    RAISE EXCEPTION 'PDF Storage imzası, MIME, boyut veya checksum doğrulaması eksik.' USING ERRCODE = '23514';
  END IF;

  IF COALESCE((v_arac.metadata ->> 'kapak_iptal_edildi')::boolean, false) IS NOT TRUE THEN
    IF COALESCE((v_arac.metadata ->> 'kapak_bekleniyor')::boolean, false) IS TRUE
       OR NULLIF(v_arac.metadata #>> '{bekleyen_destek_yollari,kapak}', '') IS NOT NULL THEN
      RAISE EXCEPTION 'Bekleyen yayın görseli tamamlanmadan Literatür teslim edilemez.' USING ERRCODE = '23514';
    END IF;
    IF v_arac.kapak_yolu IS NOT NULL AND (
      COALESCE((v_arac.metadata ->> 'kapak_dogrulandi')::boolean, false) IS NOT TRUE
      OR COALESCE((v_arac.metadata #>> '{kapak_destek_dogrulamasi,kapak,dosya_imzasi_dogrulandi}')::boolean, false) IS NOT TRUE
      OR COALESCE((v_arac.metadata #>> '{kapak_destek_dogrulamasi,kapak,dosya_boyutu_dogrulandi}')::boolean, false) IS NOT TRUE
      OR COALESCE((v_arac.metadata #>> '{kapak_destek_dogrulamasi,kapak,mime_turu_dogrulandi}')::boolean, false) IS NOT TRUE
      OR COALESCE((v_arac.metadata #>> '{kapak_destek_dogrulamasi,kapak,checksum,dogrulandi}')::boolean, false) IS NOT TRUE
      OR COALESCE((v_arac.metadata #>> '{kapak_destek_dogrulamasi,kapak,checksum,edge_makbuzu_dogrulandi}')::boolean, false) IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'Literatür yayın görselinin doğrulaması eksik.' USING ERRCODE = '23514';
    END IF;
  END IF;
  v_kapak_kaynagi := CASE
    WHEN v_arac.kapak_yolu IS NOT NULL AND COALESCE((v_arac.metadata ->> 'kapak_dogrulandi')::boolean, false) THEN 'ozel'
    ELSE 'varsayilan'
  END;

  IF v_arac.kaynak = 'iu' THEN
    IF p_gorev_id IS NULL THEN RAISE EXCEPTION 'İçerik üreticisi görevi zorunludur.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;
    IF NOT FOUND
       OR v_gorev.talep_id <> v_arac.talep_id
       OR v_gorev.asama <> 'video'
       OR v_gorev.atanan_iu_id IS DISTINCT FROM p_kullanici_id
       OR v_gorev.durum NOT IN ('hazirlaniyor', 'revizyon_bekliyor')
       OR (v_gorev.arac_id IS NOT NULL AND v_gorev.arac_id <> p_arac_id) THEN
      RAISE EXCEPTION 'Literatür üretim görevi, sahibi veya araç bağı geçersiz.' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF v_arac.kaynak <> 'hazir'
       OR v_talep.uretici_id IS DISTINCT FROM p_kullanici_id
       OR v_talep.hazir_video IS DISTINCT FROM true
       OR p_gorev_id IS NOT NULL THEN
      RAISE EXCEPTION 'Hazır Literatürü yalnız talebin üreticisi tamamlayabilir.' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_onceki_dosya_yolu := NULLIF(v_arac.metadata ->> 'onceki_ana_dosya_yolu', '');
  UPDATE public.ogrenme_araclari
  SET sayfa_sayisi = p_sayfa_sayisi,
      metadata_dogrulandi = true,
      metadata = (COALESCE(metadata, '{}'::jsonb) - 'onceki_ana_dosya_yolu') || jsonb_build_object(
        'pdf_yapisi_dogrulandi', true,
        'sifreli', false,
        'pdf_metadata_kaynagi', 'sunucu_dosya_baytlari',
        'kapak_kaynagi', v_kapak_kaynagi,
        'arama_metni', btrim(p_arama_metni),
        'arama_metni_durumu', p_arama_metni_durumu,
        'arama_metni_dogrulandi', p_arama_metni_durumu = 'tam',
        'pdf_dogrulama_tarihi', now()
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
    VALUES (p_arac_id, 'inceleme bekleniyor', p_kullanici_id, 'Literatür üretici incelemesine gönderildi')
    RETURNING arac_durum_id INTO v_durum_id;
  ELSE
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar)
    VALUES (p_arac_id, 'onaylandi', p_kullanici_id, 'Hazır Literatür — otomatik onay')
    RETURNING arac_durum_id INTO v_durum_id;
    v_sonraki := public.uretim_podcast_soru_zinciri_ac(v_arac.talep_id, v_durum_id, p_kullanici_id, NULL);
  END IF;

  IF v_onceki_dosya_yolu IS NOT NULL AND v_onceki_dosya_yolu <> v_arac.dosya_yolu THEN
    INSERT INTO public.ogrenme_araci_depolama_temizleme_kuyrugu
      (arac_id, dosya_yolu, dosya_rolu, sebep, durum)
    VALUES (p_arac_id, v_onceki_dosya_yolu, 'ana', 'dogrulanmis_literatur_revizyonu_sonrasi_eski_pdf', 'bekliyor')
    ON CONFLICT DO NOTHING;
  END IF;

  v_sonuc := jsonb_build_object(
    'arac_id', p_arac_id,
    'talep_id', v_arac.talep_id,
    'arac_durum_id', v_durum_id,
    'sayfa_sayisi', p_sayfa_sayisi,
    'arama_metni_durumu', p_arama_metni_durumu,
    'sonraki', v_sonraki
  );
  INSERT INTO public.uretim_islem_kayitlari
    (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc)
  VALUES (p_islem_anahtari, 'flip_pdf_dogrula', p_gorev_id, v_arac.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_flip_pdf_dogrula(uuid,uuid,uuid,integer,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_flip_pdf_dogrula(uuid,uuid,uuid,integer,text,text,uuid)
  TO service_role;

COMMIT;

SELECT to_regprocedure('public.uretim_flip_pdf_dogrula(uuid,uuid,uuid,integer,text,text,uuid)') IS NOT NULL
   AND to_regprocedure('public.uretim_flip_pdf_dogrula(uuid,uuid,uuid,integer,uuid)') IS NULL
  AS literatur_modern_teslim_kapisi_kuruldu;
