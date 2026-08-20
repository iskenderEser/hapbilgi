import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/eczanem/eczane/api/musteriler/route.ts", "utf8");
const deleteBaslangici = route.indexOf("export async function DELETE");
const deleteBlogu = route.slice(deleteBaslangici);

test("mutlu: eczacı liste silmesini tek atomik RPC ile yapar", () => {
  assert.match(
    deleteBlogu,
    /rpc\("eczanem_uyelik_listeden_sil", \{[\s\S]*?p_musteri_id: musteriId[\s\S]*?p_eczane_id: ctx\.eczaneId[\s\S]*?p_silen_kisi_id: ctx\.kisiId[\s\S]*?p_eposta: eposta/,
  );
});

test("red: route günlük ekleme ve üyelik silmeyi ayrı sorgularla yapmaz", () => {
  assert.doesNotMatch(deleteBlogu, /from\("eczanem_silinen_musteriler"\)[\s\S]*?\.insert\(/);
  assert.doesNotMatch(deleteBlogu, /from\("eczanem_uyelikler"\)[\s\S]*?\.delete\(/);
});
