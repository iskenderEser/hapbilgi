import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("scripts/sql/eclub_utt_eczane_uyeligi.sql", "utf8");
const eczaneRoute = readFileSync("app/(panel)/eclub/listem/api/eczaneler/route.ts", "utf8");
const kisiRoute = readFileSync("app/(panel)/eclub/listem/api/kisiler/route.ts", "utf8");
const oneriRoute = readFileSync("app/(panel)/eclub/oneriler/api/route.ts", "utf8");
const eczanemRpc = readFileSync("scripts/sql/eczanem_utt_gonderim_atomik.sql", "utf8");

test("mutlu: aynı firmanın farklı UTT'leri tek kurumsal eczane bağında ayrı liste üyelikleri kurar", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.eclub_utt_eczane/);
  assert.match(migration, /UNIQUE \(eczane_firma_id, utt_id\)/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.eclub_utt_eczane FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /INSERT INTO public\.eclub_utt_eczane[\s\S]*ef\.baglayan_utt_id/);
  assert.match(migration, /eclub_utt_eczaneye_bagla[\s\S]*pg_advisory_xact_lock/);
  assert.match(migration, /WHERE ue\.eczane_firma_id = v_eczane_firma_id[\s\S]*ue\.utt_id = p_utt_id/);
  assert.match(eczaneRoute, /rpc\("eclub_utt_eczaneye_bagla"/);
  assert.match(eczaneRoute, /uttEczaneYetkisiVarMi[\s\S]*k\.firma_id/);
  assert.match(kisiRoute, /uttEczaneYetkisiVarMi[\s\S]*k\.firma_id/);
});

test("sınır: UTT tekrarı engellenir, başka UTT'nin önerisi ve Eczanem yetkisi bağımsız kalır", () => {
  assert.match(migration, /IF FOUND AND v_uyelik_aktif THEN[\s\S]*'tekrar'/);
  assert.match(migration, /UPDATE public\.eclub_utt_eczane[\s\S]*SET aktif_mi = false/);
  assert.match(migration, /IF v_kalan = 0 THEN[\s\S]*UPDATE public\.eclub_eczane_firma/);
  assert.match(oneriRoute, /uttEczaneFirmaBaglari\(adminSupabase, user\.id\)/);
  assert.match(oneriRoute, /p_oneren_id: user\.id[\s\S]*p_kisi_id: kid[\s\S]*p_arac_id: yayin\.arac_id/);
  assert.match(eczanemRpc, /JOIN public\.eclub_utt_eczane ue ON ue\.eczane_firma_id = ef\.id/);
  assert.match(eczanemRpc, /ue\.utt_id = p_utt_id[\s\S]*ue\.aktif_mi = true/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.eclub_utt_eczaneye_bagla\(uuid, text\)[\s\S]*TO service_role/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.eclub_utt_eczaneye_bagla\(uuid, text\)[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
});
