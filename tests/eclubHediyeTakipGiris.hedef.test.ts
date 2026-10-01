import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const takimSayfasi = readFileSync("app/(panel)/eclub/eczanelerim/page.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const navigasyon = readFileSync("components/panel/panelNav.config.ts", "utf8");

test("E-Club Takımım sayfası Hediye Takip girişini doğru rotaya açar", () => {
  assert.match(takimSayfasi, />\s*Hediye Takip\s*</);
  assert.match(takimSayfasi, /router\.push\("\/eclub\/hediye-takip"\)/);
});

test("Hediye Takip proxy bekçisine bağlıdır ve eski takip URL'leri geri dönmez", () => {
  assert.match(proxy, /pathname\.startsWith\("\/eclub\/hediye-takip"\)/);
  for (const eskiUrl of ["/eclub/cek-onay-takip", "/eclub/odul-siparis-takibi"]) {
    const desen = new RegExp(eskiUrl);
    assert.doesNotMatch(takimSayfasi, desen);
    assert.doesNotMatch(proxy, desen);
    assert.doesNotMatch(navigasyon, desen);
  }
});
