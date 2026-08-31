import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const kimlikSql = readFileSync("scripts/sql/cc_ogrenme_araci_yayin_kimligi.sql", "utf8");
const tamamlamaSql = readFileSync("scripts/sql/cc_ogrenme_araci_tamamlama.sql", "utf8");
const baslatRoute = readFileSync("app/(panel)/challenge-club/izle/api/baslat/route.ts", "utf8");
const bitirRoute = readFileSync("app/(panel)/challenge-club/izle/api/bitir/route.ts", "utf8");
const baslatLib = readFileSync("lib/cclub/izleme/baslat.ts", "utf8");
const erisimRoute = readFileSync("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts", "utf8");

test("C-Club challenge ve izleme kayıtları ortak araç kimliğini taşır", () => {
  assert.match(kimlikSql, /ALTER TABLE public\.challenge_kayitlari[\s\S]*?ADD COLUMN IF NOT EXISTS arac_id uuid/);
  assert.match(kimlikSql, /ALTER TABLE public\.cc_izleme_kayitlari[\s\S]*?ADD COLUMN IF NOT EXISTS arac_id uuid/);
  assert.match(kimlikSql, /CREATE TRIGGER trg_challenge_arac_kimligi/);
  assert.match(kimlikSql, /CREATE TRIGGER trg_cc_izleme_arac_kimligi/);
  assert.match(kimlikSql, /v_arac_turu NOT IN \('video', 'podcast', 'gorsel', 'flip_pdf'\)/);
});

test("Challenge gönderme ve izleme başlangıcı yayın-araç bağını kayıpsız korur", () => {
  assert.match(kimlikSql, /INSERT INTO public\.challenge_kayitlari[\s\S]*?arac_id, arac_turu/);
  assert.doesNotMatch(kimlikSql, /v_video_suresi/);
  assert.match(baslatRoute, /arac_id, arac_turu, arac_sure_saniye/);
  assert.match(baslatRoute, /challenge\.arac_id !== yayin\.arac_id/);
  assert.match(baslatLib, /arac_id: params\.arac_id/);
  assert.match(baslatLib, /arac_turu: params\.arac_turu/);
  assert.match(erisimRoute, /challenge\.arac_id === arac_id/);
});

test("C-Club tamamlaması dört araç türünü ortak kanıt ve puanla doğrular", () => {
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"]) {
    assert.match(tamamlamaSql, new RegExp(`v_arac_turu = '${tur}'`));
  }
  assert.match(tamamlamaSql, /tamamlama_kaniti/);
  assert.match(tamamlamaSql, /ogrenme_araci_puani/);
  assert.match(tamamlamaSql, /soru_erisimi_acik_mi/);
  assert.doesNotMatch(tamamlamaSql, /JOIN public\.video_durumu/i);
  assert.doesNotMatch(tamamlamaSql, /JOIN public\.videolar/i);
  assert.match(bitirRoute, /izleme\.arac_id !== aracDetay\.arac_id/);
});
