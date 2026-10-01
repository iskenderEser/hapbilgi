import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sql = oku("scripts/sql/eclub_cek_uygulama_bildirimleri.sql");
const bildirimApi = oku("app/bildirimler/api/route.ts");
const panelLayout = oku("app/(panel)/layout.tsx");
const panelNav = oku("components/panel/panelNav.config.ts");
const ceklerim = oku("app/(panel)/eclub/cek-taleplerim/page.tsx");
const bildirimGosterimi = oku("components/panel/YayinSonucBildirimi.tsx");

test("çek kaydıyla uygulama bildirimi aynı transaction içinde oluşur", () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /pg_advisory_xact_lock\([\s\S]*?eclub-cek-uygulama-bildirimleri-faz-4/);
  assert.match(sql, /AFTER UPDATE OF durum, cek_kodu ON public\.eclub_store_cek_talepleri/);
  assert.match(sql, /NEW\.durum = 'teslimat_bekliyor'/);
  assert.match(sql, /INSERT INTO public\.eclub_bildirimler/);
  assert.match(sql, /COMMIT;\s*$/);
});

test("bildirim eczanedeki bütün aktif hesaplara ve yalnız bir kez yazılır", () => {
  assert.match(sql, /ke\.eczane_id = NEW\.eczane_id/);
  assert.match(sql, /ke\.aktif_mi = true/);
  assert.match(sql, /k\.auth_user_id IS NOT NULL/);
  assert.doesNotMatch(sql, /lower\(k\.rol\)/);
  assert.match(sql, /b\.alici_kisi_id = k\.kisi_id[\s\S]*?b\.kayit_turu = 'cek'[\s\S]*?b\.kayit_id = NEW\.talep_id/);
});

test("bildirim API'si yalnız oturumdaki E-Club kişisinin çek bildirimini okur ve kapatır", () => {
  assert.match(bildirimApi, /from\("eclub_bildirimler"\)[\s\S]*?eq\("alici_kisi_id", eclubKisi\.kisi_id\)[\s\S]*?eq\("goruldu_mu", false\)/);
  assert.match(bildirimApi, /kayit_turu === "cek"[\s\S]*?eq\("alici_kisi_id", kisi\.kisi_id\)[\s\S]*?eq\("kayit_turu", kayit_turu\)/);
});

test("çek bildirimi oturum içinde gösterilir ve Çek Taleplerim rozetine yansır", () => {
  assert.match(bildirimGosterimi, /b\.kayit_turu === "cek"[\s\S]*?basari\(b\.mesaj\)/);
  assert.match(panelLayout, /\["\/bildirimler\/api", "\/eczanem\/eczane\/api\/rozet"\]/);
  assert.match(panelLayout, /setInterval\([\s\S]*?bildirimRozetleriniYenile\(\)[\s\S]*?30000/);
  assert.match(panelNav, /Çek Taleplerim[\s\S]*?badgeKey: "cek"/);
});

test("Çek Taleplerim açılınca çek bildirimleri görüldü yapılır", () => {
  assert.match(ceklerim, /fetch\("\/bildirimler\/api"[\s\S]*?method: "PUT"[\s\S]*?kayit_turu: "cek"/);
  assert.match(ceklerim, /bildirimRozetleriniYenile\(\)/);
  assert.match(ceklerim, /CEK_KODU_GORUNUR_DURUMLARI[\s\S]*?CEK_KODU_GORUNUR_DURUMLARI\.includes\(talep\.durum\)[\s\S]*?talep\.cek_kodu/);
});
