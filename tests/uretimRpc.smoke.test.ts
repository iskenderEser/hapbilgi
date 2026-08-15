import test from "node:test";
import assert from "node:assert/strict";
import { uretimRpcHttpDurumu, uuidGecerliMi } from "../lib/uretim/rpcTemel.ts";

test("üretim RPC yardımcıları bilinen girdileri doğru sınıflandırır", () => {
  assert.equal(uuidGecerliMi("b90798f0-ac53-4548-b362-867315e1f12c"), true);
  assert.equal(uretimRpcHttpDurumu("42501"), 403);
  assert.equal(uretimRpcHttpDurumu("P0002"), 404);
  assert.equal(uretimRpcHttpDurumu("23505"), 409);
  assert.equal(uretimRpcHttpDurumu("23514"), 422);
});

test("üretim RPC yardımcıları geçersiz girdileri güvenli varsayılana taşır", () => {
  assert.equal(uuidGecerliMi("b90798f0-ac53-4548-b362-867315e1f12z"), false);
  assert.equal(uuidGecerliMi(null), false);
  assert.equal(uretimRpcHttpDurumu("BILINMEYEN"), 500);
});
