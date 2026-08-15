-- E-Club 111 test GLN zinciri — atomik önizleme ve temizlik.
--
-- Kapsam yalnızca admin tarafından üretilen kaynak='test' ve 111 önekli master
-- eczanelerdir. Gerçek GLN'lere dokunmaz. Bir kişi/müşteri test eczanesi dışında
-- herhangi bir bağ veya işlem taşıyorsa kimliği korunur; yalnız test bağı silinir.
-- Auth kullanıcıları public transaction'ın dışında Supabase Admin API ile route'ta
-- silinir; fonksiyon silinecek auth UUID'lerini hem önizleme hem temizlikte döndürür.

CREATE OR REPLACE FUNCTION public.eclub_test_veri_islem(p_islem text DEFAULT 'onizleme')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fonk$
DECLARE
  v_eczane uuid[] := ARRAY[]::uuid[];
  v_kisi_aday uuid[] := ARRAY[]::uuid[];
  v_kisi_sil uuid[] := ARRAY[]::uuid[];
  v_musteri_aday uuid[] := ARRAY[]::uuid[];
  v_musteri_sil uuid[] := ARRAY[]::uuid[];
  v_oneri uuid[] := ARRAY[]::uuid[];
  v_izleme uuid[] := ARRAY[]::uuid[];
  v_eclub_siparis uuid[] := ARRAY[]::uuid[];
  v_eczanem_gonderim uuid[] := ARRAY[]::uuid[];
  v_eczanem_izleme uuid[] := ARRAY[]::uuid[];
  v_eczanem_puan uuid[] := ARRAY[]::uuid[];
  v_eczanem_siparis uuid[] := ARRAY[]::uuid[];
  v_auth uuid[] := ARRAY[]::uuid[];
  v_musteri_telefon text[] := ARRAY[]::text[];
  v_sonuc jsonb;
