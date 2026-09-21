import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oynatici = readFileSync(
  new URL("../components/izle/VideoOynatici.tsx", import.meta.url),
  "utf8",
);

test("soru sonucu aynı izlemeye ait bütün başarılı puan kalemlerinin toplamını gösterir", () => {
  assert.match(
    oynatici,
    /const kalemler: PuanKalemi\[\] = \[[\s\S]*\.\.\.izlemeKalemleriRef\.current,[\s\S]*\{ tur: "cevap", puan: d\.kazanilan_puan \?\? 0 \},[\s\S]*\];/,
  );
  assert.match(
    oynatici,
    /const toplamKazanilanPuan = kalemler\.reduce\(\(toplam, kalem\) => toplam \+ kalem\.puan, 0\);/,
  );
  assert.match(oynatici, /setKazanilanPuan\(toplamKazanilanPuan\);/);
  assert.doesNotMatch(oynatici, /setKazanilanPuan\(d\.kazanilan_puan\)/);
});
