-- ============================================================================
-- E-Club Store: Ayın İlk 7 Günü Sipariş Takvimi Güncellemesi
-- Dosya: scripts/sql/eclub_store_ayin_ilk_yedi_gunu_takvimi.sql
--
-- GÜNCELLEME AMACI:
--   E-Club Store sipariş günlerini "ayın son 7 günü" kuralından,
--   "her ayın ilk 7 günü (1–7)" takvimine geçirir.
--
-- Sipariş Takvimi Kuralları (Europe/Istanbul):
--   * Her ayın 1. günü 00:00:00 TR'de açılır.
--   * Her ayın 8. günü 00:00:00 TR'de kapanır (8. gün hariç; 7. günün 23:59:59'u dahil).
--   * Şubat (28 ve 29 gün), 30 ve 31 günlük tüm aylarda ve yıl geçişlerinde aynı
--     1–7 günleri kuralı kesintisiz ve dinamik olarak çalışır.
--
-- Bakiye ve Puan Mimarisi Güvencesi:
--   * Hiç kullanılmamış puanlar ve sipariş sonrası kalan bakiyeler sonraki aylara
--     EKSİKSİZ devreder (get_eclub_store_firma_bakiye fonksiyonunda aylık filtre
--     veya sıfırlama kuralı bulunmaz; birikimli hesap korunur).
--   * Sipariş haftasında kazanılan puanlar anında kullanılabilir bakiyeye katılır;
--     herhangi bir bloke veya dondurma işlemi yapılmaz.
--
-- Eşzamanlılık ve Güvenlik:
--   * eclub_store_siparis_olustur fonksiyonundaki çift takvim kontrolü (erken kontrol ve
--     FOR UPDATE kilitleri sonrası, ilk sipariş INSERT'i öncesi clock_timestamp() kontrolü)
--     bu fonksiyonu doğrudan çağırdığı için sipariş fonksiyonunun yeniden yazılması gerekmez;
--     takvim güncellemesi tüm akışta anında yürürlüğe girer.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.eclub_store_siparis_donemi_acik_mi(
  p_zaman timestamptz DEFAULT clock_timestamp()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_yerel timestamp;
  v_gun integer;
BEGIN
  -- p_zaman timestamptz'i Türkiye saatine (Europe/Istanbul) dönüştür
  v_yerel := p_zaman AT TIME ZONE 'Europe/Istanbul';
  v_gun := EXTRACT(DAY FROM v_yerel)::integer;

  -- Her ayın 1. günü 00:00:00 TR ile 8. günü 00:00:00 TR hariç arası:
  -- Gün 1, 2, 3, 4, 5, 6 ve 7 boyunca açıktır; gün >= 8 veya gün < 1 kapalıdır.
  IF v_gun >= 1 AND v_gun <= 7 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.eclub_store_siparis_donemi_acik_mi(timestamptz)
  TO authenticated, service_role, anon;

COMMIT;
