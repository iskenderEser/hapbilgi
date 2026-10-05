-- YALNIZ GÖRÜNÜM TESTİ: E-Club Takımım > Hediye Takibi.
-- Hedef UTT: 765b6890-183f-4518-b887-07003ff5cdc7
--
-- Önce eclub_hediye_takip_test_verisi_onkontrol.sql çalıştırılmalıdır.
-- Bu paket:
--   * hedef UTT için iki sabit test eczanesi oluşturur ve mevcut test eczanesiyle birlikte kullanır,
--   * mevcut firmanın üç farklı uygun ürün/yayınını kullanır; ürün veya yayın ana kaydı üretmez,
--   * ürün ve talep için sistemin kalıcı görünen kimliklerini taşıyan gerçek yayını kullanır,
--   * gerçek onay/teslimat RPC'lerini çağırmaz,
--   * uygulama içi bildirim oluşturmaz,
--   * outbox örneklerini worker'ın sahiplenemeyeceği şekilde kapalı oluşturur,
--   * sekiz sabit talep UUID'si sayesinde tekrar çalıştırılabilir.
--
-- Temizlik: scripts/sql/eclub_hediye_takip_test_verisi_temizle.sql

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('hapbilgi-eclub-hediye-takip-gorunum-test-v1', 0)
);

DO $test$
DECLARE
  v_utt_id constant uuid := '765b6890-183f-4518-b887-07003ff5cdc7'::uuid;
  v_test_talep_idleri constant uuid[] := ARRAY[
    'e1100000-0000-4000-8000-000000000001'::uuid,
    'e1100000-0000-4000-8000-000000000002'::uuid,
    'e1100000-0000-4000-8000-000000000003'::uuid,
    'e1100000-0000-4000-8000-000000000004'::uuid,
    'e1100000-0000-4000-8000-000000000005'::uuid,
    'e1100000-0000-4000-8000-000000000006'::uuid,
    'e1100000-0000-4000-8000-000000000007'::uuid,
    'e1100000-0000-4000-8000-000000000008'::uuid
  ];
  v_test_glnleri constant text[] := ARRAY['1119000000001', '1119000000002'];
  v_firma_id uuid;
  v_takim_id uuid;
  v_bolge_id uuid;
  v_eczane_idleri uuid[];
  v_eczaci_idleri uuid[];
  v_eczaci_epostalari text[];
  v_yayin_idleri uuid[];
  v_bm_idleri uuid[];
  v_bm_id uuid;
  v_tm_idleri uuid[];
  v_tm_id uuid;
  v_depo_snapshotlari jsonb[];
  v_kaynak_eczane_id uuid;
  v_kaynak_eczaci_id uuid;
  v_kaynak_depo_idleri uuid[];
  v_simdi timestamptz := clock_timestamp();
