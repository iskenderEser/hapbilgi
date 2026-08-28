-- Öğrenme Araçları Genişletmesi — Tamamlama Planı Faz 2
-- Storage doğrulamasını ve durum geçişini tek kilit altında idempotent kaydeder.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ogrenme_araci_depolama_temizleme_kuyrugu (
  temizleme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arac_id uuid NOT NULL REFERENCES public.ogrenme_araclari(arac_id) ON DELETE CASCADE,
  dosya_yolu text NOT NULL,
  dosya_rolu text,
  sebep text NOT NULL,
  durum text NOT NULL DEFAULT 'bekliyor'
    CHECK (durum IN ('bekliyor', 'isleniyor', 'tamamlandi', 'basarisiz')),
  deneme_sayisi integer NOT NULL DEFAULT 0 CHECK (deneme_sayisi >= 0),
  son_hata text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tamamlanma_tarihi timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ogrenme_araci_depolama_temizleme_bekleyen
  ON public.ogrenme_araci_depolama_temizleme_kuyrugu (created_at)
  WHERE durum IN ('bekliyor', 'basarisiz');
CREATE UNIQUE INDEX IF NOT EXISTS uq_ogrenme_araci_depolama_temizleme_acik_yol
  ON public.ogrenme_araci_depolama_temizleme_kuyrugu (dosya_yolu)
  WHERE durum IN ('bekliyor', 'isleniyor');

ALTER TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.ogrenme_araci_depolama_temizleme_kuyrugu TO service_role;

CREATE OR REPLACE FUNCTION public.ogrenme_araci_yukleme_dogrulama_kaydet(
  p_arac_id uuid,
  p_degistiren_id uuid,
  p_mime_type text,
  p_dosya_boyutu bigint,
  p_checksum_sha256 text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_durum text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_arac_id::text, 1));

  SELECT durum INTO v_durum
  FROM public.ogrenme_araci_durumu
  WHERE arac_id = p_arac_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_durum = 'dogrulama_bekliyor' THEN
    RETURN jsonb_build_object(
      'arac_id', p_arac_id,
      'durum', v_durum,
      'tekrar_istek', true
    );
  END IF;
  IF v_durum IS DISTINCT FROM 'yukleme_bekliyor' THEN
    RAISE EXCEPTION 'Öğrenme aracı yükleme doğrulamasına açık değil.' USING ERRCODE = '23514';
  END IF;
  IF p_mime_type IS NULL
     OR p_dosya_boyutu IS NULL OR p_dosya_boyutu <= 0
     OR p_checksum_sha256 !~ '^[0-9a-f]{64}$'
     OR p_metadata IS NULL THEN
    RAISE EXCEPTION 'Doğrulama kaydı eksik veya geçersiz.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ogrenme_araclari
  SET mime_type = p_mime_type,
      dosya_boyutu = p_dosya_boyutu,
      checksum_sha256 = p_checksum_sha256,
      metadata = p_metadata,
      metadata_dogrulandi = false,
      updated_at = now()
  WHERE arac_id = p_arac_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Öğrenme aracı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ogrenme_araci_durumu (
    arac_id,
    durum,
    degistiren_id,
    notlar
  ) VALUES (
    p_arac_id,
    'dogrulama_bekliyor',
    p_degistiren_id,
    'Storage boyutu, checksum zinciri ve dosya imzası doğrulandı; araca özel metadata doğrulaması bekleniyor.'
  );

  RETURN jsonb_build_object(
    'arac_id', p_arac_id,
    'durum', 'dogrulama_bekliyor',
    'tekrar_istek', false
  );
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.ogrenme_araci_yukleme_dogrulama_kaydet(
  uuid, uuid, text, bigint, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ogrenme_araci_yukleme_dogrulama_kaydet(
  uuid, uuid, text, bigint, text, jsonb
) TO service_role;

COMMIT;

SELECT to_regprocedure(
  'public.ogrenme_araci_yukleme_dogrulama_kaydet(uuid,uuid,text,bigint,text,jsonb)'
) IS NOT NULL
AND to_regclass('public.ogrenme_araci_depolama_temizleme_kuyrugu') IS NOT NULL
  AS yukleme_dogrulama_idempotent_kuruldu;
