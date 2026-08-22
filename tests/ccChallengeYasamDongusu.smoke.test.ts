import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/challenge-club/api/route.ts", "utf8");
const sayfa = readFileSync("app/(panel)/challenge-club/page.tsx", "utf8");
const sql = readFileSync("scripts/sql/challenge_kaybi_tara.sql", "utf8");

test("mutlu: alıcı ve gönderici aynı challenge durumunu kullanır; tamamlama bildirimi kapanır", () => {
  assert.match(route, /function challengeDurumu[\s\S]*?durum: challengeDurumu\(c\)/);
  assert.match(sayfa, /ChallengeDurumPili durum=\{c\.durum\}/);
  assert.match(sql, /trg_cc_challenge_tamamlaninca_bildirim_kapat/);
});

test("red: süresi dolan challenge kaybı eşzamanlı veya tekrarlı taramada çoğalamaz", () => {
  assert.match(sql, /challenge_kayip_challenge_uq/);
  assert.match(sql, /FOR UPDATE OF ck SKIP LOCKED/);
  assert.match(sql, /ON CONFLICT \(challenge_id\) DO NOTHING/);
  assert.match(sql, /cron\.schedule[\s\S]*?challenge_kaybi_tara/);
  assert.doesNotMatch(route, /\.eq\("izlendi_mi", false\)[\s\S]*?\.gte\("son_tarih"/);
});
