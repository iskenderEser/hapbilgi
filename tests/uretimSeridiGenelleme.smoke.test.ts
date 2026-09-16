import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adimlariCoz, type SeritTalebi } from "@/lib/utils/uretimSeridi";
import { iuDurumMesaji, ureticiDurumMesaji } from "@/lib/utils/durum/mesaj";
import { hazirVideoIsleniyorMesaji, toastVaryant, uretimToast } from "@/lib/uretim/toastMesaj";

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
    tarih: "2026-09-16T10:00:00.000Z",
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
  assert.equal(adimlar.find((adim) => adim.anahtar === "soru_seti")?.tarih, "2026-09-16T10:00:00.000Z");
});

test("Video V1 teknik isleme durumunda onay ve revizyonu kapatir, iptali acik tutar", () => {
  const detay = readFileSync("app/(panel)/talepler/_components/TalepDetayi.tsx", "utf8");
  const aksiyon = readFileSync("app/(panel)/talepler/_components/AksiyonSeridi.tsx", "utf8");
  const kararApi = readFileSync("app/(panel)/uretim/api/karar/route.ts", "utf8");
  const teslimApi = readFileSync("app/(panel)/uretim/api/teslim/route.ts", "utf8");

  assert.match(detay, /bunnyIslemeDurumu === "isleniyor" \|\| bunnyIslemeDurumu === "hatali"/);
  assert.match(aksiyon, /disabled=\{yukleniyor \|\| incelemeKisitli\}/);
  assert.match(aksiyon, /onKarar\("Iptal Edildi"\)/);
  assert.match(kararApi, /karar === "onaylandi" && gorevBilgisi\?\.asama === "video" && aracTuru === "video"/);
  assert.match(kararApi, /bunnyDurumu\.hatali/);
  assert.match(kararApi, /!bunnyDurumu\.hazir/);
  assert.match(teslimApi, /const bunnyDurumu = await bunnyVideoDurumu\(videoGuid\)/);
  assert.match(teslimApi, /Video işlenemedi\. Yeni bir video yükleyip yeniden gönderin\./);
  assert.match(teslimApi, /Video işleniyor\. Hazır olduğunda yeniden gönderin\./);
});

test("Video V1 seridi senaryo, video, soru seti ve yayin gecislerini ortak cozumleyiciyle izler", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-video-v1-yasam-dongusu",
    hazir_video: false,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "video",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const bosZincir = {
    talep_id: talep.talep_id,
    senaryo_id: null,
    senaryo_iu_id: null,
    senaryo_durum: null,
    senaryo_durum_tarih: null,
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

  const aktif = (zincir: typeof bosZincir, gorev: Parameters<typeof adimlariCoz>[2] = null) =>
    adimlariCoz(talep, zincir, gorev).find((adim) => adim.hal === "aktif");

  assert.deepEqual(
    aktif(bosZincir, { asama: "Senaryo", durum_kodu: "iu_iletildi", tarih: talep.created_at }),
    assertAktif("senaryo", "iu_iletildi", talep.created_at),
  );

  const senaryoOnayli = {
    ...bosZincir,
    senaryo_id: "senaryo-1",
    senaryo_iu_id: "iu-1",
    senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "video-1",
  };
  assert.equal(aktif(senaryoOnayli, { asama: "Video", durum_kodu: "iu_hazirliyor" })?.anahtar, "video");

  const videoOnayli = {
    ...senaryoOnayli,
    video_iu_id: "iu-1",
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
    soru_seti_id: "soru-seti-1",
  };
  assert.equal(aktif(videoOnayli, { asama: "Soru Seti", durum_kodu: "onay_bekleniyor" })?.anahtar, "soru_seti");

  const soruSetiOnayli = {
    ...videoOnayli,
    soru_seti_iu_id: "iu-1",
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T11:00:00.000Z",
  };
  assert.equal(aktif(soruSetiOnayli)?.anahtar, "yayin");
  assert.equal(aktif(soruSetiOnayli)?.durum_kodu, "yayin_bekleniyor");

  const yayinli = { ...soruSetiOnayli, yayin_durum: "yayinda", yayin_tarihi: "2026-09-16T12:00:00.000Z" };
  assert.equal(aktif(yayinli)?.durum_kodu, "yayinda");
});

