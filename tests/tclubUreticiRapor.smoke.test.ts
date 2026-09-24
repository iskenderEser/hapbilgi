import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const KOK = process.cwd();

test("üretici T-Club raporu altı kartlık yeni yapıyı kullanır", async () => {
  const sayfa = await readFile(`${KOK}/app/(panel)/raporlar/tclub-uretici/page.tsx`, "utf8");
  const basliklar = [
    "Firma T-Club Puan Özeti",
    "Net Puan Bileşenleri",
    "Saha Puan Dağılımı",
    "Yayınlarımın Firma Puanına Katkısı",
    "Yayın Performansı",
    "İçerik Puan Dağılımı",
  ];
  for (const baslik of basliklar) assert.match(sayfa, new RegExp(baslik));
  assert.doesNotMatch(sayfa, /BmPerformansGorunumu|BegeniFavoriListesi|Katkı Payı/);
  assert.match(sayfa, /setSeciliYayinId\(yayin\.yayin_id\)/);
  assert.match(sayfa, /<YayinDetayModal yayinId=\{seciliYayinId\}/);
});

test("üretici T-Club raporu TM veri yolunu kullanmaz", async () => {
  const api = await readFile(`${KOK}/app/(panel)/raporlar/api/tclub-uretici/route.ts`, "utf8");
  assert.doesNotMatch(api, /getTmData|get_tm_bm_performans/);
  assert.match(api, /getSahaLig/);
  assert.match(api, /getUreticiEtkiLigi/);
  assert.match(api, /getUreticiYayinDetaylari/);
});

test("puan özeti beş kazanım ve üç kayıp kaleminden oluşur", async () => {
  const api = await readFile(`${KOK}/app/(panel)/raporlar/api/tclub-uretici/route.ts`, "utf8");
  assert.match(api, /izleme_puani \+ ozet\.cevaplama_puani \+ ozet\.oneri_puani \+ ozet\.extra_puani \+ ozet\.eclub_puani/);
  assert.match(api, /ileri_sarma_kaybi \+ ozet\.yanlis_cevap_kaybi \+ ozet\.oneri_kaybi/);
  assert.match(api, /net_puan: kazanilan_puan - kaybedilen_puan/);
});
