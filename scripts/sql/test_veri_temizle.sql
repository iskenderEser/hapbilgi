-- scripts/sql/test_veri_temizle.sql
--
-- Toplu/Tekil Silme — Aşama 1 (docs/toplu_tekil_silme_is_plani.md).
-- Sıfırdan yazıldı. Test ortamında ÜRETİLEN veriyi uçtan uca, iz bırakmadan siler;
-- iskelet (kimlik + master + ürün içeriği) ve BİTMİŞ siparişler her modda korunur.
--
-- Tek fonksiyon, üç mod (p_mod):
--   'tum'   → tüm firmalar (filtresiz)
--   'firma' → tek firma (p_firma_id) — kapsam: talepler.firma_id (ürünsüz talepler
--             de kapsamdadır: medikal/İK içeriği ürün taşımaz)
--   'tekil' → tek talebin yayınları (p_talep_id)
--
-- BİTMİŞ sipariş korunur: mağazalar durum='teslim_edildi', eczanem durum='onaylandi'.
-- Stok: silinen (iptal olmayan, yarım kalmış) siparişlerin stoğu ürünlere geri eklenir.
-- Özet cache (cc_ligi_ozet, hb_ligi_ozet_v2) INSERT-only trigger ile beslenir; silme
--   düşürmez → fonksiyon sonunda TRUNCATE + backfill ile yeniden kurulur (kaynak:
--   cc_ligi_backfill.sql + hbligi_v2_backfill.sql; buraya gömülü, tek işlemde atomik).
--   hb_ligi_v2 VIEW'dır, kendiliğinden güncellenir. E-Club Ligi canlı hesaplanır (cache yok).
--
-- Atomiklik: plpgsql fonksiyonu tek transaction'da koşar; herhangi bir hata → tüm silme
--   geri alınır. Yetki fonksiyon içinde YOK; route'ta adminGirisKontrol + service_role.
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.
-- ÇAĞRI (GERİ ALINAMAZ — yalnız test): SELECT public.test_veri_temizle('firma', '<firma_id>');

