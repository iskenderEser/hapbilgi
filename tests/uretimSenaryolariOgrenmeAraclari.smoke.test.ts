import assert from "node:assert/strict";
import test from "node:test";
import type { OgrenmeAraciTuru } from "../lib/ogrenmeAraci/tipler.ts";
import type { ZincirSatiri } from "../lib/utils/uretimZinciri.ts";
import { aktifAdim, bosUretimZinciri, senaryoAdimlari, senaryoTalebi } from "./helpers/uretimSenaryosu.ts";

const ARACLAR = ["podcast", "gorsel", "flip_pdf"] as const satisfies readonly OgrenmeAraciTuru[];

function uretilenArac(zincir: ZincirSatiri): ZincirSatiri {
  return {
    ...zincir,
    senaryo_id: "senaryo-1", senaryo_iu_id: "iu-1", senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "arac-1", video_iu_id: "iu-1", video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
  };
}

function hazirArac(zincir: ZincirSatiri): ZincirSatiri {
  return {
    ...zincir,
    video_id: "arac-1", video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
  };
}

function soruSeti(zincir: ZincirSatiri, iu: boolean): ZincirSatiri {
  return {
    ...zincir,
    soru_seti_id: "soru-1", soru_seti_iu_id: iu ? "iu-1" : null,
    soru_seti_durum: "onaylandi", soru_seti_durum_tarih: "2026-09-16T11:00:00.000Z",
  };
}

for (const arac of ARACLAR) {
  test(`${arac} V1: üretim ve İÜ soru seti tamamlanmadan yayın açılmaz`, () => {
    const talep = senaryoTalebi(arac, "V1");
    const bos = bosUretimZinciri(talep.talep_id);
    assert.equal(aktifAdim(senaryoAdimlari(talep, bos, { asama: "Senaryo", durum_kodu: "iu_iletildi" }))?.anahtar, "senaryo");
    const aracOnayli = uretilenArac(bos);
    assert.equal(aktifAdim(senaryoAdimlari(talep, aracOnayli))?.anahtar, "soru_seti");
    assert.equal(aktifAdim(senaryoAdimlari(talep, soruSeti(aracOnayli, true)))?.anahtar, "yayin");
  });

  test(`${arac} V2: hazır araç doğrulanınca İÜ soru setine geçer`, () => {
    const talep = senaryoTalebi(arac, "V2");
    const bos = bosUretimZinciri(talep.talep_id);
    const ilk = senaryoAdimlari(talep, bos);
    assert.equal(ilk.find((adim) => adim.anahtar === "senaryo")?.hal, "kapali");
    assert.equal(aktifAdim(ilk)?.durum_kodu, "video_bekleniyor");
    const aracOnayli = hazirArac(bos);
    assert.equal(aktifAdim(senaryoAdimlari(talep, aracOnayli))?.anahtar, "soru_seti");
    assert.equal(aktifAdim(senaryoAdimlari(talep, soruSeti(aracOnayli, true)))?.anahtar, "yayin");
  });

  test(`${arac} V3: hazır soru seti gerçek bağ olmadan yayın açmaz`, () => {
    const talep = senaryoTalebi(arac, "V3");
    const aracOnayli = uretilenArac(bosUretimZinciri(talep.talep_id));
    const eksik = aktifAdim(senaryoAdimlari(talep, aracOnayli));
    assert.equal(eksik?.anahtar, "soru_seti");
    assert.equal(eksik?.durum_kodu, "sistem_hatasi");
    assert.equal(aktifAdim(senaryoAdimlari(talep, soruSeti(aracOnayli, false)))?.anahtar, "yayin");
  });

  test(`${arac} V4: hazır araç ve hazır set birlikte doğrulanınca yayın açılır`, () => {
    const talep = senaryoTalebi(arac, "V4");
    const bos = bosUretimZinciri(talep.talep_id);
    assert.equal(aktifAdim(senaryoAdimlari(talep, bos))?.durum_kodu, "video_bekleniyor");
    const aracOnayli = hazirArac(bos);
    assert.equal(aktifAdim(senaryoAdimlari(talep, aracOnayli))?.durum_kodu, "sistem_hatasi");
    assert.equal(aktifAdim(senaryoAdimlari(talep, soruSeti(aracOnayli, false)))?.anahtar, "yayin");
  });
}
