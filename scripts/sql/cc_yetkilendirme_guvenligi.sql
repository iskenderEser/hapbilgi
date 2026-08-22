-- C-Club tablolarını doğrudan istemci erişimine kapatır.
-- Bütün okuma/yazma işlemleri, doğrulanmış oturum kimliğini kullanan sunucu
-- uçlarından service_role ile yürütülür.
-- Supabase SQL Editor'da İskender tarafından bir kez çalıştırılır.

BEGIN;

ALTER TABLE public.cc_izleme_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_kazanilan_puanlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_ileri_sarma_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_yanlis_cevap_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_kayip_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_ligi_ozet ENABLE ROW LEVEL SECURITY;

-- Bu iç tablolar için doğrudan kullanıcı politikası bilinçli olarak yoktur:
-- authenticated/anon rolleri tablo yetkisi alamaz; service_role RLS'yi aşar.
REVOKE ALL ON TABLE
  public.cc_izleme_kayitlari,
  public.cc_kazanilan_puanlar,
  public.cc_ileri_sarma_kayitlari,
  public.cc_yanlis_cevap_kayitlari,
  public.challenge_kayitlari,
  public.challenge_kayip_kayitlari,
  public.cc_ligi_ozet
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  public.cc_izleme_kayitlari,
  public.cc_kazanilan_puanlar,
  public.cc_ileri_sarma_kayitlari,
  public.cc_yanlis_cevap_kayitlari,
  public.challenge_kayitlari,
  public.challenge_kayip_kayitlari,
  public.cc_ligi_ozet
TO service_role;

REVOKE ALL ON public.v_cc_challenge_listesi FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_cc_challenge_listesi TO service_role;

REVOKE ALL ON FUNCTION public.cc_challenge_gonder(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cc_cevaplari_kaydet(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.challenge_kaybi_tara()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cc_ligi_ozet_guncelle()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cc_challenge_gonder(uuid, uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.cc_izleme_tamamla(uuid, uuid, integer[], timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.cc_cevaplari_kaydet(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.challenge_kaybi_tara() TO service_role;
GRANT EXECUTE ON FUNCTION public.cc_ligi_ozet_guncelle() TO service_role;
GRANT EXECUTE ON FUNCTION public.cc_challenge_tamamlaninca_bildirim_kapat() TO service_role;

REVOKE ALL ON FUNCTION public._cc_ligi_aralik(date, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cc_ligi_aylik(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cc_ligi_donemlik(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cc_ligi_yillik(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cc_ligi_haftalik(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cc_ligi_donem_lideri(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cc_ligi_yil_lideri(integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._cc_ligi_aralik(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_aylik(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_donemlik(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_yillik(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_haftalik(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_donem_lideri(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cc_ligi_yil_lideri(integer) TO service_role;

COMMIT;
