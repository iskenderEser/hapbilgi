import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/(panel)/eclub/store/api/siparis/route.ts", "utf8");
const rolloutSql = readFileSync("scripts/sql/eclub_store_aktif_uyelik_siparis_kapisi.sql", "utf8");
const kaynakSql = readFileSync("scripts/sql/eclub_store_firma_urun_gorunurlugu.sql", "utf8");

test("E-Club Store sipariş API'si pasif kişinin yeni siparişini reddeder", () => {
  assert.match(route, /eclubKisiErisimi\(adminSupabase, user\.id\)/);
  assert.match(route, /!erisim\.eclub_aktif\s*\|\|\s*!erisim\.eclub_store_aktif/);
  assert.match(route, /Aktif E-Club üyeliğiniz bulunmadığı için yeni sipariş oluşturamazsınız/);
});

for (const [ad, sql] of [
  ["rollout", rolloutSql],
  ["kaynak", kaynakSql],
] as const) {
  test(`E-Club Store ${ad} SQL'i aktif üyelik kapısını RPC içinde uygular`, () => {
    assert.match(sql, /FROM public\.eclub_kisi_eczane ke/);
    assert.match(sql, /ke\.aktif_mi = true/);
    assert.match(sql, /ef\.aktif_mi = true/);
    assert.match(sql, /f\.eclub_aktif = true/);
    assert.match(sql, /f\.eclub_store_aktif = true/);
    assert.match(sql, /FOR UPDATE OF ke/);
    assert.match(sql, /IF NOT FOUND THEN[\s\S]*Aktif E-Club üyeliğiniz bulunmadığı için yeni sipariş oluşturamazsınız/);
    assert.ok(
      sql.indexOf("FROM public.eclub_kisi_eczane ke") < sql.indexOf("FROM public.eclub_store_urunler"),
      "aktif üyelik kapısı ürün ve stok işleminden önce çalışmalı",
    );
  });
}
