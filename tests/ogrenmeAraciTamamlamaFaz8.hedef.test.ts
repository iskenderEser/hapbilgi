import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const push = oku("lib/push/icerik.ts");
const eczanem = oku("app/eczanem/page.tsx");
const etkilesim = oku("lib/etkilesim/yayinYetkisi.ts");

test("bildirimler doğru UTT öneri, BM challenge ve E-Club öneri kimliklerini açar", () => {
  assert.match(push, /oneri_id=/);
  assert.match(push, /challenge_id=/);
  assert.match(push, /eclub\/panel\?oneri_id=/);
});

test("Eczanem bildirimi kesin gönderimi açar", () => {
  assert.match(push, /eczanem\?gonderim_id=/);
  assert.match(eczanem, /searchParams\.get\("gonderim_id"\)/);
  assert.match(eczanem, /video\.gonderim_id === gonderimId/);
  assert.match(eczanem, /<Suspense[\s\S]*<EczanemPanelIcerik \/>[\s\S]*<\/Suspense>/);
});

test("ortak beğeni ve favori yetkisi dört öğrenme aracını kabul eder", () => {
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"]) assert.match(etkilesim, new RegExp(tur));
  assert.match(oku("app/izle/api/begeni/route.ts"), /etkilesimYayinYetkisi/);
  assert.match(oku("app/izle/api/favori/route.ts"), /etkilesimYayinYetkisi/);
});

test("tüketici ekranlarında çok araçlı alanlar öğrenme içeriği dilini kullanır", () => {
  for (const yol of [
    "components/ana-sayfa/UttAnaSayfa.tsx",
    "app/(panel)/eclub/panel/page.tsx",
    "app/eczanem/page.tsx",
  ]) assert.match(oku(yol), /[Öö]ğrenme [İi]çeri/);
});
