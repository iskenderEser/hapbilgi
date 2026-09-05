import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hapbiSorusunuDerle,
  type HapbiDerlemeSonucu,
  type HapbiDerlenmisSorgu,
} from "@/lib/hapbi/niyet/derleyici";

const SIMDI = new Date("2026-09-04T09:00:00Z");

function sorguBekle(sonuc: HapbiDerlemeSonucu): HapbiDerlenmisSorgu {
  assert.ok(!("tur" in sonuc), "Soru netleştirmeye düşmemeliydi.");
  return sonuc;
}

function netlestirmeBekle(sonuc: HapbiDerlemeSonucu) {
  assert.ok("tur" in sonuc, "Soru netleştirmeye düşmeliydi.");
  return sonuc;
}

test("aynı sayısal niyetin farklı doğal dil biçimleri aynı sorguya dönüşür", () => {
  const sorular = [
    "HB ligi bu ay toplam puanım kaç?",
    "Eğitim Yayınları bu ay puanım kaç?",
    "T Club bu ay puanımın toplamını göster",
  ];

  for (const soru of sorular) {
    const sonuc = sorguBekle(hapbiSorusunuDerle(soru, { simdi: SIMDI }));
    assert.equal(sonuc.veriAlani, "tclub");
    assert.deepEqual(sonuc.donem, { tur: "ay", yil: 2026, ay: 9 });
    assert.deepEqual(sonuc.olcutler, ["net_puan"]);
    assert.equal(sonuc.islem, "toplam");
    assert.equal(sonuc.cevapTuru, "sayisal");
  }
});

test("planda belirtilen çeyrek yazımları aynı döneme dönüşür", () => {
  const ifadeler = ["3. çeyrek", "üçüncü çeyrek", "3. dönem", "Q3", "3Q", "quarter 3", "kuartır 3"];

  for (const ifade of ifadeler) {
    const sonuc = sorguBekle(hapbiSorusunuDerle(`C Club ${ifade} meydan okuma puanı toplamı`, { simdi: SIMDI }));
    assert.deepEqual(sonuc.donem, { tur: "ceyrek", yil: 2026, ceyrek: 3 }, ifade);
    assert.equal(sonuc.veriAlani, "cclub", ifade);
    assert.deepEqual(sonuc.olcutler, ["challenge_puani"], ifade);
  }
});

test("hafta, ay ve yıl ifadeleri çözümlenir", () => {
  const hafta = sorguBekle(hapbiSorusunuDerle("T Club 36. hafta tamamlama sayısı kaç", { simdi: SIMDI }));
  assert.deepEqual(hafta.donem, { tur: "hafta", yil: 2026, hafta: 36 });

  const ay = sorguBekle(hapbiSorusunuDerle("E Club 3. ay tamamlama sayısı kaç", { simdi: SIMDI }));
  assert.deepEqual(ay.donem, { tur: "ay", yil: 2026, ay: 3 });

  const yil = sorguBekle(hapbiSorusunuDerle("2026 yılı üretim talep sayısı kaç", { simdi: SIMDI }));
  assert.deepEqual(yil.donem, { tur: "yil", yil: 2026 });
});

test("dağılım, katkı, sıralama, fark ve karşılaştırma işlemleri ayrılır", () => {
  const dagilim = sorguBekle(hapbiSorusunuDerle("E Club bu ay eczane bazında tamamlama sayısı dağılımı", { simdi: SIMDI }));
  assert.equal(dagilim.islem, "dagilim");
  assert.ok(dagilim.boyutlar.includes("eczane"));

  const katki = sorguBekle(hapbiSorusunuDerle("T Club bu ay ürün bazında net puan katkısı", { simdi: SIMDI }));
  assert.equal(katki.islem, "katki");
  assert.ok(katki.boyutlar.includes("urun"));

  const fark = sorguBekle(hapbiSorusunuDerle("HB ligi bu ay ilk iki kişi arasındaki net puan farkı", { simdi: SIMDI }));
  assert.equal(fark.islem, "fark");
  assert.equal(fark.limit, 2);
  assert.deepEqual(fark.siralama, { olcut: "net_puan", yon: "azalan" });

  const karsilastirma = sorguBekle(hapbiSorusunuDerle("HB ligi bu ay net puanı önceki dönemle karşılaştır", { simdi: SIMDI }));
  assert.equal(karsilastirma.islem, "karsilastirma");
  assert.deepEqual(karsilastirma.karsilastirmaDonemi, { tur: "ay", yil: 2026, ay: 8 });
});

test("yorum isteyen soru sayısal sorudan ayrılır", () => {
  const sonuc = sorguBekle(hapbiSorusunuDerle("HB ligi bu ay net puanı değerlendir", { simdi: SIMDI }));
  assert.equal(sonuc.cevapTuru, "yorum");
  assert.equal(sonuc.islem, "detay");
});

test("yaygın yazım hataları anlamı değiştirmez", () => {
  const sonuc = sorguBekle(hapbiSorusunuDerle("t club bu ay takim bazında net puan dagilimi", { simdi: SIMDI }));
  assert.equal(sonuc.veriAlani, "tclub");
  assert.equal(sonuc.islem, "dagilim");
  assert.ok(sonuc.boyutlar.includes("takim"));
});

test("dönemsiz soru yalnız eksik dönem için netleştirme ister", () => {
  const sonuc = netlestirmeBekle(hapbiSorusunuDerle("HB ligi net puan toplamı", { simdi: SIMDI }));
  assert.deepEqual(sonuc.eksikAlanlar, ["donem"]);
});

test("birden fazla anlam taşıyan ifadeler tahmin edilmez", () => {
  const lig = netlestirmeBekle(hapbiSorusunuDerle("bu ay lig net puan sıralaması", { simdi: SIMDI }));
  assert.deepEqual(lig.eksikAlanlar, ["veriAlani"]);

  const izleme = netlestirmeBekle(hapbiSorusunuDerle("T Club bu ay izleme sayısı kaç", { simdi: SIMDI }));
  assert.deepEqual(izleme.eksikAlanlar, ["olcutler"]);
});

test("takip bağlamı olmadan bu ürün ifadesi filtre kabul edilmez", () => {
  const sonuc = netlestirmeBekle(hapbiSorusunuDerle("T Club bu ay bu ürün net puan toplamı", { simdi: SIMDI }));
  assert.deepEqual(sonuc.eksikAlanlar, ["filtreler"]);
});

test("sunucunun verdiği açık varlık adı kimliğe dönüştürülür", () => {
  const sonuc = sorguBekle(hapbiSorusunuDerle("T Club bu ay Ardıç net puan toplamı", {
    simdi: SIMDI,
    varliklar: [{ tur: "takim", id: "takim-1", ad: "Ardıç" }],
  }));
  assert.deepEqual(sonuc.filtreler, [{ boyut: "takim", kimlikler: ["takim-1"] }]);
  assert.ok(sonuc.boyutlar.includes("takim"));
});

test("sayısal derleyici Gemini bağımlılığı içermez", async () => {
  const kaynak = await readFile(new URL("../lib/hapbi/niyet/derleyici.ts", import.meta.url), "utf8");
  assert.doesNotMatch(kaynak, /gemini|generateContent|generateObject/iu);
});
