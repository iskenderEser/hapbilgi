-- Faz 4 — Üreticinin V1/V3 podcast revizyonunda sonradan AI transkript istemesi.
-- Tekrar çalıştırılabilir; uygulama bu dosyayı otomatik çalıştırmaz.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-faz4-podcast-revizyonda-transkript-v1', 1));

CREATE OR REPLACE FUNCTION public.uretim_podcast_uretici_karar_ver(
  p_gorev_id uuid,
  p_uretici_id uuid,
  p_karar text,
  p_notlar text,
  p_islem_anahtari uuid,
  p_beklenen_surum integer,
  p_revizyonda_transkript_istendi boolean
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE;
  v_talep public.talepler%ROWTYPE;
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_onceki jsonb;
  v_sonuc jsonb;
  v_transkript_surum integer;
BEGIN
  IF p_islem_anahtari IS NULL THEN
    RAISE EXCEPTION 'İşlem anahtarı zorunludur.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));

  SELECT sonuc INTO v_onceki
  FROM public.uretim_islem_kayitlari
  WHERE islem_anahtari = p_islem_anahtari AND islem_turu = 'podcast_uretici_karari';
  IF FOUND THEN RETURN v_onceki; END IF;

  SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;
  IF NOT FOUND OR v_gorev.durum <> 'inceleme_bekliyor' OR v_gorev.surum <> p_beklenen_surum THEN
    RAISE EXCEPTION 'İncelenen görev güncelliğini yitirdi veya uygun durumda değil.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_gorev.talep_id FOR UPDATE;
  IF NOT FOUND OR v_talep.uretici_id IS DISTINCT FROM p_uretici_id OR v_talep.ogrenme_araci_turu <> 'podcast' THEN
    RAISE EXCEPTION 'Podcast karar yetkisi yok.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(p_revizyonda_transkript_istendi, false) THEN
    IF p_karar <> 'revizyon bekleniyor' OR v_gorev.asama <> 'video' OR v_talep.hazir_video IS TRUE THEN
      RAISE EXCEPTION 'Transkript yalnız V1/V3 podcast üretim revizyonunda istenebilir.' USING ERRCODE = '23514';
    END IF;
    IF COALESCE(
      CASE WHEN jsonb_typeof(v_talep.ogrenme_araci_tercihleri->'transkript_istendi') = 'boolean'
        THEN (v_talep.ogrenme_araci_tercihleri->>'transkript_istendi')::boolean END,
      true
    ) IS TRUE THEN
      RAISE EXCEPTION 'Bu podcast için transkript zaten isteniyor.' USING ERRCODE = '23514';
    END IF;
    IF v_gorev.arac_id IS NULL THEN
      RAISE EXCEPTION 'Revize edilecek podcast bulunamadı.' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = v_gorev.arac_id FOR UPDATE;
    IF NOT FOUND OR v_arac.arac_turu <> 'podcast' OR v_arac.kaynak <> 'iu' THEN
      RAISE EXCEPTION 'Revize edilecek İÜ podcasti bulunamadı.' USING ERRCODE = '23514';
    END IF;

    UPDATE public.talepler
    SET ogrenme_araci_tercihleri = COALESCE(ogrenme_araci_tercihleri, '{}'::jsonb)
      || jsonb_build_object('transkript_istendi', true),
      updated_at = now()
    WHERE talep_id = v_talep.talep_id;

    v_transkript_surum := COALESCE((v_arac.metadata->'transkript'->>'surum')::integer, 0) + 1;
    UPDATE public.ogrenme_araclari
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb) - 'transkript_metni' - 'transkript_metni_dogrulandi' - 'transkript_dogrulandi',
      '{transkript}',
      jsonb_build_object(
        'durum', 'yok', 'kaynak', NULL, 'taslak_metin', NULL, 'onaylanan_metin', NULL,
        'onaylayan_kullanici_id', NULL, 'onay_tarihi', NULL, 'son_duzenleme_tarihi', now(),
        'surum', v_transkript_surum, 'bagli_ses_checksum', checksum_sha256,
        'ai_girisim_id', NULL, 'kullanilan_model', NULL, 'hata_kodu', NULL
      ),
      true
    )
    WHERE arac_id = v_arac.arac_id;
  END IF;

  -- Mevcut sürüm kapısı, revizyon sayacı, durum geçmişi ve görev geçişi aynen kullanılır.
  v_sonuc := public.uretim_podcast_uretici_karar_ver(
    p_gorev_id, p_uretici_id, p_karar, p_notlar, p_islem_anahtari, p_beklenen_surum
  );
  RETURN v_sonuc || jsonb_build_object(
    'revizyonda_transkript_istendi', COALESCE(p_revizyonda_transkript_istendi, false)
  );
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_podcast_uretici_karar_ver(uuid,uuid,text,text,uuid,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_podcast_uretici_karar_ver(uuid,uuid,text,text,uuid,integer,boolean) TO service_role;
COMMIT;

SELECT to_regprocedure('public.uretim_podcast_uretici_karar_ver(uuid,uuid,text,text,uuid,integer,boolean)') IS NOT NULL
  AS podcast_revizyonda_transkript_kapisi_kuruldu;
