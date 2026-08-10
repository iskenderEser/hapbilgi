import test from "node:test";
import assert from "node:assert/strict";
import {
  baslatOlayIdGecerliMi,
  izlemeTuruBelirle,
  oynatmaBaslatilmaliMi,
} from "@/lib/izleme/baslat";

test("ilk gerçek oynatma tek bir sunucu oturumu ister", () => {
  assert.equal(oynatmaBaslatilmaliMi({ tuketici: true, izlemeId: null, baslatiliyor: false }), true);
  assert.equal(izlemeTuruBelirle("a1b2"), "oneri");
  assert.equal(baslatOlayIdGecerliMi("550e8400-e29b-41d4-a716-446655440000"), true);
});

test("açılış, yarışan istek ve geçersiz olay kimliği yeni oturum doğurmaz", () => {
  assert.equal(oynatmaBaslatilmaliMi({ tuketici: false, izlemeId: null, baslatiliyor: false }), false);
  assert.equal(oynatmaBaslatilmaliMi({ tuketici: true, izlemeId: null, baslatiliyor: true }), false);
  assert.equal(oynatmaBaslatilmaliMi({ tuketici: true, izlemeId: "izleme-1", baslatiliyor: false }), false);
  assert.equal(izlemeTuruBelirle(null), "kendi_kendine");
  assert.equal(baslatOlayIdGecerliMi("istemci-secti"), false);
});
