import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const kaynaklar = [
  oku("components/uretim/UretimGorevListesi.tsx"),
  oku("app/(panel)/talepler/_components/UreticiRolGorunum.tsx"),
  oku("app/(panel)/yayin-yonetimi/page.tsx"),
  oku("app/(panel)/onaylanan-talepler/page.tsx"),
  oku("app/(panel)/kullanicilar/page.tsx"),
  oku("app/(panel)/oneriler/page.tsx"),
  oku("app/(panel)/store/siparislerim/page.tsx"),
  oku("app/(panel)/store/siparisler/page.tsx"),
];

test("mutlu: üretim, yönetim ve sipariş takip yüzeyleri ortak YenileButonu kullanır", () => {
  for (const kaynak of kaynaklar) assert.match(kaynak, /<YenileButonu/);
  assert.match(oku("app/(panel)/talepler/_hooks/useTalepMerkezi.ts"), /yenileniyor/);
  assert.match(oku("app/(panel)/yayin-yonetimi/_hooks/useYayinYonetimi.ts"), /yenileniyor/);
  assert.match(oku("app/(panel)/store/siparisler/_hooks/useSiparisListe.ts"), /sessiz/);
});

test("red: ikinci paket de tarayıcı yenilemesi kullanmaz ve açık formda kullanıcı yenilemeyi kapatır", () => {
  assert.doesNotMatch(kaynaklar.join("\n"), /window\.location\.reload|location\.reload|router\.refresh/);
  assert.match(oku("app/(panel)/kullanicilar/page.tsx"), /disabled=\{formAcik \|\| formLoading\}/);
  assert.match(oku("app/(panel)/yayin-yonetimi/page.tsx"), /disabled=\{!!acikAkordiyon \|\| !!yy\.islemLoading\}/);
});
