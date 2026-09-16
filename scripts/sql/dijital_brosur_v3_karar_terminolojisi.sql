-- Dijital Broşür V3 — üretici karar RPC'sindeki kullanıcı terminolojisini günceller.
-- Tekrar çalıştırılabilir; mevcut altı parametreli sürüm kapısı bu beş parametreli
-- temel fonksiyonu çağırmaya devam eder.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-dijital-brosur-v3-karar-terminolojisi-v1', 1));

CREATE OR REPLACE FUNCTION public.uretim_gorsel_uretici_karar_ver(
  p_gorev_id uuid, p_uretici_id uuid, p_karar text, p_notlar text, p_islem_anahtari uuid
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $fonksiyon$
DECLARE
  v_gorev public.uretim_gorevleri%ROWTYPE; v_talep public.talepler%ROWTYPE;
  v_arac public.ogrenme_araclari%ROWTYPE; v_durum_id uuid; v_revizyon integer;
  v_sonraki jsonb := NULL; v_sonuc jsonb; v_onceki jsonb;
BEGIN
  IF p_islem_anahtari IS NULL OR p_karar NOT IN ('onaylandi', 'revizyon bekleniyor', 'Iptal Edildi') THEN RAISE EXCEPTION 'Geçersiz karar.' USING ERRCODE = '22023'; END IF;
  IF p_karar = 'revizyon bekleniyor' AND nullif(btrim(p_notlar), '') IS NULL THEN RAISE EXCEPTION 'Revizyon notu zorunludur.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_islem_anahtari::text, 1));
  SELECT sonuc INTO v_onceki FROM public.uretim_islem_kayitlari WHERE islem_anahtari = p_islem_anahtari AND islem_turu = 'gorsel_uretici_karari';
  IF FOUND THEN RETURN v_onceki; END IF;
  SELECT * INTO v_gorev FROM public.uretim_gorevleri WHERE gorev_id = p_gorev_id FOR UPDATE;
  IF NOT FOUND OR v_gorev.durum <> 'inceleme_bekliyor' THEN RAISE EXCEPTION 'İnceleme bekleyen görev bulunamadı.' USING ERRCODE = '23514'; END IF;
  SELECT * INTO v_talep FROM public.talepler WHERE talep_id = v_gorev.talep_id FOR UPDATE;
  IF v_talep.uretici_id IS DISTINCT FROM p_uretici_id OR v_talep.ogrenme_araci_turu <> 'gorsel' THEN RAISE EXCEPTION 'Dijital Broşür karar yetkisi yok.' USING ERRCODE = '42501'; END IF;
  UPDATE public.uretim_gorevleri SET durum = CASE p_karar WHEN 'onaylandi' THEN 'tamamlandi' WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor' ELSE 'iptal' END,
    tamamlanma_tarihi = CASE WHEN p_karar = 'onaylandi' THEN now() ELSE tamamlanma_tarihi END, iptal_tarihi = CASE WHEN p_karar = 'Iptal Edildi' THEN now() ELSE iptal_tarihi END,
    son_islem_anahtari = p_islem_anahtari, surum = surum + 1 WHERE gorev_id = p_gorev_id;
  IF v_gorev.asama = 'senaryo' THEN
    IF p_karar = 'revizyon bekleniyor' THEN SELECT count(*)::integer INTO v_revizyon FROM public.senaryo_durumu WHERE senaryo_id = v_gorev.senaryo_id AND durum = 'revizyon bekleniyor'; IF v_revizyon >= 2 THEN RAISE EXCEPTION 'Maksimum revizyon hakkı (2) kullanıldı.' USING ERRCODE = '23514'; END IF; END IF;
    INSERT INTO public.senaryo_durumu (senaryo_id, durum, degistiren_id, notlar) VALUES (v_gorev.senaryo_id, p_karar, p_uretici_id, nullif(btrim(p_notlar), '')) RETURNING senaryo_durum_id INTO v_durum_id;
    IF p_karar = 'onaylandi' THEN v_sonraki := public.uretim_gorev_ac(v_gorev.talep_id, 'video', p_uretici_id, v_gorev.atanan_iu_id, 'otomatik', NULL, NULL, NULL); END IF;
  ELSIF v_gorev.asama = 'video' THEN
    SELECT * INTO v_arac FROM public.ogrenme_araclari WHERE arac_id = v_gorev.arac_id FOR UPDATE;
    IF NOT FOUND OR v_arac.arac_turu <> 'gorsel' OR v_arac.metadata_dogrulandi IS NOT TRUE OR v_arac.genislik <= 0 OR v_arac.yukseklik <= 0 THEN RAISE EXCEPTION 'Doğrulanmış Dijital Broşür bulunamadı.' USING ERRCODE = '23514'; END IF;
    IF p_karar = 'revizyon bekleniyor' THEN SELECT count(*)::integer INTO v_revizyon FROM public.ogrenme_araci_durumu WHERE arac_id = v_arac.arac_id AND durum = 'revizyon bekleniyor'; IF v_revizyon >= 2 THEN RAISE EXCEPTION 'Maksimum revizyon hakkı (2) kullanıldı.' USING ERRCODE = '23514'; END IF; END IF;
    INSERT INTO public.ogrenme_araci_durumu (arac_id, durum, degistiren_id, notlar) VALUES (v_arac.arac_id, p_karar, p_uretici_id, nullif(btrim(p_notlar), '')) RETURNING arac_durum_id INTO v_durum_id;
    IF p_karar = 'onaylandi' THEN v_sonraki := public.uretim_podcast_soru_zinciri_ac(v_gorev.talep_id, v_durum_id, p_uretici_id, v_gorev.atanan_iu_id); END IF;
  ELSE RAISE EXCEPTION 'Bu RPC yalnız Dijital Broşür senaryo ve üretim aşamasını işler.' USING ERRCODE = '23514'; END IF;
  v_sonuc := jsonb_build_object('gorev_id', p_gorev_id, 'talep_id', v_gorev.talep_id, 'asama', v_gorev.asama, 'karar', p_karar, 'durum_id', v_durum_id, 'sonraki', v_sonraki);
  INSERT INTO public.uretim_islem_kayitlari (islem_anahtari, islem_turu, gorev_id, talep_id, sonuc) VALUES (p_islem_anahtari, 'gorsel_uretici_karari', p_gorev_id, v_gorev.talep_id, v_sonuc);
  RETURN v_sonuc;
END;
$fonksiyon$;

REVOKE ALL ON FUNCTION public.uretim_gorsel_uretici_karar_ver(uuid,uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uretim_gorsel_uretici_karar_ver(uuid,uuid,text,text,uuid) TO service_role;

COMMIT;

SELECT
  to_regprocedure('public.uretim_gorsel_uretici_karar_ver(uuid,uuid,text,text,uuid)') IS NOT NULL
  AND pg_get_functiondef(to_regprocedure('public.uretim_gorsel_uretici_karar_ver(uuid,uuid,text,text,uuid)')) LIKE '%Dijital Broşür karar yetkisi yok.%'
  AS dijital_brosur_v3_karar_terminolojisi_kuruldu;
