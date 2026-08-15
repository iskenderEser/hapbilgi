-- İçerik üretim hattı — Paket E canlı veri geçişi.
--
-- Amaç:
--   1. Tarihî IU/ürün ve IU/genel eğitim ilişkilerini çoklu atama havuzuna taşır.
--   2. Eski senaryo → video → soru seti zincirini kanonik uretim_gorevleri
--      kayıtlarıyla eşler; hiçbir içerik veya durum kaydını silmez.
--   3. Yarım kalmış fakat önceki aşaması onaylanmış zincirlerde eksik video /
--      soru-seti kabuğunu tamamlar.
--   4. Eski üretim bildirimlerini okunmuş yapıp yalnız güncel sorumluluk
--      bildirimini kurar.
--
-- Güvenlik:
--   - Tek transaction'dır; bir kontrol hata verirse bütün işlem geri alınır.
--   - Aynı talepte daha önce uretim_gorevleri varsa o talep değiştirilmez.
--   - Yeniden çalıştırılabilir; görev ve atama çoğaltmaz.
--   - Uygulama yazılarını kısa süreli kilitler; düşük trafikte çalıştırılmalıdır.

BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-uretim-gorevleri-canli-gecis-v1', 1));

LOCK TABLE public.iu_urun_atamalari,
                  public.iu_genel_atamalari,
                  public.uretim_gorevleri,
                  public.uretim_gorev_atama_gecmisi,
                  public.talepler,
                  public.senaryolar,
                  public.senaryo_durumu,
                  public.videolar,
                  public.video_durumu,
                  public.soru_setleri,
                  public.soru_seti_durumu,
                  public.bildirimler
  IN SHARE ROW EXCLUSIVE MODE;

-- Geçiş yalnız uygulamanın bildiği son durum değerleriyle yapılır. Tanımsız
-- değer sessizce "devam ediyor" sayılmaz; transaction açıkça durur.
DO $kontrol$
DECLARE
  v_bilinmeyen text;
BEGIN
  WITH son_durumlar AS (
    SELECT 'senaryo'::text AS asama, z.senaryo_durum AS durum
    FROM public.v_uretici_icerik_takip z
    WHERE z.senaryo_durum IS NOT NULL
    UNION ALL
    SELECT 'video', z.video_durum
    FROM public.v_uretici_icerik_takip z
    WHERE z.video_durum IS NOT NULL
    UNION ALL
    SELECT 'soru_seti', z.soru_seti_durum
    FROM public.v_uretici_icerik_takip z
    WHERE z.soru_seti_durum IS NOT NULL
  )
  SELECT string_agg(DISTINCT asama || '=' || durum, ', ' ORDER BY asama || '=' || durum)
    INTO v_bilinmeyen
  FROM son_durumlar
  WHERE durum NOT IN ('inceleme bekleniyor', 'revizyon bekleniyor', 'onaylandi', 'Iptal Edildi');

  IF v_bilinmeyen IS NOT NULL THEN
    RAISE EXCEPTION 'Geçiş durduruldu; tanımsız son üretim durumları: %', v_bilinmeyen
      USING ERRCODE = '23514';
  END IF;
END;
$kontrol$;

-- Tarihî ürün işleri: aynı ürünle çalışmış aktif IU'lar ürün havuzuna eklenir.
WITH tarihce AS (
  SELECT t.urun_id, s.iu_id, min(COALESCE(s.created_at, t.created_at, now())) AS ilk_tarih
  FROM public.senaryolar s
  JOIN public.talepler t ON t.talep_id = s.talep_id
  WHERE t.urun_id IS NOT NULL AND s.iu_id IS NOT NULL
  GROUP BY t.urun_id, s.iu_id
  UNION ALL
  SELECT t.urun_id, v.iu_id, min(COALESCE(v.created_at, t.created_at, now()))
  FROM public.videolar v
  JOIN public.talepler t ON t.talep_id = v.talep_id
  WHERE t.urun_id IS NOT NULL AND v.iu_id IS NOT NULL
  GROUP BY t.urun_id, v.iu_id
  UNION ALL
  SELECT t.urun_id, s.iu_id, min(COALESCE(s.created_at, t.created_at, now()))
  FROM public.soru_setleri s
  JOIN public.talepler t ON t.talep_id = s.talep_id
  WHERE t.urun_id IS NOT NULL AND s.iu_id IS NOT NULL
  GROUP BY t.urun_id, s.iu_id
), tekil AS (
  SELECT urun_id, iu_id, min(ilk_tarih) AS ilk_tarih
  FROM tarihce
  GROUP BY urun_id, iu_id
)
INSERT INTO public.iu_urun_atamalari (
  iu_id, urun_id, aktif_mi, baslangic_tarihi, aciklama, created_at, updated_at
)
SELECT x.iu_id, x.urun_id, true, x.ilk_tarih,
       'Canlı üretim hattı geçişinde tarihî iş ilişkisinden oluşturuldu.',
       x.ilk_tarih, now()
