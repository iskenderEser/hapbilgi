import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TEST_TEMIZLIK_ONAYI, testEczaneAdi, testGlnlerUret, testGlnMi } from "@/lib/eclub/testGln";

test("30 test GLN benzersiz, 13 haneli ve 111 önekli üretilir", () => {
  const glnler = testGlnlerUret(30, []);
  assert.equal(glnler.length, 30);
  assert.equal(new Set(glnler).size, 30);
  assert.equal(glnler.every(testGlnMi), true);
  assert.equal(glnler[0], "1110000000001");
  assert.equal(glnler[29], "1110000000030");
  assert.equal(testEczaneAdi(glnler[0]), "Test Eczanesi 001");
});

test("üretici mevcut GLN'leri atlar ve gerçek 868 GLN'yi test saymaz", () => {
  assert.deepEqual(testGlnlerUret(2, ["1110000000001", "1110000000003"]), ["1110000000002", "1110000000004"]);
  assert.equal(testGlnMi("8680000000001"), false);
  assert.equal(testGlnMi("111000000001"), false);
  assert.throws(() => testGlnlerUret(0, []), RangeError);
  assert.throws(() => testGlnlerUret(101, []), RangeError);
});

test("test temizliği 111 kapsamını, atomik RPC'yi ve açık onayı birlikte zorunlu tutar", () => {
  const sql = readFileSync("scripts/sql/eclub_test_veri_temizle.sql", "utf8");
  const route = readFileSync("app/admin/api/eclub/test-temizlik/route.ts", "utf8");
  assert.equal(TEST_TEMIZLIK_ONAYI, "TEST VERİLERİNİ SİL");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eclub_test_veri_islem/);
  assert.match(sql, /m\.kaynak = 'test' AND m\.gln LIKE '111%'/);
  assert.match(sql, /NOT \(ke\.eczane_id = ANY\(v_eczane\)\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.eclub_test_veri_islem\(text\) TO service_role/);
  assert.match(route, /body\.onay !== TEST_TEMIZLIK_ONAYI/);
  assert.match(route, /auth\.admin\.deleteUser/);
});

test("master eczane kaynak kuralı test GLN kaynağını kabul eder", () => {
  const sql = readFileSync("scripts/sql/eclub_test_gln_kaynak.sql", "utf8");
  assert.match(sql, /kaynak IN \('resmi', 'elle', 'test'\)/);
});
