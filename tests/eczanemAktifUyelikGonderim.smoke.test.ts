import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gonderim = readFileSync("lib/eczanem/gonderim.ts", "utf8");
const videolar = readFileSync("app/eczanem/api/videolar/route.ts", "utf8");
const sql = readFileSync("scripts/sql/eczanem_coklu_eczane_aktif_uyelik.sql", "utf8");
const izlemeRotalari = ["baslat", "bitir", "sorular", "cevapla"]
  .map((ad) => readFileSync(`app/eczanem/api/izleme/${ad}/route.ts`, "utf8"));

test("mutlu: aynı yayın gönderim ve ilerleme durumunu eczane/gönderim ekseninde ayırır", () => {
  assert.match(sql, /UNIQUE \(yayin_id, musteri_id, eczane_id\)/);
  assert.match(
    gonderim,
    /from\("eczanem_gonderimler"\)[\s\S]*?\.eq\("yayin_id", yayinId\)[\s\S]*?\.eq\("eczane_id", eczaneId\)[\s\S]*?\.in\("musteri_id", istenen\)/,
  );
  assert.match(videolar, /izlemeDurumu\.get\(g\.gonderim_id\)/);
  assert.match(videolar, /eczane_adi: eczaneAdlari\.get\(g\.eczane_id\)/);
});

test("red: pasif veya silinmiş eczane üyeliği liste, izleme ve puan kapılarını geçemez", () => {
  assert.match(videolar, /from\("eczanem_uyelikler"\)[\s\S]*?\.eq\("aktif_mi", true\)/);
  for (const route of izlemeRotalari) {
    assert.match(route, /aktif(?:Eczane|Gonderim)UyeliginiDogrula/);
  }
  assert.match(sql, /BEFORE INSERT OR UPDATE ON public\.eczanem_izleme_kayitlari/);
  assert.match(sql, /BEFORE INSERT ON public\.eczanem_puan_kayitlari/);
  assert.match(sql, /u\.aktif_mi = true/);
});
