import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/challenge-club/api/route.ts", "utf8");
const sayfa = readFileSync("app/(panel)/challenge-club/page.tsx", "utf8");
const baslat = readFileSync("app/(panel)/challenge-club/izle/api/baslat/route.ts", "utf8");
const kayit = readFileSync("lib/cclub/kayit.ts", "utf8");
const sabitler = readFileSync("lib/cclub/sabitler.ts", "utf8");
const kazanim = readFileSync("lib/cclub/puan/kazanim.ts", "utf8");
const tarihselKayipSql = readFileSync("scripts/sql/challenge_kaybi_tara.sql", "utf8");
const migrationSql = readFileSync("scripts/sql/cc_yeni_puanlama_modeli.sql", "utf8");

test("mutlu: alıcı ve gönderici aynı challenge durumunu kullanır", () => {
  assert.match(route, /function challengeDurumu[\s\S]*?durum: challengeDurumu\(c\)/);
  assert.match(sayfa, /c\.durum === "izlendi"/);
  assert.match(migrationSql, /trg_cc_challenge_tamamlaninca_bildirim_kapat/);
});

test("yeni model: challenge süresi ve cezası kalktı, cron iptal edildi", () => {
  assert.match(migrationSql, /cron\.unschedule\('challenge-kaybi-tara'\)/);
  assert.doesNotMatch(route, /\.eq\("izlendi_mi", false\)[\s\S]*?\.gte\("son_tarih"/);
  assert.doesNotMatch([route, sayfa, baslat].join("\n"), /son_tarih/);
  assert.doesNotMatch(kayit, /challengeKaybiKaydet|challenge_kayip_kayitlari/);
  assert.doesNotMatch(sabitler, /IS_GUNU_SURE/);
  assert.match(tarihselKayipSql, /TARİHSEL \/ DEVRE DIŞI PAKET — UYGULANMAMALIDIR/);
});

test("puanlar sabit metinden değil sistem ayarından okunur", () => {
  assert.match(sabitler, /cc_referral_puani/);
  assert.match(sabitler, /referral: harita\["cc_referral_puani"\] \?\? 10/);
  assert.match(kazanim, /const puanDegeri = await ccReferralPuani\(supabase\)/);
});
