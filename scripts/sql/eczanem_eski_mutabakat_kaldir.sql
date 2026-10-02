-- Eski Eczanem mutabakat/döküm yüzeyinin bütün test işlem verilerini kaldırır.
-- İskender tarafından Supabase SQL Editor'de bir kez çalıştırılır.
-- Kapsam: bütün Eczanem indirim talepleri (bekleyen/onaylı/reddedilmiş),
-- bunlara ait puan harcamaları ve personel karar izleri. Kaynak puanların
-- yalnız bu harcama defterinde düşülmüş kısmı geri yüklenir.
-- Puan kazanım kayıtları, müşteri/eczane/yayın verileri ve gelecekteki
-- indirim talebi işlevi korunur; bunlar mutabakata özel nesneler değildir.

BEGIN;

LOCK TABLE public.eczanem_siparisler,
           public.eczanem_harcama_kayitlari,
           public.eczanem_puan_kayitlari,
           public.eczanem_personel_islemleri IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE eczanem_temizlik_puan_iadesi ON COMMIT DROP AS
SELECT kaynak_kayit_id AS kayit_id, SUM(dusulen_puan)::integer AS geri_verilecek
FROM public.eczanem_harcama_kayitlari
WHERE kaynak_kayit_id IS NOT NULL
GROUP BY kaynak_kayit_id;

DO $puan_kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM eczanem_temizlik_puan_iadesi i
    LEFT JOIN public.eczanem_puan_kayitlari p ON p.kayit_id = i.kayit_id
    WHERE p.kayit_id IS NULL
       OR p.kalan_puan + i.geri_verilecek < 0
       OR p.kalan_puan + i.geri_verilecek > p.puan
  ) THEN
    RAISE EXCEPTION 'Puan iadesi kaynak kayıtla uyuşmuyor; hiçbir veri silinmedi.';
  END IF;
END;
$puan_kontrol$;

DELETE FROM public.eczanem_personel_islemleri
WHERE hedef_turu = 'siparis'
   OR islem_turu IN ('siparis_onaylandi', 'siparis_reddedildi');

DELETE FROM public.eczanem_harcama_kayitlari;
DELETE FROM public.eczanem_siparisler;

UPDATE public.eczanem_puan_kayitlari p
SET kalan_puan = p.kalan_puan + i.geri_verilecek
FROM eczanem_temizlik_puan_iadesi i
WHERE p.kayit_id = i.kayit_id
  AND i.geri_verilecek <> 0;

DROP FUNCTION IF EXISTS public.eczanem_eczane_dokumu(
  uuid, timestamptz, timestamptz, uuid[]
) RESTRICT;

DO $dogrulama$
BEGIN
  IF EXISTS (SELECT 1 FROM public.eczanem_siparisler)
     OR EXISTS (SELECT 1 FROM public.eczanem_harcama_kayitlari)
     OR EXISTS (
       SELECT 1 FROM public.eczanem_personel_islemleri
       WHERE hedef_turu = 'siparis'
          OR islem_turu IN ('siparis_onaylandi', 'siparis_reddedildi')
     )
     OR to_regprocedure('public.eczanem_eczane_dokumu(uuid,timestamptz,timestamptz,uuid[])') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Eski Eczanem mutabakat/indirim işlem verisi tamamen kaldırılamadı.';
  END IF;
END;
$dogrulama$;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  (SELECT count(*) FROM public.eczanem_siparisler) AS kalan_indirim_talebi,
  (SELECT count(*) FROM public.eczanem_harcama_kayitlari) AS kalan_puan_harcamasi,
  (SELECT count(*) FROM public.eczanem_personel_islemleri
   WHERE hedef_turu = 'siparis'
      OR islem_turu IN ('siparis_onaylandi', 'siparis_reddedildi')) AS kalan_karar_izi;
