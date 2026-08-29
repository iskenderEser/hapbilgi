import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hiyerarsiAdiBicimle, tekillikIhlaliMi } from "@/lib/admin/hiyerarsiTekillik";

test("hiyerarşi adı yinelenen boşluklardan arındırılır", () => {
  assert.equal(hiyerarsiAdiBicimle("  Kuzey   Marmara  "), "Kuzey Marmara");
});

test("yalnız PostgreSQL 23505 hatası tekillik ihlali sayılır", () => {
  assert.equal(tekillikIhlaliMi({ code: "23505" }), true);
  assert.equal(tekillikIhlaliMi({ code: "23503" }), false);
  assert.equal(tekillikIhlaliMi(null), false);
});

test("migration firma, takım ve bölge kapsamlarını ayrı benzersiz indekslerle kapatır", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "scripts/sql/admin_hiyerarsi_tekillik.sql"), "utf8");
  assert.match(sql, /ON public\.firmalar \(public\.hiyerarsi_adi_anahtari\(firma_adi\)\)/);
  assert.match(sql, /ON public\.takimlar \(firma_id, public\.hiyerarsi_adi_anahtari\(takim_adi\)\)/);
  assert.match(sql, /ON public\.bolgeler \(takim_id, public\.hiyerarsi_adi_anahtari\(bolge_adi\)\)/);
});

test("firma numarası MAX+1 yerine veritabanı sequence değeriyle üretilir", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "scripts/sql/admin_hiyerarsi_tekillik.sql"), "utf8");
  assert.match(sql, /CREATE SEQUENCE IF NOT EXISTS public\.firmalar_firma_no_seq/);
  assert.match(sql, /NEW\.firma_no := nextval\('public\.firmalar_firma_no_seq'\)/);
  assert.doesNotMatch(sql, /MAX\(firma_no\).*\+\s*1/);
});
