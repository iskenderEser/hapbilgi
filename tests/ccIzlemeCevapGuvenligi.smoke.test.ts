import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const baslat = readFileSync("app/(panel)/challenge-club/izle/api/baslat/route.ts", "utf8");
const bitir = readFileSync("app/(panel)/challenge-club/izle/api/bitir/route.ts", "utf8");
const cevap = readFileSync("app/(panel)/challenge-club/izle/api/cevap/route.ts", "utf8");
const sorular = readFileSync("app/(panel)/challenge-club/izle/api/sorular/route.ts", "utf8");
const ileriSarma = readFileSync("app/(panel)/challenge-club/izle/api/ileri-sarma/route.ts", "utf8");
const oynatici = readFileSync("components/challenge-club/CcVideoOynatici.tsx", "utf8");
const sql = readFileSync("scripts/sql/cc_izleme_cevap_guvenligi.sql", "utf8");

test("mutlu: C-Club tamamlama, soru, puan ve challenge sonucu atomik sözleşmeye bağlıdır", () => {
  assert.match(bitir, /rpc\("cc_izleme_tamamla"/);
  assert.match(cevap, /rpc\("cc_cevaplari_kaydet"/);
  assert.match(sorular, /soru_indeksleri[\s\S]*?secenekler\.map\(\(\{ harf, metin \}\) => \(\{ harf, metin \}\)\)/);
  assert.match(sql, /FOR UPDATE[\s\S]*?cevaplandi_mi = true[\s\S]*?izlendi_mi = true/);
  assert.match(sql, /cc_puan_referral_challenge_uq/);
  assert.match(oynatici, /ilkOynatmaZorunlu:\s*true/);
  assert.match(baslat, /puanli_zaman:\s*true/);
  assert.match(oynatici, /Video tamamlandı[\s\S]*?Listeye dönülüyor…/);
});

test("red: süresiz video, erken bitirme, mükerrer cevap ve atanmış küme dışı cevap reddedilir", () => {
  assert.match(baslat, /video_suresi_saniye[\s\S]*?süre doğrulanamadı/);
  assert.match(sql, /Video henüz tamamlanabilecek kadar oynatılmadı/);
  assert.match(sql, /sorular zaten cevaplandı/);
  assert.match(cevap, /cevaplarAtananSorularlaEslesiyorMu/);
  assert.match(ileriSarma, /video_suresi_saniye[\s\S]*?bitis > videoSuresi \+ 1/);
});