CREATE OR REPLACE FUNCTION public.test_veri_temizle(
  p_mod text, p_firma_id uuid DEFAULT NULL, p_talep_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_hepsi   boolean := (p_mod = 'tum');
  v_yayin   uuid[];
  v_kul     uuid[];
  v_talep   uuid[];
  v_senaryo uuid[]; v_video uuid[]; v_soru_seti uuid[];
  v_oneri   uuid[]; v_eclub_oneri uuid[]; v_challenge uuid[];
  v_sipS uuid[]; v_sipE uuid[]; v_sipZ uuid[];
BEGIN
  -- ── 0) Girdi doğrulama ────────────────────────────────────────────────
  IF p_mod NOT IN ('tum','firma','tekil') THEN RETURN jsonb_build_object('durum','gecersiz_mod'); END IF;
  IF p_mod='firma' AND p_firma_id IS NULL THEN RETURN jsonb_build_object('durum','firma_id_gerekli'); END IF;
  IF p_mod='tekil' AND p_talep_id IS NULL THEN RETURN jsonb_build_object('durum','talep_id_gerekli'); END IF;
  IF p_mod='firma' AND NOT EXISTS (SELECT 1 FROM firmalar WHERE firma_id = p_firma_id)
    THEN RETURN jsonb_build_object('durum','firma_bulunamadi'); END IF;
  IF p_mod='tekil' AND NOT EXISTS (SELECT 1 FROM talepler WHERE talep_id = p_talep_id)
    THEN RETURN jsonb_build_object('durum','talep_bulunamadi'); END IF;

  -- ── 1) Kapsam kümeleri (silmeden ÖNCE topla) ─────────────────────────
  v_talep := CASE p_mod
    WHEN 'firma' THEN ARRAY(SELECT t.talep_id FROM talepler t WHERE t.firma_id = p_firma_id)
    WHEN 'tekil' THEN ARRAY[p_talep_id]
    ELSE NULL END;
  -- Yayın kapsamı künyeden okunur (05.08.2026) — yayından talebe giden zincir
  -- tek kaynakta (v_yayin_kunye) tanımlıdır, burada tekrarlanmaz.
  v_yayin := CASE p_mod
    WHEN 'tum' THEN ARRAY(SELECT yayin_id FROM yayin_yonetimi)
    ELSE ARRAY(SELECT ky.yayin_id FROM v_yayin_kunye ky WHERE ky.talep_id = ANY(v_talep))
  END;
  v_senaryo   := ARRAY(SELECT senaryo_id  FROM senaryolar   WHERE v_hepsi OR talep_id = ANY(v_talep));
  v_video     := ARRAY(SELECT video_id    FROM videolar     WHERE v_hepsi OR talep_id = ANY(v_talep));
  v_soru_seti := ARRAY(SELECT soru_seti_id FROM soru_setleri WHERE v_hepsi OR talep_id = ANY(v_talep));
  v_oneri       := ARRAY(SELECT oneri_id     FROM oneri_kayitlari       WHERE yayin_id = ANY(v_yayin));
  v_eclub_oneri := ARRAY(SELECT oneri_id     FROM eclub_oneri_kayitlari WHERE yayin_id = ANY(v_yayin));
  v_challenge   := ARRAY(SELECT challenge_id FROM challenge_kayitlari    WHERE yayin_id = ANY(v_yayin));
  v_kul := CASE WHEN p_mod='firma'
    THEN ARRAY(SELECT kullanici_id FROM kullanicilar WHERE firma_id = p_firma_id) ELSE NULL END;

  -- Silinecek sipariş kümeleri (BİTMİŞ korunur; tekil'de sipariş talep-kapsamlı değil → boş)
  IF p_mod <> 'tekil' THEN
    v_sipS := ARRAY(SELECT siparis_id FROM store_siparisler
      WHERE durum <> 'teslim_edildi' AND (v_hepsi OR kullanici_id = ANY(v_kul)));
    v_sipE := ARRAY(SELECT s.siparis_id FROM eclub_store_siparisler s
      WHERE s.durum <> 'teslim_edildi' AND (v_hepsi OR s.siparis_id IN
        (SELECT siparis_id FROM eclub_store_siparis_firma_puan WHERE firma_id = p_firma_id)));
    v_sipZ := ARRAY(SELECT siparis_id FROM eczanem_siparisler
      WHERE durum <> 'onaylandi' AND (v_hepsi OR urun_id IN
        (SELECT urun_id FROM urunler WHERE firma_id = p_firma_id)));
  END IF;

  -- ── 2) Stok iadesi (silinecek, iptal OLMAYAN siparişler; iptal zaten iade etmişti) ──
  UPDATE store_urunler u SET stok = u.stok + x.adet FROM
    (SELECT urun_id, SUM(adet) AS adet FROM store_siparisler
     WHERE siparis_id = ANY(v_sipS) AND durum <> 'iptal' GROUP BY urun_id) x
    WHERE u.urun_id = x.urun_id;
  UPDATE eclub_store_urunler u SET stok = u.stok + x.adet FROM
    (SELECT urun_id, SUM(adet) AS adet FROM eclub_store_siparisler
     WHERE siparis_id = ANY(v_sipE) AND durum <> 'iptal' GROUP BY urun_id) x
    WHERE u.urun_id = x.urun_id;

  -- ── 3) SİLME (FK-güvenli: çocuk→ebeveyn) ─────────────────────────────
  -- F1) sipariş çocukları (harcama/firma_puan) — puan_kayitlari/sipariş'ten ÖNCE
  DELETE FROM eczanem_harcama_kayitlari      WHERE siparis_id = ANY(v_sipZ);
  DELETE FROM store_puan_harcamalari         WHERE siparis_id = ANY(v_sipS);
  DELETE FROM eclub_store_siparis_firma_puan WHERE siparis_id = ANY(v_sipE);

  -- F2) izleme çocukları (cevap + eczanem puan defteri)
  DELETE FROM soru_cevaplari WHERE izleme_id IN (SELECT izleme_id FROM izleme_kayitlari WHERE yayin_id = ANY(v_yayin));
  DELETE FROM eczanem_puan_kayitlari WHERE izleme_id IN (SELECT izleme_id FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin));

  -- F3) puan/kayıp defterleri (yayin_id)
  DELETE FROM kazanilan_puanlar         WHERE yayin_id = ANY(v_yayin);
  DELETE FROM yanlis_cevap_kayitlari    WHERE yayin_id = ANY(v_yayin);
  DELETE FROM ileri_sarma_kayitlari     WHERE yayin_id = ANY(v_yayin);
  DELETE FROM oneri_kayip_kayitlari     WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_kazanilan_puanlar      WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_yanlis_cevap_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_ileri_sarma_kayitlari  WHERE yayin_id = ANY(v_yayin);
  DELETE FROM challenge_kayip_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_kazanilan_puanlar   WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_yanlis_cevap_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_dogru_cevap_kayitlari  WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_utt_puanlari        WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_oneri_kayip_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM video_begeniler           WHERE yayin_id = ANY(v_yayin);
  DELETE FROM video_favoriler           WHERE yayin_id = ANY(v_yayin);

  -- F4) izleme tabloları
  DELETE FROM izleme_kayitlari         WHERE yayin_id = ANY(v_yayin);
  DELETE FROM cc_izleme_kayitlari      WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_izleme_kayitlari   WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eczanem_izleme_kayitlari WHERE yayin_id = ANY(v_yayin);

  -- F5) izleme ebeveynleri: öneri / challenge / gönderim / tekrar
  DELETE FROM oneri_kayitlari       WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eclub_oneri_kayitlari WHERE yayin_id = ANY(v_yayin);
  DELETE FROM challenge_kayitlari   WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eczanem_gonderimler         WHERE yayin_id = ANY(v_yayin);
  DELETE FROM eczanem_eczane_gonderimleri WHERE yayin_id = ANY(v_yayin);
  DELETE FROM yayin_tekrar_kayitlari WHERE yayin_id = ANY(v_yayin);

  -- F6) siparişler (onaysız küme) + kullanılmayan adresler
  DELETE FROM store_siparisler       WHERE siparis_id = ANY(v_sipS);
  DELETE FROM eclub_store_siparisler WHERE siparis_id = ANY(v_sipE);
  DELETE FROM eczanem_siparisler     WHERE siparis_id = ANY(v_sipZ);
  DELETE FROM store_adresler a WHERE (v_hepsi OR a.kullanici_id = ANY(v_kul))
     AND NOT EXISTS (SELECT 1 FROM store_siparisler s WHERE s.adres_id = a.adres_id);
  -- eclub adresler kişi-düzeyi (çok-firmalı) → yalnız 'tum' modunda temizlenir
  DELETE FROM eclub_store_adresler a WHERE v_hepsi
     AND NOT EXISTS (SELECT 1 FROM eclub_store_siparisler s WHERE s.adres_id = a.adres_id);

  -- F7) eczanem yan kayıtlar + push + bildirim (tekil'de eczanem/push atlanır)
  IF p_mod <> 'tekil' THEN
    DELETE FROM eczanem_uyelikler WHERE v_hepsi OR eczane_id IN
      (SELECT eczane_id FROM eclub_eczane_firma WHERE firma_id = p_firma_id);
    DELETE FROM eczanem_davetler  WHERE v_hepsi OR eczane_id IN
      (SELECT eczane_id FROM eclub_eczane_firma WHERE firma_id = p_firma_id);
    IF v_hepsi THEN DELETE FROM eczanem_giris_otp WHERE true; END IF;   -- firma bağı YOK → yalnız 'tum'
    DELETE FROM push_abonelikleri       WHERE v_hepsi OR auth_user_id = ANY(v_kul);
    DELETE FROM push_gonderim_kayitlari WHERE v_hepsi OR auth_user_id = ANY(v_kul);
  END IF;
  DELETE FROM bildirimler WHERE v_hepsi
     OR alici_id = ANY(v_kul) OR gonderen_id = ANY(v_kul)
     OR (kayit_turu='talep'     AND kayit_id = ANY(v_talep))
     OR (kayit_turu='senaryo'   AND kayit_id = ANY(v_senaryo))
     OR (kayit_turu='video'     AND kayit_id = ANY(v_video))
     OR (kayit_turu='soru_seti' AND kayit_id = ANY(v_soru_seti))
     OR (kayit_turu='yayin'     AND kayit_id = ANY(v_yayin))
     OR (kayit_turu='oneri'     AND kayit_id = ANY(v_oneri))
     OR (kayit_turu='challenge' AND kayit_id = ANY(v_challenge));
  DELETE FROM eclub_bildirimler WHERE v_hepsi
     OR gonderen_id = ANY(v_kul)
     OR (kayit_turu='oneri' AND kayit_id = ANY(v_eclub_oneri));

  -- ── 4) Özet cache resync (TRUNCATE + backfill; kaynak: *_backfill.sql) ──
  TRUNCATE cc_ligi_ozet, hb_ligi_ozet_v2;

  INSERT INTO cc_ligi_ozet
    (kullanici_id, tarih, izleme_puani, cevaplama_puani, extra_puani,
     cc_gonderme_puani, cc_referral_puani, ileri_sarma_kaybi, yanlis_cevap_kaybi, challenge_kaybi, guncellenme)
  SELECT t.kullanici_id, (t.created_at AT TIME ZONE 'Europe/Istanbul')::date,
    SUM(t.izleme), SUM(t.cevaplama), SUM(t.extra), SUM(t.ccg), SUM(t.ccr),
    SUM(t.ileri), SUM(t.yanlis), SUM(t.challenge), now()
  FROM (
    SELECT bm_id, created_at,
      CASE WHEN puan_turu='izleme' THEN puan ELSE 0 END,
      CASE WHEN puan_turu='cevaplama' THEN puan ELSE 0 END,
      CASE WHEN puan_turu='extra' THEN puan ELSE 0 END,
      CASE WHEN puan_turu='cc_gonderme' THEN puan ELSE 0 END,
      CASE WHEN puan_turu='cc_referral' THEN puan ELSE 0 END, 0,0,0
    FROM cc_kazanilan_puanlar
    UNION ALL SELECT bm_id, created_at, 0,0,0,0,0, kaybedilen_puan,0,0 FROM cc_ileri_sarma_kayitlari
    UNION ALL SELECT bm_id, created_at, 0,0,0,0,0, 0,kaybedilen_puan,0 FROM cc_yanlis_cevap_kayitlari
    UNION ALL SELECT kullanici_id, COALESCE(created_at, now()), 0,0,0,0,0, 0,0,kaybedilen_puan FROM challenge_kayip_kayitlari
  ) t(kullanici_id, created_at, izleme, cevaplama, extra, ccg, ccr, ileri, yanlis, challenge)
  GROUP BY t.kullanici_id, (t.created_at AT TIME ZONE 'Europe/Istanbul')::date;

  INSERT INTO hb_ligi_ozet_v2
    (kullanici_id, tarih, izleme_puani, cevaplama_puani, oneri_puani, extra_puani,
     ileri_sarma_kaybi, yanlis_cevap_kaybi, oneri_kaybi, guncellenme)
  SELECT t.kullanici_id, (t.created_at AT TIME ZONE 'Europe/Istanbul')::date,
    SUM(t.izleme), SUM(t.cevaplama), SUM(t.oneri), SUM(t.extra),
    SUM(t.ileri), SUM(t.yanlis), SUM(t.onerikayip), now()
  FROM (
    SELECT kullanici_id, created_at,
      CASE WHEN puan_turu='izleme' THEN puan ELSE 0 END,
      CASE WHEN puan_turu='cevaplama' THEN puan ELSE 0 END,
      CASE WHEN puan_turu='oneri' THEN puan ELSE 0 END,
      CASE WHEN puan_turu='extra' THEN puan ELSE 0 END, 0,0,0
    FROM kazanilan_puanlar
    UNION ALL SELECT kullanici_id, created_at, 0,0,0,0, kaybedilen_puan,0,0 FROM ileri_sarma_kayitlari
    UNION ALL SELECT kullanici_id, created_at, 0,0,0,0, 0,kaybedilen_puan,0 FROM yanlis_cevap_kayitlari
    UNION ALL SELECT kullanici_id, created_at, 0,0,0,0, 0,0,kaybedilen_puan FROM oneri_kayip_kayitlari
  ) t(kullanici_id, created_at, izleme, cevaplama, oneri, extra, ileri, yanlis, onerikayip)
  GROUP BY t.kullanici_id, (t.created_at AT TIME ZONE 'Europe/Istanbul')::date;

  RETURN jsonb_build_object(
    'durum','silindi', 'mod', p_mod,
    'yayin_sayisi', COALESCE(array_length(v_yayin,1),0),
    'silinen_siparis', COALESCE(array_length(v_sipS,1),0) + COALESCE(array_length(v_sipE,1),0) + COALESCE(array_length(v_sipZ,1),0)
  );
END;
$fonk$;

GRANT EXECUTE ON FUNCTION public.test_veri_temizle(text, uuid, uuid) TO service_role;
