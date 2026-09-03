import assert from "node:assert/strict";
import test from "node:test";
import { OGRENME_ARACI_TURLERI, type OgrenmeAraciTuru } from "../lib/ogrenmeAraci/tipler.ts";
import { ogrenmeAraciMetinleri } from "../lib/ogrenmeAraci/etiketler.ts";
import { uretimToast } from "../lib/uretim/toastMesaj.ts";
import { iuDurumMesaji, ureticiDurumMesaji } from "../lib/utils/durum/mesaj.ts";
import { adimlariCoz } from "../lib/utils/uretimSeridi.ts";

const BEKLENEN: Record<OgrenmeAraciTuru, { ad: string; hazir: string; ilet: string }> = {
  video: { ad: "Video", hazir: "Hazır Video", ilet: "Videonuzu İletiniz" },
  podcast: { ad: "Podcast", hazir: "Hazır Podcast", ilet: "Podcastinizi İletiniz" },
  gorsel: { ad: "Dijital Broşür", hazir: "Hazır Dijital Broşür", ilet: "Dijital Broşürünüzü İletiniz" },
  flip_pdf: { ad: "Literatür", hazir: "Hazır Literatür", ilet: "Literatürünüzü İletiniz" },
};

for (const tur of OGRENME_ARACI_TURLERI) {
  test(`${tur}: varyant, aşama ve durum metinleri seçilen aracı gösterir`, () => {
    const beklenen = BEKLENEN[tur];

    assert.equal(ogrenmeAraciMetinleri(tur).hazir, beklenen.hazir);
    assert.equal(ureticiDurumMesaji("video_bekleniyor", null, tur).metin, beklenen.ilet);
    assert.equal(
      iuDurumMesaji("iu_iletildi", { asama: "Video", ogrenmeAraciTuru: tur }).metin,
      `${beklenen.ad} Yüklemeniz Bekleniyor`,
    );

    const aracAdimi = adimlariCoz(
      {
        talep_id: `test-${tur}`,
        hazir_video: true,
        hazir_soru_seti: false,
        ogrenme_araci_turu: tur,
        created_at: null,
      },
      null,
    ).find((adim) => adim.anahtar === "video");

    assert.equal(aracAdimi?.etiket, beklenen.ad);

    const baglam = { varyant: "normal" as const, ogrenmeAraciTuru: tur, rolAdi: "Ürün Müdürü" };
    const metinler = ogrenmeAraciMetinleri(tur);
    assert.equal(
      uretimToast({ rol: "uretici", olay: "onay", asama: "senaryo", revize: false }, baglam),
      `Senaryoyu onayladınız, içerik üreticinize ${metinler.adKucuk} talebiniz iletildi`,
    );
    assert.equal(
      uretimToast({ rol: "uretici", olay: "onay", asama: "video", revize: false }, baglam),
      `${metinler.belirtme} onayladınız, soru seti talebiniz içerik üreticisine iletildi`,
    );
    assert.equal(
      uretimToast({ rol: "uretici", olay: "revizyon", asama: "video" }, baglam),
      `${metinler.ad} için revizyon talebiniz içerik üreticisine iletildi`,
    );
    assert.equal(
      uretimToast({ rol: "iu", olay: "teslim", asama: "video", revize: true }, baglam),
      `Revize ${metinler.belirtmeKucuk} Ürün Müdürü onayına ilettiniz`,
    );
  });
}

test("öğrenme aracı türü bulunmayan eski kayıtta toast Video adını kullanır", () => {
  assert.equal(
    uretimToast(
      { rol: "uretici", olay: "onay", asama: "senaryo", revize: false },
      { varyant: "normal" },
    ),
    "Senaryoyu onayladınız, içerik üreticinize video talebiniz iletildi",
  );
});
