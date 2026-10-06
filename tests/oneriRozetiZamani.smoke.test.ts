import test from "node:test";
import assert from "node:assert/strict";
import { oneriIzlenebilirMi, sonrakiOneriZamanSiniri } from "@/lib/tclub/oneri/gorunurluk";

const baslangic = Date.parse("2026-10-07T07:00:00+03:00");
const bitis = Date.parse("2026-10-08T20:30:00+03:00");
const oneri = {
  oneri_baslangic: "2026-10-07T07:00:00+03:00",
  oneri_bitis: "2026-10-08T20:30:00+03:00",
  izlendi_mi: false,
};

test("öneri rozeti başlangıçta açılır, bitişten sonra kapanır", () => {
  assert.equal(oneriIzlenebilirMi(oneri, baslangic - 1), false);
  assert.equal(oneriIzlenebilirMi(oneri, baslangic), true);
  assert.equal(oneriIzlenebilirMi(oneri, bitis), true);
  assert.equal(oneriIzlenebilirMi(oneri, bitis + 1), false);
  assert.equal(oneriIzlenebilirMi({ ...oneri, izlendi_mi: true }, baslangic), false);
});

test("açık oturumda rozetin bir sonraki değişim saati bulunur", () => {
  assert.equal(sonrakiOneriZamanSiniri([oneri], baslangic - 1), baslangic);
  assert.equal(sonrakiOneriZamanSiniri([oneri], baslangic), bitis + 1);
  assert.equal(sonrakiOneriZamanSiniri([oneri], bitis + 1), null);
});
