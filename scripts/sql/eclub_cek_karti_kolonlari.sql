-- Yalnız okuma: canlı veritabanındaki kolon adlarını ve tiplerini listeler.
SELECT
  table_name AS tablo_veya_gorunum,
  ordinal_position AS kolon_sirasi,
  column_name AS kolon_adi,
  data_type AS veri_tipi,
  is_nullable AS null_olabilir,
  column_default AS varsayilan
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'v_yayin_kunye',
    'urunler',
    'firmalar',
    'yayin_yonetimi',
    'eclub_kisiler',
    'eclub_kisi_eczane',
    'eclub_eczaneler',
    'eclub_eczane_master',
    'eclub_eczane_firma',
    'eclub_kazanilan_puanlar',
    'eclub_izleme_kayitlari',
    'eclub_store_puan_devirleri',
    'eclub_store_cek_talepleri'
  )
ORDER BY table_name, ordinal_position;