test("Podcast V1 seridi üretici ve içerik üreticisi pill geçişlerini doğru anlatır", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-podcast-v1-yasam-dongusu",
    hazir_video: false,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "podcast",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const zincir = {
    talep_id: talep.talep_id,
    senaryo_id: "senaryo-podcast-v1",
    senaryo_iu_id: "iu-1",
    senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "podcast-v1",
    video_iu_id: "iu-1",
    video_durum: null,
    video_durum_tarih: null,
    soru_seti_id: null,
    soru_seti_iu_id: null,
    soru_seti_durum: null,
    soru_seti_durum_tarih: null,
    yayin_durum: null,
    yayin_tarihi: null,
  };

  for (const [durum_kodu, ureticiMetni, iuMetni] of [
    ["iu_iletildi", "Üreticinize İletildi", "Podcast Yüklemeniz Bekleniyor"],
    ["iu_hazirliyor", "Üreticiniz Hazırlıyor", "Podcast Yüklemeniz Bekleniyor"],
    ["iu_duzeltiyor", "Üreticiniz Düzenliyor", "Podcast Revizyonu Bekleniyor"],
    ["onay_bekleniyor", "Onayınız Bekleniyor", "Ürün Müdürü İnceliyor"],
  ] as const) {
    const aktif = adimlariCoz(talep, zincir, { asama: "Video", durum_kodu }).find((adim) => adim.hal === "aktif");
    assert.equal(aktif?.anahtar, "video");
    assert.equal(aktif?.etiket, "Podcast");
    assert.equal(aktif?.durum_kodu, durum_kodu);
    assert.equal(ureticiDurumMesaji(durum_kodu, null, "podcast").metin, ureticiMetni);
    assert.equal(iuDurumMesaji(durum_kodu, { asama: "Video", rolAdi: "Ürün Müdürü", ogrenmeAraciTuru: "podcast" }).metin, iuMetni);
  }

  const soruSeti = adimlariCoz(talep, {
    ...zincir,
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
    soru_seti_id: "soru-podcast-v1",
  }, { asama: "Soru Seti", durum_kodu: "iu_iletildi" });
  assert.equal(soruSeti.find((adim) => adim.hal === "aktif")?.anahtar, "soru_seti");
});

test("Podcast V1 Talep Takibi ortak araç geçmişiyle karar verir ve revizyonda transkript isteyebilir", () => {
  const detayApi = readFileSync("app/(panel)/talepler/api/detay/route.ts", "utf8");
  const detay = readFileSync("app/(panel)/talepler/_components/TalepDetayi.tsx", "utf8");
  const aksiyon = readFileSync("app/(panel)/talepler/_components/AksiyonSeridi.tsx", "utf8");
  const merkez = readFileSync("app/(panel)/talepler/_hooks/useTalepMerkezi.ts", "utf8");

  assert.match(detayApi, /from\("ogrenme_araci_durumu"\)[\s\S]*durumOzeti/);
  assert.match(detay, /talep\.ogrenme_araci_turu === "video" \? detay\?\.video : detay\?\.ogrenme_araci/);
  assert.match(detay, /podcastTranskriptRevizyondaIstenebilir/);
  assert.match(aksiyon, /Bu revizyonda transkript de istiyorum/);
  assert.match(merkez, /revizyonda_transkript_istendi: true/);
});

