import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { hedefRolleriDogrula, hedefRolleriOku } from "@/lib/utils/roller";

test("hedef kitle sözleşmesi Eczacı ve Teknisyeni tekil ya da birlikte kabul eder", () => {
  assert.deepEqual(hedefRolleriDogrula(["eczaci"]), ["eczaci"]);
  assert.deepEqual(hedefRolleriDogrula(["eczane_teknisyeni"]), ["eczane_teknisyeni"]);
  assert.deepEqual(hedefRolleriDogrula(["eczane_teknisyeni", "eczaci"]), ["eczaci", "eczane_teknisyeni"]);
  assert.equal(hedefRolleriDogrula(["utt", "eczaci"]), null);
  assert.equal(hedefRolleriDogrula([]), null);
});

test("tek yayın iki E-Club rolüne de açılır; farklı bir role açılmaz", () => {
  const hedefler = hedefRolleriOku({ hedef_roller: ["eczaci", "eczane_teknisyeni"] });
  assert.equal(hedefler.includes("eczaci"), true);
  assert.equal(hedefler.includes("eczane_teknisyeni"), true);
  assert.equal(hedefler.includes("utt"), false);
});

test("çoğul hedef migration'ı tek yayın ve kişi bazlı öğrenme tekilliklerini korur", () => {
  const hedefSql = readFileSync("scripts/sql/talepler_hedef_roller.sql", "utf8");
  const temizlikSql = readFileSync("scripts/sql/talepler_hedef_rol_temizle.sql", "utf8");
  const izlemeSql = readFileSync("scripts/sql/eclub_izleme_tekillik.sql", "utf8");
  const yayinRoute = readFileSync("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts", "utf8");

  assert.match(hedefSql, /ARRAY\['eczaci',\s*'eczane_teknisyeni'\]::text\[\]/);
  assert.match(temizlikSql, /DROP COLUMN hedef_rol/);
  assert.doesNotMatch(temizlikSql, /\bDROP\b[^;]*\bCASCADE\b/i);
  assert.match(yayinRoute, /hedef_roller:\s*hedefRoller/);
  assert.match(izlemeSql, /eclub_izleme_oneri_uq[\s\S]*\(oneri_id\)/);
  assert.match(izlemeSql, /eclub_puan_izleme_tur_uq[\s\S]*\(izleme_id, puan_turu\)/);
});
