import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/challenge-club/api/route.ts", "utf8");

test("mutlu: başlangıç videosu BM hedefi, firma ve geçerli yayın tarihleriyle süzülür", () => {
  assert.match(route, /from\("v_yayin_detay"\)[\s\S]*?eq\("durum", "yayinda"\)[\s\S]*?eq\("firma_id", kullanici\.firma_id\)[\s\S]*?contains\("hedef_roller", \["bm"\]\)[\s\S]*?lte\("yayin_tarihi", simdi\)[\s\S]*?durdurma_tarihi\.is\.null,durdurma_tarihi\.gt/);
});

test("red: firmasında C-Club kapalı olan BM yayın listesine erişemez", () => {
  assert.match(route, /from\("firmalar"\)[\s\S]*?select\("cc_aktif"\)[\s\S]*?firma\.cc_aktif !== true[\s\S]*?C-Club erişimi kapalıdır/);
});