test("Dijital Broşür V1 seridi ve teslim yüzeyi yaşam döngüsünü doğru adlandırır", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-gorsel-v1-yasam-dongusu",
    hazir_video: false,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "gorsel",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const bosZincir = {
    talep_id: talep.talep_id,
    senaryo_id: null,
    senaryo_iu_id: null,
    senaryo_durum: null,
    senaryo_durum_tarih: null,
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

  const senaryo = adimlariCoz(talep, bosZincir, { asama: "Senaryo", durum_kodu: "iu_iletildi" });
  assert.equal(senaryo.find((adim) => adim.hal === "aktif")?.anahtar, "senaryo");

  const brosur = adimlariCoz(talep, {
    ...bosZincir,
    senaryo_id: "senaryo-gorsel-v1",
    senaryo_iu_id: "iu-1",
    senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "gorsel-v1",
  }, { asama: "Video", durum_kodu: "onay_bekleniyor" });
  const aktifBrosur = brosur.find((adim) => adim.hal === "aktif");
  assert.equal(aktifBrosur?.anahtar, "video");
  assert.equal(aktifBrosur?.etiket, "Dijital Broşür");
  assert.equal(ureticiDurumMesaji("onay_bekleniyor", null, "gorsel").metin, "Onayınız Bekleniyor");
  assert.equal(
    iuDurumMesaji("onay_bekleniyor", { asama: "Video", rolAdi: "Ürün Müdürü", ogrenmeAraciTuru: "gorsel" }).metin,
    "Ürün Müdürü İnceliyor",
  );

  const soruSeti = adimlariCoz(talep, {
    ...bosZincir,
    senaryo_id: "senaryo-gorsel-v1",
    senaryo_durum: "onaylandi",
    video_id: "gorsel-v1",
    video_iu_id: "iu-1",
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
    soru_seti_id: "soru-gorsel-v1",
  }, { asama: "Soru Seti", durum_kodu: "iu_iletildi" });
  assert.equal(soruSeti.find((adim) => adim.hal === "aktif")?.anahtar, "soru_seti");

  const gorevSayfasi = readFileSync("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx", "utf8");
  const dogrulamaRoute = readFileSync("app/api/ogrenme-araclari/[arac_id]/gorsel-dogrula/route.ts", "utf8");
  assert.match(gorevSayfasi, />Dijital Broşür<input/);
  assert.match(gorevSayfasi, /Dijital Broşür üretici incelemesine gönderildi/);
  assert.match(dogrulamaRoute, /Dijital Broşür üretim zincirine alındı/);
});

test("Video V2 seridi yukleme, isleme, soru seti ve yayin gecislerini dogru anlatir", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-video-v2-yasam-dongusu",
    hazir_video: true,
    hazir_soru_seti: false,
    ogrenme_araci_turu: "video",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const bosZincir = {
    talep_id: talep.talep_id,
    senaryo_id: null,
    senaryo_iu_id: null,
    senaryo_durum: null,
    senaryo_durum_tarih: null,
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

  const yuklemeBekliyor = adimlariCoz(talep, bosZincir);
  assert.equal(yuklemeBekliyor.find((adim) => adim.anahtar === "senaryo")?.hal, "kapali");
  assert.equal(yuklemeBekliyor.find((adim) => adim.hal === "aktif")?.durum_kodu, "video_bekleniyor");

  const isleniyor = adimlariCoz({ ...talep, hazir_video_url: "https://iframe.mediadelivery.net/embed/lib/guid" }, bosZincir);
  assert.equal(isleniyor.find((adim) => adim.hal === "aktif")?.durum_kodu, "video_isleniyor");
  assert.equal(ureticiDurumMesaji("video_isleniyor").metin, "Videonuz İşleniyor");

  const soruSetiZinciri = {
    ...bosZincir,
    video_id: "video-v2",
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T09:00:00.000Z",
    soru_seti_id: "soru-v2",
  };
  const soruSeti = adimlariCoz(talep, soruSetiZinciri, {
    asama: "Soru Seti",
    durum_kodu: "iu_iletildi",
    tarih: "2026-09-16T09:00:00.000Z",
  });
  assert.equal(soruSeti.find((adim) => adim.hal === "aktif")?.anahtar, "soru_seti");
  assert.equal(soruSeti.find((adim) => adim.hal === "aktif")?.durum_kodu, "iu_iletildi");

  const yayin = adimlariCoz(talep, {
    ...soruSetiZinciri,
    soru_seti_iu_id: "iu-1",
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T10:00:00.000Z",
  });
  assert.equal(yayin.find((adim) => adim.hal === "aktif")?.anahtar, "yayin");
  assert.equal(yayin.find((adim) => adim.hal === "aktif")?.durum_kodu, "yayin_bekleniyor");

  assert.equal(
    hazirVideoIsleniyorMesaji(false),
    "Video yüklendi ve işleniyor. Hazır olduğunda soru seti üretimi için içerik üreticinize iletilecek.",
  );
  assert.equal(
    hazirVideoIsleniyorMesaji(true),
    "Video yüklendi ve işleniyor. Hazır olduğunda yayın yönetimine aktarılacak.",
  );
});

