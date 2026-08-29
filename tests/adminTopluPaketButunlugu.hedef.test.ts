import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { topluPaketHatalari } from "@/lib/admin/topluPaketButunlugu";

test("tek hatalı satır bütün paketi engeller", () => {
  const hatalar = topluPaketHatalari([
    { index: 1, durum: "hazir" },
    { index: 2, durum: "hatali", hata_mesaji: "Geçersiz rol." },
    { index: 3, durum: "eksik" },
  ]);
  assert.deepEqual(hatalar, ["Satır 2 — Geçersiz rol."]);
});

test("tamamen geçerli paket yazma kapısından geçer", () => {
  assert.deepEqual(topluPaketHatalari([
    { index: 1, durum: "hazir" },
    { index: 2, durum: "eksik" },
  ]), []);
});

test("route doğrulama kapısını ilk organizasyon yazımından önce çalıştırır", () => {
  const kaynak = fs.readFileSync(
    path.join(process.cwd(), "app/admin/api/firmalar/[firma_id]/toplu-yukle/route.ts"),
    "utf8"
  );
  const paketKapisi = kaynak.indexOf("const paketHatalari = topluPaketHatalari");
  const ilkTakimYazimi = kaynak.indexOf('.from("takimlar")', paketKapisi);
  assert.ok(paketKapisi >= 0);
  assert.ok(ilkTakimYazimi > paketKapisi);
  assert.match(kaynak, /const telafiHatalari = await paketiGeriAl\(\)/);
});
