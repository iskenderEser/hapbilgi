import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(panel)/eclub/yayinlar/page.tsx", "utf8");
const kart = readFileSync("app/(panel)/eclub/yayinlar/_components/EclubYayinGonderimKarti.tsx", "utf8");
const yayinKarti = readFileSync("components/yayin/YayinKarti.tsx", "utf8");
const onizleme = readFileSync("components/video/VideoOnizleme.tsx", "utf8");
const inceleme = readFileSync("components/eclub/UttGonderimIncelemesi.tsx", "utf8");
const gonderimDetayi = readFileSync("app/(panel)/eclub/yayinlar/_components/EclubGonderimDetayKarti.tsx", "utf8");
const onerilerHook = readFileSync("app/(panel)/eclub/oneriler/_hooks/useEclubOneriler.ts", "utf8");

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

test("gönderilenler görünümü yayın kartına özel detay destesini kullanır", () => {
  assert.match(page, /gonderimDetayiGoster=\{gonderimFiltresi === "gonderilen"\}/);
  assert.match(page, /gonderimGecmisiMap\.get\(video\.yayin_id\)/);
  assert.match(kart, /<EclubGonderimDetayKarti/);
  assert.match(gonderimDetayi, /Gönderim detayları/);
  assert.match(gonderimDetayi, /İzleyenler/);
  assert.match(gonderimDetayi, /Bekleyenler/);
  assert.match(gonderimDetayi, /İzlemeyenler/);
  assert.doesNotMatch(gonderimDetayi, /ListChecks|CreditCard/);
  assert.doesNotMatch(gonderimDetayi, /Gönderim detaylarını kapat/);
  assert.match(onerilerHook, /gonderimGecmisi/);
});
