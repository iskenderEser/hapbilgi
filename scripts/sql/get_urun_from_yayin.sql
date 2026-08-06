-- scripts/sql/get_urun_from_yayin.sql
--
-- Yayından ürüne çözüm — puan/kayıp yazımının urun_id denormalizasyonunu besleyen
-- tek kaynak (REDBOOK §2.5 İlke 2). Dört tüketim katmanı da bunu çağırır:
-- lib/puan/kayit.ts (T-Club), lib/puan/eclubKayit.ts (E-Club),
-- lib/cc/kayit.ts (Challenge Club), lib/eczanem/kazanim.ts (Eczanem)
-- ve scripts/sql/oneri_kaybi_tara.sql (öneri kaybı cron'u).
--
-- SORUN (05.08.2026 — Arıza 1): Fonksiyon yayından talebe SENARYO üzerinden
-- gidiyordu:
--     yayın → soru seti → video → senaryo_durumu → senaryolar → talep
-- 22.07.2026'da zincir talebe doğrudan bağlandı; `videolar.senaryo_durum_id`
-- nullable yapıldı çünkü hazır video kolunda senaryo HİÇ yazılmaz. INNER JOIN
-- boş senaryo bağında satırı düşürdüğü için fonksiyon NULL dönüyordu; ürün
-- çözülemeyince puan yazımı en başında duruyor ve kullanıcıya "İzleme puanı
-- kaydedilemedi" uyarısı çıkıyordu.
-- Ölçüm: 26 yayının 9'u bu sebeple puansızdı — V2 (hazır video) ve V4 (ikisi de
-- hazır) varyantlarının TAMAMI. V1 ve V3 etkilenmiyordu (senaryoları var).
--
-- ÇÖZÜM: Zincirden video ve senaryo halkaları çıkarıldı; soru seti doğrudan
-- kendi `talep_id`'sine bağlanıyor (22.07'de eklenen bağ).
-- Ön kontrol (05.08.2026): 26 soru setinin hiçbirinde `talep_id` boş değil,
-- yayına bağlı talepsiz soru seti yok → doğrudan bağ güvenli, yedek yola gerek
-- duyulmadı.
--
-- KAPSAM DIŞI: Ürünsüz içerik (medikal / İK) bu düzeltmeyle de puan yazamaz —
-- orada ürün gerçekten yoktur (Arıza 2, ayrı karar).
--
-- GÜNCELLEME (05.08.2026 — künye): Zincir artık burada da yazılı değil.
-- Yayının nitelikleri tek kaynaktan okunuyor: v_yayin_kunye. Zincir değişirse
-- tek yer güncellenir; bu fonksiyonun bir daha bayatlaması yapısal olarak
-- imkânsız hâle gelir (Arıza 1'in tekrarı önlenmiş olur).
--
-- İmza, dönüş tipi ve volatility aynen korunmuştur; CREATE OR REPLACE mevcut
-- yetkileri (GRANT) düşürmez.
-- KOŞUM: İskender, Supabase SQL editöründe. Tekrar koşum güvenli.

CREATE OR REPLACE FUNCTION public.get_urun_from_yayin(p_yayin_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  SELECT ky.urun_id
  FROM v_yayin_kunye ky
  WHERE ky.yayin_id = p_yayin_id;
$function$;
