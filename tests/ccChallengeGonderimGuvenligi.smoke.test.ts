import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const kayit = readFileSync("lib/cc/kayit.ts", "utf8");
const uygunVideolar = readFileSync("lib/cc/uygunVideoListesi.ts", "utf8");
const uygunAlicilar = readFileSync("lib/cc/uygunAliciListesi.ts", "utf8");
const sql = readFileSync("scripts/sql/cc_challenge_gonderim_guvenligi.sql", "utf8");

test("mutlu: challenge ile gönderme puanı tek atomik RPC içinde oluşturulur", () => {
  assert.match(kayit, /rpc\("cc_challenge_gonder"/);
  assert.match(sql, /INSERT INTO public\.challenge_kayitlari[\s\S]*?INSERT INTO public\.cc_kazanilan_puanlar/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*?aylık challenge kotanız doldu/);
  assert.match(uygunVideolar, /eq\("firma_id", firmaId\)[\s\S]*?video_suresi_saniye/);
});

test("red: öz-gönderim, uygunsuz alıcı/yayın ve mükerrer video gönderimi reddedilir", () => {
  assert.match(sql, /Kendinize challenge gönderemezsiniz/);
  assert.match(sql, /Alıcı aktif bir BM değil/);
  assert.match(sql, /Bu videoyu önce kendiniz tamamlamalısınız/);
  assert.match(uygunAlicilar, /ayniVideoGonderilmisSet[\s\S]*?zaten gönderilmiş/);
});

