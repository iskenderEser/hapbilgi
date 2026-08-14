-- E-Club Raporlar — UTT'nin kendi eczaneleri için kişi × içerik dökümü.
-- Uygulama adımı: E-Club DB aktivasyonu sırasında SQL editöründe çalıştırılır.

CREATE OR REPLACE FUNCTION public.get_eclub_utt_rapor(
  p_utt_id uuid,
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone
)
RETURNS TABLE(
  eczane_id uuid,
  gln character varying,
  eczane_adi character varying,
  kisi_id uuid,
  kisi_ad character varying,
  kisi_soyad character varying,
  kisi_rol character varying,
  icerik_anahtari text,
  icerik_adi text,
  gonderilen_sayisi bigint,
  tamamlanan_izleme bigint,
  dogru_cevap bigint,
  yanlis_cevap bigint,
  izleme_puani bigint,
  cevaplama_puani bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH kapsam_eczaneler AS (
    SELECT DISTINCT ef.eczane_id
    FROM public.eclub_eczane_firma ef
    WHERE ef.baglayan_utt_id = p_utt_id
      AND ef.aktif_mi = true
  ),
  temel AS (
    SELECT
      ke.eczane_id,
      e.gln,
      m.eczane_adi,
      k.kisi_id,
      k.ad AS kisi_ad,
      k.soyad AS kisi_soyad,
      k.rol AS kisi_rol
    FROM kapsam_eczaneler ke
    JOIN public.eclub_eczaneler e ON e.eczane_id = ke.eczane_id
    LEFT JOIN public.eclub_eczane_master m ON m.gln = e.gln
    LEFT JOIN public.eclub_kisi_eczane kke
      ON kke.eczane_id = ke.eczane_id
     AND kke.aktif_mi = true
    LEFT JOIN public.eclub_kisiler k ON k.kisi_id = kke.kisi_id
  ),
  yayin_bilgi AS (
    SELECT DISTINCT ON (ky.yayin_id)
      ky.yayin_id,
      COALESCE(ky.urun_id::text, ky.teknik_id::text, ky.yayin_id::text) AS icerik_anahtari,
      COALESCE(vd.urun_adi, vd.teknik_adi, 'Diğer')::text AS icerik_adi
    FROM public.v_yayin_kunye ky
    LEFT JOIN public.v_yayin_detay vd ON vd.yayin_id = ky.yayin_id
    ORDER BY ky.yayin_id
  ),
  tum_oneriler AS (
    SELECT
      o.oneri_id,
      o.kisi_id,
      o.yayin_id,
      COALESCE(yb.icerik_anahtari, o.yayin_id::text) AS icerik_anahtari,
      COALESCE(yb.icerik_adi, 'Diğer') AS icerik_adi,
      COALESCE(o.created_at, o.oneri_baslangic) AS created_at
    FROM public.eclub_oneri_kayitlari o
    LEFT JOIN yayin_bilgi yb ON yb.yayin_id = o.yayin_id
    WHERE o.oneren_id = p_utt_id
  ),
  donem_oneri AS (
    SELECT
      o.kisi_id,
      o.icerik_anahtari,
      o.icerik_adi,
      COUNT(*) AS gonderilen_sayisi
    FROM tum_oneriler o
    WHERE o.created_at >= p_baslangic
      AND o.created_at < p_bitis
    GROUP BY o.kisi_id, o.icerik_anahtari, o.icerik_adi
  ),
  donem_izleme AS (
    SELECT
      iz.izleme_id,
      o.kisi_id,
      o.icerik_anahtari,
      o.icerik_adi
    FROM public.eclub_izleme_kayitlari iz
    JOIN tum_oneriler o ON o.oneri_id = iz.oneri_id
    WHERE iz.tamamlandi_mi = true
      AND iz.izleme_bitis >= p_baslangic
      AND iz.izleme_bitis < p_bitis
  ),
  izleme AS (
    SELECT
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      COUNT(*) AS tamamlanan_izleme
    FROM donem_izleme di
    GROUP BY di.kisi_id, di.icerik_anahtari, di.icerik_adi
  ),
  dogru AS (
    SELECT
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      COUNT(*) AS dogru_cevap
    FROM public.eclub_dogru_cevap_kayitlari dc
    JOIN donem_izleme di ON di.izleme_id = dc.izleme_id
    GROUP BY di.kisi_id, di.icerik_anahtari, di.icerik_adi
  ),
  yanlis AS (
    SELECT
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      COUNT(*) AS yanlis_cevap
    FROM public.eclub_yanlis_cevap_kayitlari yc
    JOIN donem_izleme di ON di.izleme_id = yc.izleme_id
    GROUP BY di.kisi_id, di.icerik_anahtari, di.icerik_adi
  ),
  puan AS (
    SELECT
      di.kisi_id,
      di.icerik_anahtari,
      di.icerik_adi,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'izleme'), 0)::bigint AS izleme_puani,
      COALESCE(SUM(kp.puan) FILTER (WHERE kp.puan_turu = 'cevaplama'), 0)::bigint AS cevaplama_puani
    FROM public.eclub_kazanilan_puanlar kp
    JOIN donem_izleme di ON di.izleme_id = kp.izleme_id
    GROUP BY di.kisi_id, di.icerik_anahtari, di.icerik_adi
  ),
  anahtar AS (
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM donem_oneri
    UNION
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM izleme
    UNION
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM dogru
    UNION
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM yanlis
    UNION
    SELECT kisi_id, icerik_anahtari, icerik_adi FROM puan
  )
  SELECT
    t.eczane_id,
    t.gln,
    t.eczane_adi,
    t.kisi_id,
    t.kisi_ad,
    t.kisi_soyad,
    t.kisi_rol,
    a.icerik_anahtari,
    a.icerik_adi,
    COALESCE(o.gonderilen_sayisi, 0)::bigint,
    COALESCE(i.tamamlanan_izleme, 0)::bigint,
    COALESCE(d.dogru_cevap, 0)::bigint,
    COALESCE(y.yanlis_cevap, 0)::bigint,
    COALESCE(p.izleme_puani, 0)::bigint,
    COALESCE(p.cevaplama_puani, 0)::bigint
  FROM temel t
  LEFT JOIN anahtar a ON a.kisi_id = t.kisi_id
  LEFT JOIN donem_oneri o
    ON o.kisi_id = a.kisi_id
   AND o.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN izleme i
    ON i.kisi_id = a.kisi_id
   AND i.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN dogru d
    ON d.kisi_id = a.kisi_id
   AND d.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN yanlis y
    ON y.kisi_id = a.kisi_id
   AND y.icerik_anahtari = a.icerik_anahtari
  LEFT JOIN puan p
    ON p.kisi_id = a.kisi_id
   AND p.icerik_anahtari = a.icerik_anahtari
  ORDER BY t.eczane_adi, t.kisi_ad, t.kisi_soyad, a.icerik_adi;
$function$;

REVOKE ALL ON FUNCTION public.get_eclub_utt_rapor(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_eclub_utt_rapor(uuid, timestamp with time zone, timestamp with time zone) TO service_role;
