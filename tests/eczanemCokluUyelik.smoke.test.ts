import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/eczanem/eczane/api/musteri-ekle/route.ts", "utf8");
const sql = readFileSync("scripts/sql/eczanem_eczane_yonetim_paketi.sql", "utf8");
const baglamaBaslangici = route.indexOf('if (islem === "bagla")');
const yeniKayitBaslangici = route.indexOf("if (mevcut) {", baglamaBaslangici);
const baglamaBlogu = route.slice(baglamaBaslangici, yeniKayitBaslangici);

test("mutlu: kayıtlı müşteri kimliği değiştirilmeden ikinci eczaneye bağlanır", () => {
  assert.match(route, /if \(islem === "sorgula"\)/);
  assert.match(route, /durum: uyelik\?\.aktif_mi \? "zaten_bagli" : "kayitli"/);
  assert.match(route, /if \(islem === "bagla"\)/);
  assert.match(route, /rpc\("eczanem_musteri_bagla_atomik"/);
  assert.match(sql, /ON CONFLICT \(musteri_id, eczane_id\) DO UPDATE/);
  assert.ok(baglamaBaslangici >= 0 && yeniKayitBaslangici > baglamaBaslangici);
  assert.doesNotMatch(baglamaBlogu, /auth\.admin\.(createUser|updateUserById)/);
});

test("red: aynı eczanedeki aktif üyelik mükerrer bağlanmaz", () => {
  assert.match(route, /if \(mevcutUyelik\?\.aktif_mi\)/);
  assert.match(route, /Bu müşteri zaten eczanenizin aktif üyesi\./);
});
