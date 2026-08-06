-- scripts/sql/get_eclub_store_firma_bakiye.sql
--
-- E-Club Store — kişinin FİRMA BAZINDA harcanabilir bakiyesi.
-- Dış müşteri çok firmalıdır; kazandığı puan hangi firmanın içeriğinden geldiği
-- bilinerek tutulur (REDBOOK §4.5). Bu fonksiyon o ayrıştırmayı yapar.
--
-- ⚠ PARASAL: Çıktısı doğrudan harcanabilir bakiyedir. Değişiklik dikkatle
-- ele alınmıştır; hesap mantığına, iptal süzgecine ve firma modül bayrağına
-- dokunulmamıştır.
--
-- GÜNCELLEME (05.08.2026 — künye geçişi):
--   Firma, puan defterindeki `urun_id` kopyası üzerinden çözülüyordu:
--     eclub_kazanilan_puanlar.urun_id → urunler.firma_id
--   Artık yayın künyesinden okunuyor:
--     eclub_kazanilan_puanlar.yayin_id → v_yayin_kunye.firma_id
--   Bu, içeriğin firmasını ürünün firmasına değil TALEBİN firmasına bağlar —
--   doğru kaynak budur. 05.08.2026 ölçümünde iki değer arasında tek bir çelişki
--   yoktu (28 talebin hepsinde firma_id dolu, ürün firmasıyla birebir aynı),
--   dolayısıyla mevcut bakiyeler değişmez.
--
--   Yan kazanım: eski hâlde `urun_id` boş bir kazanç satırı INNER JOIN'de
--   düşerdi ve o puan hiçbir firmanın bakiyesine yazılmazdı (sessiz kayıp).
--   Künye üzerinden firma her zaman çözülür.
--
-- Dönüş sözleşmesi ve sıralama AYNEN korunmuştur.
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE FUNCTION public.get_eclub_store_firma_bakiye(p_kisi_id uuid)
 RETURNS TABLE(firma_id uuid, firma_adi character varying, kazanilan bigint, harcanan bigint, bakiye bigint)
 LANGUAGE sql
 STABLE
AS $function$
  WITH kazanc AS (
    SELECT ky.firma_id, COALESCE(SUM(kp.puan), 0) AS kazanilan
    FROM eclub_kazanilan_puanlar kp
    JOIN v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kisi_id = p_kisi_id
    GROUP BY ky.firma_id
  ),
  harcama AS (
    SELECT sfp.firma_id, COALESCE(SUM(sfp.kullanilan_puan), 0) AS harcanan
    FROM eclub_store_siparis_firma_puan sfp
    JOIN eclub_store_siparisler s ON s.siparis_id = sfp.siparis_id
    WHERE s.kisi_id = p_kisi_id
      AND s.durum <> 'iptal'
    GROUP BY sfp.firma_id
  )
  SELECT
    f.firma_id,
    f.firma_adi,
    COALESCE(k.kazanilan, 0),
    COALESCE(h.harcanan, 0),
    (COALESCE(k.kazanilan, 0) - COALESCE(h.harcanan, 0)) AS bakiye
  FROM firmalar f
  JOIN kazanc k ON k.firma_id = f.firma_id
  LEFT JOIN harcama h ON h.firma_id = f.firma_id
  WHERE f.eclub_store_aktif = true
    AND (COALESCE(k.kazanilan, 0) - COALESCE(h.harcanan, 0)) > 0
  ORDER BY bakiye DESC;
$function$;
