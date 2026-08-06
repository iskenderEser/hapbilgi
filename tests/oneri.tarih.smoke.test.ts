// tests/oneri.tarih.smoke.test.ts — öneri tarih kuralı smoke (tavan: 1 mutlu + 1 sınır).
//
// SÖZLEŞME: "başlangıç en erken yarın" kuralı Türkiye gününe göredir. Kritik an,
// TR 00:00–02:59 aralığıdır: o saatte UTC hâlâ bir önceki gündedir, dolayısıyla
// "bugün"ü UTC'den kesen eski kod bugüne öneriyi yanlışlıkla kabul eder.
//
// Zamanı dondurup (TR 6 Ağustos 01:00 = UTC 5 Ağustos 22:00) bu ayrımı ölçeriz.

import { test } from "node:test";
import assert from "node:assert/strict";
import { oneriTarihKurali } from "../lib/oneri/tarihKurali.ts";

// Ambient saati sabitler — varsayılan "bugün" gerçek saatten okunduğu için
// deterministik ölçüm ancak zamanı dondurarak yapılır.
function donmusZamanda<T>(isoAn: string, f: () => T): T {
  const Gercek = Date;
  const sabit = new Gercek(isoAn).getTime();
  // @ts-expect-error test amaçlı Date override
  globalThis.Date = class extends Gercek {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(sabit);
      else super(...(a as ConstructorParameters<typeof Date>));
    }
    static now() {
      return sabit;
    }
  };
  try {
    return f();
  } finally {
    globalThis.Date = Gercek;
  }
}

test("mutlu: yarindan itibaren oneri kabul edilir", () => {
  donmusZamanda("2026-08-06T01:00:00+03:00", () => {
    // TR bugün = 6 Ağustos; başlangıç 7 Ağustos (yarın) → kabul.
    const s = oneriTarihKurali("2026-08-07", "2026-08-09");
    assert.equal(s.gecerli, true);
  });
});

test("sinir: gece 01:00 TR'de bugune oneri REDDEDILIR (UTC gunu bir onceki gun)", () => {
  donmusZamanda("2026-08-06T01:00:00+03:00", () => {
    // TR bugün = 6 Ağustos. Bugüne (6 Ağustos) öneri "geçmiş" sayılmalı.
    // Eski kod: varsayılan bugün = UTC "2026-08-05" → "2026-08-06" > "2026-08-05"
    // → yanlışlıkla KABUL. Doğrusu: trGunu() = "2026-08-06" → RED.
    const s = oneriTarihKurali("2026-08-06", "2026-08-08");
    assert.equal(s.gecerli, false);
    assert.equal(s.gecerli === false && s.sebep, "gecmis_tarih");
  });
});