FROM tekil x
JOIN public.kullanicilar k ON k.kullanici_id = x.iu_id
WHERE lower(k.rol) = 'iu'
  AND k.aktif_mi IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.iu_urun_atamalari a
    WHERE a.iu_id = x.iu_id AND a.urun_id = x.urun_id AND a.aktif_mi IS TRUE
  );

-- Ürünsüz tarihî işler eğitim türü havuzuna taşınır.
WITH tarihce AS (
  SELECT t.egitim_turu, s.iu_id, min(COALESCE(s.created_at, t.created_at, now())) AS ilk_tarih
  FROM public.senaryolar s
  JOIN public.talepler t ON t.talep_id = s.talep_id
  WHERE t.urun_id IS NULL AND s.iu_id IS NOT NULL
  GROUP BY t.egitim_turu, s.iu_id
  UNION ALL
  SELECT t.egitim_turu, v.iu_id, min(COALESCE(v.created_at, t.created_at, now()))
  FROM public.videolar v
  JOIN public.talepler t ON t.talep_id = v.talep_id
  WHERE t.urun_id IS NULL AND v.iu_id IS NOT NULL
  GROUP BY t.egitim_turu, v.iu_id
  UNION ALL
  SELECT t.egitim_turu, s.iu_id, min(COALESCE(s.created_at, t.created_at, now()))
  FROM public.soru_setleri s
  JOIN public.talepler t ON t.talep_id = s.talep_id
  WHERE t.urun_id IS NULL AND s.iu_id IS NOT NULL
  GROUP BY t.egitim_turu, s.iu_id
), tekil AS (
  SELECT egitim_turu, iu_id, min(ilk_tarih) AS ilk_tarih
  FROM tarihce
  GROUP BY egitim_turu, iu_id
)
INSERT INTO public.iu_genel_atamalari (
  iu_id, egitim_turu, aktif_mi, baslangic_tarihi, aciklama, created_at, updated_at
)
SELECT x.iu_id, x.egitim_turu, true, x.ilk_tarih,
       'Canlı üretim hattı geçişinde tarihî iş ilişkisinden oluşturuldu.',
       x.ilk_tarih, now()
FROM tekil x
JOIN public.kullanicilar k ON k.kullanici_id = x.iu_id
WHERE lower(k.rol) = 'iu'
  AND k.aktif_mi IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.iu_genel_atamalari a
    WHERE a.iu_id = x.iu_id AND a.egitim_turu = x.egitim_turu AND a.aktif_mi IS TRUE
  );

-- Hazır video URL'si yazılmış fakat video zinciri oluşmamış eski kayıtları
-- onaylı video halkasına tamamlar. Hazır video bir IU görevi değildir.
INSERT INTO public.videolar (
  talep_id, senaryo_durum_id, kaynak, iu_id, video_url, thumbnail_url, created_at
)
SELECT t.talep_id, NULL, 'hazir', NULL, btrim(t.hazir_video_url), NULL,
       COALESCE(t.created_at, now())
FROM public.talepler t
WHERE t.hazir_video IS TRUE
  AND nullif(btrim(t.hazir_video_url), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.videolar v WHERE v.talep_id = t.talep_id)
  AND NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = t.talep_id);

INSERT INTO public.video_durumu (video_id, durum, degistiren_id, notlar, created_at)
SELECT v.video_id, 'onaylandi', t.uretici_id, 'Canlı geçiş — hazır video otomatik onayı',
       COALESCE(v.created_at, t.created_at, now())
