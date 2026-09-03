import assert from "node:assert/strict";
import test from "node:test";
import { BILGI_KAYNAKLARI, BILGI_SURUMU, bilgiyiBul } from "../lib/hapbi/bilgiKaynaklari.ts";

const DORT_OGRENME_ARACI = ["Video", "Podcast", "Dijital Broşür", "Literatür"] as const;

function kaynak(id: string) {
  const bulunan = BILGI_KAYNAKLARI.find((bilgi) => bilgi.id === id);
  assert.ok(bulunan, `${id} bilgi kaynağı bulunamadı.`);
  return bulunan;
}

test("HapBi platform bilgisi güncel BLUEBOOK sürümünü ve dört öğrenme aracını taşır", () => {
  assert.equal(BILGI_SURUMU, "2026-09-03.1");

  for (const id of ["platform", "tclub", "cclub", "eclub", "uretim"]) {
    const metin = kaynak(id).metin;
    for (const arac of DORT_OGRENME_ARACI) assert.match(metin, new RegExp(arac, "u"));
  }
});

test("HapBi rehberi eski video-merkezli ve Eczanem müşteri tanımlarını kullanmaz", () => {
  const tumMetin = BILGI_KAYNAKLARI.map((bilgi) => bilgi.metin).join("\n");

  assert.doesNotMatch(tumMetin, /eğitim videolarını izler/iu);
  assert.doesNotMatch(tumMetin, /eczane danışanlarını kapsar/iu);
  assert.doesNotMatch(tumMetin, /hazır video/iu);
  assert.match(kaynak("eclub").metin, /Eczanem uygulaması üyesi/);
  assert.match(kaynak("platform").metin, /ticari ya da mesleki ilişkinin tarafı değildir/);
});

test("HapBi kaynak konuları ve genel kaynak listesi geriye uyumlu kalır", () => {
  const beklenenKimlikler = ["platform", "tclub", "cclub", "eclub", "roller", "uretim", "store"];
  assert.deepEqual(BILGI_KAYNAKLARI.map((bilgi) => bilgi.id), beklenenKimlikler);
  assert.equal(bilgiyiBul("genel"), BILGI_KAYNAKLARI);
  assert.deepEqual(bilgiyiBul("bilinmeyen"), []);
});
