import assert from "node:assert/strict";
import test from "node:test";
import { ogrenmeAraciTamamlamaKapisi } from "../lib/ogrenmeAraci/tamamlamaKapisi.ts";
import { podcastTranskriptErisiminiCoz } from "../lib/ogrenmeAraci/podcastTranskriptErisimi.ts";
import {
  FLIP_PDF_ARACI,
  GORSEL_ARACI,
  PODCAST_ARACI,
  VIDEO_ARACI,
} from "../lib/ogrenmeAraci/sunucu.ts";
import type { OgrenmeAraciKaydi, OgrenmeAraciTuru } from "../lib/ogrenmeAraci/tipler.ts";
import { TUKETIM_HEDEFLERI } from "./helpers/tuketimSenaryosu.ts";

function arac(aracTuru: OgrenmeAraciTuru): OgrenmeAraciKaydi {
  return {
    aracId: `arac-${aracTuru}`,
    talepId: `talep-${aracTuru}`,
    aracTuru,
    kaynak: "iu",
    dosyaYolu: `test/${aracTuru}/ana`,
    kapakYolu: null,
    metadataDogrulandi: true,
    metadata: {
      mimeType: null,
      dosyaBoyutu: 100,
      checksumSha256: "a".repeat(64),
      sureSaniye: aracTuru === "video" || aracTuru === "podcast" ? 100 : null,
      sayfaSayisi: aracTuru === "flip_pdf" ? 3 : null,
      genislik: aracTuru === "gorsel" ? 1200 : null,
      yukseklik: aracTuru === "gorsel" ? 800 : null,
      ek: {},
    },
  };
}

test("video ve podcast bütün tüketim hedeflerinde süre ve sona ulaşma kanıtı ister", async () => {
  for (const hedef of TUKETIM_HEDEFLERI) {
    for (const sunucu of [VIDEO_ARACI, PODCAST_ARACI]) {
      const kayit = arac(sunucu.aracTuru);
      const eksik = await sunucu.ilerlemeKaydet(null, {
        dogrulanmisSaniye: 20,
        onayliAtlananSaniye: 0,
        sonKonumSaniye: 100,
        sonaUlasti: true,
      });
      assert.equal(await sunucu.tamamlanabilirMi(kayit, eksik), false, `${sunucu.aracTuru} × ${hedef}`);

      const tamam = await sunucu.ilerlemeKaydet(eksik, {
        dogrulanmisSaniye: 98,
        onayliAtlananSaniye: 0,
        sonKonumSaniye: 100,
        sonaUlasti: true,
      });
      const kanit = await sunucu.tamamla(kayit, tamam);
      assert.equal(await sunucu.soruHakkiKaniti(kanit), true, `${sunucu.aracTuru} × ${hedef}`);
      assert.equal(kanit.aracTuru, sunucu.aracTuru);
    }
  }
});

test("Dijital Broşür bütün hedeflerde aktif inceleme ve açık kullanıcı onayı ister", async () => {
  const kayit = arac("gorsel");
  for (const hedef of TUKETIM_HEDEFLERI) {
    const onaysiz = await GORSEL_ARACI.ilerlemeKaydet(null, { aktifIncelemeSaniye: 3, kullaniciOnayi: false });
    assert.equal(await GORSEL_ARACI.tamamlanabilirMi(kayit, onaysiz), false, hedef);
    await assert.rejects(GORSEL_ARACI.tamamla(kayit, onaysiz));

    const tamam = await GORSEL_ARACI.ilerlemeKaydet(onaysiz, { aktifIncelemeSaniye: 3, kullaniciOnayi: true });
    const kanit = await GORSEL_ARACI.tamamla(kayit, tamam);
    assert.equal(await GORSEL_ARACI.soruHakkiKaniti(kanit), true, hedef);
    assert.deepEqual(kanit.veri, { aktifIncelemeSaniye: 3, kullaniciOnayi: true });
  }
});

