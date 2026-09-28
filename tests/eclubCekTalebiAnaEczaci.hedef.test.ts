import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eclubCekTalebiOlusturabilirMi } from "@/lib/eclub/store/cekTalebiYetkisi";

const oku = (yol: string) => readFileSync(yol, "utf8");

const sql = oku("scripts/sql/eclub_cek_talebi_ana_eczaci.sql");
const route = oku("app/(panel)/eclub/store/api/siparis/route.ts");
const sayfa = oku("app/(panel)/eclub/store/page.tsx");

test("yalnız ana eczacı rolü çek talebi oluşturabilir", () => {
  assert.equal(eclubCekTalebiOlusturabilirMi("eczaci"), true);
  assert.equal(eclubCekTalebiOlusturabilirMi(" Eczaci "), true);

  for (const rol of [
    "ikinci_eczaci",
    "yardimci_eczaci",
    "eczane_teknisyeni",
    "utt",
    "",
    null,
    undefined,
  ]) {
    assert.equal(eclubCekTalebiOlusturabilirMi(rol), false);
  }
});

test("Faz 2A SQL transaction, advisory lock ve Faz 1 bağımlılık kontrolü içerir", () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /pg_advisory_xact_lock\([\s\S]*?eclub-cek-talebi-ana-eczaci-faz-2a/);
  assert.match(sql, /eclub_store_cek_talebi_olustur\(uuid,uuid,boolean\)/);
  assert.match(sql, /table_name = 'eclub_kazanilan_puanlar'[\s\S]*?column_name = 'eczane_id'[\s\S]*?is_nullable = 'NO'/);
  assert.match(sql, /COMMIT;\s*$/);
});

test("migration yalnız çek talebi oluşturma RPC'sini yeniden tanımlar", () => {
  const tanimlar = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)/g)]
    .map((eslesme) => eslesme[1]);
  assert.deepEqual(tanimlar, ["eclub_store_cek_talebi_olustur"]);
});

test("RPC ana eczacı rolünü diğer bütün E-Club rollerinden ayırır", () => {
  assert.match(sql, /SELECT lower\(btrim\(k\.rol\)\)[\s\S]*?FOR SHARE;/);
  assert.match(sql, /IF v_rol <> 'eczaci' THEN[\s\S]*?Hediye çeki talebini yalnız ana eczacı oluşturabilir\./);
  assert.doesNotMatch(sql, /v_rol\s+IN\s*\(/);
  assert.doesNotMatch(sql, /ikinci_eczaci|yardimci_eczaci|eczane_teknisyeni/);
});

test("RPC aktif eczane üyeliğini kilitler ve tekil olmasını zorunlu tutar", () => {
  assert.match(sql, /FROM public\.eclub_kisi_eczane ke[\s\S]*?ke\.kisi_id = p_kisi_id[\s\S]*?ke\.aktif_mi = true[\s\S]*?FOR SHARE;/);
  assert.match(sql, /array_agg\(ke\.eczane_id ORDER BY ke\.eczane_id\)/);
  assert.match(sql, /cardinality\(v_aktif_eczaneler\) <> 1/);
});

test("RPC Faz 1 snapshot bakiyesini ve mevcut talep atomikliğini korur", () => {
  assert.match(sql, /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?kp\.eczane_id = v_eczane[\s\S]*?kp\.cek_karsiligi_var_mi = true/);
  assert.match(sql, /eclub-talep:' \|\| v_eczane \|\| ':' \|\| p_yayin_id/);
  assert.match(sql, /INSERT INTO public\.eclub_store_cek_talepleri[\s\S]*?talep_eden_kisi_id[\s\S]*?p_kisi_id/);
});

test("RPC yalnız service_role tarafından çalıştırılabilir", () => {
  assert.match(sql, /SECURITY DEFINER[\s\S]*?SET search_path = public, pg_temp/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.eclub_store_cek_talebi_olustur\(uuid, uuid, boolean\)\s+FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.eclub_store_cek_talebi_olustur\(uuid, uuid, boolean\)\s+TO service_role;/);
});

test("POST route çek talebinde rolü RPC çağrısından önce yeniden doğrular", () => {
  const talepDali = route.indexOf("if (body.yayin_id)");
  const rolKontrolu = route.indexOf("eclubCekTalebiOlusturabilirMi(kisi.rol)");
  const rpc = route.indexOf('adminSupabase.rpc("eclub_store_cek_talebi_olustur"');

  assert.equal(talepDali, -1, "Fiziksel Store ayrım dalı kalmamalı");
  assert.ok(rolKontrolu >= 0 && rolKontrolu < rpc);
  assert.doesNotMatch(route, /urun_id, adres_id, adet/);
  assert.match(route, /Hediye çeki talebini yalnız ana eczacı oluşturabilir\./);
});

test("Store arayüzü yetkisiz rollere talep aksiyonu sunmaz", () => {
  assert.match(sayfa, /const cekTalebiOlusturabilir = eclubCekTalebiOlusturabilirMi\(kullanici\?\.rol\)/);
  assert.match(sayfa, /if \(!cekTalebiOlusturabilir\) \{[\s\S]*?Hediye çeki talebini yalnız ana eczacı oluşturabilir\./);
  assert.match(sayfa, /!cekTalebiOlusturabilir \? \([\s\S]*?Hediye çeki talebini yalnız ana eczacı oluşturabilir\./);
});
