import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Modallar.tsx OgrenmeAraciOnizlemeModal ile 4 öğrenme aracını da destekler", () => {
  const modallar = readFileSync("app/(panel)/yayin-yonetimi/_components/Modallar.tsx", "utf8");
  assert.match(modallar, /export function OgrenmeAraciOnizlemeModal/);
  assert.match(modallar, /OgrenmeAraciOnizleme/);
  assert.match(modallar, /VideoOnizleme/);
  assert.match(modallar, /Podcast Önizleme/);
  assert.match(modallar, /Dijital Broşür Önizleme/);
  assert.match(modallar, /Literatür Önizleme/);
  assert.match(modallar, /export function VideoOnizlemeModal/);
});

test("YayinYonetimi page.tsx OgrenmeAraciOnizlemeModal'i onizlemeHedefi ile açar", () => {
  const sayfa = readFileSync("app/(panel)/yayin-yonetimi/page.tsx", "utf8");
  assert.match(sayfa, /OgrenmeAraciOnizlemeModal/);
  assert.match(sayfa, /onizlemeHedefi/);
  assert.match(sayfa, /setOnizlemeHedefi/);
  assert.match(sayfa, /onOnizle=\{setOnizlemeHedefi\}/);
});

test("BekleyenSatir ve YayinSatir onOnizle üzerinden modalı tetikler", () => {
  const bekleyen = readFileSync("app/(panel)/yayin-yonetimi/_components/BekleyenSatir.tsx", "utf8");
  const yayin = readFileSync("app/(panel)/yayin-yonetimi/_components/YayinSatir.tsx", "utf8");
  assert.match(bekleyen, /onOnizle/);
  assert.match(bekleyen, /arac_id: b\.arac_id/);
  assert.match(yayin, /onOnizle/);
  assert.match(yayin, /arac_id: y\.arac_id/);
});
