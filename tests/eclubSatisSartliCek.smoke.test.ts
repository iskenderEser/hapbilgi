import { test } from "node:test";
import assert from "node:assert/strict";
import { baremBul, baremTablosuDogrula, cekTutariHesapla, type BaremSatiri } from "../lib/eclub/store/eclubStoreTipler.ts";

const baremler: BaremSatiri[] = [
  { min_puan: 75, max_puan: 149, adet: 4, mal_fazlasi: 1 },
  { min_puan: 150, max_puan: 425, adet: 12, mal_fazlasi: 4 },
];

test("PM baremi boşluksuz ve çakışmasız olmalıdır", () => {
  assert.equal(baremTablosuDogrula(baremler), null);
  assert.match(baremTablosuDogrula([{ ...baremler[0] }, { ...baremler[1], min_puan: 151 }]) ?? "", /boşluksuz/);
  assert.equal(baremBul(50, baremler), null);
  assert.equal(baremBul(500, baremler)?.adet, 12);
});

test("taban ve tavan tamamen PM bareminden türetilir", () => {
  const dusuk = cekTutariHesapla({ puan: 50, satis_sarti_tipi: "serbest_siparis", siparis_verildi: false, baremler });
  assert.deepEqual({ kullanilan: dusuk.kullanilan_puan, devir: dusuk.devreden_puan, tl: dusuk.cek_tutari_tl }, { kullanilan: 0, devir: 50, tl: 0 });
  const yuksek = cekTutariHesapla({ puan: 500, satis_sarti_tipi: "serbest_siparis", siparis_verildi: false, baremler, karsilik_puan: 5, karsilik_tl: 2 });
  assert.deepEqual({ kullanilan: yuksek.kullanilan_puan, devir: yuksek.devreden_puan, tl: yuksek.cek_tutari_tl }, { kullanilan: 425, devir: 75, tl: 170 });
});

test("serbest siparişte katlama yalnız sipariş seçildiğinde uygulanır", () => {
  const sonuc = cekTutariHesapla({ puan: 200, satis_sarti_tipi: "serbest_siparis", siparis_verildi: true, katlama_orani: 25, baremler });
  assert.equal(sonuc.cek_tutari_tl, 250);
});
