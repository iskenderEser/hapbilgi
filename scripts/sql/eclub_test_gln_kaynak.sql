-- Admin tarafından üretilen 111 önekli test GLN'lerinin master sicilde
-- açıkça ayırt edilmesini sağlar. Mevcut resmi/elle kaynakları korunur.

ALTER TABLE public.eclub_eczane_master
  DROP CONSTRAINT IF EXISTS eclub_eczane_master_kaynak_check;

ALTER TABLE public.eclub_eczane_master
  ADD CONSTRAINT eclub_eczane_master_kaynak_check
  CHECK (kaynak IN ('resmi', 'elle', 'test'));
