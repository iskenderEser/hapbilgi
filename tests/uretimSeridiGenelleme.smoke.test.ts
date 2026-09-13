import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adimlariCoz, type SeritTalebi } from "@/lib/utils/uretimSeridi";

test("uretimSeridi adimlariCoz hazir ogrenme araci adimini kapali yapmaz", () => {
  const turler = ["podcast", "gorsel", "flip_pdf", "video"] as const;

  for (const tur of turler) {
    const talep: SeritTalebi = {
      talep_id: "test-talep-123",
      hazir_video: true, // Hazır araç varyantı (V2/V4)
      hazir_soru_seti: false,
      ogrenme_araci_turu: tur,
      created_at: new Date().toISOString(),
    };

    const adimlar = adimlariCoz(talep, null);
    const aracAdimi = adimlar.find((a) => a.anahtar === "video");

    assert.ok(aracAdimi, `${tur} için araç adımı bulunamadı`);
    assert.notEqual(aracAdimi.hal, "kapali", `${tur} hazır araç adımı hatalı şekilde kapalı işaretlendi!`);

    // Senaryo kapalı olmalıdır
    const senaryoAdimi = adimlar.find((a) => a.anahtar === "senaryo");
    assert.equal(senaryoAdimi?.hal, "kapali", `${tur} hazır varyantında senaryo kapalı olmalı`);
  }
});

test("TalepDetayi ve AdimIcerigi hazir ogrenme araci yuklemesini tum araclara acar", () => {
  const detay = readFileSync("app/(panel)/talepler/_components/TalepDetayi.tsx", "utf8");
  const adimIcerigi = readFileSync("app/(panel)/talepler/_components/AdimIcerigi.tsx", "utf8");

  assert.match(detay, /const aracMevcut =/);
  assert.doesNotMatch(detay, /talep\.ogrenme_araci_turu === "video"\s*&&\s*!detay\?\.video\?\.video_url/);
  assert.match(adimIcerigi, /if \(videoYuklenebilir\) \{/);
  assert.doesNotMatch(adimIcerigi, /if \(videoYuklenebilir && talep\.ogrenme_araci_turu === "video"\)/);
});
