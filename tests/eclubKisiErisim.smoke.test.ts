import test from "node:test";
import assert from "node:assert/strict";

import { eclubKisiModulDurumu } from "@/lib/eclub/kisiErisim";

test("mutlu: en az bir aktif bağlı firma E-Club ve Store erişimini açar", () => {
  const sonuc = eclubKisiModulDurumu([
    { firma_id: "a", firma_adi: "A", aktif: true, eclub_aktif: true, eclub_store_aktif: true },
    { firma_id: "b", firma_adi: "B", aktif: true, eclub_aktif: false, eclub_store_aktif: true },
  ]);
  assert.deepEqual(sonuc, { eclub_aktif: true, eclub_store_aktif: true });
});

test("sınır: pasif veya E-Club'ı kapalı firma dış müşteriye modül açmaz", () => {
  const sonuc = eclubKisiModulDurumu([
    { firma_id: "a", firma_adi: "A", aktif: false, eclub_aktif: true, eclub_store_aktif: true },
    { firma_id: "b", firma_adi: "B", aktif: true, eclub_aktif: false, eclub_store_aktif: true },
  ]);
  assert.deepEqual(sonuc, { eclub_aktif: false, eclub_store_aktif: false });
});
