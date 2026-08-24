import assert from "node:assert/strict";
import test from "node:test";
import { firmaIcinUrunAktifMi } from "@/lib/tclub/store/firmaUrun";

test("mutlu: global aktif ürün varsayılan veya açık firma ayarında görünür", () => {
  assert.equal(firmaIcinUrunAktifMi(true, undefined), true);
  assert.equal(firmaIcinUrunAktifMi(true, null), true);
  assert.equal(firmaIcinUrunAktifMi(true, true), true);
});

test("red: firma ürünü kapatırsa veya ürün global pasifse görünmez", () => {
  assert.equal(firmaIcinUrunAktifMi(true, false), false);
  assert.equal(firmaIcinUrunAktifMi(false, true), false);
  assert.equal(firmaIcinUrunAktifMi(false, undefined), false);
});
