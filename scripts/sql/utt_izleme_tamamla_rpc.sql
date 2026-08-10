-- UTT izleme tamamlamasını satır kilidi ve sunucu zamanı ile tekilleştirir.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.
-- Yeniden koşum güvenlidir; mevcut izleme verisini değiştirmez.

CREATE OR REPLACE FUNCTION public.utt_izleme_tamamla(
  p_izleme_id uuid,
  p_kullanici_id uuid,
  p_soru_hakki_var_mi boolean,
  p_soru_hakki_nedeni text,
  p_soru_indeksleri integer[]
)
RETURNS TABLE (
  izleme_id uuid,
  tamamlandi_mi boolean,
  yeni_tamamlandi boolean,
  soru_hakki_var_mi boolean,
  soru_hakki_nedeni text,
  soru_indeksleri integer[],
  izleme_bitis timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fonksiyon$
DECLARE
  v_izleme public.izleme_kayitlari%ROWTYPE;
  v_onayli_atlanan_sure integer;
BEGIN
  SELECT ik.*
  INTO v_izleme
  FROM public.izleme_kayitlari ik
  WHERE ik.izleme_id = p_izleme_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzleme kaydı bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF v_izleme.kullanici_id <> p_kullanici_id THEN
    RAISE EXCEPTION 'İzleme kaydı kullanıcıya ait değil.' USING ERRCODE = '42501';
  END IF;

  IF NOT v_izleme.gercek_oynatma_mi THEN
    RAISE EXCEPTION 'Yalın açılış kaydı tamamlanamaz.' USING ERRCODE = '22023';
  END IF;

  -- Ağ tekrarı mevcut kalıcı kararı aynen döndürür.
  IF COALESCE(v_izleme.tamamlandi_mi, false) THEN
    RETURN QUERY SELECT
      v_izleme.izleme_id,
      true,
      false,
      v_izleme.soru_hakki_var_mi,
      v_izleme.soru_hakki_nedeni,
      v_izleme.soru_indeksleri,
      v_izleme.izleme_bitis;
    RETURN;
  END IF;

  IF v_izleme.video_suresi_saniye IS NULL OR v_izleme.video_suresi_saniye <= 0 THEN
    RAISE EXCEPTION 'Video süresi doğrulanmamış.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(isk.atlanan_sure), 0)::integer
  INTO v_onayli_atlanan_sure
  FROM public.ileri_sarma_kayitlari isk
  WHERE isk.izleme_id = p_izleme_id;

  -- İstemci süre beyanı kullanılmaz. Sunucuda geçen süre + sunucunun onayladığı
  -- ileri sarma süresi, video süresine iki saniyelik toleransla ulaşmalıdır.
  IF EXTRACT(EPOCH FROM (clock_timestamp() - v_izleme.izleme_baslangic))
       + v_onayli_atlanan_sure
       < GREATEST(0, v_izleme.video_suresi_saniye - 2) THEN
    RAISE EXCEPTION 'Video henüz tamamlanabilecek kadar oynatılmadı.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.izleme_kayitlari ik
  SET tamamlandi_mi = true,
      izleme_bitis = clock_timestamp(),
      soru_hakki_var_mi = p_soru_hakki_var_mi,
      soru_hakki_nedeni = p_soru_hakki_nedeni,
      soru_indeksleri = CASE
        WHEN p_soru_hakki_var_mi THEN p_soru_indeksleri
        ELSE NULL
      END
  WHERE ik.izleme_id = p_izleme_id
  RETURNING ik.* INTO v_izleme;

  RETURN QUERY SELECT
    v_izleme.izleme_id,
    true,
    true,
    v_izleme.soru_hakki_var_mi,
    v_izleme.soru_hakki_nedeni,
    v_izleme.soru_indeksleri,
    v_izleme.izleme_bitis;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.utt_izleme_tamamla(uuid, uuid, boolean, text, integer[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.utt_izleme_tamamla(uuid, uuid, boolean, text, integer[])
  TO service_role;
