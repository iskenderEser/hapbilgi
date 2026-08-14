import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ECLUB_GONDERI_AYARLARI,
  eclubGonderiAyariMi,
  eclubGonderiAyariVarsayilani,
} from "@/lib/eclub/gonderiAyarlari";
import { kayanPencereBasi, oneriBitisHesapla } from "@/lib/eclub/oneriLimit";

test("E-Club gönderi ayarları beş pozitif tam sayı kuralını tek kaynaktan tanımlar", () => {
  assert.equal(ECLUB_GONDERI_AYARLARI.length, 5);
  assert.equal(new Set(ECLUB_GONDERI_AYARLARI.map((ayar) => ayar.anahtar)).size, 5);
  for (const ayar of ECLUB_GONDERI_AYARLARI) {
    assert.equal(eclubGonderiAyariMi(ayar.anahtar), true);
    assert.equal(Number.isInteger(ayar.varsayilan), true);
    assert.ok(eclubGonderiAyariVarsayilani(ayar.anahtar) > 0);
  }
});

test("öneri bitişi ve alıcı penceresi ayarlanan gün sayısını kullanır", () => {
  const simdi = new Date("2026-08-14T12:00:00.000Z");
  assert.equal(oneriBitisHesapla(simdi, 10).toISOString(), "2026-08-24T12:00:00.000Z");
  assert.equal(kayanPencereBasi(3, simdi).toISOString(), "2026-08-11T12:00:00.000Z");
});

test("öneri API'si geçerlilik süresini sistem ayarından okuyarak kaydeder", () => {
  const route = readFileSync("app/(panel)/eclub/oneriler/api/route.ts", "utf8");
  assert.match(route, /eclubOneriGecerlilikGun\(adminSupabase\)/);
  assert.match(route, /oneriBitisHesapla\(now, gecerlilikGun\)/);
});
