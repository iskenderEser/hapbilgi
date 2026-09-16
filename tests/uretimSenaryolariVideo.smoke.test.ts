import assert from "node:assert/strict";
import test from "node:test";
import type { ZincirSatiri } from "../lib/utils/uretimZinciri.ts";
import {
  aktifAdim,
  bosUretimZinciri,
  senaryoAdimlari,
  senaryoTalebi,
  type UretimVaryanti,
} from "./helpers/uretimSenaryosu.ts";

function senaryoOnayli(zincir: ZincirSatiri): ZincirSatiri {
  return {
    ...zincir,
    senaryo_id: "senaryo-1", senaryo_iu_id: "iu-1", senaryo_durum: "onaylandi",
    senaryo_durum_tarih: "2026-09-16T09:00:00.000Z",
    video_id: "video-1",
  };
}

function videoOnayli(zincir: ZincirSatiri, hazirSet: boolean): ZincirSatiri {
  return {
    ...zincir,
    video_id: "video-1", video_iu_id: "iu-1", video_durum: "onaylandi",
    video_durum_tarih: "2026-09-16T10:00:00.000Z",
    soru_seti_id: "soru-1",
    soru_seti_durum: hazirSet ? "onaylandi" : null,
    soru_seti_durum_tarih: hazirSet ? "2026-09-16T10:01:00.000Z" : null,
  };
}

function soruSetiOnayli(zincir: ZincirSatiri): ZincirSatiri {
  return {
    ...zincir,
    soru_seti_id: "soru-1", soru_seti_iu_id: "iu-1", soru_seti_durum: "onaylandi",
    soru_seti_durum_tarih: "2026-09-16T11:00:00.000Z",
  };
}

test("Video V1: senaryo, video, soru seti ve yayın sırasını korur", () => {
  const talep = senaryoTalebi("video", "V1");
  const bos = bosUretimZinciri(talep.talep_id);
  assert.equal(aktifAdim(senaryoAdimlari(talep, bos, { asama: "Senaryo", durum_kodu: "iu_iletildi" }))?.anahtar, "senaryo");

  const senaryo = senaryoOnayli(bos);
  assert.equal(aktifAdim(senaryoAdimlari(talep, senaryo, { asama: "Video", durum_kodu: "iu_hazirliyor" }))?.anahtar, "video");

  const video = videoOnayli(senaryo, false);
  assert.equal(aktifAdim(senaryoAdimlari(talep, video, { asama: "Soru Seti", durum_kodu: "iu_iletildi" }))?.anahtar, "soru_seti");

  const yayin = aktifAdim(senaryoAdimlari(talep, soruSetiOnayli(video)));
  assert.equal(yayin?.anahtar, "yayin");
  assert.equal(yayin?.durum_kodu, "yayin_bekleniyor");
});

test("Video V2: hazır video yüklenmeden soru setini açmaz", () => {
  const talep = senaryoTalebi("video", "V2");
  const bos = bosUretimZinciri(talep.talep_id);
  const ilk = senaryoAdimlari(talep, bos);
  assert.equal(ilk.find((adim) => adim.anahtar === "senaryo")?.hal, "kapali");
  assert.equal(aktifAdim(ilk)?.durum_kodu, "video_bekleniyor");

  const video = videoOnayli(bos, false);
  assert.equal(aktifAdim(senaryoAdimlari(talep, video, { asama: "Soru Seti", durum_kodu: "iu_iletildi" }))?.anahtar, "soru_seti");
  assert.equal(aktifAdim(senaryoAdimlari(talep, soruSetiOnayli(video)))?.anahtar, "yayin");
});

test("Video V3: hazır soru seti bağlanmadan yayın açılmaz", () => {
  const talep = senaryoTalebi("video", "V3");
  const bos = bosUretimZinciri(talep.talep_id);
  const senaryo = senaryoOnayli(bos);
  const setsizVideo = { ...senaryo, video_durum: "onaylandi", video_durum_tarih: "2026-09-16T10:00:00.000Z" };
  const hata = aktifAdim(senaryoAdimlari(talep, setsizVideo));
  assert.equal(hata?.anahtar, "soru_seti");
  assert.equal(hata?.durum_kodu, "sistem_hatasi");

  const yayin = aktifAdim(senaryoAdimlari(talep, videoOnayli(senaryo, true)));
  assert.equal(yayin?.anahtar, "yayin");
});

test("Video V4: iki hazır içerik doğrulanmadan yayın açılmaz", () => {
  const talep = senaryoTalebi("video", "V4");
  const bos = bosUretimZinciri(talep.talep_id);
  assert.equal(aktifAdim(senaryoAdimlari(talep, bos))?.durum_kodu, "video_bekleniyor");

  const yayin = aktifAdim(senaryoAdimlari(talep, videoOnayli(bos, true)));
  assert.equal(yayin?.anahtar, "yayin");
  assert.equal(yayin?.durum_kodu, "yayin_bekleniyor");
});

test("Video varyant matrisi dört benzersiz sözleşmeden oluşur", () => {
  const varyantlar: UretimVaryanti[] = ["V1", "V2", "V3", "V4"];
  assert.equal(new Set(varyantlar.map((varyant) => {
    const talep = senaryoTalebi("video", varyant);
    return `${talep.hazir_video}-${talep.hazir_soru_seti}`;
  })).size, 4);
});
