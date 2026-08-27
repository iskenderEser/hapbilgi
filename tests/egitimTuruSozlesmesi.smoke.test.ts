import assert from "node:assert/strict";
import test from "node:test";
import {
  TALEP_TURU_KURALLARI,
  TALEP_TURU_SIRA,
  URETICI_YETENEKLERI,
  isTalepTuru,
  talepTuruAdi,
} from "@/lib/uretici/yetenekler";
import { UTT_VIDEO_KATEGORILERI } from "@/lib/video/uttVideoKategorileri";

test("eğitim türü sözleşmesi altı kanonik türü ve üretici rol yetkilerini doğru tutar", () => {
  assert.deepEqual(TALEP_TURU_SIRA, [
    "urun_egitimi",
    "satis_teknikleri",
    "yonetim_egitimi",
    "medikal_egitim",
    "urun_medikal_egitim",
    "ik_egitimi",
  ]);
  assert.equal(new Set(TALEP_TURU_SIRA).size, 6);
  assert.ok(TALEP_TURU_SIRA.every((tur) => isTalepTuru(tur)));
  assert.ok(URETICI_YETENEKLERI.egt_md.acabilecegiTalepTurleri.includes("yonetim_egitimi"));
  assert.ok(URETICI_YETENEKLERI.ik_md.acabilecegiTalepTurleri.includes("yonetim_egitimi"));
  assert.equal(URETICI_YETENEKLERI.pm.acabilecegiTalepTurleri.includes("yonetim_egitimi"), false);
});

test("altı eğitim türü altı ayrı içerik kategorisine ve kullanıcı adına bağlanır", () => {
  const kategoriler = TALEP_TURU_SIRA.map((tur) => TALEP_TURU_KURALLARI[tur].icerikTuru);
  assert.equal(new Set(kategoriler).size, 6);
  assert.deepEqual(TALEP_TURU_SIRA.map(talepTuruAdi), [
    "Ürün Eğitimi",
    "Satış Teknikleri",
    "Yönetim Eğitimleri",
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

test("UTT navigasyonu hedeflenebilen altı eğitim kategorisinin tamamını taşır", () => {
  assert.equal(UTT_VIDEO_KATEGORILERI.length, 6);
  assert.deepEqual(
    UTT_VIDEO_KATEGORILERI.map((kategori) => kategori.icerikTuru),
    ["urun", "medikal", "urun_medikal", "egitim", "yonetim", "ik"],
  );
  assert.equal(UTT_VIDEO_KATEGORILERI.find((kategori) => kategori.slug === "yonetim")?.etiket, "Yönetim Eğitimleri");
});
