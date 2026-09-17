import assert from "node:assert/strict";
import test from "node:test";

process.env.BUNNY_LEARNING_STORAGE_ZONE = "test-storage";
process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY = "test-key";
process.env.BUNNY_LEARNING_PULL_ZONE = "cdn.test.com";
process.env.BUNNY_LEARNING_TOKEN_KEY = "test-token-key";
process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT = "https://upload.bunny.net";
process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET = "test-shared-secret";

import { ogrenmeAraciTamamlamaKapisi } from "../lib/ogrenmeAraci/tamamlamaKapisi.ts";
import {
  FLIP_PDF_ARACI,
  GORSEL_ARACI,
  PODCAST_ARACI,
  VIDEO_ARACI,
} from "../lib/ogrenmeAraci/sunucu.ts";
import type { OgrenmeAraciKaydi, OgrenmeAraciTuru, TamamlamaKaniti } from "../lib/ogrenmeAraci/tipler.ts";
import { yayinThumbnailCevabi } from "../lib/ogrenmeAraci/yayinThumbnail.ts";
import { yayinTuketiciRoluneAcikMi, type HedefRol } from "../lib/utils/roller.ts";
import type { ZincirSatiri } from "../lib/utils/uretimZinciri.ts";
import {
  aktifAdim,
  bosUretimZinciri,
  senaryoAdimlari,
  senaryoTalebi,
  URETIM_ARACLARI,
  URETIM_VARYANTLARI,
  type UretimVaryanti,
} from "./helpers/uretimSenaryosu.ts";
import { TUKETICI_FIXTURELARI, TUKETIM_HEDEFLERI, yayinFixture } from "./helpers/tuketimSenaryosu.ts";

const SIMDI_MS = Date.parse("2026-09-17T09:00:00.000Z");

function hedefSec(aracIndeksi: number, varyantIndeksi: number): HedefRol {
  return TUKETIM_HEDEFLERI[(aracIndeksi * URETIM_VARYANTLARI.length + varyantIndeksi) % TUKETIM_HEDEFLERI.length];
}

function yayinAsamasindakiZincir(arac: OgrenmeAraciTuru, varyant: UretimVaryanti): ZincirSatiri {
  const talep = senaryoTalebi(arac, varyant);
  const hazirArac = talep.hazir_video;
  return {
    ...bosUretimZinciri(talep.talep_id),
    senaryo_id: hazirArac ? null : `senaryo-${talep.talep_id}`,
    senaryo_iu_id: hazirArac ? null : "iu-test",
    senaryo_durum: hazirArac ? null : "onaylandi",
    senaryo_durum_tarih: hazirArac ? null : "2026-09-17T07:00:00.000Z",
    arac_id: `arac-${talep.talep_id}`,
    arac_iu_id: hazirArac ? null : "iu-test",
    arac_durum: "onaylandi",
    arac_durum_tarih: "2026-09-17T07:30:00.000Z",
    soru_seti_id: `soru-${talep.talep_id}`,
    soru_seti_iu_id: talep.hazir_soru_seti ? null : "iu-test",
    soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-17T08:00:00.000Z",
  };
}

function aracKaydi(aracTuru: OgrenmeAraciTuru, varyant: UretimVaryanti): OgrenmeAraciKaydi {
  const hazir = varyant === "V2" || varyant === "V4";
  return {
    aracId: `arac-${aracTuru}-${varyant}`,
    talepId: `talep-${aracTuru}-${varyant}`,
    aracTuru,
    kaynak: hazir ? "hazir" : "iu",
    dosyaYolu: `test/${aracTuru}/${varyant}/ana`,
    kapakYolu: null,
    metadataDogrulandi: true,
    metadata: {
      mimeType: null,
      dosyaBoyutu: 100,
      checksumSha256: "b".repeat(64),
      sureSaniye: aracTuru === "video" || aracTuru === "podcast" ? 100 : null,
      sayfaSayisi: aracTuru === "flip_pdf" ? 2 : null,
      genislik: aracTuru === "gorsel" ? 1200 : null,
      yukseklik: aracTuru === "gorsel" ? 800 : null,
      ek: {},
    },
  };
}