FROM public.talepler t
JOIN LATERAL (
  SELECT x.video_id, x.video_url, x.created_at
  FROM public.videolar x
  WHERE x.talep_id = t.talep_id AND x.kaynak = 'hazir'
  ORDER BY x.created_at DESC, x.video_id DESC
  LIMIT 1
) v ON true
WHERE t.hazir_video IS TRUE
  AND nullif(btrim(v.video_url), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.video_durumu d WHERE d.video_id = v.video_id)
  AND NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = t.talep_id);

-- Onaylı senaryodan sonra video kabuğu doğmamış eski normal talepleri onarır.
WITH onayli_senaryo AS (
  SELECT t.talep_id, sd.senaryo_durum_id, sd.created_at
  FROM public.talepler t
  JOIN LATERAL (
    SELECT x.senaryo_id
    FROM public.senaryolar x
    WHERE x.talep_id = t.talep_id
    ORDER BY x.created_at DESC, x.senaryo_id DESC
    LIMIT 1
  ) s ON true
  JOIN LATERAL (
    SELECT d.senaryo_durum_id, d.durum, d.created_at
    FROM public.senaryo_durumu d
    WHERE d.senaryo_id = s.senaryo_id
    ORDER BY d.created_at DESC, d.senaryo_durum_id DESC
    LIMIT 1
  ) sd ON sd.durum = 'onaylandi'
  WHERE t.hazir_video IS NOT TRUE
)
INSERT INTO public.videolar (
  talep_id, senaryo_durum_id, kaynak, iu_id, video_url, thumbnail_url, created_at
)
SELECT x.talep_id, x.senaryo_durum_id, 'iu', NULL, '', NULL, COALESCE(x.created_at, now())
FROM onayli_senaryo x
WHERE NOT EXISTS (SELECT 1 FROM public.videolar v WHERE v.talep_id = x.talep_id)
  AND NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = x.talep_id);

-- Onaylı videodan sonra soru seti kabuğu doğmamış taleplerde, hazır set varsa
-- önce veri sözleşmesi doğrulanır. Hatalı hazır set transaction'ı durdurur.
DO $hazir_set_kontrol$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.talep_id, t.hazir_soru_seti_verisi
    FROM public.talepler t
    JOIN LATERAL (
      SELECT x.video_id
      FROM public.videolar x
      WHERE x.talep_id = t.talep_id
      ORDER BY x.created_at DESC, x.video_id DESC
      LIMIT 1
    ) v ON true
    JOIN LATERAL (
      SELECT d.video_durum_id, d.durum
      FROM public.video_durumu d
      WHERE d.video_id = v.video_id
      ORDER BY d.created_at DESC, d.video_durum_id DESC
      LIMIT 1
    ) vd ON vd.durum = 'onaylandi'
    WHERE t.hazir_soru_seti IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.soru_setleri s WHERE s.video_durum_id = vd.video_durum_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = t.talep_id
      )
  LOOP
    PERFORM public.uretim_soru_seti_dogrula(r.talep_id, r.hazir_soru_seti_verisi);
  END LOOP;
END;
$hazir_set_kontrol$;

WITH son_onayli_video AS (
  SELECT t.talep_id, t.hazir_soru_seti, t.hazir_soru_seti_verisi,
         vd.video_durum_id, vd.created_at
  FROM public.talepler t
  JOIN LATERAL (
    SELECT x.video_id
    FROM public.videolar x
    WHERE x.talep_id = t.talep_id
    ORDER BY x.created_at DESC, x.video_id DESC
    LIMIT 1
  ) v ON true
  JOIN LATERAL (
    SELECT d.video_durum_id, d.durum, d.created_at
    FROM public.video_durumu d
    WHERE d.video_id = v.video_id
    ORDER BY d.created_at DESC, d.video_durum_id DESC
    LIMIT 1
  ) vd ON vd.durum = 'onaylandi'
)
INSERT INTO public.soru_setleri (
  talep_id, video_durum_id, kaynak, iu_id, sorular, created_at
)
SELECT x.talep_id, x.video_durum_id,
       CASE WHEN x.hazir_soru_seti IS TRUE THEN 'hazir' ELSE 'iu' END,
       NULL,
       CASE WHEN x.hazir_soru_seti IS TRUE THEN x.hazir_soru_seti_verisi ELSE '[]'::jsonb END,
       COALESCE(x.created_at, now())
