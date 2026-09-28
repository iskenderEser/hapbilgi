-- Faz 4: Çek kodu teslim transaction'ında bütün aktif eczane çalışanlarına
-- uygulama içi bildirim oluşturur.
BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('hapbilgi-eclub-cek-uygulama-bildirimleri-faz-4', 1));

CREATE OR REPLACE FUNCTION public.eclub_cek_uygulama_bildirimi_yaz()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  INSERT INTO public.eclub_bildirimler (
    alici_kisi_id,
    gonderen_id,
    kayit_turu,
    kayit_id,
    mesaj,
    goruldu_mu
  )
  SELECT
    k.kisi_id,
    NULL,
    'cek',
    NEW.talep_id,
    'Eczanenizin Migros hediye çeki hazır. Çek kodunu Çek Taleplerim ekranından görüntüleyebilirsiniz.',
    false
  FROM public.eclub_kisi_eczane ke
  JOIN public.eclub_kisiler k ON k.kisi_id = ke.kisi_id
  WHERE ke.eczane_id = NEW.eczane_id
    AND ke.aktif_mi = true
    AND k.auth_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.eclub_bildirimler b
      WHERE b.alici_kisi_id = k.kisi_id
        AND b.kayit_turu = 'cek'
        AND b.kayit_id = NEW.talep_id
    );

  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS eclub_cek_uygulama_bildirimi_trg
  ON public.eclub_store_cek_talepleri;
CREATE TRIGGER eclub_cek_uygulama_bildirimi_trg
AFTER UPDATE OF durum, cek_kodu ON public.eclub_store_cek_talepleri
FOR EACH ROW
WHEN (
  OLD.durum IS DISTINCT FROM NEW.durum
  AND NEW.durum = 'teslimat_bekliyor'
  AND NEW.cek_kodu IS NOT NULL
)
EXECUTE FUNCTION public.eclub_cek_uygulama_bildirimi_yaz();

REVOKE ALL ON FUNCTION public.eclub_cek_uygulama_bildirimi_yaz()
  FROM PUBLIC, anon, authenticated;

COMMIT;
