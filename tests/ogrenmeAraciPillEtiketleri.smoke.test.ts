import assert from "node:assert/strict";
import test from "node:test";
import { OGRENME_ARACI_TURLERI, type OgrenmeAraciTuru } from "../lib/ogrenmeAraci/tipler.ts";
import { ogrenmeAraciMetinleri } from "../lib/ogrenmeAraci/etiketler.ts";
import { uretimToast } from "../lib/uretim/toastMesaj.ts";
import { iuDurumMesaji, ureticiDurumMesaji } from "../lib/utils/durum/mesaj.ts";
import { adimlariCoz } from "../lib/utils/uretimSeridi.ts";
import { asamaCoz, type ZincirSatiri } from "../lib/utils/uretimZinciri.ts";

const BEKLENEN: Record<OgrenmeAraciTuru, { ad: string; hazir: string; ilet: string }> = {
  video: { ad: "Video", hazir: "Hazır Video", ilet: "Videonuzu İletiniz" },
  podcast: { ad: "Podcast", hazir: "Hazır Podcast", ilet: "Podcastinizi İletiniz" },
  gorsel: { ad: "Dijital Broşür", hazir: "Hazır Dijital Broşür", ilet: "Dijital Broşürünüzü İletiniz" },
  flip_pdf: { ad: "Literatür", hazir: "Hazır Literatür", ilet: "Literatürünüzü İletiniz" },
};

function bosZincir(talepId: string): ZincirSatiri {
  return {
    talep_id: talepId,
    senaryo_id: null, senaryo_iu_id: null, senaryo_durum: null, senaryo_durum_tarih: null,
    video_id: null, video_iu_id: null, video_durum: null, video_durum_tarih: null,
    soru_seti_id: null, soru_seti_iu_id: null, soru_seti_durum: null, soru_seti_durum_tarih: null,
    yayin_durum: null, yayin_tarihi: null,
  };
}

function onayliHazirZincir(talepId: string): ZincirSatiri {
  return {
    ...bosZincir(talepId),
    video_id: "arac-1",
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:05:00Z",
    soru_seti_id: "soru-seti-1",
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T10:06:00Z",
  };
}

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

test("V4 Hazır Podcast + Hazır Soru Seti: doğrulanmış araç ve bağlı setten sonra yayın aktiftir", () => {
  const talep = {
    talep_id: "talep-v4-podcast",
    hazir_video: true,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "podcast" as const,
    created_at: "2026-09-13T10:00:00Z",
  };

  const zincir = onayliHazirZincir(talep.talep_id);
  const zincirDurumu = asamaCoz(talep, zincir);

  assert.equal(zincirDurumu.asama, "Tamamlandı");
  assert.equal(zincirDurumu.durum_kodu, "yayin_bekleniyor");
  assert.equal(zincirDurumu.yol, "/yayin-yonetimi");

  const adimlar = adimlariCoz(talep, zincir);

  const senaryo = adimlar.find((a) => a.anahtar === "senaryo");
  const podcast = adimlar.find((a) => a.anahtar === "video");
  const soruSeti = adimlar.find((a) => a.anahtar === "soru_seti");
  const yayin = adimlar.find((a) => a.anahtar === "yayin");

  assert.equal(senaryo?.hal, "kapali");
  assert.equal(podcast?.hal, "tamam");
  assert.equal(podcast?.etiket, "Podcast");
  assert.equal(soruSeti?.hal, "tamam");
  assert.equal(soruSeti?.durum_kodu, "hazir_soru_seti");
  assert.equal(yayin?.hal, "aktif");
  assert.equal(yayin?.durum_kodu, "yayin_bekleniyor");
  assert.equal(yayin?.yol, "/yayin-yonetimi");
});

