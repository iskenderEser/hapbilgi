// tests/gonderimKarari.smoke.test.ts — Ç-3 smoke (tavan: 1 mutlu + 1 red).
// Koşum: npm run test:smoke (node --test, Node 24 tip soymasıyla).
import { test } from "node:test";
import assert from "node:assert/strict";
import { gonderimKarari } from "../lib/utils/senaryo/gonderimKarari.ts";

test("mutlu: beklemedeki id ya da kendi durumsuz satiri -> guncelle + dogru id", () => {
  assert.deepEqual(
    gonderimKarari("s-bekleyen", null, "iu1"),
    { tur: "guncelle", senaryo_id: "s-bekleyen" }
  );
  assert.deepEqual(
    gonderimKarari(null, { senaryo_id: "s1", iu_id: "iu1", son_durum: null }, "iu1"),
    { tur: "guncelle", senaryo_id: "s1" }
  );
});

test("red: baskasinin durumsuz satiri ya da durumlu satir -> olustur", () => {
  assert.deepEqual(
    gonderimKarari(null, { senaryo_id: "s1", iu_id: "iu2", son_durum: null }, "iu1"),
    { tur: "olustur" }
  );
  assert.deepEqual(
    gonderimKarari(null, { senaryo_id: "s1", iu_id: "iu1", son_durum: "inceleme bekleniyor" }, "iu1"),
    { tur: "olustur" }
  );
});
