import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const sayfa = oku("app/(panel)/eczanem/eczane/dagitim/page.tsx");
const satir = oku("app/(panel)/eczanem/eczane/_components/EczanemVideoGonderimSatiri.tsx");
const api = oku("app/(panel)/eczanem/eczane/api/gonderim/route.ts");
const gonderim = oku("lib/eczanem/gonderim.ts");
const ortakOnizleme = oku("components/ogrenme-araci/OgrenmeAraciOnizleme.tsx");

test("mutlu: eczacı dağıtımı UTT ile aynı satır içi yönetim ve önizleme akışını kullanır", () => {
  assert.match(sayfa, /Müşterilere Gönderilecek Öğrenme İçerikleri/);
  assert.match(sayfa, /<EczanemVideoGonderimSatiri/);
  assert.match(satir, /<Collapsible open=\{acik\}/);
  assert.match(satir, /Müşterileri Yönet/);
  assert.match(satir, /<Progress value=\{oran\}/);
  assert.match(satir, /onVideoAc\(video\)/);
  assert.doesNotMatch(satir, /<Play/);
  assert.match(sayfa, /<OgrenmeAraciOnizleme/);
  assert.match(ortakOnizleme, /yalnizPlayButonu/);
  assert.match(sayfa, /onBitti=\{\(\) => setAktifVideo\(null\)\}/);
});

test("mutlu: bütün video satırlarının gönderim özeti tek API yanıtında sağlanır", () => {
  assert.match(api, /eczaneVideoGonderimOzetleri/);
  assert.match(api, /video_ozetleri: videoOzetleri/);
  assert.match(gonderim, /\.from\("eczanem_gonderimler"\)/);
  assert.match(gonderim, /aktifMusteriIdleri\.has\(gonderim\.musteri_id\)/);
  assert.match(gonderim, /gonderilebilir_uye_sayisi: Math\.max/);
});

test("red: önizleme dağıtım veya izleme kaydı yazmaz", () => {
  const onizlemeBolumu = sayfa.slice(sayfa.indexOf("if (aktifVideo)"), sayfa.indexOf("return (\n    <div className=\"min-h-full"));
  assert.doesNotMatch(onizlemeBolumu, /fetch\(|videoDagit|\/izle\/api\//);
});
