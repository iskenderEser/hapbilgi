import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const takimSayfasi = readFileSync("app/(panel)/eclub/eczanelerim/page.tsx", "utf8");

test("E-Club Takımım sayfası Hediye Takip girişini doğru rotaya açar", () => {
  assert.match(takimSayfasi, />\s*Hediye Takip\s*</);
  assert.match(takimSayfasi, /router\.push\("\/eclub\/hediye-takip"\)/);
});