FROM son_onayli_video x
WHERE NOT EXISTS (SELECT 1 FROM public.soru_setleri s WHERE s.video_durum_id = x.video_durum_id)
  AND NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = x.talep_id);

INSERT INTO public.soru_seti_durumu (
  soru_seti_id, durum, degistiren_id, notlar, created_at
)
SELECT s.soru_seti_id, 'onaylandi', t.uretici_id,
       'Canlı geçiş — hazır soru seti otomatik onayı', COALESCE(s.created_at, t.created_at, now())
FROM public.soru_setleri s
JOIN public.talepler t ON t.talep_id = s.talep_id
WHERE s.kaynak = 'hazir'
  AND NOT EXISTS (SELECT 1 FROM public.soru_seti_durumu d WHERE d.soru_seti_id = s.soru_seti_id)
  AND NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = t.talep_id);

-- Geçiş anlık görüntüsü. Mevcut görev kaydı olan talepler bilerek kapsam dışıdır.
CREATE TEMP TABLE _uretim_gecis_gorevleri (
  talep_id uuid NOT NULL,
  asama text NOT NULL,
  senaryo_id uuid,
  video_id uuid,
  soru_seti_id uuid,
  atanan_iu_id uuid,
  durum text NOT NULL,
  olay_tarihi timestamptz NOT NULL,
  PRIMARY KEY (talep_id, asama)
);

-- Senaryo: hazır video olmayan her talebin IU aşamasıdır.
INSERT INTO _uretim_gecis_gorevleri
SELECT t.talep_id, 'senaryo', z.senaryo_id, NULL, NULL, z.senaryo_iu_id,
       CASE z.senaryo_durum
         WHEN 'inceleme bekleniyor' THEN 'inceleme_bekliyor'
         WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor'
         WHEN 'onaylandi' THEN 'tamamlandi'
         WHEN 'Iptal Edildi' THEN 'iptal'
         ELSE 'hazirlaniyor'
       END,
       COALESCE(z.senaryo_durum_tarih, t.created_at, now())
FROM public.talepler t
LEFT JOIN public.v_uretici_icerik_takip z ON z.talep_id = t.talep_id
WHERE t.hazir_video IS NOT TRUE
  AND NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = t.talep_id);

-- Video: yalnız kaynak='iu' olan video içerik üreticisi görevidir.
INSERT INTO _uretim_gecis_gorevleri
SELECT t.talep_id, 'video', NULL, z.video_id, NULL,
       COALESCE(z.video_iu_id, z.senaryo_iu_id),
       CASE z.video_durum
         WHEN 'inceleme bekleniyor' THEN 'inceleme_bekliyor'
         WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor'
         WHEN 'onaylandi' THEN 'tamamlandi'
         WHEN 'Iptal Edildi' THEN 'iptal'
         ELSE 'hazirlaniyor'
       END,
       COALESCE(z.video_durum_tarih, v.created_at, t.created_at, now())
FROM public.talepler t
JOIN public.v_uretici_icerik_takip z ON z.talep_id = t.talep_id
JOIN public.videolar v ON v.video_id = z.video_id AND v.kaynak = 'iu'
WHERE NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = t.talep_id);

-- Soru seti: yalnız kaynak='iu' olan set içerik üreticisi görevidir.
INSERT INTO _uretim_gecis_gorevleri
SELECT t.talep_id, 'soru_seti', NULL, NULL, z.soru_seti_id,
       COALESCE(z.soru_seti_iu_id, z.video_iu_id, z.senaryo_iu_id),
       CASE z.soru_seti_durum
         WHEN 'inceleme bekleniyor' THEN 'inceleme_bekliyor'
         WHEN 'revizyon bekleniyor' THEN 'revizyon_bekliyor'
         WHEN 'onaylandi' THEN 'tamamlandi'
         WHEN 'Iptal Edildi' THEN 'iptal'
         ELSE 'hazirlaniyor'
       END,
       COALESCE(z.soru_seti_durum_tarih, s.created_at, t.created_at, now())
FROM public.talepler t
JOIN public.v_uretici_icerik_takip z ON z.talep_id = t.talep_id
JOIN public.soru_setleri s ON s.soru_seti_id = z.soru_seti_id AND s.kaynak = 'iu'
WHERE NOT EXISTS (SELECT 1 FROM public.uretim_gorevleri g WHERE g.talep_id = t.talep_id);