test("Video V4: yükleme öncesinde hazır soru seti görünür, video yüklemesi beklenir", () => {
  const talep = {
    talep_id: "talep-v4-video-yukleme",
    hazir_video: true,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "video" as const,
    created_at: "2026-09-16T08:00:00Z",
  };

  const adimlar = adimlariCoz(talep, null);

  assert.deepEqual(
    adimlar.map(({ anahtar, hal, durum_kodu }) => ({ anahtar, hal, durum_kodu })),
    [
      { anahtar: "talep", hal: "tamam", durum_kodu: "talep_olusturuldu" },
      { anahtar: "senaryo", hal: "kapali", durum_kodu: null },
      { anahtar: "video", hal: "aktif", durum_kodu: "video_bekleniyor" },
      { anahtar: "soru_seti", hal: "hazir", durum_kodu: "hazir_soru_seti" },
      { anahtar: "yayin", hal: "ileri", durum_kodu: null },
    ],
  );
});

test("Video V4: video ve hazır soru seti bağlanınca yayın yönetimine geçer", () => {
  const talep = {
    talep_id: "talep-v4-video-tamamlandi",
    hazir_video: true,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "video" as const,
    created_at: "2026-09-16T08:00:00Z",
  };
  const zincir = {
    talep_id: talep.talep_id,
    senaryo_id: null,
    senaryo_iu_id: null,
    senaryo_durum: null,
    senaryo_durum_tarih: null,
    video_id: "video-v4",
    video_iu_id: null,
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T08:10:00Z",
    soru_seti_id: "soru-v4",
    soru_seti_iu_id: null,
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T08:10:00Z",
    yayin_durum: null,
    yayin_tarihi: null,
  };

  const zincirDurumu = asamaCoz(talep, zincir);
  assert.equal(zincirDurumu.asama, "Tamamlandı");
  assert.equal(zincirDurumu.durum_kodu, "yayin_bekleniyor");
  assert.equal(zincirDurumu.yol, "/yayin-yonetimi");

  const adimlar = adimlariCoz(talep, zincir);
  assert.equal(adimlar.find((adim) => adim.anahtar === "senaryo")?.hal, "kapali");
  assert.equal(adimlar.find((adim) => adim.anahtar === "video")?.hal, "tamam");
  assert.equal(adimlar.find((adim) => adim.anahtar === "soru_seti")?.hal, "tamam");
  assert.equal(adimlar.find((adim) => adim.anahtar === "yayin")?.hal, "aktif");
});

test("V2 Hazır Podcast + İÜ Soru Seti: senaryo kapalı, podcast tamamlanmış ve soru seti aktiftir", () => {
  const talep = {
    talep_id: "talep-v2-podcast",
    hazir_video: true,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "podcast" as const,
    created_at: "2026-09-13T10:00:00Z",
  };

  const zincir = { ...bosZincir(talep.talep_id), video_id: "arac-1", video_durum: "onaylandi" };
  const zincirDurumu = asamaCoz(talep, zincir);

  assert.equal(zincirDurumu.asama, "Soru Seti");
  assert.equal(zincirDurumu.durum_kodu, "iu_iletildi");

  const adimlar = adimlariCoz(talep, zincir);

  const senaryo = adimlar.find((a) => a.anahtar === "senaryo");
  const podcast = adimlar.find((a) => a.anahtar === "video");
  const soruSeti = adimlar.find((a) => a.anahtar === "soru_seti");
  const yayin = adimlar.find((a) => a.anahtar === "yayin");

  assert.equal(senaryo?.hal, "kapali");
  assert.equal(podcast?.hal, "tamam");
  assert.equal(podcast?.durum_kodu, "hazir_arac_iletildi");
  assert.equal(
    ureticiDurumMesaji(podcast!.durum_kodu!, null, talep.ogrenme_araci_turu).metin,
    "Podcastinizi İlettiniz",
  );
  assert.equal(soruSeti?.hal, "aktif");
  assert.equal(soruSeti?.durum_kodu, "iu_iletildi");
  assert.equal(yayin?.hal, "ileri");
});