test("Video V2 arka plan kalici hatasinda kullaniciyi bilgilendirir ve talep verisini yeniler", () => {
  const merkez = readFileSync("app/(panel)/talepler/_hooks/useTalepMerkezi.ts", "utf8");
  const form = readFileSync("app/(panel)/talepler/_hooks/useTalepFormu.ts", "utf8");

  assert.match(merkez, /t\.d2\.hata \?\? "Video işlenemedi\. Yeniden yükleyebilirsiniz\."/);
  assert.match(merkez, /setDetayTetik\(\(x\) => x \+ 1\);\s*await veriCek\(\);/);
  assert.match(form, /t\.d2\.hata \?\? "Video işlenemedi\. Talep Takibi ekranından yeniden yükleyebilirsiniz\."/);
  assert.match(form, /await onTalepOlusturuldu\?\.\(\);/);
});

test("Video V3 hazir soru setini goruntulenebilir tutar ve video onayindan sonra yayina gecer", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-video-v3-yasam-dongusu",
    hazir_video: false,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "video",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const bosZincir = {
    talep_id: talep.talep_id,
    senaryo_id: null,
    senaryo_iu_id: null,
    senaryo_durum: null,
    senaryo_durum_tarih: null,
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

  const ilk = adimlariCoz(talep, bosZincir, { asama: "Senaryo", durum_kodu: "iu_iletildi" });
  assert.equal(ilk.find((adim) => adim.hal === "aktif")?.anahtar, "senaryo");
  assert.deepEqual(
    ilk.find((adim) => adim.anahtar === "soru_seti"),
    {
      anahtar: "soru_seti",
      etiket: "Soru Seti",
      hal: "hazir",
      durum_kodu: "hazir_soru_seti",
      tarih: talep.created_at,
    },
  );
  assert.equal(ureticiDurumMesaji("hazir_soru_seti").metin, "Hazır Soru Seti");

  const videoAsamasi = {
    ...bosZincir,
    senaryo_id: "senaryo-v3",
    senaryo_iu_id: "iu-1",
    senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "video-v3",
  };
  const video = adimlariCoz(talep, videoAsamasi, { asama: "Video", durum_kodu: "iu_hazirliyor" });
  assert.equal(video.find((adim) => adim.hal === "aktif")?.anahtar, "video");
  assert.equal(video.find((adim) => adim.anahtar === "soru_seti")?.hal, "hazir");

  const yayin = adimlariCoz(talep, {
    ...videoAsamasi,
    video_iu_id: "iu-1",
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
    soru_seti_id: "soru-seti-v3",
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T10:00:00.000Z",
  });
  assert.equal(yayin.find((adim) => adim.anahtar === "soru_seti")?.hal, "tamam");
  assert.equal(yayin.find((adim) => adim.anahtar === "soru_seti")?.durum_kodu, "hazir_soru_seti");
  assert.equal(yayin.find((adim) => adim.hal === "aktif")?.anahtar, "yayin");
  assert.equal(yayin.find((adim) => adim.hal === "aktif")?.durum_kodu, "yayin_bekleniyor");

  assert.equal(toastVaryant(false, true), "hazir_set");
  assert.equal(
    uretimToast(
      { rol: "uretici", olay: "onay", asama: "video", revize: false },
      { varyant: "hazir_set", ogrenmeAraciTuru: "video" },
    ),
    "Videoyu onayladınız, yayın yönetimi sayfasına gidiniz",
  );
});

