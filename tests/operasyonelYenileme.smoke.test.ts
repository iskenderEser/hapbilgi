import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const ortak = oku("components/ui/yenile-butonu.tsx");
const sayfalar = [
  oku("app/(panel)/eczanem/utt/page.tsx"),
  oku("app/(panel)/eclub/videolarim/page.tsx"),
  oku("app/(panel)/eclub/gonderilen-videolar/page.tsx"),
  oku("app/(panel)/eclub/eczanelerim/page.tsx"),
  oku("app/(panel)/eclub/siparisler/page.tsx"),
  oku("app/(panel)/eczanem/eczane/dagitim/page.tsx"),
  oku("app/(panel)/eczanem/eczane/musterilerim/page.tsx"),
  oku("app/(panel)/eczanem/eczane/_components/EczanemSiparisKuyrugu.tsx"),
  oku("app/(panel)/eczanem/eczane/_components/EczanemDokum.tsx"),
  oku("app/(panel)/eczanem/utt/_components/UttEczanemDokum.tsx"),
];

test("mutlu: operasyon sayfaları ortak, pasiflenebilir ve durum koruyan yenileme kullanır", () => {
  assert.match(ortak, /disabled=\{disabled \|\| yenileniyor\}/);
  assert.match(ortak, /aria-busy=\{yenileniyor\}/);
  assert.match(ortak, /Yenileniyor…/);
  for (const sayfa of sayfalar) assert.match(sayfa, /<YenileButonu/);

  assert.match(oku("app/(panel)/eclub/oneriler/_hooks/useEclubOneriler.ts"), /if \(ilkYukleme\) setLoading\(true\);\s*else setYenileniyor\(true\)/);
  assert.match(oku("app/(panel)/eclub/listem/_hooks/useEclubListem.ts"), /if \(ilkYukleme\) setLoading\(true\);\s*else setYenileniyor\(true\)/);
});

test("red: manuel yenileme tarayıcıyı yeniden yüklemez ve yarışan döküm isteğini iptal eder", () => {
  const tumKaynak = [ortak, ...sayfalar].join("\n");
  assert.doesNotMatch(tumKaynak, /window\.location\.reload|location\.reload|router\.refresh/);
  assert.match(oku("app/(panel)/eczanem/utt/_components/UttEczanemDokum.tsx"), /istekRef\.current\?\.abort\(\)/);
  assert.match(oku("app/(panel)/eclub/gonderilen-videolar/page.tsx"), /istekRef\.current\?\.abort\(\)/);
});
