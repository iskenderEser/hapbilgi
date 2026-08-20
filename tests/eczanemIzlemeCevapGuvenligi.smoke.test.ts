import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sabitSoruIndeksleri } from "@/lib/soru/secim";
import { cevaplarAtananSorularlaEslesiyorMu } from "@/lib/soru/kontrol";

const bitirRoute = readFileSync("app/eczanem/api/izleme/bitir/route.ts", "utf8");
const cevaplaRoute = readFileSync("app/eczanem/api/izleme/cevapla/route.ts", "utf8");
const sql = readFileSync("scripts/sql/eczanem_izleme_cevap_guvenligi.sql", "utf8");

test("mutlu: izleme ve cevap akışı sabit soru kümesiyle atomik RPC'leri kullanır", () => {
  const ilk = sabitSoruIndeksleri(6, 2, "123e4567-e89b-42d3-a456-426614174000");
  const ikinci = sabitSoruIndeksleri(6, 2, "123e4567-e89b-42d3-a456-426614174000");

  assert.deepEqual(ilk, ikinci);
  assert.equal(new Set(ilk).size, 2);
  assert.equal(cevaplarAtananSorularlaEslesiyorMu(
    ilk.map((soru_index) => ({ soru_index, verilen_cevap: "A" })),
    ilk,
  ), true);
  assert.match(bitirRoute, /rpc\("eczanem_izleme_tamamla"/);
  assert.match(cevaplaRoute, /rpc\("eczanem_cevaplari_kaydet"/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /clock_timestamp\(\) - v_izleme\.izleme_baslangic/);
});

test("red: eksik, fazla veya mükerrer soru cevapları ve doğrudan puan yazımı reddedilir", () => {
  const atanan = [1, 3];

  assert.equal(cevaplarAtananSorularlaEslesiyorMu([
    { soru_index: 1, verilen_cevap: "A" },
    { soru_index: 1, verilen_cevap: "B" },
  ], atanan), false);
  assert.equal(cevaplarAtananSorularlaEslesiyorMu([
    { soru_index: 1, verilen_cevap: "A" },
    { soru_index: 3, verilen_cevap: "B" },
    { soru_index: 4, verilen_cevap: "C" },
  ], atanan), false);
  assert.doesNotMatch(bitirRoute, /kazanimKaydet|from\("eczanem_puan_kayitlari"\)/);
  assert.doesNotMatch(cevaplaRoute, /kazanimKaydet|from\("eczanem_puan_kayitlari"\)/);
  assert.match(sql, /cevaplandi_mi = true/);
});