-- Yanlış rolle ilişkilendirilmiş IU kimliği sorumlu olarak taşınmaz.
UPDATE _uretim_gecis_gorevleri x
   SET atanan_iu_id = NULL
 WHERE x.atanan_iu_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.kullanicilar k
     WHERE k.kullanici_id = x.atanan_iu_id AND lower(k.rol) = 'iu'
   );

-- Çalışan/revizyondaki görev pasif IU'da kalmaz. İnceleme bekleyen ve tarihî
-- tamamlanan kayıtlar gerçek üreticisini korur; gerekirse karar sonrası devredilir.
UPDATE _uretim_gecis_gorevleri x
   SET atanan_iu_id = NULL
 WHERE x.atanan_iu_id IS NOT NULL
   AND x.durum IN ('hazirlaniyor', 'revizyon_bekliyor')
   AND NOT EXISTS (
     SELECT 1 FROM public.kullanicilar k
     WHERE k.kullanici_id = x.atanan_iu_id
       AND lower(k.rol) = 'iu'
       AND k.aktif_mi IS TRUE
   );

-- Sahibi olmayan işler ürün/genel havuzundan deterministik olarak dağıtılır.
DO $aday_sec$
DECLARE
  r record;
  v_iu_id uuid;
BEGIN
  FOR r IN
    SELECT x.talep_id, x.asama
    FROM _uretim_gecis_gorevleri x
    WHERE x.atanan_iu_id IS NULL AND x.durum <> 'iptal'
    ORDER BY x.olay_tarihi, x.talep_id, x.asama
  LOOP
    v_iu_id := public.uretim_iu_adayi_sec(r.talep_id, NULL);
    IF v_iu_id IS NOT NULL THEN
      UPDATE _uretim_gecis_gorevleri
         SET atanan_iu_id = v_iu_id
       WHERE talep_id = r.talep_id AND asama = r.asama;

      UPDATE public.iu_urun_atamalari a
         SET son_atama_tarihi = clock_timestamp()
       WHERE a.iu_id = v_iu_id
         AND a.urun_id = (SELECT t.urun_id FROM public.talepler t WHERE t.talep_id = r.talep_id)
         AND a.aktif_mi IS TRUE;

      UPDATE public.iu_genel_atamalari a
         SET son_atama_tarihi = clock_timestamp()
       WHERE a.iu_id = v_iu_id
         AND a.egitim_turu = (SELECT t.egitim_turu FROM public.talepler t WHERE t.talep_id = r.talep_id)
         AND (SELECT t.urun_id FROM public.talepler t WHERE t.talep_id = r.talep_id) IS NULL
         AND a.aktif_mi IS TRUE;
    END IF;
  END LOOP;
END;
$aday_sec$;

-- Henüz içerik oluşmamış ve uygun IU bulunamayan iş açıkça admin atamasını bekler.
UPDATE _uretim_gecis_gorevleri
   SET durum = 'atama_bekliyor'
 WHERE atanan_iu_id IS NULL AND durum = 'hazirlaniyor';

DO $sahip_kontrol$
DECLARE
  v_sorun text;
BEGIN
  SELECT string_agg(talep_id::text || '/' || asama || '=' || durum, ', ' ORDER BY talep_id::text, asama)
    INTO v_sorun
  FROM _uretim_gecis_gorevleri
  WHERE atanan_iu_id IS NULL AND durum NOT IN ('atama_bekliyor', 'iptal');

  IF v_sorun IS NOT NULL THEN
    RAISE EXCEPTION 'Geçiş durduruldu; sorumlusu çözülemeyen ilerlemiş görevler: %', v_sorun
      USING ERRCODE = '23514';
  END IF;
END;
$sahip_kontrol$;

-- Tarihî/pasif IU kimliğini yalnız bu geçişte koruyabilmek ve eski işler için
-- bildirim yağmuru üretmemek amacıyla iki görev trigger'ı geçici kapatılır.
ALTER TABLE public.uretim_gorevleri DISABLE TRIGGER uretim_gorevleri_aktif_iu_trg;
ALTER TABLE public.uretim_gorevleri DISABLE TRIGGER uretim_gorev_bildirimi_trg;

