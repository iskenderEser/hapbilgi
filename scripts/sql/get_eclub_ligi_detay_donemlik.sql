-- scripts/sql/get_eclub_ligi_detay_donemlik.sql
--
-- E-Club Ligi — bir UTT'nin dış müşterilerinin ÇEYREK bazlı ürün dökümü.
-- Aylık ikizinin (get_eclub_ligi_detay_aylik) çeyrek penceresi.
--
-- GÜNCELLEME (05.08.2026 — künye geçişi): Ürün kimliği üç ayrı yoldan
-- çözülüyordu — iki CTE puan defterindeki kopyadan (`kp.urun_id`, `dc.urun_id`),
-- biri satır satır `get_urun_from_yayin()` çağırarak. Üçü de yayın künyesine
-- (`v_yayin_kunye`) bağlandı: tek kaynak, tek yol. Satır-başına fonksiyon
-- çağrısı da kalktı.
--
-- Dönüş sözleşmesi, parametreler ve hesap mantığı AYNEN korunmuştur.
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE FUNCTION public.get_eclub_ligi_detay_donemlik(p_utt_id uuid, p_yil integer, p_ceyrek integer)
 RETURNS TABLE(gln character varying, eczane_adi character varying, eczaci_ad text, teknisyen_ad text, urun_id uuid, urun_adi character varying, izleme_puani bigint, cevaplama_puani bigint, izlenen_video bigint, dogru_cevap bigint)
 LANGUAGE sql
 STABLE
AS $function$
  WITH d AS (
    SELECT
      make_timestamptz(p_yil, (p_ceyrek - 1) * 3 + 1, 1, 0, 0, 0) AS bas,
      (make_timestamptz(p_yil, (p_ceyrek - 1) * 3 + 1, 1, 0, 0, 0) + interval '3 months') AS son
  ),
  temel AS (
    SELECT o.kisi_id, ky.urun_id,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0) AS izleme_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0) AS cevaplama_puani
    FROM eclub_kazanilan_puanlar kp
    JOIN eclub_izleme_kayitlari iz ON iz.izleme_id = kp.izleme_id
    JOIN eclub_oneri_kayitlari o ON o.oneri_id = iz.oneri_id
    JOIN v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id, d
    WHERE o.oneren_id = p_utt_id AND kp.created_at >= d.bas AND kp.created_at < d.son
    GROUP BY o.kisi_id, ky.urun_id
  ),
  video AS (
    SELECT o.kisi_id, ky.urun_id, COUNT(*) AS izlenen_video
    FROM eclub_izleme_kayitlari iz
    JOIN eclub_oneri_kayitlari o ON o.oneri_id = iz.oneri_id
    JOIN v_yayin_kunye ky ON ky.yayin_id = iz.yayin_id, d
    WHERE o.oneren_id = p_utt_id AND iz.tamamlandi_mi = true
      AND iz.izleme_bitis >= d.bas AND iz.izleme_bitis < d.son
    GROUP BY o.kisi_id, ky.urun_id
  ),
  dogru AS (
    SELECT o.kisi_id, ky.urun_id, COUNT(*) AS dogru_cevap
    FROM eclub_dogru_cevap_kayitlari dc
    JOIN eclub_izleme_kayitlari iz ON iz.izleme_id = dc.izleme_id
    JOIN eclub_oneri_kayitlari o ON o.oneri_id = iz.oneri_id
    JOIN v_yayin_kunye ky ON ky.yayin_id = dc.yayin_id, d
    WHERE o.oneren_id = p_utt_id AND dc.created_at >= d.bas AND dc.created_at < d.son
    GROUP BY o.kisi_id, ky.urun_id
  ),
  anahtar AS (
    SELECT kisi_id, urun_id FROM temel
    UNION SELECT kisi_id, urun_id FROM video
    UNION SELECT kisi_id, urun_id FROM dogru
  )
  SELECT ecz.gln, m.eczane_adi, eczaci.ad_soyad, tekn.ad_soyad, a.urun_id, ur.urun_adi,
    COALESCE(t.izleme_puani, 0), COALESCE(t.cevaplama_puani, 0),
    COALESCE(v.izlenen_video, 0), COALESCE(dg.dogru_cevap, 0)
  FROM anahtar a
  JOIN eclub_kisiler k ON k.kisi_id = a.kisi_id
  LEFT JOIN temel t ON t.kisi_id = a.kisi_id AND t.urun_id = a.urun_id
  LEFT JOIN video v ON v.kisi_id = a.kisi_id AND v.urun_id = a.urun_id
  LEFT JOIN dogru dg ON dg.kisi_id = a.kisi_id AND dg.urun_id = a.urun_id
  LEFT JOIN urunler ur ON ur.urun_id = a.urun_id
  LEFT JOIN eclub_kisi_eczane ke ON ke.kisi_id = a.kisi_id AND ke.aktif_mi = true
  LEFT JOIN eclub_eczaneler ecz ON ecz.eczane_id = ke.eczane_id
  LEFT JOIN eclub_eczane_master m ON m.gln = ecz.gln
  LEFT JOIN LATERAL (
    SELECT (kk.ad || ' ' || kk.soyad) AS ad_soyad FROM eclub_kisi_eczane kke
    JOIN eclub_kisiler kk ON kk.kisi_id = kke.kisi_id AND kk.rol = 'eczaci'
    WHERE kke.eczane_id = ke.eczane_id AND kke.aktif_mi = true LIMIT 1
  ) eczaci ON true
  LEFT JOIN LATERAL (
    SELECT (kk.ad || ' ' || kk.soyad) AS ad_soyad FROM eclub_kisi_eczane kke
    JOIN eclub_kisiler kk ON kk.kisi_id = kke.kisi_id AND kk.rol = 'eczane_teknisyeni'
    WHERE kke.eczane_id = ke.eczane_id AND kke.aktif_mi = true LIMIT 1
  ) tekn ON true;
$function$;
