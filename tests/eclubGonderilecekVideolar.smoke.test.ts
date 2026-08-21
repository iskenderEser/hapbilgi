import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(panel)/eclub/videolarim/page.tsx", "utf8");
const satir = readFileSync("app/(panel)/eclub/videolarim/_components/VideoGonderimSatiri.tsx", "utf8");
const onizleme = readFileSync("components/video/VideoOnizleme.tsx", "utf8");

test("mutlu: thumbnail videoyu yerleştirir, Play başlatır ve bitiş listeye döndürür", () => {
  assert.match(satir, /onVideoAc\(video\)/);
  assert.match(satir, /videosunu sayfaya yerleştir/);
  assert.doesNotMatch(satir, /<Play/);
  assert.match(page, /<VideoOnizleme/);
  assert.match(page, /yalnizPlayButonu/);
  assert.match(page, /onBitti=\{\(\) => setAktifVideo\(null\)\}/);
  assert.match(page, /bitisGecikmesiMs=\{1500\}/);
});

test("red: gönderilecek video önizlemesi izleme kaydı yazma uçlarını içermez", () => {
  assert.doesNotMatch(page, /VideoOynatici|tuketici=|onizlemeYuzeyi/);
  assert.doesNotMatch(onizleme, /fetch\(|\/izle\/api\//);
  assert.match(onizleme, /player\.onEnded\(tamamla\)/);
});
