import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(panel)/eclub/videolarim/page.tsx", "utf8");
const kart = readFileSync("app/(panel)/eclub/videolarim/_components/EclubYayinGonderimKarti.tsx", "utf8");
const yayinKarti = readFileSync("components/yayin/YayinKarti.tsx", "utf8");
const onizleme = readFileSync("components/video/VideoOnizleme.tsx", "utf8");
const inceleme = readFileSync("components/eclub/UttGonderimIncelemesi.tsx", "utf8");

test("gönderim öncesi dört araç türü sorusuz ve puansız incelenir", () => {
  assert.match(page, /onOnizle=\{\(\) => setAktifVideo\(video\)\}/);
  assert.match(kart, /<YayinKarti/);
  assert.match(yayinKarti, /yayinThumbnailIstemciCoz\(yayin\)/);
  assert.match(yayinKarti, /<AracVarsayilanKapak/);
  assert.match(kart, /öğrenme içeriğini önizle/);
  assert.doesNotMatch(kart, /<Play/);
  assert.match(page, /<UttGonderimIncelemesi/);
  assert.match(inceleme, /<VideoOnizleme/);
  assert.match(inceleme, /<audio/);
  assert.match(inceleme, /<GorselOynatici/);
  assert.match(inceleme, /<FlipPdfOynatici/);
  assert.match(inceleme, /Soru ve puan yoktur/);
});

test("gönderim öncesi inceleme puanlı izleme uçlarını kullanmaz", () => {
  assert.doesNotMatch(page, /VideoOynatici|tuketici=|onizlemeYuzeyi/);
  assert.doesNotMatch(inceleme, /\/izle\/api\/|podcast-ilerleme|gorsel-tamamla|flip-pdf-ilerleme/);
  assert.match(inceleme, /\/eclub\/oneriler\/api\/inceleme/);
  assert.doesNotMatch(onizleme, /fetch\(|\/izle\/api\//);
  assert.match(onizleme, /player\.onEnded\(tamamla\)/);
});
