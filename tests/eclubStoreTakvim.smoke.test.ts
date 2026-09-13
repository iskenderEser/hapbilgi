import { test } from "node:test";
import assert from "node:assert/strict";
import { eclubAyPenceresi, eclubStoreSiparisAcikMi, eclubStoreTakvimDurumu } from "../lib/eclub/store/takvim.ts";

test("çek talebi yalnız iki aylık dönemi izleyen ayın 1–7'sinde açılır", () => {
  assert.equal(eclubStoreSiparisAcikMi(new Date("2026-03-01T00:00:00+03:00")), true);
  assert.equal(eclubStoreSiparisAcikMi(new Date("2026-03-07T23:59:59+03:00")), true);
  assert.equal(eclubStoreSiparisAcikMi(new Date("2026-03-08T00:00:00+03:00")), false);
  assert.equal(eclubStoreSiparisAcikMi(new Date("2026-04-01T00:00:00+03:00")), false);
  assert.equal(eclubStoreSiparisAcikMi(new Date("2027-01-01T00:00:00+03:00")), true);
});

test("talep penceresi doğru iki aylık kazanç dönemini taşır", () => {
  const mart = eclubAyPenceresi(2026, 3);
  assert.equal(mart.donemKodu, "2026-P1");
  assert.equal(mart.donemAdi, "Ocak–Şubat 2026");
  assert.equal(mart.kazancBaslangic.toISOString(), "2025-12-31T21:00:00.000Z");
  assert.equal(mart.kazancBitisHaric.toISOString(), "2026-02-28T21:00:00.000Z");

  const ocak = eclubAyPenceresi(2027, 1);
  assert.equal(ocak.donemKodu, "2026-P6");
  assert.equal(ocak.donemAdi, "Kasım–Aralık 2026");
});

test("kapalı zamanda sonraki geçerli tek ay gösterilir", () => {
  const nisan = eclubStoreTakvimDurumu(new Date("2026-04-15T12:00:00+03:00"));
  assert.equal(nisan.acik, false);
  assert.equal(nisan.sonrakiPencere.ay, 5);
  const eylul = eclubStoreTakvimDurumu(new Date("2026-09-03T12:00:00+03:00"));
  assert.equal(eylul.acik, true);
  assert.equal(eylul.aktifPencere?.donemKodu, "2026-P4");
  assert.equal(eylul.sonrakiPencere.ay, 11);
});
