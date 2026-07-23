-- scripts/sql/toplu_test_sil.sql
--
-- Talep/Yayın Silme — Adım 2, RPC 3/3 (24.07.2026).
-- Eski app/admin/api/test-verileri-sil route mantığının atomik RPC karşılığı
-- + kural: PUANLI yayınları ve bağlılarını (üretim zinciri + tüketici kayıtları)
-- KORU, gerisini sil. Puansız her şey ve yayına bağlı olmayan ticaret/auth
-- kayıtları eskisi gibi tam silinir. Stok iadesi RPC içine taşındı (atomiklik).
--
-- Korunan küme: P = puanlı yayın_id'ler; PT = zinciri P'ye çıkan talep_id'ler.
-- Yayın-bağlı tablolar yayin_id ∉ P koşuluyla; üretim zinciri talep_id ∉ PT ile;
-- bildirimler (polymorphic) korunanlar hariç silinir. Silme sırası eski route ile
-- aynı kanıtlı çocuk→ebeveyn topolojisi.
--
-- Yetki: fonksiyon içinde YOK; route'ta adminGirisKontrol + service_role çağrısı.
-- KOŞUM: Supabase SQL editöründe bir kez. Yeniden koşum güvenli (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.toplu_test_sil()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_p_yayin        uuid[];  -- puanlı yayınlar
  v_p_talep        uuid[];  -- korunan talepler (P'nin zinciri)
  v_p_senaryo      uuid[];
  v_p_video        uuid[];
  v_p_soru_seti    uuid[];
  v_p_oneri        uuid[];
  v_p_eclub_oneri  uuid[];
  v_p_challenge    uuid[];
BEGIN
  -- 0) Korunan kümeyi hesapla (silmeden ÖNCE).
  v_p_yayin := ARRAY(SELECT yayin_id FROM yayin_yonetimi y WHERE public.yayin_puan_var_mi(y.yayin_id));
  v_p_talep := ARRAY(
    SELECT DISTINCT ss.talep_id
    FROM soru_setleri ss
    JOIN soru_seti_durumu ssd ON ssd.soru_seti_id = ss.soru_seti_id
    JOIN yayin_yonetimi   y   ON y.soru_seti_durum_id = ssd.soru_seti_durum_id
    WHERE y.yayin_id = ANY(v_p_yayin)
  );
  v_p_senaryo     := ARRAY(SELECT senaryo_id   FROM senaryolar   WHERE talep_id = ANY(v_p_talep));
  v_p_video       := ARRAY(SELECT video_id     FROM videolar     WHERE talep_id = ANY(v_p_talep));
  v_p_soru_seti   := ARRAY(SELECT soru_seti_id FROM soru_setleri WHERE talep_id = ANY(v_p_talep));
  v_p_oneri       := ARRAY(SELECT oneri_id     FROM oneri_kayitlari       WHERE yayin_id = ANY(v_p_yayin));
  v_p_eclub_oneri := ARRAY(SELECT oneri_id     FROM eclub_oneri_kayitlari WHERE yayin_id = ANY(v_p_yayin));
  v_p_challenge   := ARRAY(SELECT challenge_id FROM challenge_kayitlari    WHERE yayin_id = ANY(v_p_yayin));

  -- 1) Stok iadesi — siparişler silinmeden ÖNCE (iptal olmayanlar; iki store).
  UPDATE store_urunler u SET stok = u.stok + s.toplam
  FROM (SELECT urun_id, SUM(adet) AS toplam FROM store_siparisler WHERE durum <> 'iptal' GROUP BY urun_id) s
  WHERE u.urun_id = s.urun_id;
  UPDATE eclub_store_urunler u SET stok = u.stok + s.toplam
  FROM (SELECT urun_id, SUM(adet) AS toplam FROM eclub_store_siparisler WHERE durum <> 'iptal' GROUP BY urun_id) s
  WHERE u.urun_id = s.urun_id;

  -- 2) Bildirimler (polymorphic) — korunanlar HARİÇ sil.
  DELETE FROM bildirimler WHERE NOT (
       (kayit_turu = 'talep'     AND kayit_id = ANY(v_p_talep))
    OR (kayit_turu = 'senaryo'   AND kayit_id = ANY(v_p_senaryo))
    OR (kayit_turu = 'video'     AND kayit_id = ANY(v_p_video))
    OR (kayit_turu = 'soru_seti' AND kayit_id = ANY(v_p_soru_seti))
    OR (kayit_turu = 'yayin'     AND kayit_id = ANY(v_p_yayin))
    OR (kayit_turu = 'oneri'     AND kayit_id = ANY(v_p_oneri))
    OR (kayit_turu = 'challenge' AND kayit_id = ANY(v_p_challenge))
  );
  DELETE FROM eclub_bildirimler WHERE NOT (kayit_turu = 'oneri' AND kayit_id = ANY(v_p_eclub_oneri));

  -- 3) En derin çocuklar — puan/kayıp defterleri (yayin_id ∉ P).
  DELETE FROM cc_ileri_sarma_kayitlari     WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM cc_kazanilan_puanlar         WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM cc_yanlis_cevap_kayitlari    WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM challenge_kayip_kayitlari    WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM ileri_sarma_kayitlari        WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM kazanilan_puanlar            WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM oneri_kayip_kayitlari        WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM yanlis_cevap_kayitlari       WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM video_begeniler              WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM video_favoriler              WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eclub_kazanilan_puanlar      WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eclub_yanlis_cevap_kayitlari WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eclub_dogru_cevap_kayitlari  WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eclub_utt_puanlari           WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eclub_oneri_kayip_kayitlari  WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM soru_cevaplari
    WHERE izleme_id IN (SELECT izleme_id FROM izleme_kayitlari WHERE NOT (yayin_id = ANY(v_p_yayin)));
  DELETE FROM eczanem_puan_kayitlari
    WHERE izleme_id IN (SELECT izleme_id FROM eczanem_izleme_kayitlari WHERE NOT (yayin_id = ANY(v_p_yayin)));
  DELETE FROM video_puanlari
    WHERE video_durum_id IN (SELECT vd.video_durum_id FROM video_durumu vd
                             JOIN videolar v ON v.video_id = vd.video_id
                             WHERE NOT (v.talep_id = ANY(v_p_talep)));
  DELETE FROM soru_seti_puanlari
    WHERE soru_seti_durum_id IN (SELECT ssd.soru_seti_durum_id FROM soru_seti_durumu ssd
                                 JOIN soru_setleri ss ON ss.soru_seti_id = ssd.soru_seti_id
                                 WHERE NOT (ss.talep_id = ANY(v_p_talep)));

  -- 4) Yayına bağlı OLMAYAN ticaret/auth — tam sil (eski davranış).
  DELETE FROM eclub_store_siparis_firma_puan WHERE created_at >= '1970-01-01';
  DELETE FROM eclub_store_siparisler         WHERE created_at >= '1970-01-01';
  DELETE FROM eclub_store_adresler           WHERE created_at >= '1970-01-01';
  DELETE FROM eczanem_harcama_kayitlari      WHERE created_at >= '1970-01-01';
  DELETE FROM eczanem_siparisler             WHERE created_at >= '1970-01-01';
  DELETE FROM eczanem_giris_otp              WHERE created_at >= '1970-01-01';
  DELETE FROM eczanem_davetler               WHERE created_at >= '1970-01-01';
  DELETE FROM store_puan_harcamalari         WHERE created_at >= '1970-01-01';
  DELETE FROM store_siparisler               WHERE created_at >= '1970-01-01';
  DELETE FROM store_adresler                 WHERE created_at >= '1970-01-01';

  -- 5) Orta katman — izleme'ler (çocuklarından sonra), gönderim, öneri, challenge.
  DELETE FROM eclub_izleme_kayitlari   WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eclub_oneri_kayitlari    WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eczanem_izleme_kayitlari WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eczanem_gonderimler          WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM eczanem_eczane_gonderimleri  WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM cc_izleme_kayitlari      WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM izleme_kayitlari         WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM challenge_kayitlari      WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM oneri_kayitlari          WHERE NOT (yayin_id = ANY(v_p_yayin));
  DELETE FROM yayin_tekrar_kayitlari   WHERE NOT (yayin_id = ANY(v_p_yayin));

  -- 6) Yayın.
  DELETE FROM yayin_yonetimi WHERE NOT (yayin_id = ANY(v_p_yayin));

  -- 7) Üretim zinciri (çocuk→ebeveyn; talep_id ∉ PT).
  DELETE FROM soru_seti_durumu WHERE soru_seti_id IN (SELECT soru_seti_id FROM soru_setleri WHERE NOT (talep_id = ANY(v_p_talep)));
  DELETE FROM soru_setleri     WHERE NOT (talep_id = ANY(v_p_talep));
  DELETE FROM video_durumu     WHERE video_id IN (SELECT video_id FROM videolar WHERE NOT (talep_id = ANY(v_p_talep)));
  DELETE FROM videolar         WHERE NOT (talep_id = ANY(v_p_talep));
  DELETE FROM senaryo_durumu   WHERE senaryo_id IN (SELECT senaryo_id FROM senaryolar WHERE NOT (talep_id = ANY(v_p_talep)));
  DELETE FROM senaryolar       WHERE NOT (talep_id = ANY(v_p_talep));
  DELETE FROM talepler         WHERE NOT (talep_id = ANY(v_p_talep));

  RETURN jsonb_build_object(
    'durum', 'silindi',
    'korunan_yayin', COALESCE(array_length(v_p_yayin, 1), 0),
    'korunan_talep', COALESCE(array_length(v_p_talep, 1), 0)
  );
END;
$fonk$;

GRANT EXECUTE ON FUNCTION public.toplu_test_sil() TO service_role;

-- Doğrulama (GERİ ALINAMAZ — yalnız test ortamında):
-- SELECT public.toplu_test_sil();
