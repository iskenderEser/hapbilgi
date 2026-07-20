// tests/duzeltmeModeli.smoke.test.ts — IU düzeltme editörü modeli smoke
// (tavan: 1 mutlu + 1 red/sınır). Koşum: npm run test:smoke.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  modelOlustur, yaziEkle, geriSil, aralikSil, temizMetin, runlar,
} from "../lib/utils/senaryo/duzeltmeModeli.ts";

test("mutlu: silinen ustu cizili kalir, yazilan ekle olur, temiz metin dogru", () => {
  const m = modelOlustur("abc");
  const s = geriSil(m, 3); // 'c' silinmez, cikar olur
  const y = yaziEkle(s.model, s.caret, "XY");
  assert.equal(temizMetin(y.model), "abXY");
  const r = runlar(y.model);
  assert.ok(r.some(x => x.tur === "cikar" && x.metin === "c"));
  assert.ok(r.some(x => x.tur === "ekle" && x.metin === "XY"));
});

test("red/sinir: ekle silinince tamamen gider; cikar tekrar silinmez; secim silme dogru ayristirir", () => {
  const m = yaziEkle(modelOlustur("ab"), 2, "Z").model; // a b Z(ekle)
  const s1 = geriSil(m, 3); // Z tamamen gider
  assert.equal(temizMetin(s1.model), "ab");
  const s2 = geriSil(s1.model, 2); // b -> cikar
  const s3 = geriSil(s2.model, 2); // cikar üzerinde: model değişmez, caret atlar
  assert.equal(s3.model.length, 2);
  assert.equal(temizMetin(s3.model), "a");
  assert.equal(s3.caret, 1);
  const a = aralikSil(yaziEkle(modelOlustur("ab"), 1, "Q").model, 0, 3); // a Q(ekle) b seçili
  assert.equal(temizMetin(a.model), ""); // temel'ler cikar, Q düştü
  assert.equal(a.model.length, 2);
  assert.equal(a.caret, 2);
});
