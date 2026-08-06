// tests/periyotAltKirilim.smoke.test.ts — grafik dilim sınırları smoke (1 mutlu + 1 sınır).
//
// SÖZLEŞME: dilim sınırları Türkiye saatine göre hesaplanır ve makinenin saat
// diliminden BAĞIMSIZDIR. Etiket ile sınır AYNI takvimden gelmeli — "12" etiketli
// bu_gun dilimi gerçekten TR 06:00–12:00'yi kapsamalı (eski kod UTC ile 09:00–15:00 derdi).
//
// Girdi: sabit mutlak an (açık ofsetli ISO) — `simdi` parametresiyle enjekte edilir.
// Çıktı: TR takvim sınırları. İki uç TZ'de aynı sonucu vermezse sözleşme bozuktur.

import { test } from "node:test";
import assert from "node:assert/strict";
import { periyotAltKirilim } from "../lib/utils/periyotAltKirilim.ts";

const trSaat = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const trGun = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

test("mutlu: bu_gun dilimleri TR 6'sar saatlik ve etiketle uyumlu", () => {
  const dilimler = periyotAltKirilim("bu_gun", new Date("2026-08-05T15:00:00+03:00"));
  assert.equal(dilimler.length, 4);
  // İlk dilim TR günü 00:00'dan başlar.
  assert.equal(trSaat(dilimler[0].baslangic), "00:00");
  // "12" etiketli dilim (index 1) gerçekten TR 06:00–12:00'yi kapsar.
  const oniki = dilimler[1];
  assert.equal(oniki.etiket, "12");
  assert.equal(trSaat(oniki.baslangic), "06:00");
  assert.equal(trSaat(oniki.bitis), "12:00");
});

test("sinir: gece 01:00 ve yil sonu TR gunune sadik kalir", () => {
  // TR 6 Ağustos 01:00 (UTC 5 Ağustos 22:00). Dilimler TR gününe demirlenmeli.
  const gun = periyotAltKirilim("bu_gun", new Date("2026-08-06T01:00:00+03:00"));
  assert.equal(trGun(gun[0].baslangic), "2026-08-06");
  assert.equal(trSaat(gun[0].baslangic), "00:00");

  // Yıl sonu: 12 aylık dilim; ilk Ocak, son dilim gelecek yıl 1 Ocak'ta biter (TR).
  const yil = periyotAltKirilim("bu_yil", new Date("2026-12-31T23:30:00+03:00"));
  assert.equal(yil.length, 12);
  assert.equal(trGun(yil[0].baslangic), "2026-01-01");
  assert.equal(trGun(yil[11].bitis), "2027-01-01");
});
