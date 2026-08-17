-- E-Club video gönderim ayarları: yalnız izleme süresi ve aynı video tekrar süresi.

BEGIN;

INSERT INTO public.sistem_ayarlari (anahtar, deger, aciklama) VALUES
  (
    'eclub_oneri_gecerlilik_gun',
    '7'::jsonb,
    'E-Club önerisinin izlenebildiği, soru sunduğu ve puan kazandırdığı gün sayısı.'
  ),
  (
    'eclub_ayni_video_tekrar_bekleme_gun',
    '21'::jsonb,
    'Aynı UTT''nin aynı kişiye aynı videoyu, önceki önerinin bitişinden sonra yeniden göndermek için bekleyeceği gün sayısı.'
  )
ON CONFLICT (anahtar) DO UPDATE
SET aciklama = EXCLUDED.aciklama,
    updated_at = now();

DELETE FROM public.sistem_ayarlari
WHERE anahtar IN (
  'eclub_aylik_gonderim_limiti',
  'eclub_gonderim_araligi_gun',
  'eclub_alici_pencere_gun',
  'eclub_alici_haftalik_limit'
);

COMMIT;

SELECT anahtar, deger, aciklama
FROM public.sistem_ayarlari
WHERE anahtar IN (
  'eclub_oneri_gecerlilik_gun',
  'eclub_ayni_video_tekrar_bekleme_gun'
)
ORDER BY anahtar;
