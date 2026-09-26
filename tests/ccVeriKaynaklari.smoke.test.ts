// C-Club veri kaynaklarının HBLigi/UTT kayıtlarından ayrıldığını korur.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ozetSql = readFileSync("scripts/sql/cc_ligi_ozet.sql", "utf8");
const backfillSql = readFileSync("scripts/sql/cc_ligi_backfill.sql", "utf8");
const okumaSql = readFileSync("scripts/sql/cc_ligi_okuma.sql", "utf8");
const ligApi = readFileSync("app/(panel)/cc-ligi/api/route.ts", "utf8");
const ligSayfasi = readFileSync("app/(panel)/cc-ligi/page.tsx", "utf8");
const takimAkordeonu = readFileSync("components/cc-ligi/CcTakimLigAkordeonu.tsx", "utf8");
const ligIskeleti = readFileSync("components/cc-ligi/CcLigiSkeleton.tsx", "utf8");
const ligLoading = readFileSync("app/(panel)/cc-ligi/loading.tsx", "utf8");

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
  assert.match(ligApi, /get_cc_ligi_/);
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

test("mutlu: yönetici takım toplamı challenge kaybını net puandan düşer", () => {
  assert.match(takimAkordeonu, /Number\(s\.challenge_kaybi \|\| 0\)/);
  assert.match(takimAkordeonu, /bm\.toplam_net_puan \?\?/);
});

test("mutlu: C-Club mobil stat kartları net üstte, kazanım ve kayıp altta iki sütundur", () => {
  assert.match(ligSayfasi, /URETICI_ROLLER\.includes/);
  assert.match(ligSayfasi, /ureticiMi \? "grid-cols-2" : "grid-cols-1"/);
  assert.match(ligSayfasi, /ureticiMi \? "col-span-2 sm:col-span-1"/);
});

test("mutlu: C-Club dönem istekleri kısa süreli oturum önbelleği ve iptal kullanır", () => {
  assert.match(ligSayfasi, /CC_LIG_ONBELLEK_SURESI = 60_000/);
  assert.match(ligSayfasi, /sessionStorage\.setItem/);
  assert.match(ligSayfasi, /devamEdenCcLigIstekleri/);
  assert.match(ligSayfasi, /AbortController/);
  assert.match(ligSayfasi, /onPeriyotChange=\{\(yeniPeriyot\) => void ligiYukle\(yeniPeriyot, false, true\)\}/);
  assert.match(ligSayfasi, /if \(periyoduUygula\) setPeriyot\(hedefPeriyot\)/);
  assert.doesNotMatch(ligSayfasi, /onPeriyotChange=\{setPeriyot\}/);
});

test("mutlu: C-Club yalnız ilk boş yüklemede sayfa düzeniyle uyumlu iskelet gösterir", () => {
  assert.match(ligSayfasi, /ligYukleniyor && ligSatirlari\.length === 0/);
  assert.match(ligSayfasi, /<CcLigiSkeleton/);
  assert.match(ligIskeleti, /animate-pulse/);
  assert.match(ligIskeleti, /aria-label="C-Club Ligi yükleniyor"/);
  assert.match(ligLoading, /CcLigiSkeleton/);
});
