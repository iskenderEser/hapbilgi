-- E-Club'ta Gönderi Sayısı Limitleri
-- Mevcut değerleri korur; eksik anahtarları güvenli varsayılanlarla ekler.

INSERT INTO public.sistem_ayarlari (anahtar, deger, aciklama) VALUES
  (
    'eclub_aylik_gonderim_limiti',
    '100'::jsonb,
    'Bir UTT''nin bir takvim ayında gönderebileceği toplam E-Club video önerisi.'
  ),
  (
    'eclub_oneri_gecerlilik_gun',
    '7'::jsonb,
    'E-Club önerisinin izlenebildiği, soru sunduğu ve puan kazandırdığı gün sayısı.'
  ),
  (
    'eclub_gonderim_araligi_gun',
    '7'::jsonb,
    'Aynı UTT''nin aynı kişiye yeniden E-Club videosu gönderebilmek için bekleyeceği gün sayısı.'
  ),
  (
    'eclub_alici_pencere_gun',
    '7'::jsonb,
    'Bir kişinin aldığı toplam E-Club önerilerinin geriye doğru sayılacağı kayan gün penceresi.'
  ),
  (
    'eclub_alici_haftalik_limit',
    '20'::jsonb,
    'Bir kişinin alıcı koruma penceresi içinde tüm UTT''lerden alabileceği toplam E-Club önerisi.'
  )
ON CONFLICT (anahtar) DO UPDATE
SET aciklama = EXCLUDED.aciklama,
    updated_at = now();

SELECT anahtar, deger, aciklama
FROM public.sistem_ayarlari
WHERE anahtar IN (
  'eclub_aylik_gonderim_limiti',
  'eclub_oneri_gecerlilik_gun',
  'eclub_gonderim_araligi_gun',
  'eclub_alici_pencere_gun',
  'eclub_alici_haftalik_limit'
)
ORDER BY anahtar;
