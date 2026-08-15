import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const kok = new URL("../", import.meta.url);
const varMi = (yol: string) => existsSync(new URL(yol, kok));

test("mutlu: üretim yazıları yalnız kanonik görev API'lerinde yaşar", () => {
  assert.equal(varMi("app/(panel)/uretim/api/teslim/route.ts"), true);
  assert.equal(varMi("app/(panel)/uretim/api/karar/route.ts"), true);
  assert.equal(varMi("app/(panel)/uretim/api/hazir-video/route.ts"), true);
});

test("red: eski paralel yazma uçları yeniden açılamaz", () => {
  for (const yol of [
    "app/(panel)/senaryolar/api/durum/route.ts",
    "app/(panel)/videolar/api/durum/route.ts",
    "app/(panel)/soru-setleri/api/durum/route.ts",
    "app/(panel)/talepler/api/hazir-video/route.ts",
    "lib/uretim/surec.ts",
  ]) {
    assert.equal(varMi(yol), false, `${yol} kaldırılmış olmalıdır`);
  }
});