BEGIN
  IF to_regclass('public.eclub_store_cek_talepleri') IS NULL
     OR to_regclass('public.eclub_siparis_utt_onaylari') IS NULL
     OR to_regclass('public.eclub_cek_teslimat_outbox') IS NULL THEN
    RAISE EXCEPTION 'Hediye Takibi tabloları eksik; test verisi eklenmedi.';
  END IF;

  SELECT k.firma_id, k.takim_id, k.bolge_id
  INTO v_firma_id, v_takim_id, v_bolge_id
  FROM public.kullanicilar k
  JOIN public.firmalar f ON f.firma_id = k.firma_id
  WHERE k.kullanici_id = v_utt_id
    AND lower(k.rol) IN ('utt', 'kd_utt')
    AND k.aktif_mi = true
    AND f.aktif = true
    AND f.eclub_aktif = true
    AND f.eclub_store_aktif = true;

  IF v_firma_id IS NULL THEN
    RAISE EXCEPTION 'Hedef UTT veya açık E-Club Hediye Çeki firması bulunamadı; hiçbir kayıt eklenmedi.';
  END IF;

  -- Var olan uygun test eczanesi, iki yeni test eczanesinin eczacı ve depo
  -- iskeleti için kaynak olur. Yeni Auth hesabı veya gerçek kişi üretilmez.
  SELECT ef.eczane_id, kisi.kisi_id
  INTO v_kaynak_eczane_id, v_kaynak_eczaci_id
  FROM public.eclub_utt_eczane ue
  JOIN public.eclub_eczane_firma ef
    ON ef.id = ue.eczane_firma_id
   AND ef.firma_id = v_firma_id
   AND ef.aktif_mi = true
  JOIN public.eclub_eczaneler e ON e.eczane_id = ef.eczane_id
  JOIN public.eclub_eczane_master em
    ON em.gln = e.gln
   AND em.kaynak = 'test'
   AND em.gln LIKE '111%'
   AND NOT (em.gln = ANY(v_test_glnleri))
  JOIN public.eclub_kisi_eczane ke
    ON ke.eczane_id = ef.eczane_id
   AND ke.aktif_mi = true
  JOIN public.eclub_kisiler kisi
    ON kisi.kisi_id = ke.kisi_id
   AND lower(kisi.rol) = 'eczaci'
   AND kisi.auth_user_id IS NOT NULL
   AND nullif(btrim(kisi.eposta), '') IS NOT NULL
  WHERE ue.utt_id = v_utt_id
    AND ue.aktif_mi = true
    AND public.eclub_eczane_depolari_hazir(ef.eczane_id)
    AND (
      SELECT count(*)
      FROM public.eclub_kisi_eczane tek_ke
      JOIN public.eclub_kisiler tek_kisi ON tek_kisi.kisi_id = tek_ke.kisi_id
      WHERE tek_ke.eczane_id = ef.eczane_id
        AND tek_ke.aktif_mi = true
        AND lower(tek_kisi.rol) = 'eczaci'
        AND tek_kisi.auth_user_id IS NOT NULL
        AND nullif(btrim(tek_kisi.eposta), '') IS NOT NULL
    ) = 1
  ORDER BY em.eczane_adi, ef.eczane_id
  LIMIT 1;

  IF v_kaynak_eczane_id IS NULL OR v_kaynak_eczaci_id IS NULL THEN
    RAISE EXCEPTION 'Yeni test eczanelerine kaynak olacak uygun mevcut test eczanesi bulunamadı; hiçbir kayıt eklenmedi.';
  END IF;

  SELECT array_agg(d.depo_sube_id ORDER BY d.depo_sube_id)
  INTO v_kaynak_depo_idleri
  FROM public.eclub_eczane_depo_tercihleri d
  WHERE d.eczane_id = v_kaynak_eczane_id;

  IF coalesce(cardinality(v_kaynak_depo_idleri), 0) = 0 THEN
    RAISE EXCEPTION 'Kaynak test eczanesinin depo tercihi bulunamadı; hiçbir kayıt eklenmedi.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.eclub_eczane_master em
    WHERE em.gln = ANY(v_test_glnleri)
      AND (
        em.kaynak IS DISTINCT FROM 'test'
        OR em.onay_durumu IS DISTINCT FROM 'onayli'
        OR em.eczane_adi IS DISTINCT FROM CASE em.gln
          WHEN '1119000000001' THEN 'Hediye Takibi Test Eczanesi 002'
          WHEN '1119000000002' THEN 'Hediye Takibi Test Eczanesi 003'
        END
      )
  ) THEN
    RAISE EXCEPTION 'Hediye Takibi için ayrılan test GLNlerinden biri test kapsamı dışında kullanılıyor; hiçbir kayıt eklenmedi.';
  END IF;

  INSERT INTO public.eclub_eczane_master (
    gln, eczane_adi, il, ilce, kaynak, onay_durumu, ekleyen_utt_id
  ) VALUES
    (v_test_glnleri[1], 'Hediye Takibi Test Eczanesi 002', 'Test', 'E-Club', 'test', 'onayli', v_utt_id),
    (v_test_glnleri[2], 'Hediye Takibi Test Eczanesi 003', 'Test', 'E-Club', 'test', 'onayli', v_utt_id)
  ON CONFLICT (gln) DO UPDATE
  SET eczane_adi = EXCLUDED.eczane_adi,
      il = EXCLUDED.il,
      ilce = EXCLUDED.ilce,
      kaynak = EXCLUDED.kaynak,
      onay_durumu = EXCLUDED.onay_durumu,
      ekleyen_utt_id = EXCLUDED.ekleyen_utt_id;

  INSERT INTO public.eclub_eczaneler (gln)
  SELECT gln
  FROM unnest(v_test_glnleri) AS test_gln(gln)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.eclub_eczaneler e WHERE e.gln = test_gln.gln
  );

  INSERT INTO public.eclub_eczane_firma (
    eczane_id, firma_id, baglayan_utt_id, aktif_mi
  )
  SELECT e.eczane_id, v_firma_id, v_utt_id, true
  FROM public.eclub_eczaneler e
  WHERE e.gln = ANY(v_test_glnleri)
    AND NOT EXISTS (
      SELECT 1
      FROM public.eclub_eczane_firma ef
      WHERE ef.eczane_id = e.eczane_id AND ef.firma_id = v_firma_id
    );

  UPDATE public.eclub_eczane_firma ef
  SET aktif_mi = true,
      baglayan_utt_id = v_utt_id
  FROM public.eclub_eczaneler e
  WHERE e.eczane_id = ef.eczane_id
    AND e.gln = ANY(v_test_glnleri)
    AND ef.firma_id = v_firma_id;

  INSERT INTO public.eclub_utt_eczane (
    eczane_firma_id, utt_id, aktif_mi, bitis_tarihi
  )
  SELECT ef.id, v_utt_id, true, NULL
  FROM public.eclub_eczane_firma ef
  JOIN public.eclub_eczaneler e ON e.eczane_id = ef.eczane_id
  WHERE e.gln = ANY(v_test_glnleri)
    AND ef.firma_id = v_firma_id
  ON CONFLICT (eczane_firma_id, utt_id) DO UPDATE
  SET aktif_mi = true,
      bitis_tarihi = NULL;

  INSERT INTO public.eclub_eczane_depo_tercihleri (
    eczane_id, depo_sube_id, kaydeden_utt_id
  )
  SELECT e.eczane_id, depo.depo_sube_id, v_utt_id
  FROM public.eclub_eczaneler e
  CROSS JOIN unnest(v_kaynak_depo_idleri) AS depo(depo_sube_id)
  WHERE e.gln = ANY(v_test_glnleri)
  ON CONFLICT (eczane_id, depo_sube_id) DO NOTHING;

  INSERT INTO public.eclub_kisi_eczane (kisi_id, eczane_id, aktif_mi)
  SELECT v_kaynak_eczaci_id, e.eczane_id, true
  FROM public.eclub_eczaneler e
  WHERE e.gln = ANY(v_test_glnleri)
    AND NOT EXISTS (
      SELECT 1
      FROM public.eclub_kisi_eczane ke
      WHERE ke.kisi_id = v_kaynak_eczaci_id AND ke.eczane_id = e.eczane_id
    );

  UPDATE public.eclub_kisi_eczane ke
  SET aktif_mi = true,
      bitis_tarihi = NULL
  FROM public.eclub_eczaneler e
  WHERE e.eczane_id = ke.eczane_id
    AND e.gln = ANY(v_test_glnleri)
    AND ke.kisi_id = v_kaynak_eczaci_id;

  WITH aday AS (
    SELECT
      ef.eczane_id,
      em.eczane_adi,
      ana.kisi_id AS eczaci_id,
      ana.eposta AS eczaci_eposta,
      coalesce((
        SELECT jsonb_agg(
          jsonb_build_object('depo_sube_id', d.depo_sube_id)
          ORDER BY d.depo_sube_id
        )
        FROM public.eclub_eczane_depo_tercihleri d
        WHERE d.eczane_id = ef.eczane_id
      ), '[]'::jsonb) AS depo_snapshot
    FROM public.eclub_utt_eczane ue
    JOIN public.eclub_eczane_firma ef
      ON ef.id = ue.eczane_firma_id
     AND ef.firma_id = v_firma_id
     AND ef.aktif_mi = true
    JOIN public.eclub_eczaneler e ON e.eczane_id = ef.eczane_id
    JOIN public.eclub_eczane_master em
      ON em.gln = e.gln
     AND em.kaynak = 'test'
     AND em.gln LIKE '111%'
    JOIN LATERAL (
      SELECT kisi.kisi_id, btrim(kisi.eposta) AS eposta
      FROM public.eclub_kisi_eczane ke
      JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
      WHERE ke.eczane_id = ef.eczane_id
        AND ke.aktif_mi = true
        AND lower(kisi.rol) = 'eczaci'
        AND kisi.auth_user_id IS NOT NULL
        AND nullif(btrim(kisi.eposta), '') IS NOT NULL
    ) ana ON true
    WHERE ue.utt_id = v_utt_id
      AND ue.aktif_mi = true
      AND public.eclub_eczane_depolari_hazir(ef.eczane_id)
      AND (
        SELECT count(*)
        FROM public.eclub_kisi_eczane ke
        JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
        WHERE ke.eczane_id = ef.eczane_id
          AND ke.aktif_mi = true
          AND lower(kisi.rol) = 'eczaci'
          AND kisi.auth_user_id IS NOT NULL
          AND nullif(btrim(kisi.eposta), '') IS NOT NULL
      ) = 1
      AND EXISTS (
        SELECT 1
        FROM public.eclub_kisi_eczane ke
        JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
        WHERE ke.eczane_id = ef.eczane_id
          AND ke.aktif_mi = true
          AND kisi.auth_user_id IS NOT NULL
      )
    ORDER BY em.eczane_adi, ef.eczane_id
    LIMIT 3
  )
  SELECT
    array_agg(eczane_id ORDER BY eczane_adi, eczane_id),
    array_agg(eczaci_id ORDER BY eczane_adi, eczane_id),
    array_agg(eczaci_eposta ORDER BY eczane_adi, eczane_id),
    array_agg(depo_snapshot ORDER BY eczane_adi, eczane_id)
  INTO v_eczane_idleri, v_eczaci_idleri, v_eczaci_epostalari, v_depo_snapshotlari
  FROM aday;

  IF coalesce(cardinality(v_eczane_idleri), 0) <> 3 THEN
    RAISE EXCEPTION 'Deposu, ana eczacısı ve push hesabı hazır üç bağlı test eczanesi gerekli; bulunan: %. Hiçbir kayıt eklenmedi.', coalesce(cardinality(v_eczane_idleri), 0);
  END IF;

  SELECT array_agg(aday.yayin_id ORDER BY aday.yayin_id)
  INTO v_yayin_idleri
  FROM (
    SELECT urun_yayini.yayin_id
    FROM (
      SELECT DISTINCT ON (k.urun_id)
        y.yayin_id,
        u.gorunen_urun_id
      FROM public.yayin_yonetimi y
      JOIN public.v_yayin_kunye k ON k.yayin_id = y.yayin_id
      JOIN public.urunler u ON u.urun_id = k.urun_id
      JOIN public.firmalar f ON f.firma_id = k.firma_id
      WHERE k.firma_id = v_firma_id
        AND y.durum = 'yayinda'
        AND y.cek_karsiligi_var_mi = true
        AND public.eclub_store_barem_gecerli(y.barem_tablosu)
        AND nullif(btrim(u.gorunen_urun_id), '') IS NOT NULL
        AND k.talep_no IS NOT NULL
        AND nullif(btrim(f.firma_adi), '') IS NOT NULL
      ORDER BY k.urun_id, y.yayin_id
    ) urun_yayini
    ORDER BY urun_yayini.gorunen_urun_id, urun_yayini.yayin_id
    LIMIT 3
  ) aday;

  IF coalesce(cardinality(v_yayin_idleri), 0) <> 3 THEN
    RAISE EXCEPTION 'Hedef firmada görünen ürün/talep kimlikleri hazır üç geçerli ve yayında Çekli Puan yayını gerekli; bulunan: %. Hiçbir kayıt eklenmedi.', coalesce(cardinality(v_yayin_idleri), 0);
  END IF;

  SELECT array_agg(k.kullanici_id ORDER BY k.kullanici_id)
  INTO v_bm_idleri
  FROM public.kullanicilar k
  WHERE k.firma_id = v_firma_id
    AND k.takim_id IS NOT DISTINCT FROM v_takim_id
    AND k.bolge_id IS NOT DISTINCT FROM v_bolge_id
    AND lower(k.rol) = 'bm'
    AND k.aktif_mi = true;

  IF coalesce(cardinality(v_bm_idleri), 0) <> 1 THEN
    RAISE EXCEPTION 'Hedef UTT için tam olarak bir aktif BM gerekli; bulunan: %.', coalesce(cardinality(v_bm_idleri), 0);
  END IF;
  v_bm_id := v_bm_idleri[1];

  SELECT array_agg(k.kullanici_id ORDER BY k.kullanici_id)
  INTO v_tm_idleri
  FROM public.kullanicilar k
  WHERE k.firma_id = v_firma_id
    AND k.takim_id IS NOT DISTINCT FROM v_takim_id
    AND lower(k.rol) = 'tm'
    AND k.aktif_mi = true;

  IF coalesce(cardinality(v_tm_idleri), 0) <> 1 THEN
    RAISE EXCEPTION 'Hedef takım için tam olarak bir aktif TM gerekli; bulunan: %.', coalesce(cardinality(v_tm_idleri), 0);
  END IF;
  v_tm_id := v_tm_idleri[1];

  IF EXISTS (
    SELECT 1
    FROM unnest(v_depo_snapshotlari) AS snapshots(snapshot)
    WHERE jsonb_array_length(snapshot) = 0
  ) THEN
    RAISE EXCEPTION 'Test eczanelerinden birinin depo snapshotı boş; hiçbir kayıt eklenmedi.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.eclub_store_cek_talepleri t
    WHERE t.talep_id = ANY(v_test_talep_idleri)
      AND (
        t.utt_id IS DISTINCT FROM v_utt_id
        OR NOT (t.eczane_id = ANY(v_eczane_idleri))
        OR t.donem_kodu NOT IN (
          '2099-P1', '2099-P2', '2099-P3', '2099-P4', '2099-P5', '2099-P6',
          '2100-P1', '2100-P2'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Sabit test UUIDlerinden biri test kapsamı dışında kullanılıyor; hiçbir kayıt değiştirilmedi.';
  END IF;

  -- Önceki çalıştırmanın yalnız sabit test kayıtlarını çocuklardan ebeveyne temizle.
  DELETE FROM public.eclub_bildirimler WHERE kayit_turu = 'cek' AND kayit_id = ANY(v_test_talep_idleri);
  DELETE FROM public.eclub_siparis_utt_onaylari WHERE talep_id = ANY(v_test_talep_idleri);
  DELETE FROM public.eclub_cek_teslimat_outbox WHERE talep_id = ANY(v_test_talep_idleri);
  DELETE FROM public.eclub_store_puan_devirleri
  WHERE kaynak_talep_id = ANY(v_test_talep_idleri)
     OR kullanilan_talep_id = ANY(v_test_talep_idleri);
  DELETE FROM public.eclub_store_cek_talepleri WHERE talep_id = ANY(v_test_talep_idleri);

  INSERT INTO public.eclub_store_cek_talepleri (
    talep_id, eczane_id, firma_id, yayin_id, talep_eden_kisi_id,
    toplanan_puan, talep_edilen_cek_tl, siparis_tipi,
    siparis_verildi_mi, siparis_adet, siparis_mal_fazlasi,
    durum, utt_id, bm_id, bm_onay_tarihi, tm_id, tm_onay_tarihi,
    cek_kodu, cek_gonderim_tarihi, devreden_puan, donem_kodu,
    created_at, guncellenme_at
  ) VALUES
    (v_test_talep_idleri[1], v_eczane_idleri[1], v_firma_id, v_yayin_idleri[1], v_eczaci_idleri[1],
      220, 220.00, 'siparissiz_cek', false, 0, 0,
      'beklemede', v_utt_id, NULL, NULL, NULL, NULL,
      NULL, NULL, 0, '2099-P1', v_simdi - interval '8 days', v_simdi - interval '8 days'),
    (v_test_talep_idleri[2], v_eczane_idleri[2], v_firma_id, v_yayin_idleri[2], v_eczaci_idleri[2],
      400, 400.00, 'satis_sartli', true, 20, 3,
      'beklemede', v_utt_id, NULL, NULL, NULL, NULL,
      NULL, NULL, 0, '2099-P2', v_simdi - interval '7 days', v_simdi - interval '7 days'),
    (v_test_talep_idleri[3], v_eczane_idleri[3], v_firma_id, v_yayin_idleri[3], v_eczaci_idleri[3],
      500, 500.00, 'satis_sartli', true, 20, 3,
      'bm_onayinda', v_utt_id, v_bm_id, NULL, NULL, NULL,
      NULL, NULL, 25, '2099-P3', v_simdi - interval '6 days', v_simdi - interval '5 days'),
    (v_test_talep_idleri[4], v_eczane_idleri[1], v_firma_id, v_yayin_idleri[2], v_eczaci_idleri[1],
      650, 650.00, 'satis_sartli', true, 50, 25,
      'tm_onayinda', v_utt_id, v_bm_id, v_simdi - interval '4 days', v_tm_id, NULL,
      NULL, NULL, 0, '2099-P4', v_simdi - interval '5 days', v_simdi - interval '4 days'),
    (v_test_talep_idleri[5], v_eczane_idleri[2], v_firma_id, v_yayin_idleri[3], v_eczaci_idleri[2],
      300, 300.00, 'siparissiz_cek', false, 0, 0,
      'onaylandi', v_utt_id, v_bm_id, v_simdi - interval '3 days', v_tm_id, v_simdi - interval '2 days',
      NULL, NULL, 0, '2099-P5', v_simdi - interval '4 days', v_simdi - interval '2 days'),
    (v_test_talep_idleri[6], v_eczane_idleri[3], v_firma_id, v_yayin_idleri[1], v_eczaci_idleri[3],
      350, 350.00, 'siparissiz_cek', false, 0, 0,
      'teslimat_bekliyor', v_utt_id, v_bm_id, v_simdi - interval '3 days', v_tm_id, v_simdi - interval '2 days',
      'HB-TEST-TESLIMAT-BEKLIYOR', NULL, 0, '2099-P6', v_simdi - interval '3 days', v_simdi - interval '1 day'),
    (v_test_talep_idleri[7], v_eczane_idleri[1], v_firma_id, v_yayin_idleri[3], v_eczaci_idleri[1],
      450, 450.00, 'siparissiz_cek', false, 0, 0,
      'cek_kodlari_gonderildi', v_utt_id, v_bm_id, v_simdi - interval '3 days', v_tm_id, v_simdi - interval '2 days',
      'HB-TEST-TAMAMLANDI', v_simdi - interval '12 hours', 0, '2100-P1', v_simdi - interval '2 days', v_simdi - interval '12 hours'),
    (v_test_talep_idleri[8], v_eczane_idleri[2], v_firma_id, v_yayin_idleri[1], v_eczaci_idleri[2],
      280, 280.00, 'satis_sartli', true, 10, 1,
      'iptal', v_utt_id, NULL, NULL, NULL, NULL,
      NULL, NULL, 0, '2100-P2', v_simdi - interval '1 day', v_simdi - interval '6 hours');

  -- Sipariş Takibi: bir bekleyen, iki UTT onaylı ve bir iptal kayıt oluşur.
  INSERT INTO public.eclub_siparis_utt_onaylari (
    talep_id, utt_id, onay_tarihi, depo_tercihleri_snapshot
  ) VALUES
    (v_test_talep_idleri[3], v_utt_id, v_simdi - interval '5 days', v_depo_snapshotlari[3]),
    (v_test_talep_idleri[4], v_utt_id, v_simdi - interval '4 days', v_depo_snapshotlari[1]);

  -- Teslimat bekleyen örneği: e-posta tamam, push bekliyor. Push satırları
  -- deneme_sayisi=max_deneme olduğundan worker tarafından ASLA sahiplenilemez.
  INSERT INTO public.eclub_cek_teslimat_outbox (
    olay_id, talep_id, kanal, alici_kisi_id, alici_eposta, payload,
    durum, deneme_sayisi, max_deneme, sonraki_deneme_at,
    tamamlanma_at, created_at, guncellenme_at
  ) VALUES (
    gen_random_uuid(), v_test_talep_idleri[6], 'eposta', v_eczaci_idleri[3], v_eczaci_epostalari[3],
    jsonb_build_object('talep_id', v_test_talep_idleri[6], 'eczane_id', v_eczane_idleri[3],
      'cek_kodu', 'HB-TEST-TESLIMAT-BEKLIYOR', 'cek_tutari_tl', 350, 'alici_adi', 'Görünüm Testi'),
    'tamamlandi', 1, 1, '2099-12-31 00:00:00+03',
    v_simdi - interval '1 day', v_simdi - interval '1 day', v_simdi - interval '1 day'
  );

  INSERT INTO public.eclub_cek_teslimat_outbox (
    olay_id, talep_id, kanal, alici_kisi_id, alici_eposta, payload,
    durum, deneme_sayisi, max_deneme, sonraki_deneme_at,
    tamamlanma_at, created_at, guncellenme_at
  )
  SELECT
    gen_random_uuid(), v_test_talep_idleri[6], 'push', kisi.kisi_id, NULL,
    jsonb_build_object('talep_id', v_test_talep_idleri[6], 'eczane_id', v_eczane_idleri[3],
      'cek_kodu', 'HB-TEST-TESLIMAT-BEKLIYOR', 'cek_tutari_tl', 350),
    'bekliyor', 1, 1, '2099-12-31 00:00:00+03',
    NULL, v_simdi - interval '1 day', v_simdi - interval '1 day'
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
  WHERE ke.eczane_id = v_eczane_idleri[3]
    AND ke.aktif_mi = true
    AND kisi.auth_user_id IS NOT NULL;

  -- Tamamlanmış örnek: tek ana eczacı e-postası ve bütün aktif hesap pushları tamamlandı.
  INSERT INTO public.eclub_cek_teslimat_outbox (
    olay_id, talep_id, kanal, alici_kisi_id, alici_eposta, payload,
    durum, deneme_sayisi, max_deneme, sonraki_deneme_at,
    tamamlanma_at, created_at, guncellenme_at
  ) VALUES (
    gen_random_uuid(), v_test_talep_idleri[7], 'eposta', v_eczaci_idleri[1], v_eczaci_epostalari[1],
    jsonb_build_object('talep_id', v_test_talep_idleri[7], 'eczane_id', v_eczane_idleri[1],
      'cek_kodu', 'HB-TEST-TAMAMLANDI', 'cek_tutari_tl', 450, 'alici_adi', 'Görünüm Testi'),
    'tamamlandi', 1, 1, '2099-12-31 00:00:00+03',
    v_simdi - interval '12 hours', v_simdi - interval '1 day', v_simdi - interval '12 hours'
  );

  INSERT INTO public.eclub_cek_teslimat_outbox (
    olay_id, talep_id, kanal, alici_kisi_id, alici_eposta, payload,
    durum, deneme_sayisi, max_deneme, sonraki_deneme_at,
    tamamlanma_at, created_at, guncellenme_at
  )
  SELECT
    gen_random_uuid(), v_test_talep_idleri[7], 'push', kisi.kisi_id, NULL,
    jsonb_build_object('talep_id', v_test_talep_idleri[7], 'eczane_id', v_eczane_idleri[1],
      'cek_kodu', 'HB-TEST-TAMAMLANDI', 'cek_tutari_tl', 450),
    'tamamlandi', 1, 1, '2099-12-31 00:00:00+03',
    v_simdi - interval '12 hours', v_simdi - interval '1 day', v_simdi - interval '12 hours'
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler kisi ON kisi.kisi_id = ke.kisi_id
  WHERE ke.eczane_id = v_eczane_idleri[1]
    AND ke.aktif_mi = true
    AND kisi.auth_user_id IS NOT NULL;

  RAISE NOTICE 'Hediye Takibi görünüm testi hazır: UTT %, 3 eczane %, 3 yayın %, 8 talep.',
    v_utt_id, v_eczane_idleri, v_yayin_idleri;
END;
$test$;

COMMIT;

SELECT
  t.talep_id AS test_talep_id,
  em.eczane_adi,
  u.urun_adi,
  u.gorunen_urun_id,
  concat_ws('_', f.firma_adi, k.talep_no::text) AS gorunen_talep_id,
  t.donem_kodu,
  t.durum,
  t.siparis_tipi,
  t.siparis_verildi_mi,
  t.toplanan_puan,
  t.talep_edilen_cek_tl,
  CASE WHEN s.talep_id IS NULL THEN 'UTT sipariş onayı yok' ELSE 'UTT siparişi onayladı' END AS siparis_takip_durumu,
  count(o.outbox_id) FILTER (WHERE o.kanal = 'eposta') AS eposta_isi,
  count(o.outbox_id) FILTER (WHERE o.kanal = 'push') AS push_isi
FROM public.eclub_store_cek_talepleri t
JOIN public.eclub_eczaneler e ON e.eczane_id = t.eczane_id
JOIN public.eclub_eczane_master em ON em.gln = e.gln
JOIN public.v_yayin_kunye k ON k.yayin_id = t.yayin_id
JOIN public.urunler u ON u.urun_id = k.urun_id
JOIN public.firmalar f ON f.firma_id = k.firma_id
LEFT JOIN public.eclub_siparis_utt_onaylari s ON s.talep_id = t.talep_id
LEFT JOIN public.eclub_cek_teslimat_outbox o ON o.talep_id = t.talep_id
WHERE t.talep_id IN (
  'e1100000-0000-4000-8000-000000000001'::uuid,
  'e1100000-0000-4000-8000-000000000002'::uuid,
  'e1100000-0000-4000-8000-000000000003'::uuid,
  'e1100000-0000-4000-8000-000000000004'::uuid,
  'e1100000-0000-4000-8000-000000000005'::uuid,
  'e1100000-0000-4000-8000-000000000006'::uuid,
  'e1100000-0000-4000-8000-000000000007'::uuid,
  'e1100000-0000-4000-8000-000000000008'::uuid
)
GROUP BY t.talep_id, em.eczane_adi, u.urun_adi, u.gorunen_urun_id, f.firma_adi, k.talep_no,
  t.donem_kodu, t.durum, t.siparis_tipi,
  t.siparis_verildi_mi, t.toplanan_puan, t.talep_edilen_cek_tl, s.talep_id
ORDER BY t.created_at;