INSERT INTO public.uretim_gorevleri (
  talep_id, asama, senaryo_id, video_id, soru_seti_id,
  atanan_iu_id, durum, atama_kaynagi, atayan_id,
  atama_tarihi, baslama_tarihi, inceleme_tarihi,
  tamamlanma_tarihi, iptal_tarihi, surum, created_at, updated_at
)
SELECT x.talep_id, x.asama, x.senaryo_id, x.video_id, x.soru_seti_id,
       x.atanan_iu_id, x.durum,
       CASE WHEN x.atanan_iu_id IS NULL THEN NULL ELSE 'gecis' END,
       CASE WHEN x.atanan_iu_id IS NULL THEN NULL ELSE t.uretici_id END,
       CASE WHEN x.atanan_iu_id IS NULL THEN NULL ELSE x.olay_tarihi END,
       CASE WHEN x.atanan_iu_id IS NULL THEN NULL ELSE x.olay_tarihi END,
       CASE WHEN x.durum IN ('inceleme_bekliyor', 'revizyon_bekliyor', 'tamamlandi') THEN x.olay_tarihi ELSE NULL END,
       CASE WHEN x.durum = 'tamamlandi' THEN x.olay_tarihi ELSE NULL END,
       CASE WHEN x.durum = 'iptal' THEN x.olay_tarihi ELSE NULL END,
       1, COALESCE(t.created_at, x.olay_tarihi), x.olay_tarihi
FROM _uretim_gecis_gorevleri x
JOIN public.talepler t ON t.talep_id = x.talep_id
ORDER BY x.olay_tarihi, x.talep_id, x.asama;

INSERT INTO public.uretim_gorev_atama_gecmisi (
  gorev_id, onceki_iu_id, yeni_iu_id, islem, atama_kaynagi,
  islemi_yapan_id, neden, created_at
)
SELECT g.gorev_id, NULL, g.atanan_iu_id, 'atandi', 'gecis', g.atayan_id,
       'Canlı üretim hattı görev modeli geçişi', g.atama_tarihi
FROM public.uretim_gorevleri g
JOIN _uretim_gecis_gorevleri x
  ON x.talep_id = g.talep_id AND x.asama = g.asama
WHERE g.atanan_iu_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.uretim_gorev_atama_gecmisi h WHERE h.gorev_id = g.gorev_id
  );

ALTER TABLE public.uretim_gorevleri ENABLE TRIGGER uretim_gorevleri_aktif_iu_trg;
ALTER TABLE public.uretim_gorevleri ENABLE TRIGGER uretim_gorev_bildirimi_trg;

-- Eski yanlış aşama/talep rozetleri kaybolur; kayıtlar denetim izi olarak kalır.
UPDATE public.bildirimler b
   SET goruldu_mu = true
 WHERE b.goruldu_mu IS FALSE
   AND b.kayit_turu IN ('talep', 'senaryo', 'video', 'soru_seti')
   AND EXISTS (
     SELECT 1 FROM _uretim_gecis_gorevleri x WHERE x.talep_id = b.talep_id
   );

-- Yalnız güncel top kimdeyse ona tek kanonik bildirim yazılır.
DO $bildirim_kur$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT g.gorev_id, g.talep_id, g.asama, g.durum, g.atanan_iu_id,
           t.uretici_id,
           COALESCE(u.urun_adi, t.urun_adi, '-') AS icerik_adi
    FROM public.uretim_gorevleri g
    JOIN _uretim_gecis_gorevleri x
      ON x.talep_id = g.talep_id AND x.asama = g.asama
    JOIN public.talepler t ON t.talep_id = g.talep_id
    LEFT JOIN public.urunler u ON u.urun_id = t.urun_id
    WHERE g.durum IN ('hazirlaniyor', 'revizyon_bekliyor', 'inceleme_bekliyor')
  LOOP
    IF r.durum IN ('hazirlaniyor', 'revizyon_bekliyor') AND r.atanan_iu_id IS NOT NULL THEN
      PERFORM public.uretim_bildirim_yaz(
        r.atanan_iu_id, r.uretici_id, r.asama, r.gorev_id,
        r.talep_id, r.gorev_id,
        CASE r.durum
          WHEN 'revizyon_bekliyor' THEN 'Revizyon görevi: ' || r.icerik_adi
          ELSE 'Üretim görevi: ' || r.icerik_adi
        END
      );
    ELSIF r.durum = 'inceleme_bekliyor' THEN
      PERFORM public.uretim_bildirim_yaz(
        r.uretici_id, r.atanan_iu_id, 'talep', r.talep_id,
        r.talep_id, r.gorev_id,
        CASE r.asama
          WHEN 'senaryo' THEN 'Senaryo inceleme bekliyor: '
          WHEN 'video' THEN 'Video inceleme bekliyor: '
          ELSE 'Soru seti inceleme bekliyor: '
        END || r.icerik_adi
      );
    END IF;
  END LOOP;
