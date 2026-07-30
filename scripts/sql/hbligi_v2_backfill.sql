-- scripts/sql/hbligi_v2_backfill.sql
--
-- E9 Faz 2.2 — HBLigi_v2 özet tablosu backfill (docs/E9_hebligi_gelistirme_is_plani.md).
-- Mevcut 4 olay tablosundan kişi × ay kovalarını tek seferde doldurur.
--
-- YETKİLİ TAM-HESAP (SET semantiği): ON CONFLICT ... DO UPDATE SET = EXCLUDED
-- (ekleme değil). Trigger (Faz 2.3) zaten aktif olduğundan backfill'i en son
-- koşmak, backfill anındaki gerçeği tabloya yazar; trigger'ın araya girmiş
-- kısmi eklemelerini tam-hesap ezer. Sonraki yazımları trigger yakalar.
-- Tekrar koşumu güvenli (idempotent, SET).
--
-- Kova: created_at'in yıl/ay'ı (oturum saat dilimi — periyot RPC'leri de
-- make_timestamptz ile aynısını kullanır; Faz 2.6 periyot bazında doğrular).
-- Tüm-zaman toplamı saat diliminden bağımsızdır (aylar toplamı = genel toplam).

INSERT INTO public.hb_ligi_ozet_v2 AS o
  (kullanici_id, yil, ay,
   izleme_puani, cevaplama_puani, oneri_puani, extra_puani,
   ileri_sarma_kaybi, yanlis_cevap_kaybi, oneri_kaybi, guncellenme)
SELECT
  t.kullanici_id,
  EXTRACT(year  FROM t.created_at)::smallint,
  EXTRACT(month FROM t.created_at)::smallint,
  SUM(t.izleme), SUM(t.cevaplama), SUM(t.oneri), SUM(t.extra),
  SUM(t.ileri), SUM(t.yanlis), SUM(t.onerikayip),
  now()
FROM (
  SELECT kullanici_id, created_at,
    CASE WHEN puan_turu = 'izleme'    THEN puan ELSE 0 END AS izleme,
    CASE WHEN puan_turu = 'cevaplama' THEN puan ELSE 0 END AS cevaplama,
    CASE WHEN puan_turu = 'oneri'     THEN puan ELSE 0 END AS oneri,
    CASE WHEN puan_turu = 'extra'     THEN puan ELSE 0 END AS extra,
    0 AS ileri, 0 AS yanlis, 0 AS onerikayip
  FROM kazanilan_puanlar
  UNION ALL
  SELECT kullanici_id, created_at, 0,0,0,0, kaybedilen_puan, 0, 0 FROM ileri_sarma_kayitlari
  UNION ALL
  SELECT kullanici_id, created_at, 0,0,0,0, 0, kaybedilen_puan, 0 FROM yanlis_cevap_kayitlari
  UNION ALL
  SELECT kullanici_id, created_at, 0,0,0,0, 0, 0, kaybedilen_puan FROM oneri_kayip_kayitlari
) t
GROUP BY t.kullanici_id,
         EXTRACT(year  FROM t.created_at),
         EXTRACT(month FROM t.created_at)
ON CONFLICT (kullanici_id, yil, ay) DO UPDATE SET
  izleme_puani       = EXCLUDED.izleme_puani,
  cevaplama_puani    = EXCLUDED.cevaplama_puani,
  oneri_puani        = EXCLUDED.oneri_puani,
  extra_puani        = EXCLUDED.extra_puani,
  ileri_sarma_kaybi  = EXCLUDED.ileri_sarma_kaybi,
  yanlis_cevap_kaybi = EXCLUDED.yanlis_cevap_kaybi,
  oneri_kaybi        = EXCLUDED.oneri_kaybi,
  guncellenme        = now();
