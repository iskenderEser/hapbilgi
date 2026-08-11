import assert from "node:assert/strict";
import test from "node:test";
import {
  TALEP_TURU_KURALLARI,
  TALEP_TURU_SIRA,
  isTalepTuru,
  talepTuruAdi,
} from "@/lib/uretici/yetenekler";

test("eğitim türü sözleşmesi beş kanonik türü doğru sırada tutar", () => {
  assert.deepEqual(TALEP_TURU_SIRA, [
    "urun_egitimi",
    "satis_teknikleri",
    "medikal_egitim",
    "urun_medikal_egitim",
    "ik_egitimi",
  ]);
  assert.equal(new Set(TALEP_TURU_SIRA).size, 5);
  assert.ok(TALEP_TURU_SIRA.every((tur) => isTalepTuru(tur)));
});

test("beş eğitim türü beş ayrı içerik kategorisine ve kullanıcı adına bağlanır", () => {
  const kategoriler = TALEP_TURU_SIRA.map((tur) => TALEP_TURU_KURALLARI[tur].icerikTuru);
  assert.equal(new Set(kategoriler).size, 5);
  assert.deepEqual(TALEP_TURU_SIRA.map(talepTuruAdi), [
    "Ürün Eğitimi",
    "Satış Teknikleri",
    "Medikal Eğitim",
    "Ürün-Medikal Eğitim",
    "İK Eğitimi/Bilgilendirme",
  ]);
});

test("departman anahtarları eğitim türü kabul edilmez", () => {
  assert.equal(isTalepTuru("urun"), false);
  assert.equal(isTalepTuru("medikal"), false);
  assert.equal(isTalepTuru("egitim"), false);
  assert.equal(isTalepTuru("ik"), false);
});
