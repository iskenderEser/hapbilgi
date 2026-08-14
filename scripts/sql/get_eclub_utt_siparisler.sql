-- E-Club Siparişler — UTT'nin kendi aktif eczaneleri ve bu eczanelerdeki
-- aktif eczacı/teknisyenlerin, yalnız UTT firmasının puan kullandığı siparişleri.
-- Uygulama adımı: E-Club DB aktivasyonu sırasında SQL editöründe çalıştırılır.

CREATE OR REPLACE FUNCTION public.get_eclub_utt_siparisler(
  p_utt_id uuid,
  p_eczane_id uuid DEFAULT NULL::uuid,
  p_kisi_id uuid DEFAULT NULL::uuid,
  p_durum text DEFAULT NULL::text,
  p_tarih_baslangic timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tarih_bitis timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH ben AS (
    SELECT k.firma_id
    FROM public.kullanicilar k
    WHERE k.kullanici_id = p_utt_id
      AND lower(k.rol) IN ('utt', 'kd_utt')
  ),
  kapsam_eczaneler AS (
    SELECT DISTINCT
      ef.eczane_id,
      e.gln,
      COALESCE(m.eczane_adi, 'Adsız Eczane')::text AS eczane_adi
    FROM ben b
    JOIN public.eclub_eczane_firma ef
      ON ef.firma_id = b.firma_id
     AND ef.baglayan_utt_id = p_utt_id
     AND ef.aktif_mi = true
    JOIN public.eclub_eczaneler e ON e.eczane_id = ef.eczane_id
    LEFT JOIN public.eclub_eczane_master m ON m.gln = e.gln
  ),
  kapsam_kisiler AS (
    SELECT DISTINCT ON (k.kisi_id)
      k.kisi_id,
      ke.eczane_id,
      ke.gln,
      ke.eczane_adi,
      k.ad,
      k.soyad,
      k.rol
    FROM kapsam_eczaneler ke
    JOIN public.eclub_kisi_eczane kke
      ON kke.eczane_id = ke.eczane_id
     AND kke.aktif_mi = true
    JOIN public.eclub_kisiler k
      ON k.kisi_id = kke.kisi_id
     AND lower(k.rol) IN ('eczaci', 'eczane_teknisyeni')
    ORDER BY k.kisi_id, kke.baslangic_tarihi DESC NULLS LAST, kke.created_at DESC NULLS LAST
  ),
  firma_payi AS (
    SELECT
      sfp.siparis_id,
      SUM(sfp.kullanilan_puan)::bigint AS firma_kullanilan_puan
    FROM ben b
    JOIN public.eclub_store_siparis_firma_puan sfp ON sfp.firma_id = b.firma_id
    GROUP BY sfp.siparis_id
  ),
  filtreli AS (
    SELECT
      s.siparis_id,
      s.kisi_id,
      kk.eczane_id,
      kk.gln,
      kk.eczane_adi,
      kk.ad AS kisi_ad,
      kk.soyad AS kisi_soyad,
      kk.rol AS kisi_rol,
      s.urun_id,
      u.ad AS urun_adi,
      u.gorsel_url AS urun_gorsel_url,
      s.adres_snapshot,
      s.adet,
      s.puan_birim_fiyat,
      s.toplam_puan AS siparis_toplam_puan,
      fp.firma_kullanilan_puan,
      s.durum,
      s.kargo_firmasi,
      s.kargo_takip_no,
      s.iptal_sebebi,
      s.created_at,
      s.guncellenme_at,
      s.teslim_alma_at
    FROM public.eclub_store_siparisler s
    JOIN kapsam_kisiler kk ON kk.kisi_id = s.kisi_id
    JOIN firma_payi fp ON fp.siparis_id = s.siparis_id
    JOIN public.eclub_store_urunler u ON u.urun_id = s.urun_id
    WHERE (p_eczane_id IS NULL OR kk.eczane_id = p_eczane_id)
      AND (p_kisi_id IS NULL OR kk.kisi_id = p_kisi_id)
      AND (p_durum IS NULL OR s.durum = p_durum)
      AND (p_tarih_baslangic IS NULL OR s.created_at >= p_tarih_baslangic)
      AND (p_tarih_bitis IS NULL OR s.created_at < p_tarih_bitis)
  ),
  ozet AS (
    SELECT
      COUNT(*)::integer AS toplam,
      COUNT(*) FILTER (WHERE durum IN ('beklemede', 'hazirlaniyor'))::integer AS islemde,
      COUNT(*) FILTER (WHERE durum = 'kargoda')::integer AS kargoda,
      COUNT(*) FILTER (WHERE durum = 'teslim_edildi')::integer AS teslim_edildi,
      COUNT(*) FILTER (WHERE durum = 'iptal')::integer AS iptal,
      COALESCE(SUM(firma_kullanilan_puan) FILTER (WHERE durum <> 'iptal'), 0)::bigint AS firma_kullanilan_puan
    FROM filtreli
  ),
  sayfali AS (
    SELECT *
    FROM filtreli
    ORDER BY created_at DESC, siparis_id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'siparisler', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC, s.siparis_id)
      FROM sayfali s
    ), '[]'::jsonb),
    'toplam', (SELECT o.toplam FROM ozet o),
    'ozet', (SELECT to_jsonb(o) FROM ozet o),
    'kapsam', jsonb_build_object(
      'eczaneler', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('eczane_id', ke.eczane_id, 'eczane_adi', ke.eczane_adi, 'gln', ke.gln)
          ORDER BY ke.eczane_adi, ke.eczane_id
        )
        FROM kapsam_eczaneler ke
      ), '[]'::jsonb),
      'kisiler', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'kisi_id', kk.kisi_id,
            'eczane_id', kk.eczane_id,
            'ad', kk.ad,
            'soyad', kk.soyad,
            'rol', kk.rol
          ) ORDER BY kk.ad, kk.soyad, kk.kisi_id
        )
        FROM kapsam_kisiler kk
      ), '[]'::jsonb)
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.get_eclub_utt_siparisler(
  uuid, uuid, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_eclub_utt_siparisler(
  uuid, uuid, uuid, text, timestamp with time zone, timestamp with time zone, integer, integer
) TO service_role;
