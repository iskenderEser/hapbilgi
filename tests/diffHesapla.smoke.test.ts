// tests/diffHesapla.smoke.test.ts — A-4 smoke (tavan: 1 mutlu + 1 sınır).
// Koşum: npm run test:smoke (node --test, Node 24 tip soymasıyla).
import { test } from "node:test";
import assert from "node:assert/strict";
import { senaryoDiffHesapla } from "../lib/utils/senaryo/diffHesapla.ts";

test("mutlu: degisen kelime cikar+ekle, kalan ayni olarak ayristirilir", () => {
  const parcalar = senaryoDiffHesapla("Gunde bir tablet alinir.", "Gunde iki tablet alinir.");
  assert.ok(parcalar.some(p => p.tur === "cikar" && p.metin.includes("bir")));
  assert.ok(parcalar.some(p => p.tur === "ekle" && p.metin.includes("iki")));
  assert.ok(parcalar.some(p => p.tur === "ayni" && p.metin.includes("tablet")));
});

test("sinir: ayni metin hic fark uretmez; bos onceki tumunu ayni sayar", () => {
  assert.ok(senaryoDiffHesapla("Ayni metin.", "Ayni metin.").every(p => p.tur === "ayni"));
  assert.deepEqual(senaryoDiffHesapla("", "Ilk gonderim."), [{ tur: "ayni", metin: "Ilk gonderim." }]);
});
