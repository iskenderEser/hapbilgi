import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/challenge-club/api/route.ts", "utf8");
const sayfa = readFileSync("app/(panel)/challenge-club/page.tsx", "utf8");
const migrationSql = readFileSync("scripts/sql/cc_yeni_puanlama_modeli.sql", "utf8");

test("mutlu: alıcı ve gönderici aynı challenge durumunu kullanır", () => {
  assert.match(route, /function challengeDurumu[\s\S]*?durum: challengeDurumu\(c\)/);
  assert.match(sayfa, /c\.durum === "izlendi"/);
  assert.match(migrationSql, /trg_cc_challenge_tamamlaninca_bildirim_kapat/);
});

test("yeni model: challenge süresi ve cezası kalktı, cron iptal edildi", () => {
  assert.match(migrationSql, /cron\.unschedule\('challenge-kaybi-tara'\)/);
  assert.doesNotMatch(route, /\.eq\("izlendi_mi", false\)[\s\S]*?\.gte\("son_tarih"/);
});

