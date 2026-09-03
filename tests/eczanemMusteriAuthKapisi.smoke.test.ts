import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("scripts/sql/eczanem_musteri_auth_kapisi.sql", "utf8");
const route = readFileSync("app/(panel)/eczanem/eczane/api/musteri-ekle/route.ts", "utf8");

test("müşteri provizyonu geçerli Auth hesabı olmadan aktif müşteri oluşturmaz", () => {
  assert.match(sql, /IF p_auth_user_id IS NULL THEN/);
  assert.match(sql, /FROM auth\.users au/);
  assert.match(sql, /WHERE au\.id = p_auth_user_id/);
  assert.match(sql, /Müşteri Auth hesabı bulunamadı/);
});

test("uygulama Auth hesabını RPC çağrısından önce oluşturur", () => {
  const authCreate = route.indexOf("auth.admin.createUser");
  const rpcCall = route.indexOf('rpc("eczanem_yeni_musteri_provizyonu_izli"');

  assert.notEqual(authCreate, -1);
  assert.notEqual(rpcCall, -1);
  assert.ok(authCreate < rpcCall);
});
