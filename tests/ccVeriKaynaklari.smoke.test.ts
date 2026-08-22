// C-Club veri kaynaklarının HBLigi/UTT kayıtlarından ayrıldığını korur.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ozetSql = readFileSync("scripts/sql/cc_ligi_ozet.sql", "utf8");
const backfillSql = readFileSync("scripts/sql/cc_ligi_backfill.sql", "utf8");
const okumaSql = readFileSync("scripts/sql/cc_ligi_okuma.sql", "utf8");
const netHesap = readFileSync("lib/cc/puan/netHesap.ts", "utf8");
const ligApi = readFileSync("app/(panel)/cc-ligi/api/route.ts", "utf8");

test("mutlu: CC özet ve backfill yalnız C-Club puan/kayıp tablolarını kullanır", () => {
  assert.match(ozetSql, /CREATE TRIGGER trg_cc_ozet_kazanim[\s\S]*ON public\.cc_kazanilan_puanlar/);
  assert.match(ozetSql, /CREATE TRIGGER trg_cc_ozet_ileri_sarma[\s\S]*ON public\.cc_ileri_sarma_kayitlari/);
  assert.match(ozetSql, /CREATE TRIGGER trg_cc_ozet_yanlis_cevap[\s\S]*ON public\.cc_yanlis_cevap_kayitlari/);
  assert.match(backfillSql, /FROM cc_kazanilan_puanlar/);
  assert.match(backfillSql, /FROM cc_ileri_sarma_kayitlari/);
  assert.match(backfillSql, /FROM cc_yanlis_cevap_kayitlari/);
  assert.match(backfillSql, /BEGIN;[\s\S]*TRUNCATE TABLE public\.cc_ligi_ozet;[\s\S]*COMMIT;/);
  assert.doesNotMatch(ozetSql, /CREATE TRIGGER trg_cc_ozet_kazanim[\s\S]*ON public\.kazanilan_puanlar\b/);
});

test("mutlu: challenge görünümü ve liderler CC izleme/özet kaynağına bağlıdır", () => {
  assert.match(okumaSql, /FROM public\.cc_izleme_kayitlari ik/);
  assert.match(okumaSql, /ik\.challenge_id = ck\.challenge_id/);
  assert.match(okumaSql, /get_cc_ligi_donem_lideri[\s\S]*get_cc_ligi_donemlik/);
  assert.match(okumaSql, /get_cc_ligi_yil_lideri[\s\S]*get_cc_ligi_yillik/);
  assert.match(netHesap, /from\("cc_kazanilan_puanlar"\)[\s\S]*gte\("created_at"/);
});

test("mutlu: bütün lig dönemleri ve liderler aynı net puan sözleşmesini kullanır", () => {
  assert.match(
    okumaSql,
    /COALESCE\(oz\.izleme,0\)\+COALESCE\(oz\.cev,0\)\+COALESCE\(oz\.extra,0\)\+COALESCE\(oz\.ccg,0\)\+COALESCE\(oz\.ccr,0\)[\s\S]*- COALESCE\(oz\.ileri,0\) - COALESCE\(oz\.yanlis,0\) - COALESCE\(oz\.chl,0\)/
  );
  assert.match(okumaSql, /get_cc_ligi_aylik[\s\S]*_cc_ligi_aralik/);
  assert.match(okumaSql, /get_cc_ligi_donemlik[\s\S]*_cc_ligi_aralik/);
  assert.match(okumaSql, /get_cc_ligi_yillik[\s\S]*_cc_ligi_aralik/);
  assert.match(okumaSql, /get_cc_ligi_haftalik[\s\S]*_cc_ligi_aralik/);
});

test("ret: challenge listesi UTC ay sınırıyla ligden ayrılamaz", () => {
  assert.match(ligApi, /ligPeriyoduAraligi\(\{[\s\S]*periyot: "ay"/);
  assert.doesNotMatch(ligApi, /Date\.UTC\(periyot\.yil/);
});
