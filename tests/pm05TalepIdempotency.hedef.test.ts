import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

const sql = oku("scripts/sql/talep_olusturma_idempotent.sql");
const api = oku("app/(panel)/talepler/api/route.ts");
const form = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

test("PM-05 istemci, yanıt kaybında aynı form için aynı işlem anahtarını korur", () => {
  assert.match(form, /window\.sessionStorage\.getItem\(depoAnahtari\)/);
  assert.match(form, /onceki\?\.govde_imzasi === govdeImzasi[\s\S]*islemAnahtari = onceki\.islem_anahtari/);
  assert.match(form, /body: JSON\.stringify\(\{ \.\.\.talepGovdesi, islem_anahtari: islemAnahtari \}\)/);
  assert.match(form, /if \(kayit\?\.islem_anahtari === islemAnahtari\) window\.sessionStorage\.removeItem/);
});

test("PM-05 API, talep ve ilk görevi doğrudan yazmak yerine atomik RPC kullanır", () => {
  assert.match(api, /uuidGecerliMi\(islem_anahtari\)/);
  assert.match(api, /adminSupabase\.rpc\("talep_atomik_olustur"/);
  assert.doesNotMatch(api, /\.from\("talepler"\)\s*\.insert\(/);
  assert.doesNotMatch(api, /uretim_talep_ilk_gorevini_ac/);
  assert.doesNotMatch(api, /geriAlmaError/);
});

test("PM-05 veritabanı aynı anahtarı tekilleştirir, veri değişimini reddeder ve ilk görevi aynı transactionda açar", () => {
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_talepler_uretici_olusturma_islemi/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_mevcut_ozet IS DISTINCT FROM v_istek_ozeti[\s\S]*ERRCODE = '23505'/);
  assert.match(sql, /INSERT INTO public\.talepler[\s\S]*public\.uretim_talep_ilk_gorevini_ac/);
  assert.match(sql, /RETURN jsonb_build_object\([\s\S]*'mevcut', true/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.talep_atomik_olustur[\s\S]*TO service_role/);
});
