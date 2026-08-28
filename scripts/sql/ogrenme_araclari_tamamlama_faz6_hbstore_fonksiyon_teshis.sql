-- Salt okunur: canlı HBStore bakiye fonksiyonunun gerçek tanımını gösterir.
SELECT pg_get_functiondef(
  'public.get_harcama_bakiyesi(uuid)'::regprocedure
) AS fonksiyon_tanimi;
