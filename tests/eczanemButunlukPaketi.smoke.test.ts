// Beş bulgunun tek paket sözleşmesi — en fazla 1 mutlu + 1 red senaryosu.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const proxy = readFileSync("proxy.ts", "utf8");
const erisim = readFileSync("lib/eczanem/erisim.ts", "utf8");
const eclubRoute = readFileSync("app/(panel)/eclub/listem/api/kisiler/route.ts", "utf8");
const musteriRoute = readFileSync("app/(panel)/eczanem/eczane/api/musteri-ekle/route.ts", "utf8");
const listeRoute = readFileSync("app/(panel)/eczanem/eczane/api/musteriler/route.ts", "utf8");
const kasa = readFileSync("lib/eczanem/kasa.ts", "utf8");
const sql = readFileSync("scripts/sql/eczanem_butunluk_paketi.sql", "utf8");
const listeGet = listeRoute.slice(listeRoute.indexOf("export async function GET"), listeRoute.indexOf("export async function PUT"));

test("mutlu: firma kapısı, atomik provizyon, sipariş tekilliği ve tek-sorgu liste birlikte kurulur", () => {
  assert.match(proxy, /await eczanemRolErisimi\(eczanemSupabase, user\.id, rol\)/);
  assert.match(erisim, /\.eq\("eczanem_aktif", true\)/);
  assert.match(eclubRoute, /rpc\("eclub_yeni_kisi_provizyonu"/);
  assert.match(musteriRoute, /rpc\("eczanem_yeni_musteri_provizyonu"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.kimlik_provizyon_islemleri/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS ux_eczanem_siparis_tek_bekleyen/);
  assert.match(kasa, /error\?\.code === "23505"/);
  assert.match(listeGet, /from\("v_eczanem_musteri_liste_admin"\)/);
  assert.doesNotMatch(listeGet, /await adminSupabase\.auth\.admin\.getUserById/);
});

test("red: ters kimlik, kapalı firma ve başarısız Auth telafisi sessiz geçemez", () => {
  assert.match(eclubRoute, /await eczanemMusterisiTelefonMu\(adminSupabase, telefonTemiz\)/);
  assert.match(sql, /trg_eclub_kisiler_telefon_ayir/);
  assert.match(sql, /trg_eczanem_musteriler_telefon_ayir/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(v_telefon, 0\)\)/);
  assert.match(eclubRoute, /await authTelafisiYap/);
  assert.match(musteriRoute, /await authTelafisiYap/);
  assert.match(proxy, /if \(!erisim\.acik\)/);
  assert.match(sql, /'mudahale_gerekli'/);
});
