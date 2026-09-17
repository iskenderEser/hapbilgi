import assert from "node:assert/strict";
import test from "node:test";

import { gorunenTalepNumarasiniCoz } from "../lib/admin/talepSilKimligi.ts";

test("admin tekil silme görünen talep kimliğinin sonundaki numarayı çözer", () => {
  assert.equal(gorunenTalepNumarasiniCoz("hepifarma_30058"), 30058);
  assert.equal(gorunenTalepNumarasiniCoz("Firma_Alt_Ad_40001"), 40001);
  assert.equal(gorunenTalepNumarasiniCoz("  hepifarma_30058  "), 30058);
});

test("admin tekil silme geçersiz veya güvenli olmayan kimlikleri reddeder", () => {
  assert.equal(gorunenTalepNumarasiniCoz("hepifarma_"), null);
  assert.equal(gorunenTalepNumarasiniCoz("hepifarma_abc"), null);
  assert.equal(gorunenTalepNumarasiniCoz("hepifarma_-1"), null);
  assert.equal(gorunenTalepNumarasiniCoz("0"), null);
  assert.equal(gorunenTalepNumarasiniCoz(null), null);
});