BEGIN
  IF p_islem NOT IN ('onizleme', 'temizle') THEN
    RETURN jsonb_build_object('durum', 'gecersiz_islem');
  END IF;

  v_eczane := ARRAY(
    SELECT e.eczane_id
    FROM eclub_eczaneler e
    JOIN eclub_eczane_master m ON m.gln = e.gln
    WHERE m.kaynak = 'test' AND m.gln LIKE '111%'
  );

  v_kisi_aday := ARRAY(
    SELECT DISTINCT ke.kisi_id
    FROM eclub_kisi_eczane ke
    WHERE ke.eczane_id = ANY(v_eczane)
  );

  -- Kişi gerçek bir eczaneyle geçmiş/aktif herhangi bir bağ taşıyorsa korunur.
  v_kisi_sil := ARRAY(
    SELECT kisi_id
    FROM unnest(v_kisi_aday) AS aday(kisi_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM eclub_kisi_eczane ke
      WHERE ke.kisi_id = aday.kisi_id
        AND NOT (ke.eczane_id = ANY(v_eczane))
    )
  );

  -- Test eczanesiyle temas etmiş Eczanem müşterilerini bütün temas kanallarından bul.
  v_musteri_aday := ARRAY(
    SELECT DISTINCT musteri_id
    FROM (
      SELECT u.musteri_id FROM eczanem_uyelikler u WHERE u.eczane_id = ANY(v_eczane)
      UNION SELECT g.musteri_id FROM eczanem_gonderimler g WHERE g.eczane_id = ANY(v_eczane)
      UNION SELECT p.musteri_id FROM eczanem_puan_kayitlari p WHERE p.eczane_id = ANY(v_eczane)
      UNION SELECT s.musteri_id FROM eczanem_siparisler s WHERE s.eczane_id = ANY(v_eczane)
    ) adaylar
    WHERE musteri_id IS NOT NULL
  );

  -- Gerçek eczanede üyelik veya işlem taşıyan müşteri kimliği korunur.
  v_musteri_sil := ARRAY(
    SELECT musteri_id
    FROM unnest(v_musteri_aday) AS aday(musteri_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM eczanem_uyelikler u
      WHERE u.musteri_id = aday.musteri_id AND NOT (u.eczane_id = ANY(v_eczane))
    )
    AND NOT EXISTS (
      SELECT 1 FROM eczanem_gonderimler g
      WHERE g.musteri_id = aday.musteri_id AND NOT (g.eczane_id = ANY(v_eczane))
    )
    AND NOT EXISTS (
      SELECT 1 FROM eczanem_puan_kayitlari p
      WHERE p.musteri_id = aday.musteri_id AND NOT (p.eczane_id = ANY(v_eczane))
    )
    AND NOT EXISTS (
      SELECT 1 FROM eczanem_siparisler s
      WHERE s.musteri_id = aday.musteri_id AND NOT (s.eczane_id = ANY(v_eczane))
    )
  );

  v_oneri := ARRAY(SELECT oneri_id FROM eclub_oneri_kayitlari WHERE kisi_id = ANY(v_kisi_sil));
  v_izleme := ARRAY(SELECT izleme_id FROM eclub_izleme_kayitlari WHERE kisi_id = ANY(v_kisi_sil));
  v_eclub_siparis := ARRAY(SELECT siparis_id FROM eclub_store_siparisler WHERE kisi_id = ANY(v_kisi_sil));

  v_eczanem_gonderim := ARRAY(
    SELECT gonderim_id FROM eczanem_gonderimler
    WHERE eczane_id = ANY(v_eczane)
       OR musteri_id = ANY(v_musteri_sil)
       OR gonderen_kisi_id = ANY(v_kisi_sil)
  );
  v_eczanem_izleme := ARRAY(
    SELECT izleme_id FROM eczanem_izleme_kayitlari
    WHERE gonderim_id = ANY(v_eczanem_gonderim) OR musteri_id = ANY(v_musteri_sil)
  );
  v_eczanem_puan := ARRAY(
    SELECT kayit_id FROM eczanem_puan_kayitlari
    WHERE eczane_id = ANY(v_eczane)
       OR musteri_id = ANY(v_musteri_sil)
       OR izleme_id = ANY(v_eczanem_izleme)
  );
  v_eczanem_siparis := ARRAY(
    SELECT siparis_id FROM eczanem_siparisler
    WHERE eczane_id = ANY(v_eczane) OR musteri_id = ANY(v_musteri_sil)
  );

  v_auth := ARRAY(
    SELECT DISTINCT aday_auth.auth_user_id
    FROM (
      SELECT k.auth_user_id FROM eclub_kisiler k WHERE k.kisi_id = ANY(v_kisi_sil)
      UNION
      SELECT m.auth_user_id FROM eczanem_musteriler m WHERE m.musteri_id = ANY(v_musteri_sil)
    ) aday_auth
    WHERE aday_auth.auth_user_id IS NOT NULL
      -- Aynı Auth hesabı korunan başka bir E-Club/Eczanem kimliğine bağlıysa
      -- giriş hesabını ve push kayıtlarını silme.
      AND NOT EXISTS (
        SELECT 1 FROM eclub_kisiler k
        WHERE k.auth_user_id = aday_auth.auth_user_id
          AND NOT (k.kisi_id = ANY(v_kisi_sil))
      )
      AND NOT EXISTS (
        SELECT 1 FROM eczanem_musteriler m
        WHERE m.auth_user_id = aday_auth.auth_user_id
          AND NOT (m.musteri_id = ANY(v_musteri_sil))
      )
  );
  v_musteri_telefon := ARRAY(
    SELECT DISTINCT telefon FROM eczanem_musteriler
    WHERE musteri_id = ANY(v_musteri_sil) AND telefon IS NOT NULL
  );

  SELECT jsonb_build_object(
    'durum', CASE WHEN p_islem = 'onizleme' THEN 'onizleme' ELSE 'hazir' END,
    'test_master_sayisi', (SELECT count(*) FROM eclub_eczane_master WHERE kaynak='test' AND gln LIKE '111%'),
    'eczane_sayisi', cardinality(v_eczane),
    'firma_bagi_sayisi', (SELECT count(*) FROM eclub_eczane_firma WHERE eczane_id = ANY(v_eczane)),
    'kisi_bagi_sayisi', (SELECT count(*) FROM eclub_kisi_eczane WHERE eczane_id = ANY(v_eczane)),
    'silinecek_kisi_sayisi', cardinality(v_kisi_sil),
    'korunacak_kisi_sayisi', cardinality(v_kisi_aday) - cardinality(v_kisi_sil),
    'eclub_oneri_sayisi', cardinality(v_oneri),
    'eclub_izleme_sayisi', cardinality(v_izleme),
    'eclub_puan_kaydi_sayisi',
      (SELECT count(*) FROM eclub_kazanilan_puanlar WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme))
      + (SELECT count(*) FROM eclub_dogru_cevap_kayitlari WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme))
      + (SELECT count(*) FROM eclub_yanlis_cevap_kayitlari WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme))
      + (SELECT count(*) FROM eclub_utt_puanlari WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme) OR oneri_id = ANY(v_oneri))
      + (SELECT count(*) FROM eclub_oneri_kayip_kayitlari WHERE kisi_id = ANY(v_kisi_sil) OR oneri_id = ANY(v_oneri)),
    'eclub_siparis_sayisi', cardinality(v_eclub_siparis),
    'eczanem_musteri_bagi_sayisi', (SELECT count(*) FROM eczanem_uyelikler WHERE eczane_id = ANY(v_eczane)),
    'silinecek_musteri_sayisi', cardinality(v_musteri_sil),
    'korunacak_musteri_sayisi', cardinality(v_musteri_aday) - cardinality(v_musteri_sil),
    'eczanem_gonderim_sayisi', cardinality(v_eczanem_gonderim),
    'eczanem_izleme_sayisi', cardinality(v_eczanem_izleme),
    'eczanem_siparis_sayisi', cardinality(v_eczanem_siparis),
    'auth_hesabi_sayisi', cardinality(v_auth),
    'auth_user_idler', to_jsonb(v_auth)
  ) INTO v_sonuc;

  IF p_islem = 'onizleme' THEN RETURN v_sonuc; END IF;

  -- E-Club Store: test kişilerine ait tüm siparişleri kaldır ve stokları geri koy.
  UPDATE eclub_store_urunler u
  SET stok = u.stok + x.adet
  FROM (
    SELECT urun_id, sum(adet)::integer AS adet
    FROM eclub_store_siparisler
    WHERE siparis_id = ANY(v_eclub_siparis) AND durum <> 'iptal'
    GROUP BY urun_id
  ) x
  WHERE u.urun_id = x.urun_id;
  DELETE FROM eclub_store_siparis_firma_puan WHERE siparis_id = ANY(v_eclub_siparis);
  DELETE FROM eclub_store_siparisler WHERE siparis_id = ANY(v_eclub_siparis);
  DELETE FROM eclub_store_adresler WHERE kisi_id = ANY(v_kisi_sil);

  -- E-Club öğrenme zinciri: çocuklardan ebeveyne.
  DELETE FROM eclub_kazanilan_puanlar WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme);
  DELETE FROM eclub_dogru_cevap_kayitlari WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme);
  DELETE FROM eclub_yanlis_cevap_kayitlari WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme);
  DELETE FROM eclub_utt_puanlari WHERE kisi_id = ANY(v_kisi_sil) OR izleme_id = ANY(v_izleme) OR oneri_id = ANY(v_oneri);
  DELETE FROM eclub_oneri_kayip_kayitlari WHERE kisi_id = ANY(v_kisi_sil) OR oneri_id = ANY(v_oneri);
  DELETE FROM eclub_izleme_kayitlari WHERE izleme_id = ANY(v_izleme);
  DELETE FROM eclub_bildirimler WHERE alici_kisi_id = ANY(v_kisi_sil) OR (kayit_turu='oneri' AND kayit_id = ANY(v_oneri));
  DELETE FROM eclub_oneri_kayitlari WHERE oneri_id = ANY(v_oneri);

  -- Eczanem zinciri: test eczaneleri ve yalnız-test müşterileri.
  DELETE FROM eczanem_harcama_kayitlari
  WHERE siparis_id = ANY(v_eczanem_siparis) OR kaynak_kayit_id = ANY(v_eczanem_puan);
  DELETE FROM eczanem_puan_kayitlari WHERE kayit_id = ANY(v_eczanem_puan);
  DELETE FROM eczanem_izleme_kayitlari WHERE izleme_id = ANY(v_eczanem_izleme);
  DELETE FROM eczanem_siparisler WHERE siparis_id = ANY(v_eczanem_siparis);
  DELETE FROM eczanem_gonderimler WHERE gonderim_id = ANY(v_eczanem_gonderim);
  DELETE FROM eczanem_eczane_gonderimleri WHERE eczane_id = ANY(v_eczane);
  DELETE FROM eczanem_davetler WHERE eczane_id = ANY(v_eczane) OR davet_eden_kisi_id = ANY(v_kisi_sil);
  DELETE FROM eczanem_uyelikler WHERE eczane_id = ANY(v_eczane) OR musteri_id = ANY(v_musteri_sil);
  DELETE FROM eczanem_giris_otp WHERE telefon = ANY(v_musteri_telefon);
  DELETE FROM eczanem_musteriler WHERE musteri_id = ANY(v_musteri_sil);

  -- Auth yan kayıtları; auth.users route'taki Admin API ile silinir.
  DELETE FROM push_abonelikleri WHERE auth_user_id = ANY(v_auth);
  DELETE FROM push_gonderim_kayitlari WHERE auth_user_id = ANY(v_auth);

  -- Eczane/kişi iskeleti en son kaldırılır.
  DELETE FROM eclub_kisi_eczane WHERE eczane_id = ANY(v_eczane) OR kisi_id = ANY(v_kisi_sil);
  DELETE FROM eclub_kisiler WHERE kisi_id = ANY(v_kisi_sil);
  DELETE FROM eclub_eczane_firma WHERE eczane_id = ANY(v_eczane);
  DELETE FROM eclub_eczaneler WHERE eczane_id = ANY(v_eczane);
  DELETE FROM eclub_eczane_master WHERE kaynak='test' AND gln LIKE '111%';

  RETURN v_sonuc || jsonb_build_object('durum', 'silindi');
END;
$fonk$;

REVOKE ALL ON FUNCTION public.eclub_test_veri_islem(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eclub_test_veri_islem(text) TO service_role;
