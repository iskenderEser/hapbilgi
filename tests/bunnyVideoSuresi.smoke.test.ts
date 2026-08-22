import test from "node:test";
import assert from "node:assert/strict";
import { bunnyVideoKullanimaHazirMi, bunnyVideoSuresiCoz } from "@/lib/video/bunnyYukleme";

test("Bunny video süresi pozitif tam saniye olarak çözülür", () => {
  assert.equal(bunnyVideoSuresiCoz({ length: 121 }), 121);
});

test("Geçersiz Bunny süresi puan hesabına alınmaz", () => {
  assert.equal(bunnyVideoSuresiCoz({ length: 0 }), null);
  assert.equal(bunnyVideoSuresiCoz({ length: Number.NaN }), null);
  assert.equal(bunnyVideoSuresiCoz({ length: "121" }), null);
});

test("Bunny videosu yalnız Ready ve pozitif süre birlikteyse kullanıma açılır", () => {
  assert.equal(bunnyVideoKullanimaHazirMi(4, 121), true);
  assert.equal(bunnyVideoKullanimaHazirMi(2, 121), false);
  assert.equal(bunnyVideoKullanimaHazirMi(4, 0), false);
  assert.equal(bunnyVideoKullanimaHazirMi(4, null), false);
  assert.equal(bunnyVideoKullanimaHazirMi(5, 121), false);
});