async function tamamlamaKaniti(arac: OgrenmeAraciKaydi): Promise<TamamlamaKaniti> {
  if (arac.aracTuru === "video" || arac.aracTuru === "podcast") {
    const sunucu = arac.aracTuru === "video" ? VIDEO_ARACI : PODCAST_ARACI;
    const ilerleme = await sunucu.ilerlemeKaydet(null, {
      dogrulanmisSaniye: 98,
      onayliAtlananSaniye: 0,
      sonKonumSaniye: 100,
      sonaUlasti: true,
    });
    return sunucu.tamamla(arac, ilerleme);
  }
  if (arac.aracTuru === "gorsel") {
    const ilerleme = await GORSEL_ARACI.ilerlemeKaydet(null, { aktifIncelemeSaniye: 3, kullaniciOnayi: true });
    return GORSEL_ARACI.tamamla(arac, ilerleme);
  }
  const ilerleme = await FLIP_PDF_ARACI.ilerlemeKaydet(null, {
    toplamSayfa: 2,
    okunanSayfalar: [1, 2],
    aktifSayfaSaniyeleri: { "1": 2, "2": 2 },
    sonSayfa: 2,
    kuralSnapshot: { sayfaBasiSaniye: 2, toplamSayfa: 2 },
  });
  return FLIP_PDF_ARACI.tamamla(arac, ilerleme);
}

test("seçilmiş 16 araç-varyant köprüsü üretimden doğru tüketiciye ve tamamlamaya kesintisiz ulaşır", async () => {
  const gorulenHedefler = new Set<HedefRol>();

  for (const [aracIndeksi, aracTuru] of URETIM_ARACLARI.entries()) {
    for (const [varyantIndeksi, varyant] of URETIM_VARYANTLARI.entries()) {
      const talep = senaryoTalebi(aracTuru, varyant);
      const zincir = yayinAsamasindakiZincir(aracTuru, varyant);
      const yayinAdimi = aktifAdim(senaryoAdimlari(talep, zincir));
      assert.equal(yayinAdimi?.anahtar, "yayin", `${aracTuru} ${varyant} yayın kapısına ulaşmadı`);

      const hedef = hedefSec(aracIndeksi, varyantIndeksi);
      gorulenHedefler.add(hedef);
      const yayin = {
        ...yayinFixture(aracTuru, hedef),
        yayin_id: `yayin-${aracTuru}-${varyant}-${hedef}`,
        arac_id: zincir.arac_id!,
        urun_adi: `${aracTuru} ${varyant}`,
      };
      const cevap = yayinThumbnailCevabi(yayin, SIMDI_MS);
      assert.equal(cevap.arac_id, zincir.arac_id, `${aracTuru} ${varyant} araç bağı koptu`);
      assert.equal(cevap.arac_turu, aracTuru);
      assert.equal("arac_dosya_yolu" in cevap, false);

      const hedefKimlikler = TUKETICI_FIXTURELARI.filter((kimlik) => kimlik.hedefRol === hedef);
      assert.ok(hedefKimlikler.length > 0);
      assert.ok(hedefKimlikler.every((kimlik) => yayinTuketiciRoluneAcikMi(yayin, kimlik.rol)));
      assert.ok(TUKETICI_FIXTURELARI.filter((kimlik) => kimlik.hedefRol !== hedef)
        .every((kimlik) => !yayinTuketiciRoluneAcikMi(yayin, kimlik.rol)));

      const kayit = aracKaydi(aracTuru, varyant);
      const baslangic = aracTuru === "video"
        ? await VIDEO_ARACI.baslat(kayit, null)
        : aracTuru === "podcast"
          ? await PODCAST_ARACI.baslat(kayit, null)
          : aracTuru === "gorsel"
            ? await GORSEL_ARACI.baslat(kayit, null)
            : await FLIP_PDF_ARACI.baslat(kayit, null);
      assert.ok(baslangic.oturumId);
      assert.equal(kayit.kaynak, talep.hazir_video ? "hazir" : "iu");

      const kanit = await tamamlamaKaniti(kayit);
      assert.deepEqual(
        ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "yayinda", aracTuru, tamamlamaKaniti: kanit }),
        { ok: true },
        `${aracTuru} ${varyant} × ${hedef}`,
      );
    }
  }

  assert.deepEqual([...gorulenHedefler].sort(), [...TUKETIM_HEDEFLERI].sort());
});

test("hazır ve İÜ üretimi aynı tüketim sözleşmesini üretir", async () => {
  for (const aracTuru of URETIM_ARACLARI) {
    const iu = aracKaydi(aracTuru, "V1");
    const hazir = aracKaydi(aracTuru, "V2");
    const iuKaniti = await tamamlamaKaniti(iu);
    const hazirKaniti = await tamamlamaKaniti(hazir);

    assert.equal(iu.kaynak, "iu");
    assert.equal(hazir.kaynak, "hazir");
    assert.equal(iuKaniti.aracTuru, hazirKaniti.aracTuru);
    assert.equal(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "yayinda", aracTuru, tamamlamaKaniti: iuKaniti }).ok, true);
    assert.equal(ogrenmeAraciTamamlamaKapisi({ yayinDurumu: "yayinda", aracTuru, tamamlamaKaniti: hazirKaniti }).ok, true);
  }
});
