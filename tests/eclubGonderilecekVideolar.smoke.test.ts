import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(panel)/eclub/videolarim/page.tsx", "utf8");
const satir = readFileSync("app/(panel)/eclub/videolarim/_components/VideoGonderimSatiri.tsx", "utf8");
const onizleme = readFileSync("components/video/VideoOnizleme.tsx", "utf8");
const aracOnizleme = readFileSync("components/ogrenme-araci/OgrenmeAraciOnizleme.tsx", "utf8");

test("mutlu: öğrenme aracı önizlemesi dört araç türünü salt görüntüler", () => {
  assert.match(satir, /onVideoAc\(video\)/);
  assert.match(satir, /yayinThumbnailIstemciCoz\(video\)/);
  assert.match(satir, /<AracVarsayilanKapak aracTuru=\{video\.arac_turu\} urunAdi=\{video\.urun_adi\} kucuk \/>/);
  assert.match(satir, /öğrenme içeriğini önizle/);
  assert.doesNotMatch(satir, /<Play/);
  assert.match(page, /<OgrenmeAraciOnizleme/);
  assert.match(aracOnizleme, /<VideoOnizleme/);
  assert.match(aracOnizleme, /yalnizPlayButonu/);
  assert.match(aracOnizleme, /onBitti=\{onBitti\}/);
  assert.match(aracOnizleme, /bitisGecikmesiMs=\{1500\}/);
  assert.match(aracOnizleme, /<PodcastOynatici/);
  assert.match(aracOnizleme, /<GorselOynatici/);
  assert.match(aracOnizleme, /<FlipPdfOynatici/);
  assert.match(aracOnizleme, /saltGoruntuleme: true/);
});

test("red: gönderilecek öğrenme aracı önizlemesi izleme kaydı yazma uçlarını içermez", () => {
  assert.doesNotMatch(page, /VideoOynatici|tuketici=|onizlemeYuzeyi/);
  assert.doesNotMatch(aracOnizleme, /\/izle\/api\/|podcast-ilerleme|gorsel-tamamla|flip-pdf-ilerleme/);
  assert.doesNotMatch(onizleme, /fetch\(|\/izle\/api\//);
  assert.match(onizleme, /player\.onEnded\(tamamla\)/);
});
