import test from "node:test";
import assert from "node:assert/strict";

import {
  cevaplarAtananSorularlaEslesiyorMu,
  eclubIzlemeHaklari,
  eclubSoruIndeksleri,
} from "@/lib/eclub/izlemeKurali";
import { eclubIleriSarmaKaybiHesapla, eclubIleriSarmaKonumuDogrula } from "@/lib/eclub/ileriSarma";
import { yalnizEclubHedefliMi } from "@/lib/utils/roller";

test("mutlu: aktif öneri puan ve soru hakkı verir; soru kümesi sabittir", () => {
  const simdi = new Date("2026-08-14T10:00:00Z");
  const haklar = eclubIzlemeHaklari("2026-08-13T10:00:00Z", "2026-08-15T10:00:00Z", simdi);
  const ilk = eclubSoruIndeksleri(6, 2, "9aa1a8e3-c6dc-4cad-b182-cdfb69c93aac");
  const ikinci = eclubSoruIndeksleri(6, 2, "9aa1a8e3-c6dc-4cad-b182-cdfb69c93aac");

  assert.deepEqual(haklar, { durum: "aktif", izlenebilir: true, puanli: true, soruGoster: true });
  assert.deepEqual(ilk, ikinci);
  assert.equal(new Set(ilk).size, 2);
  assert.equal(cevaplarAtananSorularlaEslesiyorMu(ilk.map((soru_index) => ({ soru_index, verilen_cevap: "A" })), ilk), true);
});

test("sınır: süresi geçmiş öneri izlenir ama puan/soru vermez; farklı cevap kümesi reddedilir", () => {
  const simdi = new Date("2026-08-14T10:00:00Z");
  const haklar = eclubIzlemeHaklari("2026-08-10T10:00:00Z", "2026-08-12T10:00:00Z", simdi);

  assert.deepEqual(haklar, { durum: "suresi_gecmis", izlenebilir: true, puanli: false, soruGoster: false });
  assert.equal(cevaplarAtananSorularlaEslesiyorMu([{ soru_index: 0, verilen_cevap: "A" }], [0, 2]), false);
});

test("mutlu: E-Club ileri sarma kaybı atlanan sürenin video puanındaki karşılığıdır", () => {
  const konum = eclubIleriSarmaKonumuDogrula(20.2, 50.4, 120);
  assert.deepEqual(konum, { baslangic: 20, bitis: 50, atlananSure: 30 });
  assert.equal(eclubIleriSarmaKaybiHesapla({ videoPuani: 40, videoSuresi: 120, atlananSure: 30, puanli: true }), 10);
  assert.equal(yalnizEclubHedefliMi(["eczaci", "eczane_teknisyeni"]), true);
});

test("sınır: geri/taşan sarma reddedilir; süresi geçen öneride puan kaybı doğmaz", () => {
  assert.equal(eclubIleriSarmaKonumuDogrula(50, 20, 120), null);
  assert.equal(eclubIleriSarmaKonumuDogrula(50, 121, 120), null);
  assert.equal(eclubIleriSarmaKaybiHesapla({ videoPuani: 40, videoSuresi: 120, atlananSure: 30, puanli: false }), 0);
  assert.equal(yalnizEclubHedefliMi(["utt", "eczaci"]), false);
});
