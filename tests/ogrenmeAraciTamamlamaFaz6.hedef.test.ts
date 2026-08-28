import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const butunluk = oku("scripts/sql/ogrenme_araclari_tamamlama_faz6_puan_butunlugu.sql");
const mutabakat = oku("scripts/sql/ogrenme_araclari_tamamlama_faz6_mutabakat.sql");
const uttBitir = oku("app/izle/api/bitir/route.ts");
const bmBitir = oku("app/(panel)/challenge-club/izle/api/bitir/route.ts");
const eclubBitir = oku("app/(panel)/eclub/panel/api/bitir/route.ts");
const eczanemBitir = oku("app/eczanem/api/izleme/bitir/route.ts");

test("araç türleri mevcut yayın ve ortak tamamlama puanı omurgasını kullanır", () => {
  assert.match(uttBitir, /utt_izleme_tamamla/);
  assert.match(bmBitir, /cc_izleme_tamamla/);
  assert.match(eclubBitir, /eclub_izleme_tamamla/);
  assert.match(eczanemBitir, /eczanem_izleme_tamamla/);
  for (const kaynak of [uttBitir, bmBitir, eclubBitir, eczanemBitir]) {
    assert.match(kaynak, /tamamlamaKanitiDogrula/);
  }
});

test("puan satırları yayın ve izleme sahibine veritabanı kapısıyla bağlanır", () => {
  for (const tablo of ["kazanilan_puanlar", "cc_kazanilan_puanlar", "eclub_kazanilan_puanlar", "eczanem_puan_kayitlari"]) {
    assert.match(butunluk, new RegExp(`TRIGGER trg_ogrenme_puani_bag_[\\s\\S]*?ON public\\.${tablo}`));
  }
  assert.match(butunluk, /ogrenme_puani_izleme_bagini_dogrula/);
});

test("aynı tamamlamanın ikinci puanı tekillik kurallarıyla engellenir", () => {
  assert.match(butunluk, /eczanem_puan_izleme_turu_uq/);
  assert.match(butunluk, /\(izleme_id, puan_turu\)/);
  assert.match(mutabakat, /puan_turu IN \('izleme','extra','oneri'\)/);
  assert.match(mutabakat, /puan_turu IN \('izleme','extra'\)/);
});

test("BM referral puanı gönderen ile alıcının farklı olmasını doğru challenge bağıyla kabul eder", () => {
  assert.match(butunluk, /p\.puan_turu = 'cc_referral'/);
  assert.match(butunluk, /c\.gonderen_id = p\.bm_id/);
  assert.match(butunluk, /c\.alan_id = i\.bm_id/);
  assert.match(butunluk, /i\.challenge_id = c\.challenge_id/);
});

test("BM HBStore bakiyesi UTT yerine C-Club puan ve kayıp defterlerini kullanır", () => {
  const bmDali = butunluk.slice(butunluk.indexOf("  ELSE\n    SELECT COALESCE(SUM(p.puan)"), butunluk.indexOf("  END IF;\n\n  SELECT", butunluk.indexOf("  ELSE\n    SELECT COALESCE(SUM(p.puan)")));
  assert.match(bmDali, /public\.cc_kazanilan_puanlar/);
  assert.match(bmDali, /p\.bm_id = p_kullanici_id/);
  assert.match(bmDali, /public\.cc_ileri_sarma_kayitlari/);
  assert.match(bmDali, /public\.cc_yanlis_cevap_kayitlari/);
  assert.match(bmDali, /public\.challenge_kayip_kayitlari/);
  assert.doesNotMatch(bmDali, /FROM public\.kazanilan_puanlar/);
});

test("UTT ve BM lig özetleri gerçek puan ve kayıp defterleriyle karşılaştırılır", () => {
  assert.match(mutabakat, /FULL JOIN public\.hb_ligi_ozet_v2/);
  assert.match(mutabakat, /FULL JOIN public\.cc_ligi_ozet/);
  assert.match(mutabakat, /cc_gonderme_puani/);
  assert.match(mutabakat, /cc_referral_puani/);
});

test("üç ödül ekonomisi kanonik bakiye ve FIFO kayıtlarıyla mutabakata alınır", () => {
  assert.match(mutabakat, /public\.get_harcama_bakiyesi/);
  assert.match(mutabakat, /public\.get_eclub_store_firma_bakiye/);
  assert.match(mutabakat, /public\.eczanem_harcama_kayitlari/);
  assert.match(mutabakat, /tarife_snapshot/);
  assert.match(mutabakat, /indirim_tl/);
});

test("iptal ve başarısız finansal hareketler açık net harcama bırakmaz", () => {
  assert.match(mutabakat, /s\.durum='iptal'/);
  assert.match(mutabakat, /h\.tur='harcama'/);
  assert.match(mutabakat, /h\.tur='iade'/);
  assert.match(mutabakat, /s\.durum<>'onaylandi' AND COALESCE\(h\.dusulen,0\)<>0/);
});
