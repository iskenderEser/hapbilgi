-- scripts/sql/get_kullanici_kategori_dagilimi.sql
--
-- Kullanıcı × eğitim kategorisi dağılımı — get_kullanici_urun_dagilimi'nin ikizi.
--
-- NEDEN AYRI FONKSİYON (06.08.2026):
-- Ürün dağılımı fonksiyonunun son SELECT'i `JOIN urunler` ile INNER'dır; bu
-- bilinçli bir karardır (o dosyanın DAVRANIŞ NOTU'na bakınız) ve ürünsüz içeriği
-- (medikal, İK) ürün raporunun dışında tutar. Sonuç: kullanıcının toplam puanı
-- ile ürün dağılımının toplamı ürünsüz içerik kadar ayrışır. Bu fonksiyon o
-- ayrışan kısmı görünür kılar — kırılım ürüne değil, yayının içerik türüne göre
-- yapılır, dolayısıyla HER puan bir kategoriye düşer ve kategori toplamı
-- kullanıcının toplam net puanına eşit olmak zorundadır.
--
-- İKİZİNDEN TEK FARKI eksen değişimidir: `ky.urun_id` yerine `ky.icerik_turu`.
-- Dört defter (kazanım, ileri sarma, yanlış cevap, öneri kaybı), matematik,
-- rol filtresi ve scope parametreleri AYNEN korunmuştur — böylece BM/TM/firma
-- raporları da aynı fonksiyonu kendi scope'uyla çağırabilir.
--
-- ETİKET YOK: Fonksiyon `icerik_turu` anahtarını döner, insan okunur başlığı
-- dönmez. Başlık tek kaynaktan gelir (lib/uretici/yetenekler.ts →
-- TALEP_TURU_KURALLARI.ad); DB'ye ikinci bir etiket kopyası yazılmaz.
--
-- SIRALAMA: Gösterim sırası da tek kaynaktadır (lib/video/icerikTuru.ts →
-- TUR_SIRA). Fonksiyon yalnızca belirlenimci bir sıra verir, sunum sırasını
-- dayatmaz.
--
-- KOŞUM: İskender, Supabase SQL editöründe. CREATE OR REPLACE → tekrar güvenli.

CREATE OR REPLACE FUNCTION public.get_kullanici_kategori_dagilimi(
  p_baslangic timestamp with time zone,
  p_bitis timestamp with time zone,
  p_kullanici_id uuid DEFAULT NULL::uuid,
  p_bolge_id uuid DEFAULT NULL::uuid,
  p_takim_id uuid DEFAULT NULL::uuid,
  p_firma_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  kullanici_id uuid, ad text, soyad text, icerik_turu text,
  izlenme_sayisi integer, video_puani integer, soru_puani integer,
  oneri_puani integer, extra_puan integer, ileri_sarma_kaybi integer,
  yanlis_cevap_kaybi integer, oneri_kaybi integer, toplam_net_puan integer,
  teknik_dagilimi jsonb
)
LANGUAGE plpgsql
STABLE
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH
  scoped_users AS (
    SELECT k.kullanici_id, k.ad::text AS ad, k.soyad::text AS soyad
    FROM kullanicilar k
    WHERE k.aktif_mi = true
      AND k.rol IN ('utt', 'kd_utt')
      AND (p_kullanici_id IS NULL OR k.kullanici_id = p_kullanici_id)
      AND (p_bolge_id    IS NULL OR k.bolge_id    = p_bolge_id)
      AND (p_takim_id    IS NULL OR k.takim_id    = p_takim_id)
      AND (p_firma_id    IS NULL OR k.firma_id    = p_firma_id)
  ),
  kazanim AS (
    SELECT
      kp.kullanici_id,
      ky.icerik_turu::text AS icerik_turu,
      SUM(CASE WHEN kp.puan_turu = 'izleme'    THEN kp.puan ELSE 0 END)::int AS video_puani,
      SUM(CASE WHEN kp.puan_turu = 'cevaplama' THEN kp.puan ELSE 0 END)::int AS soru_puani,
      SUM(CASE WHEN kp.puan_turu = 'oneri'     THEN kp.puan ELSE 0 END)::int AS oneri_puani,
      SUM(CASE WHEN kp.puan_turu = 'extra'     THEN kp.puan ELSE 0 END)::int AS extra_puan,
      COUNT(*) FILTER (WHERE kp.puan_turu = 'izleme')::int AS izlenme_sayisi
    FROM kazanilan_puanlar kp
    JOIN v_yayin_kunye ky ON ky.yayin_id = kp.yayin_id
    WHERE kp.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY kp.kullanici_id, ky.icerik_turu
  ),
  ileri_sarma AS (
    SELECT isk.kullanici_id, ky.icerik_turu::text AS icerik_turu,
      SUM(isk.kaybedilen_puan)::int AS toplam_kayip
    FROM ileri_sarma_kayitlari isk
    JOIN v_yayin_kunye ky ON ky.yayin_id = isk.yayin_id
    WHERE isk.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND isk.created_at >= p_baslangic AND isk.created_at <= p_bitis
    GROUP BY isk.kullanici_id, ky.icerik_turu
  ),
  yanlis_cevap AS (
    SELECT ycb.kullanici_id, ky.icerik_turu::text AS icerik_turu,
      SUM(ycb.kaybedilen_puan)::int AS toplam_kayip
    FROM yanlis_cevap_kayitlari ycb
    JOIN v_yayin_kunye ky ON ky.yayin_id = ycb.yayin_id
    WHERE ycb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND ycb.created_at >= p_baslangic AND ycb.created_at <= p_bitis
    GROUP BY ycb.kullanici_id, ky.icerik_turu
  ),
  oneri_kayip AS (
    SELECT okb.kullanici_id, ky.icerik_turu::text AS icerik_turu,
      SUM(okb.kaybedilen_puan)::int AS toplam_kayip
    FROM oneri_kayip_kayitlari okb
    JOIN v_yayin_kunye ky ON ky.yayin_id = okb.yayin_id
    WHERE okb.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND okb.created_at >= p_baslangic AND okb.created_at <= p_bitis
    GROUP BY okb.kullanici_id, ky.icerik_turu
  ),
  -- Teknik kırılımı ürün ikizindeki ile aynı mantıkta; tekniği olmayan
  -- kategorilerde (medikal, İK) doğal olarak boş kalır.
  teknik_kayitlari AS (
    SELECT
      kp.kullanici_id,
      ky.icerik_turu::text AS icerik_turu,
      tk.teknik_adi::text AS teknik_adi,
      COUNT(*)::int AS izlenme_sayisi
    FROM kazanilan_puanlar kp
    JOIN v_yayin_kunye ky ON ky.yayin_id  = kp.yayin_id
    JOIN teknikler tk     ON tk.teknik_id = ky.teknik_id
    WHERE kp.kullanici_id IN (SELECT kullanici_id FROM scoped_users)
      AND kp.puan_turu = 'izleme'
      AND kp.created_at >= p_baslangic AND kp.created_at <= p_bitis
    GROUP BY kp.kullanici_id, ky.icerik_turu, tk.teknik_adi
  ),
  teknik_dagilim AS (
    SELECT
      tk.kullanici_id,
      tk.icerik_turu,
      jsonb_agg(
        jsonb_build_object('teknik_adi', tk.teknik_adi, 'izlenme_sayisi', tk.izlenme_sayisi)
        ORDER BY tk.izlenme_sayisi DESC
      ) AS dagilim
    FROM teknik_kayitlari tk
    GROUP BY tk.kullanici_id, tk.icerik_turu
  ),
  birlesik AS (
    SELECT kullanici_id, icerik_turu FROM kazanim
    UNION
    SELECT kullanici_id, icerik_turu FROM ileri_sarma
    UNION
    SELECT kullanici_id, icerik_turu FROM yanlis_cevap
    UNION
    SELECT kullanici_id, icerik_turu FROM oneri_kayip
  )
  SELECT
    su.kullanici_id,
    su.ad,
    su.soyad,
    b.icerik_turu,
    COALESCE(k.izlenme_sayisi, 0),
    COALESCE(k.video_puani, 0),
    COALESCE(k.soru_puani, 0),
    COALESCE(k.oneri_puani, 0),
    COALESCE(k.extra_puan, 0),
    COALESCE(isk.toplam_kayip, 0),
    COALESCE(yc.toplam_kayip, 0),
    COALESCE(ok.toplam_kayip, 0),
    (COALESCE(k.video_puani, 0) + COALESCE(k.soru_puani, 0)
      + COALESCE(k.oneri_puani, 0) + COALESCE(k.extra_puan, 0)
      - COALESCE(isk.toplam_kayip, 0) - COALESCE(yc.toplam_kayip, 0)
      - COALESCE(ok.toplam_kayip, 0))::int,
    COALESCE(td.dagilim, '[]'::jsonb)
  FROM birlesik b
  JOIN scoped_users su ON su.kullanici_id = b.kullanici_id
  LEFT JOIN kazanim      k   ON k.kullanici_id   = b.kullanici_id AND k.icerik_turu   = b.icerik_turu
  LEFT JOIN ileri_sarma  isk ON isk.kullanici_id = b.kullanici_id AND isk.icerik_turu = b.icerik_turu
  LEFT JOIN yanlis_cevap yc  ON yc.kullanici_id  = b.kullanici_id AND yc.icerik_turu  = b.icerik_turu
  LEFT JOIN oneri_kayip  ok  ON ok.kullanici_id  = b.kullanici_id AND ok.icerik_turu  = b.icerik_turu
  LEFT JOIN teknik_dagilim td ON td.kullanici_id = b.kullanici_id AND td.icerik_turu  = b.icerik_turu
  ORDER BY b.icerik_turu, su.ad, su.soyad;
END;
$function$;
