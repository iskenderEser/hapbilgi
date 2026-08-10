import test from "node:test";
import assert from "node:assert/strict";
import { bunnyVideoSuresiCoz } from "@/lib/video/bunnyYukleme";

test("Bunny video süresi pozitif tam saniye olarak çözülür", () => {
  assert.equal(bunnyVideoSuresiCoz({ length: 121 }), 121);
});

test("Geçersiz Bunny süresi puan hesabına alınmaz", () => {
  assert.equal(bunnyVideoSuresiCoz({ length: 0 }), null);
  assert.equal(bunnyVideoSuresiCoz({ length: Number.NaN }), null);
  assert.equal(bunnyVideoSuresiCoz({ length: "121" }), null);
});
