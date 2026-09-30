import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ECLUB_KAZANIM_SECENEKLERI,
  cekTutariHesapla,
  eclubKazanimKosullari,
} from "../lib/eclub/store/eclubStoreTipler.ts";
import { yalnizEclubHedefliMi } from "../lib/utils/roller.ts";

test("E-Club üreticisi dört ayrı kazanım hâli seçer", () => {
  assert.equal(ECLUB_KAZANIM_SECENEKLERI.length, 4);
  assert.equal(new Set(ECLUB_KAZANIM_SECENEKLERI.map((s) => s.model)).size, 4);

  assert.deepEqual(eclubKazanimKosullari("yalniz_puan"), {
    cek_karsiligi_var_mi: false,
    satis_sarti_tipi: null,
    siparis_secimi_var_mi: false,
  });
  assert.equal(eclubKazanimKosullari("siparissiz_cek").satis_sarti_tipi, "siparissiz_cek");
  assert.equal(eclubKazanimKosullari("siparisle_artan_cek").satis_sarti_tipi, "serbest_siparis");
  assert.equal(eclubKazanimKosullari("siparis_zorunlu_cek").satis_sarti_tipi, "satis_sartli");
});

test("aynı seçim eczacı, teknisyen ve ortak hedefli yayınlarda açılır", () => {
  assert.equal(yalnizEclubHedefliMi(["eczaci"]), true);
  assert.equal(yalnizEclubHedefliMi(["eczane_teknisyeni"]), true);
  assert.equal(yalnizEclubHedefliMi(["eczaci", "eczane_teknisyeni"]), true);
  assert.equal(yalnizEclubHedefliMi(["utt"]), false);
});

test("siparişsiz çek sipariş kabul etmez; teklifli çek yalnız çek tutarını artırır", () => {
  const ortak = {
    puan: 300,
    karsilik_puan: 10,
    karsilik_tl: 2,
    baremler: [{ min_puan: 200, max_puan: 500, adet: 10, mal_fazlasi: 2 }],
  };
  const siparissiz = cekTutariHesapla({ ...ortak, satis_sarti_tipi: "siparissiz_cek", siparis_verildi: false });
  const gecersizSiparis = cekTutariHesapla({ ...ortak, satis_sarti_tipi: "siparissiz_cek", siparis_verildi: true });
  const normal = cekTutariHesapla({ ...ortak, satis_sarti_tipi: "serbest_siparis", siparis_verildi: false, katlama_orani: 20 });
  const teklifKabul = cekTutariHesapla({ ...ortak, satis_sarti_tipi: "serbest_siparis", siparis_verildi: true, katlama_orani: 20 });

  assert.equal(siparissiz.cek_tutari_tl, 60);
  assert.equal(gecersizSiparis.cek_tutari_tl, 0);
  assert.equal(normal.cek_tutari_tl, 60);
  assert.equal(teklifKabul.cek_tutari_tl, 72);
  assert.equal(teklifKabul.kullanilan_puan, normal.kullanilan_puan);
});
