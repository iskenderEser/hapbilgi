import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HAPBI_CANLI_TURLAR } from "../lib/hapbi/hapbiBilgiTabani.ts";

const RESMI_OLMAYAN_HITAPLAR = new Set([
  "sen", "sana", "senin", "puanlarınla", "puanınla", "puanının", "takımınla",
  "sıranı", "izlediğin", "tamamladığın", "tamamladın", "duyduğun", "önerini",
  "siparişini", "siparişin", "ihtiyacın", "arayabilirsin", "yapabilirsin",
  "kazanabilirsin", "edebilirsin", "tıkla", "öğren", "gör", "uzmanlaş", "topla",
]);

test("HapBi canlı turları kullanıcıya kurumsal siz diliyle seslenir", () => {
  for (const tur of Object.values(HAPBI_CANLI_TURLAR)) {
    const gorunenMetinler = [
      tur.baslik,
      tur.aciklama,
      ...tur.adimlar.flatMap((adim) => [adim.mesaj, adim.butonMetni ?? ""]),
    ];

    for (const metin of gorunenMetinler) {
      const kelimeler = metin.match(/\p{L}+/gu)?.map((kelime) => kelime.toLocaleLowerCase("tr-TR")) ?? [];
      assert.equal(kelimeler.some((kelime) => RESMI_OLMAYAN_HITAPLAR.has(kelime)), false, metin);
    }
  }

  const provider = readFileSync(new URL("../components/hapbi/HapbiProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /turunu başarıyla tamamladınız\. Başka bir konuda yardıma ihtiyaç duyarsanız buradayım!/);
});

test("öğrenme araçları turu dört araç türünü birlikte tanıtır", () => {
  const tur = HAPBI_CANLI_TURLAR.video_tur;
  const gorunenMetin = [tur.baslik, tur.aciklama, ...tur.adimlar.map((adim) => adim.mesaj)].join(" ");

  for (const arac of ["Video", "Podcast", "Dijital Broşür", "Literatür"]) {
    assert.match(gorunenMetin, new RegExp(arac, "u"));
  }

  assert.match(HAPBI_CANLI_TURLAR.oneri_tur.baslik, /Öğrenme Aracı/);
  assert.doesNotMatch(HAPBI_CANLI_TURLAR.oneri_tur.baslik, /Yeni Video/);
});
