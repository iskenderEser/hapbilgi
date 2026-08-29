-- Yarım öğrenme aracı yüklemeleri: kullanıcıya devam/iptal olanağı.
-- Video oturumları dış sistemdeki Bunny kaydı DB'ye bağlanmadan önce de kalıcıdır.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ogrenme_araci_video_yukleme_oturumlari (
  yukleme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kullanici_id uuid NOT NULL REFERENCES public.kullanicilar(kullanici_id),
  talep_id uuid NOT NULL REFERENCES public.talepler(talep_id),
  gorev_id uuid REFERENCES public.uretim_gorevleri(gorev_id),
  video_id uuid REFERENCES public.videolar(video_id),
  kaynak text NOT NULL CHECK (kaynak IN ('hazir', 'iu')),
  video_guid text NOT NULL CHECK (video_guid ~ '^[0-9a-fA-F-]{36}$'),
  embed_url text NOT NULL,
  baslik text NOT NULL,
  dosya_adi text NOT NULL,
  mime_type text NOT NULL,
  dosya_boyutu bigint NOT NULL CHECK (dosya_boyutu > 0),
  durum text NOT NULL DEFAULT 'yukleme_bekliyor'
    CHECK (durum IN ('yukleme_bekliyor', 'dogrulama_bekliyor', 'iptal_hatasi')),
  son_hata text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_video_yukleme_aktif_talep
  ON public.ogrenme_araci_video_yukleme_oturumlari (kullanici_id, talep_id)
  WHERE durum IN ('yukleme_bekliyor', 'dogrulama_bekliyor', 'iptal_hatasi');
CREATE INDEX IF NOT EXISTS ix_video_yukleme_kullanici
  ON public.ogrenme_araci_video_yukleme_oturumlari (kullanici_id, created_at DESC);

ALTER TABLE public.ogrenme_araci_video_yukleme_oturumlari ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ogrenme_araci_video_yukleme_oturumlari FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ogrenme_araci_video_yukleme_oturumlari TO service_role;

CREATE OR REPLACE FUNCTION public.ogrenme_araci_yarim_yukleme_iptal(
  p_arac_id uuid,
  p_kullanici_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_arac public.ogrenme_araclari%ROWTYPE;
  v_uretici_id uuid;
  v_son_durum text;
BEGIN
  SELECT * INTO v_arac
  FROM public.ogrenme_araclari
  WHERE arac_id = p_arac_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('zaten_silindi', true);
  END IF;

  SELECT uretici_id INTO v_uretici_id FROM public.talepler WHERE talep_id = v_arac.talep_id;
  IF NOT ((v_arac.kaynak = 'hazir' AND v_uretici_id = p_kullanici_id)
       OR (v_arac.kaynak = 'iu' AND v_arac.iu_id = p_kullanici_id)) THEN
    RAISE EXCEPTION 'Yarım yükleme bu kullanıcıya ait değil.' USING ERRCODE = '42501';
  END IF;

  SELECT durum INTO v_son_durum
  FROM public.ogrenme_araci_durumu
  WHERE arac_id = p_arac_id
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_son_durum NOT IN ('yukleme_bekliyor', 'dogrulama_bekliyor') THEN
    RAISE EXCEPTION 'Araç artık yarım yükleme durumunda değil.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.uretim_gorevleri SET arac_id = NULL WHERE arac_id = p_arac_id;
  UPDATE public.soru_setleri SET arac_durum_id = NULL
    WHERE arac_durum_id IN (SELECT arac_durum_id FROM public.ogrenme_araci_durumu WHERE arac_id = p_arac_id);
  UPDATE public.yayin_yonetimi SET arac_durum_id = NULL
    WHERE arac_durum_id IN (SELECT arac_durum_id FROM public.ogrenme_araci_durumu WHERE arac_id = p_arac_id);
  DELETE FROM public.ogrenme_araci_puanlari
    WHERE arac_durum_id IN (SELECT arac_durum_id FROM public.ogrenme_araci_durumu WHERE arac_id = p_arac_id);
  DELETE FROM public.ogrenme_araci_durumu WHERE arac_id = p_arac_id;
  DELETE FROM public.ogrenme_araci_depolama_temizleme_kuyrugu WHERE arac_id = p_arac_id;
  DELETE FROM public.ogrenme_araclari WHERE arac_id = p_arac_id;
  RETURN jsonb_build_object('silindi', true, 'arac_id', p_arac_id);
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.ogrenme_araci_yarim_yukleme_iptal(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ogrenme_araci_yarim_yukleme_iptal(uuid, uuid)
  TO service_role;

COMMIT;

SELECT
  to_regclass('public.ogrenme_araci_video_yukleme_oturumlari') IS NOT NULL AS video_yukleme_oturumu_kuruldu,
  to_regprocedure('public.ogrenme_araci_yarim_yukleme_iptal(uuid,uuid)') IS NOT NULL AS atomic_iptal_kuruldu;
