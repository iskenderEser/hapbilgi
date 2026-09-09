import assert from "node:assert/strict";
import test from "node:test";

import { nedirSorusunuCoz } from "../lib/bi/nedir.ts";

test("NEDİR yalnız açık soru kalıbını ve katalogdaki tam kavramı kabul eder", () => {
  const hbstore = nedirSorusunuCoz("HBStore nedir?");
  assert.equal(hbstore.durum, "bulundu");
  if (hbstore.durum === "bulundu") {
    assert.equal(hbstore.konu.id, "hbstore");
    assert.equal(hbstore.konu.aksiyon?.url, "/store");
  }

  assert.equal(nedirSorusunuCoz("C-Club puanım kaç?").durum, "nedir_sorusu_degil");
  assert.equal(nedirSorusunuCoz("HBStore nerede?").durum, "nedir_sorusu_degil");
  assert.deepEqual(nedirSorusunuCoz("Bilinmeyen şey nedir?"), {
    durum: "tanim_yok",
    aranan: "bilinmeyen şey",
  });
});