END;
$bildirim_kur$;

COMMIT;

-- Tek sonuç tablosu. SONUÇ=TEMİZ değilse kod dağıtımına geçilmez.
WITH kontroller AS (
  SELECT 1 AS sira, 'GEÇİŞ GÖREVİ'::text AS kontrol,
         count(*)::bigint AS deger,
         'Eski zincirden görev modeline alınan aşama'::text AS detay
  FROM _uretim_gecis_gorevleri
  UNION ALL
  SELECT 2, 'MEVCUT GÖREVLİ TALEP', count(DISTINCT g.talep_id),
         'Önceden görev modeli bulunan ve korunarak atlanan talep'
  FROM public.uretim_gorevleri g
  WHERE NOT EXISTS (SELECT 1 FROM _uretim_gecis_gorevleri x WHERE x.talep_id = g.talep_id)
  UNION ALL
  SELECT 3, 'ÜRÜN HAVUZU', count(*), 'Aktif IU/ürün ilişkisi'
  FROM public.iu_urun_atamalari WHERE aktif_mi IS TRUE
  UNION ALL
  SELECT 4, 'GENEL HAVUZ', count(*), 'Aktif IU/eğitim türü ilişkisi'
  FROM public.iu_genel_atamalari WHERE aktif_mi IS TRUE
  UNION ALL
  SELECT 5, 'EKSİK GÖREV', count(*), 'Beklenen geçiş görevi bulunamadı'
  FROM _uretim_gecis_gorevleri x
  WHERE NOT EXISTS (
    SELECT 1 FROM public.uretim_gorevleri g
    WHERE g.talep_id = x.talep_id AND g.asama = x.asama
  )
  UNION ALL
  SELECT 6, 'DURUM UYUMSUZLUĞU', count(*), 'Geçiş anlık görüntüsüyle görev durumu farklı'
  FROM _uretim_gecis_gorevleri x
  JOIN public.uretim_gorevleri g ON g.talep_id = x.talep_id AND g.asama = x.asama
  WHERE g.durum IS DISTINCT FROM x.durum
     OR g.atanan_iu_id IS DISTINCT FROM x.atanan_iu_id
  UNION ALL
  SELECT 7, 'AKTİF ÇAKIŞMA', count(*), 'Aynı talepte birden çok aktif görev'
  FROM (
    SELECT talep_id
    FROM public.uretim_gorevleri
    WHERE durum IN ('atama_bekliyor', 'hazirlaniyor', 'inceleme_bekliyor', 'revizyon_bekliyor')
    GROUP BY talep_id
    HAVING count(*) > 1
  ) c
  UNION ALL
  SELECT 8, 'SAHİPSİZ İLERLEMİŞ GÖREV', count(*), 'Atama bekleme/iptal dışındaki görevin IU sahibi yok'
  FROM public.uretim_gorevleri
  WHERE atanan_iu_id IS NULL AND durum NOT IN ('atama_bekliyor', 'iptal')
), sonuc AS (
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM kontroller WHERE kontrol IN (
      'EKSİK GÖREV', 'DURUM UYUMSUZLUĞU', 'AKTİF ÇAKIŞMA', 'SAHİPSİZ İLERLEMİŞ GÖREV'
    ) AND deger <> 0
  ) THEN 'HATALI' ELSE 'TEMİZ' END AS deger
)
SELECT sira, kontrol, deger::text, detay
FROM kontroller
UNION ALL
SELECT 99, 'SONUÇ', sonuc.deger, 'Kod temizliğine geçiş kararı'
FROM sonuc
ORDER BY sira;