test("Literatür bütün hedeflerde her sayfa okunmadan tamamlanmaz ve kaldığı sayfayı korur", async () => {
  const kayit = arac("flip_pdf");
  for (const hedef of TUKETIM_HEDEFLERI) {
    const ilk = await FLIP_PDF_ARACI.ilerlemeKaydet(null, {
      toplamSayfa: 3,
      okunanSayfalar: [1, 2],
      aktifSayfaSaniyeleri: { "1": 2, "2": 2 },
      sonSayfa: 2,
      kuralSnapshot: { sayfaBasiSaniye: 2, toplamSayfa: 3 },
    });
    assert.equal(await FLIP_PDF_ARACI.tamamlanabilirMi(kayit, ilk), false, hedef);

    const tamam = await FLIP_PDF_ARACI.ilerlemeKaydet(ilk, {
      toplamSayfa: 3,
      okunanSayfalar: [3],
      aktifSayfaSaniyeleri: { "3": 2 },
      sonSayfa: 3,
      kuralSnapshot: { sayfaBasiSaniye: 99, toplamSayfa: 99 },
    });
    assert.deepEqual(tamam.okunanSayfalar, [1, 2, 3]);
    assert.deepEqual(tamam.kuralSnapshot, { sayfaBasiSaniye: 2, toplamSayfa: 3 });
    assert.equal((await FLIP_PDF_ARACI.kaldigiYerdenDevam(tamam))?.sonSayfa, 3);
    const kanit = await FLIP_PDF_ARACI.tamamla(kayit, tamam);
    assert.equal(await FLIP_PDF_ARACI.soruHakkiKaniti(kanit), true, hedef);
  }
});

test("tamamlama kapısı araç türü başka olan veya bozuk kanıtı bütün kanallarda reddeder", async () => {
  const podcast = arac("podcast");
  const ilerleme = await PODCAST_ARACI.ilerlemeKaydet(null, {
    dogrulanmisSaniye: 100,
    onayliAtlananSaniye: 0,
    sonKonumSaniye: 100,
    sonaUlasti: true,
  });
  const kanit = await PODCAST_ARACI.tamamla(podcast, ilerleme);

  for (const hedef of TUKETIM_HEDEFLERI) {
    assert.deepEqual(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "yayinda", aracTuru: "podcast", tamamlamaKaniti: kanit }), { ok: true }, hedef);
    assert.equal(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "yayinda", aracTuru: "gorsel", tamamlamaKaniti: kanit }).ok, false, hedef);
    assert.equal(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "durduruldu", aracTuru: "podcast", tamamlamaKaniti: kanit }).ok, false, hedef);
  }
});

test("podcast tüketicisi yalnız onaylanmış transkripti görür; üretim sırları yanıta sızmaz", () => {
  const durumlar = ["yok", "ai_bekliyor", "ai_isleniyor", "ai_taslak", "iptal", "hata"];
  for (const durum of durumlar) {
    const sonuc = podcastTranskriptErisiminiCoz({
      metadata: {
        transkript: {
          durum,
          taslak_metin: "gizli taslak",
          onaylanan_metin: "henüz açık değil",
          ai_girisim_id: "girisim-1",
          hata_kodu: "AI_HATA",
          onaylayan_kullanici_id: "kullanici-1",
        },
      },
      transkriptYolu: "podcast/transkript.pdf",
      imzaliUrlUret: (yol) => `https://cdn.test/${yol}?token=test`,
    });
    assert.equal(sonuc.transkriptUrl, null, durum);
    assert.equal(sonuc.transkriptMetni, null, durum);
    const temiz = JSON.stringify(sonuc.temizMetadata);
    for (const gizli of ["gizli taslak", "henüz açık değil", "girisim-1", "AI_HATA", "kullanici-1"]) {
      assert.equal(temiz.includes(gizli), false, `${durum}: ${gizli}`);
    }
  }

  const onayli = podcastTranskriptErisiminiCoz({
    metadata: { transkript: { durum: "onaylandi", onaylanan_metin: "  Nihai transkript  ", taslak_metin: "eski taslak" } },
    transkriptYolu: "podcast/transkript.pdf",
    imzaliUrlUret: (yol) => `https://cdn.test/${yol}?token=test`,
  });
  assert.equal(onayli.transkriptMetni, "Nihai transkript");
  assert.equal(onayli.transkriptUrl, "https://cdn.test/podcast/transkript.pdf?token=test");
  assert.equal(JSON.stringify(onayli.temizMetadata).includes("eski taslak"), false);
});
