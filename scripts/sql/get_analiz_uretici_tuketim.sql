-- scripts/sql/get_analiz_uretici_tuketim.sql
--
-- Analiz sayfası — üretici kolu tüketim metrikleri.
--
-- GÜNCELLEME (05.08.2026 — künye geçişi): BM ve TM kollarındaki düzeltmenin
-- aynısı. Yayından talebe giden sekiz tablolu SENARYO zinciri gövdede yedi kez
-- tekrarlanıyordu; hazır video kolunda senaryo yazılmadığı için o yol kopuyordu
-- (altı blokta süzgeç uygulandığında içerik düşüyor, "izlenmeyen video"
-- bloğunda hiç görünmüyordu). Yedi blokta da zincir `v_yayin_kunye` ile
-- değiştirildi; ürün süzgeci de defterdeki kopyadan değil künyeden okunuyor.
--
-- Dönüş sözleşmesi, parametreler ve hesap mantığı AYNEN korunmuştur.
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE FUNCTION public.get_analiz_uretici_tuketim(
  p_kullanici_id uuid,
  p_baslangic timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_bitis timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_urun_id uuid DEFAULT NULL::uuid,
  p_egitim_turu text DEFAULT NULL::text,
  p_takim_id uuid DEFAULT NULL::uuid,
  p_bolge_id uuid DEFAULT NULL::uuid,
  p_utt_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  izlenen_video_sayisi bigint, kazanilan_izleme_puani bigint,
  cevaplanan_soru_sayisi bigint, kazanilan_cevaplama_puani bigint,
  onerilen_video_sayisi bigint, kazanilan_oneri_izleme_puani bigint,
  extra_izleme_olan_video_sayisi bigint, kazanilan_extra_izleme_puani bigint,
  izlenmeyen_video_sayisi bigint, kaybedilen_video_puani bigint,
  yanlis_cevaplanan_soru_sayisi bigint, kaybedilen_cevaplama_puani bigint,
  izlenmeyen_oneri_video_sayisi bigint, kaybedilen_oneri_video_puani bigint,
  ileri_sarilan_video_sayisi bigint, kaybedilen_ileri_sarma_puani bigint,
  kazanilan_toplam_puan bigint, kaybedilen_toplam_puan bigint, net_puan bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_firma_id uuid;
  v_uretici_takim_id uuid;
  v_kazanim_izleme bigint;
  v_kazanim_cevaplama bigint;
  v_kazanim_oneri bigint;
  v_kazanim_extra bigint;
  v_izlenen_sayi bigint;
  v_oneri_sayi bigint;
  v_extra_sayi bigint;
  v_cevap_toplam bigint;
  v_cevap_yanlis bigint;
  v_yanlis_kaybi bigint;
  v_ileri_sarma_sayi bigint;
  v_ileri_sarma_kaybi bigint;
  v_oneri_kayip_sayi bigint;
  v_oneri_kayip_puan bigint;
  v_izlenmeyen_sayi bigint;
  v_izlenmeyen_puan bigint;
BEGIN
  SELECT k.firma_id, k.takim_id INTO v_firma_id, v_uretici_takim_id
  FROM kullanicilar k
  WHERE k.kullanici_id = p_kullanici_id;

  IF v_firma_id IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı bulunamadı veya firma_id tanımsız: %', p_kullanici_id;
  END IF;

  -- KAZANIM 1: kazanilan_puanlar (4 türde puan)
  SELECT
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'),    0)::bigint,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::bigint,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'oneri'),     0)::bigint,
    COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'extra'),     0)::bigint
  INTO v_kazanim_izleme, v_kazanim_cevaplama, v_kazanim_oneri, v_kazanim_extra
  FROM kazanilan_puanlar kp
  JOIN kullanicilar k ON k.kullanici_id = kp.kullanici_id
  LEFT JOIN v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
  WHERE k.rol IN ('utt','kd_utt')
    AND k.firma_id = v_firma_id
    AND (v_uretici_takim_id IS NULL OR k.takim_id = v_uretici_takim_id)
    AND (p_utt_id      IS NULL OR kp.kullanici_id = p_utt_id)
    AND (p_takim_id    IS NULL OR k.takim_id      = p_takim_id)
    AND (p_bolge_id    IS NULL OR k.bolge_id      = p_bolge_id)
    AND (p_urun_id     IS NULL OR ky.urun_id      = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu  = p_egitim_turu)
    AND (p_baslangic   IS NULL OR kp.created_at  >= p_baslangic)
    AND (p_bitis       IS NULL OR kp.created_at  <= p_bitis);

  -- KAZANIM 2: izleme_kayitlari (3 sayım)
  SELECT
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'kendi_kendine')::bigint,
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'oneri')::bigint,
    COUNT(DISTINCT ik.izleme_id) FILTER (WHERE ik.izleme_turu = 'extra')::bigint
  INTO v_izlenen_sayi, v_oneri_sayi, v_extra_sayi
  FROM izleme_kayitlari ik
  JOIN kullanicilar k ON k.kullanici_id = ik.kullanici_id
  LEFT JOIN v_yayin_kunye ky ON ky.yayin_id = ik.yayin_id
  WHERE k.rol IN ('utt','kd_utt')
    AND k.firma_id = v_firma_id
    AND (v_uretici_takim_id IS NULL OR k.takim_id = v_uretici_takim_id)
    AND ik.tamamlandi_mi = true
    AND (p_utt_id      IS NULL OR ik.kullanici_id = p_utt_id)
    AND (p_takim_id    IS NULL OR k.takim_id      = p_takim_id)
    AND (p_bolge_id    IS NULL OR k.bolge_id      = p_bolge_id)
    AND (p_urun_id     IS NULL OR ky.urun_id      = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu  = p_egitim_turu)
    AND (p_baslangic   IS NULL OR ik.created_at  >= p_baslangic)
    AND (p_bitis       IS NULL OR ik.created_at  <= p_bitis);

  -- KAZANIM 3 + KAYIP 1: cevap sayıları
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE sc.dogru_mu = false)::bigint
  INTO v_cevap_toplam, v_cevap_yanlis
  FROM soru_cevaplari sc
  JOIN kullanicilar k ON k.kullanici_id = sc.kullanici_id
  LEFT JOIN izleme_kayitlari ik ON ik.izleme_id = sc.izleme_id
  LEFT JOIN v_yayin_kunye ky    ON ky.yayin_id  = ik.yayin_id
  WHERE k.rol IN ('utt','kd_utt')
    AND k.firma_id = v_firma_id
    AND (v_uretici_takim_id IS NULL OR k.takim_id = v_uretici_takim_id)
    AND (p_utt_id      IS NULL OR sc.kullanici_id = p_utt_id)
    AND (p_takim_id    IS NULL OR k.takim_id      = p_takim_id)
    AND (p_bolge_id    IS NULL OR k.bolge_id      = p_bolge_id)
    AND (p_urun_id     IS NULL OR ky.urun_id      = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu  = p_egitim_turu)
    AND (p_baslangic   IS NULL OR sc.created_at  >= p_baslangic)
    AND (p_bitis       IS NULL OR sc.created_at  <= p_bitis);

  -- KAYIP 2: yanlis_cevap_kayitlari
  SELECT COALESCE(SUM(yck.kaybedilen_puan), 0)::bigint
  INTO v_yanlis_kaybi
  FROM yanlis_cevap_kayitlari yck
  JOIN kullanicilar k ON k.kullanici_id = yck.kullanici_id
  LEFT JOIN v_yayin_kunye ky ON ky.yayin_id = yck.yayin_id
  WHERE k.rol IN ('utt','kd_utt')
    AND k.firma_id = v_firma_id
    AND (v_uretici_takim_id IS NULL OR k.takim_id = v_uretici_takim_id)
    AND (p_utt_id      IS NULL OR yck.kullanici_id = p_utt_id)
    AND (p_takim_id    IS NULL OR k.takim_id       = p_takim_id)
    AND (p_bolge_id    IS NULL OR k.bolge_id       = p_bolge_id)
    AND (p_urun_id     IS NULL OR ky.urun_id       = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu   = p_egitim_turu)
    AND (p_baslangic   IS NULL OR yck.created_at  >= p_baslangic)
    AND (p_bitis       IS NULL OR yck.created_at  <= p_bitis);

  -- KAYIP 3: ileri_sarma_kayitlari
  SELECT
    COUNT(DISTINCT isk.kayit_id)::bigint,
    COALESCE(SUM(isk.kaybedilen_puan), 0)::bigint
  INTO v_ileri_sarma_sayi, v_ileri_sarma_kaybi
  FROM ileri_sarma_kayitlari isk
  JOIN kullanicilar k ON k.kullanici_id = isk.kullanici_id
  LEFT JOIN v_yayin_kunye ky ON ky.yayin_id = isk.yayin_id
  WHERE k.rol IN ('utt','kd_utt')
    AND k.firma_id = v_firma_id
    AND (v_uretici_takim_id IS NULL OR k.takim_id = v_uretici_takim_id)
    AND (p_utt_id      IS NULL OR isk.kullanici_id = p_utt_id)
    AND (p_takim_id    IS NULL OR k.takim_id       = p_takim_id)
    AND (p_bolge_id    IS NULL OR k.bolge_id       = p_bolge_id)
    AND (p_urun_id     IS NULL OR ky.urun_id       = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu   = p_egitim_turu)
    AND (p_baslangic   IS NULL OR isk.created_at  >= p_baslangic)
    AND (p_bitis       IS NULL OR isk.created_at  <= p_bitis);

  -- KAYIP 4: oneri_kayip_kayitlari
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(okk.kaybedilen_puan), 0)::bigint
  INTO v_oneri_kayip_sayi, v_oneri_kayip_puan
  FROM oneri_kayip_kayitlari okk
  JOIN kullanicilar k ON k.kullanici_id = okk.kullanici_id
  LEFT JOIN v_yayin_kunye ky ON ky.yayin_id = okk.yayin_id
  WHERE k.rol IN ('utt','kd_utt')
    AND k.firma_id = v_firma_id
    AND (v_uretici_takim_id IS NULL OR k.takim_id = v_uretici_takim_id)
    AND (p_utt_id      IS NULL OR okk.kullanici_id = p_utt_id)
    AND (p_takim_id    IS NULL OR k.takim_id       = p_takim_id)
    AND (p_bolge_id    IS NULL OR k.bolge_id       = p_bolge_id)
    AND (p_urun_id     IS NULL OR ky.urun_id       = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu   = p_egitim_turu)
    AND (p_baslangic   IS NULL OR okk.created_at  >= p_baslangic)
    AND (p_bitis       IS NULL OR okk.created_at  <= p_bitis);

  -- KAYIP 5: izlenmeyen video
  -- Zincir künyeye alındı; hazır video yayınları artık bu sayıma giriyor.
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(vp.video_puani), 0)::bigint
  INTO v_izlenmeyen_sayi, v_izlenmeyen_puan
  FROM yayin_yonetimi ym
  JOIN kullanicilar k
    ON k.rol IN ('utt','kd_utt')
   AND k.rol = ANY(ym.hedef_roller)
   AND k.firma_id = v_firma_id
   AND (v_uretici_takim_id IS NULL OR k.takim_id = v_uretici_takim_id)
  JOIN v_yayin_kunye ky ON ky.yayin_id = ym.yayin_id
  JOIN soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
  JOIN soru_setleri     ss  ON ss.soru_seti_id        = ssd.soru_seti_id
  LEFT JOIN video_puanlari vp ON vp.video_durum_id = ss.video_durum_id
  WHERE ym.durum = 'yayinda'
    AND NOT EXISTS (
      SELECT 1 FROM izleme_kayitlari ik
      WHERE ik.yayin_id     = ym.yayin_id
        AND ik.kullanici_id = k.kullanici_id
        AND ik.tamamlandi_mi = true
    )
    AND (p_utt_id      IS NULL OR k.kullanici_id = p_utt_id)
    AND (p_takim_id    IS NULL OR k.takim_id     = p_takim_id)
    AND (p_bolge_id    IS NULL OR k.bolge_id     = p_bolge_id)
    AND (p_urun_id     IS NULL OR ky.urun_id     = p_urun_id)
    AND (p_egitim_turu IS NULL OR ky.egitim_turu = p_egitim_turu)
    AND (p_baslangic   IS NULL OR ym.yayin_tarihi >= p_baslangic)
    AND (p_bitis       IS NULL OR ym.yayin_tarihi <= p_bitis);

  RETURN QUERY SELECT
    v_izlenen_sayi,
    v_kazanim_izleme,
    v_cevap_toplam,
    v_kazanim_cevaplama,
    v_oneri_sayi,
    v_kazanim_oneri,
    v_extra_sayi,
    v_kazanim_extra,
    v_izlenmeyen_sayi,
    v_izlenmeyen_puan,
    v_cevap_yanlis,
    v_yanlis_kaybi,
    v_oneri_kayip_sayi,
    v_oneri_kayip_puan,
    v_ileri_sarma_sayi,
    v_ileri_sarma_kaybi,
    (v_kazanim_izleme + v_kazanim_cevaplama + v_kazanim_oneri + v_kazanim_extra),
    (v_izlenmeyen_puan + v_yanlis_kaybi + v_oneri_kayip_puan + v_ileri_sarma_kaybi),
    ((v_kazanim_izleme + v_kazanim_cevaplama + v_kazanim_oneri + v_kazanim_extra)
     - (v_izlenmeyen_puan + v_yanlis_kaybi + v_oneri_kayip_puan + v_ileri_sarma_kaybi));
END;
$function$;
