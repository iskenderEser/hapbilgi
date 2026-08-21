import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI,
  eclubTelefonVaryantlari,
} from "@/lib/eczanem/eclubUyesiKontrol";

const route = readFileSync("app/(panel)/eczanem/eczane/api/musteri-ekle/route.ts", "utf8");

test("mutlu: global E-Club kontrolü kanonik ve mevcut telefon biçimlerini kapsar", () => {
  assert.deepEqual(eclubTelefonVaryantlari("5321234567"), [
    "5321234567",
    "05321234567",
    "905321234567",
    "+905321234567",
  ]);
  assert.match(route, /await eclubUyesiTelefonMu\(adminSupabase, telefon\)/);
});

test("red: E-Club üyesi yeni kayıt ve mevcut müşteri bağından önce kesin mesajla reddedilir", () => {
  const kontrolSirasi = route.indexOf("if (eclubKontrol.uyeMi)");
  const islemSirasi = route.indexOf("const islem =");
  assert.ok(kontrolSirasi >= 0 && islemSirasi > kontrolSirasi);
  assert.equal(
    ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI,
    "HapBilgi'de E-Club üyesi olduğunuz için müşteri olarak kayıt olmazsınız",
  );
  assert.match(route, /isKuraluHatasi\(ECLUB_UYESI_MUSTERI_OLAMAZ_MESAJI\)/);
});
