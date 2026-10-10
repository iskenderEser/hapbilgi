-- Hediye Çeki kartlarının görünüm çalışması için yalnız OKUMA.
-- Açık Chrome hesabı: Adil Güçlü. Hiçbir kayıt eklemez/değiştirmez/silmez.
-- Sonuç, eklenecek test verisini gerçek eczane/yayın bağlarıyla hazırlamak içindir.
-- Mevcut Hediye Takibi test verilerine dokunulmaz.
-- Kolonlar, kullanıcının 9 Ekim 2026 tarihinde ilettiği canlı kolon listesiyle karşılaştırıldı.
WITH hedef AS (
  SELECT k.kisi_id, k.ad, k.soyad, k.rol, ke.eczane_id, e.gln,
    em.eczane_adi, em.kaynak AS eczane_kaynagi
  FROM public.eclub_kisiler k
  JOIN public.eclub_kisi_eczane ke ON ke.kisi_id = k.kisi_id AND ke.aktif_mi = true
  JOIN public.eclub_eczaneler e ON e.eczane_id = ke.eczane_id
  LEFT JOIN public.eclub_eczane_master em ON em.gln = e.gln
  WHERE lower(btrim(k.ad)) = 'adil' AND lower(btrim(k.soyad)) = 'güçlü'
    AND lower(k.rol) = 'eczaci' AND k.auth_user_id IS NOT NULL
), yayinlar AS (
  SELECT DISTINCT h.eczane_id, y.yayin_id, ky.urun_id, u.urun_adi,
    ky.firma_id, f.firma_adi, y.satis_sarti_tipi, y.barem_tablosu,
    y.karsilik_puan, y.karsilik_tl, y.gizli_sart_katlama_orani
  FROM hedef h
  JOIN public.eclub_eczane_firma ef ON ef.eczane_id = h.eczane_id AND ef.aktif_mi = true
  JOIN public.firmalar f ON f.firma_id = ef.firma_id
    AND f.aktif = true AND f.eclub_aktif = true AND f.eclub_store_aktif = true
  JOIN public.v_yayin_kunye ky ON ky.firma_id = ef.firma_id
  JOIN public.urunler u ON u.urun_id = ky.urun_id
  JOIN public.yayin_yonetimi y ON y.yayin_id = ky.yayin_id
    AND y.durum = 'yayinda' AND y.cek_karsiligi_var_mi = true
    AND public.eclub_store_barem_gecerli(y.barem_tablosu)
), sonuc AS (
  SELECT '1_HEDEF_ECZACI_ECZANE'::text AS kontrol, to_jsonb(h) AS detay FROM hedef h
  UNION ALL
  SELECT '2_UYGUN_YAYIN', to_jsonb(y) FROM yayinlar y
  UNION ALL
  SELECT '3_AKTIF_DONEM', to_jsonb(d) FROM public.eclub_store_aktif_donem() d
  UNION ALL
  SELECT '4_TABLO_KISITLARI', jsonb_build_object(
    'tablo', co.conrelid::regclass::text, 'ad', co.conname,
    'tanim', pg_get_constraintdef(co.oid))
  FROM pg_constraint co
  WHERE co.conrelid IN ('public.eclub_kazanilan_puanlar'::regclass,
    'public.eclub_izleme_kayitlari'::regclass)
  UNION ALL
  SELECT '5_TABLO_TETIKLEYICILERI', jsonb_build_object(
    'tablo', tg.tgrelid::regclass::text, 'tanim', pg_get_triggerdef(tg.oid),
    'fonksiyon', pg_get_functiondef(tg.tgfoid))
  FROM pg_trigger tg
  WHERE tg.tgrelid IN ('public.eclub_kazanilan_puanlar'::regclass,
    'public.eclub_izleme_kayitlari'::regclass) AND NOT tg.tgisinternal
)
SELECT kontrol, detay FROM sonuc ORDER BY kontrol, detay::text;
