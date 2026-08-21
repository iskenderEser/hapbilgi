import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const raporlar = [
  "utt",
  "bm",
  "tm",
  "uretici",
  "yonetici",
].map((rol) => oku(`app/(panel)/raporlar/${rol}/page.tsx`));

const canliYuzeyler = [
  ...raporlar,
  oku("app/(panel)/eclub/raporlar/page.tsx"),
  oku("app/(panel)/hbligi/page.tsx"),
  oku("app/(panel)/cc-ligi/page.tsx"),
  oku("app/(panel)/eclub/ligi/page.tsx"),
  oku("app/(panel)/yayindaki-videolar/page.tsx"),
  oku("app/(panel)/yayindaki-videolar/_components/UreticiYayinKatalogu.tsx"),
  oku("app/(panel)/store/page.tsx"),
  oku("app/(panel)/eclub/store/page.tsx"),
];

test("mutlu: rapor, lig ve katalog yüzeyleri ortak yenileme sözleşmesini kullanır", () => {
  for (const kaynak of canliYuzeyler) assert.match(kaynak, /<YenileButonu/);

  const raporHooku = oku("hooks/useRapor.ts");
  assert.match(raporHooku, /yenileniyor/);
  assert.match(raporHooku, /yenile: \(\) => void/);
  assert.match(raporHooku, /AbortController/);
});

test("red: üçüncü paket tarayıcıyı yenilemez; aktif düzenleme ve sipariş modalını korur", () => {
  assert.doesNotMatch(canliYuzeyler.join("\n"), /window\.location\.reload|location\.reload|router\.refresh/);
  assert.match(oku("app/(panel)/eclub/ligi/page.tsx"), /disabled=\{takimDuzenleniyor \|\| takimKaydediliyor\}/);
  assert.match(oku("app/(panel)/eclub/store/page.tsx"), /disabled=\{Boolean\(seciliUrun\) \|\| islemLoading\}/);
  assert.match(oku("app/(panel)/yayindaki-videolar/page.tsx"), /disabled=\{oneriModu\}/);
});

test("kapsam: video oynatma ve ana sayfa yüzeylerine genel yenileme eklenmez", () => {
  assert.doesNotMatch(oku("app/(panel)/ana-sayfa/page.tsx"), /<YenileButonu/);
  assert.doesNotMatch(oku("app/(panel)/challenge-club/izle/[yayin_id]/page.tsx"), /<YenileButonu/);
});
