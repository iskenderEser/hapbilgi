import assert from "node:assert/strict";
import test from "node:test";
import { atanmisSorulariCoz } from "@/lib/soru/secim";

const soruSeti = [
  {
    soru_metni: "Birinci soru",
    secenekler: [
      { harf: "A", metin: "Yanlış", dogru: false },
      { harf: "B", metin: "Doğru", dogru: true },
    ],
  },
  {
    soru_metni: "İkinci soru",
    secenekler: [
      { harf: "A", metin: "Doğru", dogru: true },
      { harf: "B", metin: "Yanlış", dogru: false },
    ],
  },
];

test("atanmış sorular kayıtlı sırayla çözülür ve doğru cevap bilgisi istemciye taşınmaz", () => {
  const sonuc = atanmisSorulariCoz(soruSeti, [1, 0]);

  assert.deepEqual(sonuc, [
    {
      soru_index: 1,
      soru_metni: "İkinci soru",
      secenekler: [{ harf: "A", metin: "Doğru" }, { harf: "B", metin: "Yanlış" }],
    },
    {
      soru_index: 0,
      soru_metni: "Birinci soru",
      secenekler: [{ harf: "A", metin: "Yanlış" }, { harf: "B", metin: "Doğru" }],
    },
  ]);
  assert.equal(JSON.stringify(sonuc).includes("dogru"), false);
});

test("güncel sette bulunmayan veya bozuk atanmış soru kısmi sonuç üretmez", () => {
  assert.equal(atanmisSorulariCoz(soruSeti, [2]), null);
  assert.equal(atanmisSorulariCoz([{ soru_metni: "Eksik" }], [0]), null);
  assert.equal(atanmisSorulariCoz(soruSeti, []), null);
});
