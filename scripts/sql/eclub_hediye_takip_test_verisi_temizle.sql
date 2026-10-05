-- Yalnız Hediye Takibi görünüm testi için kullanılan sekiz sabit talebi ve
-- bu senaryo için ayrılmış iki test eczanesini temizler.
-- Kullanıcı, ürün, yayın, puan veya gerçek eczane/talep silmez.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtextextended('hapbilgi-eclub-hediye-takip-gorunum-test-v1', 0)
);

CREATE TEMP TABLE eclub_hediye_takip_test_idleri (
  talep_id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO eclub_hediye_takip_test_idleri (talep_id) VALUES
  ('e1100000-0000-4000-8000-000000000001'::uuid),
  ('e1100000-0000-4000-8000-000000000002'::uuid),
  ('e1100000-0000-4000-8000-000000000003'::uuid),
  ('e1100000-0000-4000-8000-000000000004'::uuid),
  ('e1100000-0000-4000-8000-000000000005'::uuid),
  ('e1100000-0000-4000-8000-000000000006'::uuid),
  ('e1100000-0000-4000-8000-000000000007'::uuid),
  ('e1100000-0000-4000-8000-000000000008'::uuid);

DO $kontrol$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.eclub_store_cek_talepleri t
    JOIN eclub_hediye_takip_test_idleri x ON x.talep_id = t.talep_id
    WHERE t.utt_id IS DISTINCT FROM '765b6890-183f-4518-b887-07003ff5cdc7'::uuid
       OR t.donem_kodu NOT IN (
         '2099-P1', '2099-P2', '2099-P3', '2099-P4', '2099-P5', '2099-P6',
         '2100-P1', '2100-P2'
       )
  ) THEN
    RAISE EXCEPTION 'Sabit test UUIDlerinden biri beklenen test kapsamı dışında; temizlik durduruldu.';
  END IF;
END;
$kontrol$;

DELETE FROM public.eclub_bildirimler b
USING eclub_hediye_takip_test_idleri x
WHERE b.kayit_turu = 'cek' AND b.kayit_id = x.talep_id;

DELETE FROM public.eclub_siparis_utt_onaylari s
USING eclub_hediye_takip_test_idleri x
WHERE s.talep_id = x.talep_id;

DELETE FROM public.eclub_cek_teslimat_outbox o
USING eclub_hediye_takip_test_idleri x
WHERE o.talep_id = x.talep_id;

DELETE FROM public.eclub_store_puan_devirleri d
USING eclub_hediye_takip_test_idleri x
WHERE d.kaynak_talep_id = x.talep_id
   OR d.kullanilan_talep_id = x.talep_id;

DELETE FROM public.eclub_store_cek_talepleri t
USING eclub_hediye_takip_test_idleri x
WHERE t.talep_id = x.talep_id;

DELETE FROM public.eclub_kisi_eczane ke
USING public.eclub_eczaneler e
WHERE ke.eczane_id = e.eczane_id
  AND e.gln IN ('1119000000001', '1119000000002');

DELETE FROM public.eclub_depo_tercih_gecmisi g
USING public.eclub_eczaneler e
WHERE g.eczane_id = e.eczane_id
  AND e.gln IN ('1119000000001', '1119000000002');

DELETE FROM public.eclub_eczane_depo_tercihleri d
USING public.eclub_eczaneler e
WHERE d.eczane_id = e.eczane_id
  AND e.gln IN ('1119000000001', '1119000000002');

DELETE FROM public.eclub_utt_eczane ue
USING public.eclub_eczane_firma ef, public.eclub_eczaneler e
WHERE ue.eczane_firma_id = ef.id
  AND ef.eczane_id = e.eczane_id
  AND e.gln IN ('1119000000001', '1119000000002');

DELETE FROM public.eclub_eczane_firma ef
USING public.eclub_eczaneler e
WHERE ef.eczane_id = e.eczane_id
  AND e.gln IN ('1119000000001', '1119000000002');

DELETE FROM public.eclub_eczaneler e
WHERE e.gln IN ('1119000000001', '1119000000002');

DELETE FROM public.eclub_eczane_master em
WHERE em.gln IN ('1119000000001', '1119000000002')
  AND em.kaynak = 'test';

COMMIT;

SELECT count(*) AS kalan_test_talebi
FROM public.eclub_store_cek_talepleri
WHERE talep_id IN (
  'e1100000-0000-4000-8000-000000000001'::uuid,
  'e1100000-0000-4000-8000-000000000002'::uuid,
  'e1100000-0000-4000-8000-000000000003'::uuid,
  'e1100000-0000-4000-8000-000000000004'::uuid,
  'e1100000-0000-4000-8000-000000000005'::uuid,
  'e1100000-0000-4000-8000-000000000006'::uuid,
  'e1100000-0000-4000-8000-000000000007'::uuid,
  'e1100000-0000-4000-8000-000000000008'::uuid
);
