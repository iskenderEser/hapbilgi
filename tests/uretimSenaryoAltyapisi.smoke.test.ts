import assert from "node:assert/strict";
import test from "node:test";
import {
  aktifAdim,
  bosUretimZinciri,
  senaryoAdimlari,
  senaryoTalebi,
  URETIM_ARACLARI,
  URETIM_VARYANTLARI,
} from "./helpers/uretimSenaryosu.ts";

test("üretim senaryosu altyapısı dört araç ve dört varyant için 16 izole başlangıç üretir", () => {
  const kimlikler = new Set<string>();

  for (const arac of URETIM_ARACLARI) {
    for (const varyant of URETIM_VARYANTLARI) {
      const talep = senaryoTalebi(arac, varyant);
      const zincir = bosUretimZinciri(talep.talep_id);
      const adimlar = senaryoAdimlari(talep, zincir);

      kimlikler.add(talep.talep_id);
      assert.equal(adimlar.length, 5);
      assert.equal(adimlar[0]?.anahtar, "talep");
      assert.equal(adimlar[2]?.etiket, arac === "gorsel" ? "Dijital Broşür" : arac === "flip_pdf" ? "Literatür" : arac === "podcast" ? "Podcast" : "Video");
      assert.equal(aktifAdim(adimlar)?.anahtar, talep.hazir_video ? "video" : "senaryo");
    }
  }

  assert.equal(kimlikler.size, 16);
});

test("senaryo verileri testler arasında ortak nesne taşımaz", () => {
  const ilk = bosUretimZinciri("talep-1");
  const ikinci = bosUretimZinciri("talep-2");
  ilk.video_id = "degisti";

  assert.equal(ikinci.video_id, null);
});
