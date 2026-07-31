-- scripts/sql/get_izle_videolari_firma.sql
--
-- İzle sayfası video listesinin firma-geneli (takımsız) içeriği kapsaması
-- (İskender 31.07.2026).
--
-- SORUN: get_izle_videolari WHERE bloğu `v.takim_id = p_takim_id` ile tam
-- eşleşme arıyordu. Üretici rol PM'den 13 role genişleyince, firma seviyeli
-- roller (med_md, egt_*, ik_*) taleplerini takim_id = NULL ile açıyor
-- (yetenekler.ts takimZorunlu:false). Bu içerik UTT hedefli olsa da NULL satır
-- `= p_takim_id` koşulundan geçemediği için tüketiciden yapısal olarak
-- eleniyordu — UTT yalnız kendi takımının ürün eğitimlerini görüyordu.
--
-- ÇÖZÜM: 24.07'de Yayındaki Videolar için uygulanan "takım VEYA (takımsız +
-- aynı firma)" düzeltmesinin tüketim tarafına taşınması. Firma, p_takim_id'den
-- takimlar üzerinden çözülür (view zaten firma_id kolonu sunar — 24.07).
-- Ürün eğitimi takım-kapsamlı kalır: başka takımın içeriği yine görünmez,
-- yalnız takımsız + aynı firma içerik eklenir.
--
-- TEK DEĞİŞİKLİK: WHERE'deki takim_id koşulu genişletildi. İmza, dönüş tipi,
-- SELECT ve diğer tüm satırlar aynen korundu (CREATE OR REPLACE güvenli).
--
-- KOŞUM: Supabase SQL editöründe bir kez. Yeniden koşum güvenli.

CREATE OR REPLACE FUNCTION public.get_izle_videolari(p_kullanici_id uuid, p_takim_id uuid, p_rol text)
 RETURNS TABLE(yayin_id uuid, soru_seti_durum_id uuid, urun_adi text, teknik_adi text, video_url text, thumbnail_url text, video_puani integer, yayin_tarihi timestamp with time zone, daha_once_izledi boolean, begeni_sayisi integer, favori_sayisi integer, begeni_mi boolean, favori_mi boolean, ileri_sarma_acik boolean, extra_puan integer, hedef_roller text[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    v.yayin_id,
    v.soru_seti_durum_id,
    COALESCE(v.urun_adi, '-')        AS urun_adi,
    COALESCE(v.teknik_adi, '-')      AS teknik_adi,
    v.video_url,
    v.thumbnail_url,
    v.video_puani,
    v.yayin_tarihi,
    EXISTS (
      SELECT 1 FROM izleme_kayitlari ik
      WHERE ik.yayin_id = v.yayin_id
        AND ik.kullanici_id = p_kullanici_id
        AND ik.tamamlandi_mi = true
    ) AS daha_once_izledi,
    (SELECT COUNT(*)::int FROM video_begeniler vb WHERE vb.yayin_id = v.yayin_id) AS begeni_sayisi,
    (SELECT COUNT(*)::int FROM video_favoriler vf WHERE vf.yayin_id = v.yayin_id) AS favori_sayisi,
    EXISTS (
      SELECT 1 FROM video_begeniler vb
      WHERE vb.yayin_id = v.yayin_id
        AND vb.kullanici_id = p_kullanici_id
    ) AS begeni_mi,
    EXISTS (
      SELECT 1 FROM video_favoriler vf
      WHERE vf.yayin_id = v.yayin_id
        AND vf.kullanici_id = p_kullanici_id
    ) AS favori_mi,
    COALESCE(yy.ileri_sarma_acik, false)     AS ileri_sarma_acik,
    COALESCE(yy.extra_puan, 0)                AS extra_puan,
    COALESCE(yy.hedef_roller, ARRAY['utt'])  AS hedef_roller
  FROM v_yayin_detay v
  JOIN yayin_yonetimi yy ON yy.yayin_id = v.yayin_id
  WHERE v.durum = 'yayinda'
    AND (
      v.takim_id = p_takim_id
      OR (v.takim_id IS NULL
          AND v.firma_id = (SELECT firma_id FROM takimlar WHERE takim_id = p_takim_id))
    )
    AND p_rol = ANY(COALESCE(yy.hedef_roller, ARRAY['utt']))
  ORDER BY v.yayin_tarihi DESC;
$function$;
