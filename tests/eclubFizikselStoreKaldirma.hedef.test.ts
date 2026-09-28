import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");
const fizikselSozlesme = /eclub_store_(?:kategoriler|urunler|urun_firma_ayarlari|adresler|siparisler|siparis_firma_puan)|get_eclub_store_firma_bakiye|get_eclub_utt_siparisler|eclub_store_siparis_olustur|eclub_store_teslim_aldim/;

test("fiziksel katalog, adres ve yönetim yüzeyleri kaldırıldı", () => {
  for (const yol of [
    "app/(panel)/eclub/store/adreslerim/page.tsx",
    "app/(panel)/eclub/store/api/adres/route.ts",
    "app/admin/eclub-cek-teslimat/api/kategori/route.ts",
    "app/admin/eclub-cek-teslimat/api/urun/route.ts",
    "app/admin/eclub-cek-teslimat/api/urun-firma/route.ts",
    "lib/eclub/store/eclubStoreSiparis.ts",
    "lib/eclub/store/eclubStoreBakiye.ts",
  ]) assert.equal(existsSync(yol), false, yol);
});

test("aktif E-Club hediye çeki rotaları yalnız çek sözleşmesini kullanır", () => {
  for (const yol of [
    "app/(panel)/eclub/store/api/route.ts",
    "app/(panel)/eclub/api/cek-talepleri/route.ts",
    "app/(panel)/eclub/cek-onay-takip/api/route.ts",
    "app/admin/eclub-cek-teslimat/api/cek-talepleri/route.ts",
  ]) assert.doesNotMatch(oku(yol), fizikselSozlesme, yol);

  assert.match(oku("app/(panel)/eclub/api/cek-talepleri/route.ts"), /eclub_store_cek_talebi_olustur/);
  assert.match(oku("app/admin/eclub-cek-teslimat/api/cek-talepleri/route.ts"), /eclub_store_admin_kod_teslim/);
});

test("geçmiş veri silinmeden eski yazma kapıları kapatılır", () => {
  const sql = oku("scripts/sql/eclub_fiziksel_store_kapatma.sql");
  for (const fonksiyon of [
    "eclub_store_siparis_olustur",
    "eclub_store_siparis_iptal",
    "eclub_store_teslim_aldim",
    "get_eclub_utt_siparisler",
    "get_eclub_store_firma_bakiye",
    "eclub_store_siparis_donemi_acik_mi",
  ]) assert.match(sql, new RegExp(`DROP FUNCTION IF EXISTS public\\.${fonksiyon}\\(`));

  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE/);
  assert.doesNotMatch(sql, /DROP\s+TABLE/i);
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /COMMIT;\s*$/);
});

test("gezinmede fiziksel adres ve ürün mağazası bağlantısı kalmadı", () => {
  const nav = oku("components/panel/panelNav.config.ts");
  assert.doesNotMatch(nav, /\/eclub\/store\/adreslerim/);
  assert.match(nav, /Hediye Çeki/);
  assert.match(nav, /Çek Taleplerim/);
});
