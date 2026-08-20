import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/eczanem/eczane/api/musteri-ekle/route.ts", "utf8");
const baglamaBaslangici = route.indexOf('if (islem === "bagla")');
const yeniKayitBaslangici = route.indexOf("if (mevcut) {", baglamaBaslangici);
const baglamaBlogu = route.slice(baglamaBaslangici, yeniKayitBaslangici);

test("mutlu: kayıtlı müşteri kimliği değiştirilmeden ikinci eczaneye bağlanır", () => {
  assert.match(route, /if \(islem === "bagla"\)/);
  assert.match(
    route,
    /from\("eczanem_uyelikler"\)[\s\S]*?\.upsert\([\s\S]*?musteri_id: mevcut\.musteri_id[\s\S]*?eczane_id: eden\.eczaneId![\s\S]*?onConflict: "musteri_id,eczane_id"/,
  );
  assert.ok(baglamaBaslangici >= 0 && yeniKayitBaslangici > baglamaBaslangici);
  assert.doesNotMatch(baglamaBlogu, /auth\.admin\.(createUser|updateUserById)/);
});

test("red: aynı eczanedeki aktif üyelik mükerrer bağlanmaz", () => {
  assert.match(route, /if \(mevcutUyelik\?\.aktif_mi\)/);
  assert.match(route, /Bu müşteri zaten eczanenizin aktif üyesi\./);
});