test("Podcast V3 hazir soru seti mesajini podcast onayindan sonra da korur", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-podcast-v3-yasam-dongusu",
    hazir_video: false,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "podcast",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const zincir = {
    talep_id: talep.talep_id,
    senaryo_id: "senaryo-podcast-v3",
    senaryo_iu_id: "iu-1",
    senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "podcast-v3",
    video_iu_id: "iu-1",
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
    soru_seti_id: "soru-seti-podcast-v3",
    soru_seti_iu_id: null,
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T10:00:00.000Z",
    yayin_durum: null,
    yayin_tarihi: null,
  };

  const adimlar = adimlariCoz(talep, zincir);
  const podcast = adimlar.find((adim) => adim.anahtar === "video");
  const soruSeti = adimlar.find((adim) => adim.anahtar === "soru_seti");
  const yayin = adimlar.find((adim) => adim.anahtar === "yayin");

  assert.equal(podcast?.hal, "tamam");
  assert.equal(podcast?.durum_kodu, "onaylandi");
  assert.equal(soruSeti?.hal, "tamam");
  assert.equal(soruSeti?.durum_kodu, "hazir_soru_seti");
  assert.equal(ureticiDurumMesaji(soruSeti!.durum_kodu!).metin, "Hazır Soru Seti");
  assert.equal(yayin?.hal, "aktif");
  assert.equal(yayin?.durum_kodu, "yayin_bekleniyor");
});

test("Dijital Broşür V3 hazır soru setini korur ve broşür onayından sonra yayına geçer", () => {
  const talep: SeritTalebi = {
    talep_id: "talep-gorsel-v3-yasam-dongusu",
    hazir_video: false,
    hazir_soru_seti: true,
    ogrenme_araci_turu: "gorsel",
    created_at: "2026-09-16T08:00:00.000Z",
  };
  const zincir = {
    talep_id: talep.talep_id,
    senaryo_id: "senaryo-gorsel-v3",
    senaryo_iu_id: "iu-1",
    senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "gorsel-v3",
    video_iu_id: "iu-1",
    video_durum: null,
    video_durum_tarih: null,
    soru_seti_id: null,
    soru_seti_iu_id: null,
    soru_seti_durum: null,
    soru_seti_durum_tarih: null,
    yayin_durum: null,
    yayin_tarihi: null,
  };

  const uretim = adimlariCoz(talep, zincir, { asama: "Video", durum_kodu: "onay_bekleniyor" });
  assert.equal(uretim.find((adim) => adim.hal === "aktif")?.etiket, "Dijital Broşür");
  assert.equal(uretim.find((adim) => adim.anahtar === "soru_seti")?.durum_kodu, "hazir_soru_seti");
  assert.equal(
    uretimToast(
      { rol: "uretici", olay: "onay", asama: "video", revize: false },
      { varyant: "hazir_set", ogrenmeAraciTuru: "gorsel" },
    ),
    "Dijital Broşürü onayladınız, yayın yönetimi sayfasına gidiniz",
  );

  const yayin = adimlariCoz(talep, {
    ...zincir,
    video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
    soru_seti_id: "soru-seti-gorsel-v3",
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T10:00:00.000Z",
  });
  assert.equal(yayin.find((adim) => adim.anahtar === "soru_seti")?.durum_kodu, "hazir_soru_seti");
  assert.equal(yayin.find((adim) => adim.hal === "aktif")?.anahtar, "yayin");
  assert.equal(yayin.find((adim) => adim.hal === "aktif")?.durum_kodu, "yayin_bekleniyor");

  const gorevSayfasi = readFileSync("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx", "utf8");
  assert.match(gorevSayfasi, /alt="Dijital Broşür önizlemesi"/);
});

test("Video V3 hazir soru seti talep detayinda kayit olusmadan da okunabilir", () => {
  const detayApi = readFileSync("app/(panel)/talepler/api/detay/route.ts", "utf8");
  const serit = readFileSync("app/(panel)/talepler/_components/UretimSeridi.tsx", "utf8");

  assert.match(detayApi, /hazir_soru_seti, hazir_soru_seti_verisi, created_at/);
  assert.match(detayApi, /talep\.hazir_soru_seti === true && Array\.isArray\(talep\.hazir_soru_seti_verisi\)/);
  assert.match(serit, /const acilabilir = adim\.hal !== "kapali" && !adim\.yol/);
});

function assertAktif(anahtar: string, durum_kodu: string, tarih: string | null) {
  return {
    anahtar,
    etiket: anahtar === "senaryo" ? "Senaryo" : anahtar,
    hal: "aktif",
    durum_kodu,
    tarih,
  };
}

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
