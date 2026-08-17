-- E-Club aynı video tekrar gönderim kuralının yönetilebilir gün değeri.
-- Mevcut değeri korur; yalnız eksik anahtarı 21 gün varsayılanıyla ekler.

INSERT INTO public.sistem_ayarlari (anahtar, deger, aciklama)
VALUES (
  'eclub_ayni_video_tekrar_bekleme_gun',
  '21'::jsonb,
  'Aynı UTT''nin aynı kişiye aynı videoyu, önceki önerinin bitişinden sonra yeniden göndermek için bekleyeceği gün sayısı.'
)
ON CONFLICT (anahtar) DO UPDATE
SET aciklama = EXCLUDED.aciklama,
    updated_at = now();

SELECT
  anahtar,
  deger,
  aciklama,
  (deger #>> '{}')::integer > 0 AS gecerli_deger
FROM public.sistem_ayarlari
WHERE anahtar = 'eclub_ayni_video_tekrar_bekleme_gun';
