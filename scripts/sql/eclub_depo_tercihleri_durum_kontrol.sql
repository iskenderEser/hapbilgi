-- E-Club depo tercihleri migration yapisal durum kontrolu.
-- Nesnelerin varligini, RLS'yi ve trigger-fonksiyon baglarini denetler; migration'in
-- birebir hangi tarihte calistirildigini veya islevsel test sonucunu kanitlamaz.
-- Salt okunurdur; tablo, fonksiyon, trigger, RLS veya veri degistirmez.
-- Supabase SQL Editor'da tek parca calistirilir.

WITH kontroller(kontrol, tamam_mi) AS (
  VALUES
    (
      'tablo:eclub_eczane_depo_tercihleri',
      to_regclass('public.eclub_eczane_depo_tercihleri') IS NOT NULL
    ),
    (
      'tablo:eclub_depo_tercih_gecmisi',
      to_regclass('public.eclub_depo_tercih_gecmisi') IS NOT NULL
    ),
    (
      'rls:eclub_eczane_depo_tercihleri',
      coalesce((
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'eclub_eczane_depo_tercihleri'
          AND c.relkind = 'r'
      ), false)
    ),
    (
      'rls:eclub_depo_tercih_gecmisi',
      coalesce((
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'eclub_depo_tercih_gecmisi'
          AND c.relkind = 'r'
      ), false)
    ),
    (
      'fonksiyon:eclub_depo_konumu_uygun(uuid)',
      to_regprocedure('public.eclub_depo_konumu_uygun(uuid)') IS NOT NULL
    ),
    (
      'fonksiyon:eclub_eczane_depolari_hazir(uuid)',
      to_regprocedure('public.eclub_eczane_depolari_hazir(uuid)') IS NOT NULL
    ),
    (
      'fonksiyon:eclub_eczaci_kayit_depo_kapisi()',
      to_regprocedure('public.eclub_eczaci_kayit_depo_kapisi()') IS NOT NULL
    ),
    (
      'fonksiyon:eclub_depo_tercihlerini_kaydet(uuid,uuid,uuid[])',
      to_regprocedure('public.eclub_depo_tercihlerini_kaydet(uuid,uuid,uuid[])') IS NOT NULL
    ),
    (
      'fonksiyon:eclub_utt_eczaneye_depolar_ile_bagla(uuid,text,uuid[])',
      to_regprocedure('public.eclub_utt_eczaneye_depolar_ile_bagla(uuid,text,uuid[])') IS NOT NULL
    ),
    (
      'fonksiyon:eclub_siparis_depo_kapisi()',
      to_regprocedure('public.eclub_siparis_depo_kapisi()') IS NOT NULL
    ),
    (
      'trigger:eclub_eczaci_kayit_depo_kapisi_trg',
      EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'eclub_kisi_eczane'
          AND t.tgname = 'eclub_eczaci_kayit_depo_kapisi_trg'
          AND t.tgfoid = to_regprocedure('public.eclub_eczaci_kayit_depo_kapisi()')
          AND NOT t.tgisinternal
          AND t.tgenabled <> 'D'
      )
    ),
    (
      'trigger:eclub_siparis_depo_kapisi_trg',
      EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'eclub_store_cek_talepleri'
          AND t.tgname = 'eclub_siparis_depo_kapisi_trg'
          AND t.tgfoid = to_regprocedure('public.eclub_siparis_depo_kapisi()')
          AND NOT t.tgisinternal
          AND t.tgenabled <> 'D'
      )
    ),
    (
      'ayar:eclub_depo_info_eposta',
      to_regclass('public.sistem_ayarlari') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.sistem_ayarlari
        WHERE anahtar = 'eclub_depo_info_eposta'
      )
    )
), ozet AS (
  SELECT
    bool_and(tamam_mi) AS tumu_tamam,
    count(*) FILTER (WHERE tamam_mi) AS tamam_sayisi,
    count(*) AS toplam_sayi,
    coalesce(
      array_agg(kontrol ORDER BY kontrol) FILTER (WHERE NOT tamam_mi),
      ARRAY[]::text[]
    ) AS eksikler,
    jsonb_object_agg(kontrol, tamam_mi ORDER BY kontrol) AS ayrinti
  FROM kontroller
)
SELECT
  CASE WHEN tumu_tamam THEN 'YAPISAL_KURULUM_MEVCUT' ELSE 'EKSIK' END AS migration_durumu,
  tamam_sayisi,
  toplam_sayi,
  eksikler,
  ayrinti
FROM ozet;
