import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ECLUB_GONDERI_AYARLARI,
  eclubGonderiAyariMi,
  eclubGonderiAyariVarsayilani,
} from "@/lib/eclub/gonderiAyarlari";
import { ayniVideoTekrarAcikZamani, oneriBitisHesapla } from "@/lib/eclub/oneriLimit";

test("E-Club gönderi ayarları iki pozitif tam sayı kuralını tek kaynaktan tanımlar", () => {
  assert.equal(ECLUB_GONDERI_AYARLARI.length, 2);
  assert.equal(new Set(ECLUB_GONDERI_AYARLARI.map((ayar) => ayar.anahtar)).size, 2);
  for (const ayar of ECLUB_GONDERI_AYARLARI) {
    assert.equal(eclubGonderiAyariMi(ayar.anahtar), true);
    assert.equal(Number.isInteger(ayar.varsayilan), true);
    assert.ok(eclubGonderiAyariVarsayilani(ayar.anahtar) > 0);
  }
});

test("aynı video tekrar tarihi önceki öneri bitişinden sonra hesaplanır", () => {
  const oncekiBitis = new Date("2026-08-21T12:00:00.000Z");
  assert.equal(ayniVideoTekrarAcikZamani(oncekiBitis, 21).toISOString(), "2026-09-11T12:00:00.000Z");
});

test("öneri bitişi ayarlanan gün sayısını kullanır", () => {
  const simdi = new Date("2026-08-14T12:00:00.000Z");
  assert.equal(oneriBitisHesapla(simdi, 10).toISOString(), "2026-08-24T12:00:00.000Z");
});

test("öneri API'si geçerlilik süresini sistem ayarından okuyarak kaydeder", () => {
  const route = readFileSync("app/(panel)/eclub/oneriler/api/route.ts", "utf8");
  assert.match(route, /eclubOneriGecerlilikGun\(adminSupabase\)/);
  assert.match(route, /oneriBitisHesapla\(now, gecerlilikGun\)/);
  assert.match(route, /\.rpc\("eclub_oneri_atomik_kaydet"/);
  assert.doesNotMatch(route, /aylikKrediKontrol|aliciLimitKontrol|tekrarKontrol/);
});
