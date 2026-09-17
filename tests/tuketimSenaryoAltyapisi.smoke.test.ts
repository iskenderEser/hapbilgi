import assert from "node:assert/strict";
import test from "node:test";
import { eclubKisiHedefRolu } from "../lib/utils/roller.ts";
import {
  aracHedefMatrisi,
  TUKETICI_FIXTURELARI,
  TUKETIM_ARACLARI,
  TUKETIM_HEDEFLERI,
  yayinFixture,
} from "./helpers/tuketimSenaryosu.ts";

test("tüketim altyapısı dört araç ve beş hedef için 20 izole yayın üretir", () => {
  const matris = aracHedefMatrisi();
  assert.equal(matris.length, 20);
  assert.equal(new Set(matris.map((yayin) => yayin.yayin_id)).size, 20);
  assert.equal(new Set(matris.map((yayin) => yayin.arac_id)).size, 20);

  for (const arac of TUKETIM_ARACLARI) {
    for (const hedef of TUKETIM_HEDEFLERI) {
      const yayin = matris.find((satir) => satir.arac_turu === arac && satir.hedef_roller.includes(hedef));
      assert.ok(yayin, `${arac} × ${hedef} yayını eksik`);
      assert.equal(yayin.durum, "yayinda");
      assert.ok(yayin.arac_dosya_yolu);
    }
  }
});

test("araç fixture'ları tüketiciye ulaşan dosya ve kapak sözleşmesini temsil eder", () => {
  const video = yayinFixture("video", "utt");
  const podcast = yayinFixture("podcast", "eczaci");
  const brosur = yayinFixture("gorsel", "eczane_teknisyeni");
  const literatur = yayinFixture("flip_pdf", "eczanem");

  assert.ok(video.video_url);
  assert.ok(video.thumbnail_url);
  assert.equal(podcast.video_url, null);
  assert.equal(podcast.arac_metadata.kapak_dogrulandi, true);
  assert.match(brosur.arac_dosya_yolu, /\.webp$/);
  assert.equal(brosur.arac_kapak_yolu, null);
  assert.match(literatur.arac_dosya_yolu, /\.pdf$/);
  assert.equal(literatur.arac_metadata.kapak_dogrulandi, true);
});

test("tüketici kimlikleri üç kimlik düzlemini ve bütün hedef eşlemelerini kapsar", () => {
  assert.deepEqual(new Set(TUKETICI_FIXTURELARI.map((kisi) => kisi.kimlikTuru)), new Set(["kullanici", "eclub_kisi", "eczanem_musteri"]));
  assert.deepEqual(new Set(TUKETICI_FIXTURELARI.map((kisi) => kisi.hedefRol)), new Set(TUKETIM_HEDEFLERI));
  assert.equal(new Set(TUKETICI_FIXTURELARI.map((kisi) => kisi.authUserId)).size, TUKETICI_FIXTURELARI.length);

  for (const kisi of TUKETICI_FIXTURELARI.filter((satir) => satir.kimlikTuru === "eclub_kisi")) {
    assert.equal(eclubKisiHedefRolu(kisi.rol), kisi.hedefRol);
    assert.ok(kisi.eczaneId);
  }
});

test("fixture üretimi testler arasında ortak değişebilir nesne taşımaz", () => {
  const ilk = yayinFixture("podcast", "eczaci");
  const ikinci = yayinFixture("podcast", "eczaci");
  ilk.hedef_roller.push("eczane_teknisyeni");
  ilk.arac_metadata.kapak_dogrulandi = false;

  assert.deepEqual(ikinci.hedef_roller, ["eczaci"]);
  assert.equal(ikinci.arac_metadata.kapak_dogrulandi, true);
});
