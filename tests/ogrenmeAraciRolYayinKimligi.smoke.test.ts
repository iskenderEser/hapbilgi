import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const uttVerisi = readFileSync("lib/utils/anaSayfa/utt.ts", "utf8");
const uttKarti = readFileSync("components/video/UttVideoKarti.tsx", "utf8");
const ortakAnaSayfa = readFileSync("lib/video/anaSayfaVideolari.ts", "utf8");

test("UTT yayın sözleşmesi öğrenme aracı kimliği ve türünü oynatıcıya taşır", () => {
  assert.match(uttVerisi, /firma_adi, arac_id, arac_turu/);
  assert.match(uttVerisi, /arac_id: y\.arac_id \?\? null/);
  assert.match(uttVerisi, /arac_turu: y\.arac_turu \?\? "video"/);
  assert.match(uttKarti, /arac_id: string \| null/);
  assert.match(uttKarti, /arac_turu: OgrenmeAraciTuru/);
});

test("BM ortak ana sayfa sözleşmesi yalnız açık araçları kimliği ve türüyle döndürür", () => {
  assert.match(ortakAnaSayfa, /firma_adi, arac_id, arac_turu/);
  assert.match(ortakAnaSayfa, /\.in\("arac_turu", Object\.entries\(ogrenmeAraciBayraklari\(\)\)/);
  assert.match(ortakAnaSayfa, /arac_id: v\.arac_id \?\? null/);
  assert.match(ortakAnaSayfa, /arac_turu: v\.arac_turu \?\? "video"/);
});
