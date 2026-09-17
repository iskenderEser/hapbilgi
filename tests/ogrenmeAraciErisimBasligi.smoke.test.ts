import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ogrenmeAraciErisimUrunAdi } from "../lib/ogrenmeAraci/erisimBasligi.ts";
import { haritalaTalep } from "../lib/utils/talepZinciri.ts";

const temelTalep = {
  talep_id: "talep-1",
  ogrenme_araci_turu: "podcast",
  hedef_roller: ["utt"],
};

test("ortak talep künyesi katalog ürününü serbest ürün adından önce kullanır", () => {
  const talep = haritalaTalep({
    ...temelTalep,
    urun_adi: "Serbest ürün adı",
    urunler: { urun_adi: "Katalogdaki ürün adı" },
  });
  assert.equal(talep.urun_adi, "Katalogdaki ürün adı");
  assert.equal(ogrenmeAraciErisimUrunAdi("podcast", talep), "Katalogdaki ürün adı");
});

test("katalog ürünü olmayan talepte ortak künye serbest ürün adını kullanır", () => {
  const talep = haritalaTalep({
    ...temelTalep,
    urun_adi: "Kurumsal Gelişim Programı",
    urunler: null,
  });
  assert.equal(talep.urun_adi, "Kurumsal Gelişim Programı");
  assert.equal(ogrenmeAraciErisimUrunAdi("flip_pdf", talep), "Kurumsal Gelişim Programı");
});

test("ürün adı yoksa üç ortak erişim aracı kendi anlaşılır adını gösterir", () => {
  assert.equal(ogrenmeAraciErisimUrunAdi("podcast", { urun_adi: "-" }), "Podcast");
  assert.equal(ogrenmeAraciErisimUrunAdi("gorsel", { urun_adi: " " }), "Dijital Broşür");
  assert.equal(ogrenmeAraciErisimUrunAdi("flip_pdf", null), "Literatür");
});

test("ortak erişim route'u özel ürün join'i yerine merkezi talep künyesini kullanır", () => {
  const route = readFileSync(new URL("../app/api/ogrenme-araclari/[arac_id]/erisim/route.ts", import.meta.url), "utf8");
  assert.match(route, /talepBilgisiTalep\(db, arac\.talep_id\)/);
  assert.match(route, /ogrenmeAraciErisimUrunAdi\(arac\.arac_turu, talepBilgisi\)/);
  assert.doesNotMatch(route, /talepler\s*\(\s*urun_adi/);
  assert.doesNotMatch(route, /urunler\s*\(\s*urun_adi/);
});
