import assert from "node:assert/strict";
import test from "node:test";
import {
  aktifUretimDurumuCoz,
  ilkUretimDurumu,
  uretimDurumSirasi,
} from "@/lib/utils/durum/filtre";

test("mutlu: içerik üreticisi revizyonu ve yeni işi üretici incelemesinden önce görür", () => {
  assert.deepEqual(uretimDurumSirasi("iu").slice(0, 4), [
    "iu_duzeltiyor",
    "iu_iletildi",
    "iu_hazirliyor",
    "onay_bekleniyor",
  ]);
  assert.equal(ilkUretimDurumu("iu", {
    onay_bekleniyor: 5,
    iu_iletildi: 1,
  }), "iu_iletildi");
  assert.equal(ilkUretimDurumu("iu", {
    onay_bekleniyor: 5,
    iu_iletildi: 1,
    iu_duzeltiyor: 1,
  }), "iu_duzeltiyor");
  assert.equal(ilkUretimDurumu("pm", {
    onay_bekleniyor: 1,
    iu_duzeltiyor: 4,
  }), "onay_bekleniyor");
});

test("red: veri yenilenmesi kullanıcının elle seçtiği filtreyi değiştirmez", () => {
  assert.equal(aktifUretimDurumuCoz({
    rol: "iu",
    sayim: { iu_duzeltiyor: 2, iu_iletildi: 3 },
    mevcut: "onaylandi",
    kullaniciSecti: true,
  }), "onaylandi");
});
