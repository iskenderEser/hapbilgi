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

test("talep adimi her arac turunde ortak olusturulma mesajini tasir", () => {
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"] as const) {
    const talep: SeritTalebi = {
      talep_id: `talep-${tur}`,
      hazir_video: false,
      hazir_soru_seti: false,
      ogrenme_araci_turu: tur,
      created_at: "2026-09-16T08:00:00.000Z",
    };

    const adim = adimlariCoz(talep, null)[0];
    assert.equal(adim.anahtar, "talep");
    assert.equal(adim.hal, "tamam");
    assert.equal(adim.durum_kodu, "talep_olusturuldu");
  }
});

test("aktif gorev tum araclarda icerik zinciri tahmininin onune gecer", () => {
  const durumlar = ["iu_iletildi", "iu_hazirliyor", "iu_duzeltiyor", "onay_bekleniyor"] as const;
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"] as const) {
    for (const durum_kodu of durumlar) {
      const talep: SeritTalebi = {
        talep_id: `talep-${tur}`,
        hazir_video: false,
        hazir_soru_seti: false,
        ogrenme_araci_turu: tur,
        created_at: "2026-09-16T08:00:00.000Z",
      };

      const adimlar = adimlariCoz(talep, null, {
        asama: "Senaryo",
        durum_kodu,
      });
      const aktif = adimlar.find((adim) => adim.hal === "aktif");

      assert.equal(aktif?.anahtar, "senaryo");
      assert.equal(aktif?.durum_kodu, durum_kodu);
    }
  }
});

test("aktif gorevin asamasi seritteki aktif adimi ve onceki tamamlanan adimlari belirler", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-video-v1",
    hazir_video: false,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "video",
    created_at: "2026-09-16T08:00:00.000Z",
  };

  const adimlar = adimlariCoz(talep, null, {
    asama: "Soru Seti",
    durum_kodu: "iu_duzeltiyor",
  });

  assert.deepEqual(
    adimlar.map(({ anahtar, hal, durum_kodu }) => ({ anahtar, hal, durum_kodu })),
    [
      { anahtar: "talep", hal: "tamam", durum_kodu: "talep_olusturuldu" },
      { anahtar: "senaryo", hal: "tamam", durum_kodu: "onaylandi" },
      { anahtar: "video", hal: "tamam", durum_kodu: "onaylandi" },
      { anahtar: "soru_seti", hal: "aktif", durum_kodu: "iu_duzeltiyor" },
      { anahtar: "yayin", hal: "ileri", durum_kodu: null },
    ],
  );
});

test("aktif gorev yokken teslim ve yayin durumu icerik zincirinden cozulur", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-video-v1",
    hazir_video: false,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "video",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const zincir = {
    talep_id: talep.talep_id,
    senaryo_id: "senaryo-1",
    senaryo_iu_id: "iu-1",
    senaryo_durum: "inceleme bekleniyor",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: null,
    video_iu_id: null,
    video_durum: null,
    video_durum_tarih: null,
    soru_seti_id: null,
    soru_seti_iu_id: null,
    soru_seti_durum: null,
    soru_seti_durum_tarih: null,
    yayin_durum: null,
    yayin_tarihi: null,
  };

  const aktif = adimlariCoz(talep, zincir).find((adim) => adim.hal === "aktif");
  assert.equal(aktif?.anahtar, "senaryo");
  assert.equal(aktif?.durum_kodu, "onay_bekleniyor");
});
