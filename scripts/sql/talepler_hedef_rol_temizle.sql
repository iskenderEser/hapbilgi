-- Çoğul hedef sürümü canlıya alındıktan sonra tekil geçiş katmanını kaldırır.
-- CASCADE kullanılmaz: beklenmeyen bir bağımlılık varsa transaction geri alınır.

BEGIN;

LOCK TABLE public.talepler IN ACCESS EXCLUSIVE MODE;

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.talepler
    WHERE hedef_roller IS NULL OR cardinality(hedef_roller) = 0
  ) THEN
    RAISE EXCEPTION 'hedef_roller boş olan talep bulundu; eski kolon kaldırılamaz.';
  END IF;
END;
$kontrol$;

DROP VIEW public.v_cc_challenge_listesi;
DROP VIEW public.v_yayin_detay;
DROP VIEW public.v_yayin_kunye;

DROP TRIGGER IF EXISTS talepler_hedef_roller_esitle_trg ON public.talepler;
DROP FUNCTION IF EXISTS public.talepler_hedef_roller_esitle();

ALTER TABLE public.talepler
  DROP CONSTRAINT IF EXISTS chk_talepler_hedef_rol;
ALTER TABLE public.talepler
  DROP COLUMN hedef_rol;

CREATE VIEW public.v_yayin_detay AS
 SELECT ym.yayin_id,
    ym.soru_seti_durum_id,
    ym.durum,
    ym.yayin_tarihi,
    ym.durdurma_tarihi,
    COALESCE(u.urun_adi, t.urun_adi) AS urun_adi,
    tek.teknik_adi,
    t.takim_id,
    t.uretici_id,
    t.video_basi_soru_sayisi,
    t.soru_seti_buyuklugu,
    v.video_url,
    v.thumbnail_url,
    vp.video_puani,
    avg(ssp.soru_puani)::integer AS soru_puani,
    ss.sorular,
    s.senaryo_metni,
    s.senaryo_id,
    sd.senaryo_durum_id,
    vd.video_durum_id,
    ssd.soru_seti_id,
    t.icerik_turu,
    t.talep_no,
    f.firma_adi,
    t.egitim_turu,
    t.firma_id,
    ym.hedef_roller
   FROM public.yayin_yonetimi ym
     JOIN public.soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
     JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
     JOIN public.video_durumu vd ON vd.video_durum_id = ss.video_durum_id
     JOIN public.videolar v ON v.video_id = vd.video_id
     JOIN public.talepler t ON t.talep_id = v.talep_id
     LEFT JOIN public.senaryo_durumu sd ON sd.senaryo_durum_id = v.senaryo_durum_id
     LEFT JOIN public.senaryolar s ON s.senaryo_id = sd.senaryo_id
     LEFT JOIN public.urunler u ON u.urun_id = t.urun_id
     LEFT JOIN public.teknikler tek ON tek.teknik_id = t.teknik_id
     LEFT JOIN public.video_puanlari vp ON vp.video_durum_id = vd.video_durum_id
     LEFT JOIN public.soru_seti_puanlari ssp ON ssp.soru_seti_durum_id = ym.soru_seti_durum_id
     LEFT JOIN public.firmalar f ON f.firma_id = t.firma_id
  GROUP BY ym.yayin_id, ym.soru_seti_durum_id, ym.durum, ym.yayin_tarihi, ym.durdurma_tarihi,
    u.urun_adi, t.urun_adi, tek.teknik_adi, t.takim_id, t.uretici_id, t.video_basi_soru_sayisi,
    t.soru_seti_buyuklugu, v.video_url, v.thumbnail_url, vp.video_puani, ss.sorular,
    s.senaryo_metni, s.senaryo_id, sd.senaryo_durum_id, vd.video_durum_id, ssd.soru_seti_id,
    t.icerik_turu, t.egitim_turu, t.talep_no, f.firma_adi, t.firma_id, ym.hedef_roller;

GRANT SELECT ON public.v_yayin_detay TO anon, authenticated, service_role;

CREATE VIEW public.v_yayin_kunye AS
SELECT
  ym.yayin_id,
  t.talep_id,
  t.talep_no,
  t.urun_id,
  t.teknik_id,
  t.icerik_turu,
  t.egitim_turu,
  t.firma_id,
  t.takim_id,
  t.uretici_id,
  ym.hedef_roller
FROM public.yayin_yonetimi ym
JOIN public.soru_seti_durumu ssd ON ssd.soru_seti_durum_id = ym.soru_seti_durum_id
JOIN public.soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
JOIN public.talepler t ON t.talep_id = ss.talep_id;

GRANT SELECT ON public.v_yayin_kunye TO service_role;

CREATE VIEW public.v_cc_challenge_listesi AS
SELECT
  ck.challenge_id,
  ck.gonderen_id,
  (g.ad::text || ' '::text) || g.soyad::text AS challenger_adi,
  ck.alan_id,
  (a.ad::text || ' '::text) || a.soyad::text AS challengee_adi,
  ck.yayin_id,
  vyd.urun_adi,
  vyd.teknik_adi,
  ck.created_at AS challenge_tarihi,
  ck.son_tarih,
  ck.izlendi_mi,
  CASE
    WHEN ck.izlendi_mi = true THEN 'İzlendi'::text
    WHEN ck.son_tarih > now() THEN 'Bekliyor'::text
    ELSE 'Süresi Doldu'::text
  END AS durum,
  (
    SELECT ik.izleme_bitis
    FROM public.izleme_kayitlari ik
    WHERE ik.kullanici_id = ck.alan_id
      AND ik.yayin_id = ck.yayin_id
      AND ik.tamamlandi_mi = true
    ORDER BY ik.izleme_bitis
    LIMIT 1
  ) AS izleme_tarihi
FROM public.challenge_kayitlari ck
JOIN public.kullanicilar g ON g.kullanici_id = ck.gonderen_id
JOIN public.kullanicilar a ON a.kullanici_id = ck.alan_id
JOIN public.v_yayin_detay vyd ON vyd.yayin_id = ck.yayin_id;

GRANT SELECT ON public.v_cc_challenge_listesi TO authenticated, service_role;

COMMIT;