test("V2 Hazır Dijital Broşür + İÜ Soru Seti: broşür iletildi ve soru seti aktiftir", () => {
  const talep = {
    talep_id: "talep-v2-gorsel",
    hazir_video: true,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "gorsel" as const,
    created_at: "2026-09-16T10:00:00Z",
  };
  const zincir = { ...bosZincir(talep.talep_id), video_id: "arac-1", video_durum: "onaylandi" };
  const adimlar = adimlariCoz(talep, zincir);
  const senaryo = adimlar.find((adim) => adim.anahtar === "senaryo");
  const brosur = adimlar.find((adim) => adim.anahtar === "video");
  const soruSeti = adimlar.find((adim) => adim.anahtar === "soru_seti");
  const yayin = adimlar.find((adim) => adim.anahtar === "yayin");

  assert.equal(senaryo?.hal, "kapali");
  assert.equal(brosur?.hal, "tamam");
  assert.equal(brosur?.etiket, "Dijital Broşür");
  assert.equal(brosur?.durum_kodu, "hazir_arac_iletildi");
  assert.equal(ureticiDurumMesaji(brosur!.durum_kodu!, null, "gorsel").metin, "Dijital Broşürünüzü İlettiniz");
  assert.equal(soruSeti?.hal, "aktif");
  assert.equal(soruSeti?.durum_kodu, "iu_iletildi");
  assert.equal(yayin?.hal, "ileri");
});

test("V4 hazır Dijital Broşür ve Literatür: yükleme yokken yayın açılmaz", () => {
  for (const tur of ["gorsel", "flip_pdf"] as const) {
    const talep = {
      talep_id: `talep-v4-${tur}`,
      hazir_video: true,
      hazir_soru_seti: true,
      ogrenme_araci_turu: tur,
      created_at: "2026-09-13T10:00:00Z",
    };

    const zincirDurumu = asamaCoz(talep, bosZincir(talep.talep_id));

    assert.equal(zincirDurumu.asama, "Video");
    assert.equal(zincirDurumu.durum_kodu, "video_bekleniyor");
  }
});

test("Dijital Broşür V4: doğrulaması yarım kalan araç yayın aşamasını açmaz", () => {
  const talep = {
    talep_id: "talep-v4-gorsel-yarim",
    hazir_video: true,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "gorsel" as const,
    created_at: "2026-09-16T10:00:00Z",
  };
  const zincir = { ...bosZincir(talep.talep_id), video_id: "arac-yarim", video_durum: "inceleme bekleniyor" };

  const durum = asamaCoz(talep, zincir);
  assert.equal(durum.asama, "Video");
  assert.equal(durum.durum_kodu, "onay_bekleniyor");
});

test("Dijital Broşür V4: araç onaylı fakat hazır set bağlı değilse hata görünür", () => {
  const talep = {
    talep_id: "talep-v4-gorsel-setsiz",
    hazir_video: true,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "gorsel" as const,
    created_at: "2026-09-16T10:00:00Z",
  };
  const zincir = { ...bosZincir(talep.talep_id), video_id: "arac-1", video_durum: "onaylandi" };

  const durum = asamaCoz(talep, zincir);
  assert.equal(durum.asama, "Soru Seti");
  assert.equal(durum.durum_kodu, "sistem_hatasi");
});

test("Dijital Broşür V4: doğrulanmış araç ve bağlı hazır setten sonra yayın açılır", () => {
  const talep = {
    talep_id: "talep-v4-gorsel-tamam",
    hazir_video: true,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "gorsel" as const,
    created_at: "2026-09-16T10:00:00Z",
  };
  const zincir = onayliHazirZincir(talep.talep_id);

  const durum = asamaCoz(talep, zincir);
  const adimlar = adimlariCoz(talep, zincir);
  assert.equal(durum.asama, "Tamamlandı");
  assert.equal(durum.durum_kodu, "yayin_bekleniyor");
  assert.equal(adimlar.find((adim) => adim.anahtar === "video")?.hal, "tamam");
  assert.equal(adimlar.find((adim) => adim.anahtar === "soru_seti")?.hal, "tamam");
  assert.equal(adimlar.find((adim) => adim.anahtar === "yayin")?.hal, "aktif");
});
