import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/(panel)/eczanem/eczane/api/musteriler/route.ts", "utf8");
const sql = readFileSync("scripts/sql/eczanem_eczane_yonetim_paketi.sql", "utf8");

test("mutlu: müşteri durumu eczaneye özel üyelik bağında okunur ve yazılır", () => {
  assert.match(route, /from\("v_eczanem_musteri_liste_admin"\)[\s\S]*?select\("musteri_id, ad_soyad, telefon, eposta, aktif_mi, created_at"/);
  assert.match(route, /rpc\("eczanem_musteri_durum_degistir"/);
  assert.match(sql, /UPDATE public\.eczanem_uyelikler[\s\S]*SET aktif_mi = p_aktif_mi/);
  assert.match(route, /aktif_mi: kayit\.aktif_mi/);
});

test("red: eczacının durum işlemi global müşteri hesabını güncellemez", () => {
  assert.doesNotMatch(
    route,
    /from\("eczanem_musteriler"\)[\s\S]{0,200}\.update\(\{ aktif_mi: body\.aktif_mi \}\)/,
  );
});
