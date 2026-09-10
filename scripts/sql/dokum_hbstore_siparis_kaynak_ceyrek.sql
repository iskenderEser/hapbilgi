-- ============================================================================
-- HBStore: Mevcut Siparişler İçin Kaynak Çeyrek Döküm Sorgusu
-- Dosya: scripts/sql/dokum_hbstore_siparis_kaynak_ceyrek.sql
--
-- KURALLAR:
--   * Salt-okunur (read-only) durum tespit raporudur. Kesinlikle veri DEĞİŞTİRMEZ.
--   * Henüz tabloda bulunmayan kolona doğrudan erişilmez; mevcut değer
--     (to_jsonb(s)->>'kaynak_ceyrek_baslangici')::timestamptz ile güvenli okunur.
--   * Kaynak çeyrek kolonda kayıtlıysa gösterilir; kayıtlı değilse "DOĞRULANMADI" yazılır.
--   * Siparişin ay/gün bilgisine bakılarak tahminî sınıflandırma yapılmaz.
--   * Tek bir sonuç tablosu döndürür.
-- ============================================================================

SELECT
  s.siparis_id,
  to_char(s.created_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI:SS') AS siparis_tarihi_tr,
  s.toplam_puan,
  s.durum,
  CASE
    WHEN (to_jsonb(s)->>'kaynak_ceyrek_baslangici')::timestamptz IS NOT NULL
      THEN to_char(((to_jsonb(s)->>'kaynak_ceyrek_baslangici')::timestamptz) AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD')
    ELSE 'DOĞRULANMADI'
  END AS kaynak_ceyrek
FROM public.store_siparisler s
ORDER BY s.created_at DESC;
