// Eczanem eczane yönetimi redesign + veri bütünlüğü sözleşmesi.
// En fazla bir mutlu yol ve bir red senaryosu.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("scripts/sql/eczanem_eczane_yonetim_paketi.sql", "utf8");
const siparisRoute = readFileSync("app/(panel)/eczanem/eczane/api/siparisler/route.ts", "utf8");
const musteriRoute = readFileSync("app/(panel)/eczanem/eczane/api/musteriler/route.ts", "utf8");
const gonderim = readFileSync("lib/eczanem/gonderim.ts", "utf8");
const dokum = readFileSync("lib/eczanem/dokum.ts", "utf8");
const ortakArayuz = readFileSync("app/(panel)/eczanem/eczane/_components/EczanemEczaneArayuz.tsx", "utf8");
const musterilerim = readFileSync("app/(panel)/eczanem/eczane/musterilerim/page.tsx", "utf8");

test("mutlu: personel izi, ayrılmış sipariş kuyruğu ve DB toplamları ortak arayüzle kurulur", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.eczanem_personel_islemleri/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_siparis_personel_islemi/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_eczane_dokumu/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eczanem_musterilere_video_gonder/);
  assert.match(siparisRoute, /\.eq\("durum", "bekliyor"\)[\s\S]*\.range\(/);
  assert.match(dokum, /rpc\("eczanem_eczane_dokumu"/);
  assert.match(gonderim, /rpc\("eczanem_musterilere_video_gonder"/);
  assert.match(ortakArayuz, /max-w-\[1480px\]/);
  assert.match(musterilerim, /Müşteriyi sorgula/);
  assert.match(musterilerim, /Eczaneme bağla/);
  assert.match(musterilerim, /Yeni müşteri kaydı oluştur/);
  assert.match(musterilerim, /aria-label="Bilgilendirmeyi kapat"/);
});

test("red: eski yüz kayıt sınırı, doğrudan üyelik güncellemesi ve açık e-posta çıkışı geri gelemez", () => {
  assert.doesNotMatch(siparisRoute, /\.limit\(100\)/);
  const putBolumu = musteriRoute.slice(musteriRoute.indexOf("export async function PUT"), musteriRoute.indexOf("export async function DELETE"));
  assert.doesNotMatch(putBolumu, /\.from\("eczanem_uyelikler"\)[\s\S]*\.update\(/);
  assert.match(musteriRoute, /eposta: epostaMaskele\(/);
  assert.match(gonderim, /istenen\.length > 100/);
  assert.match(sql, /ON CONFLICT \(yayin_id, musteri_id, eczane_id\) DO NOTHING/);
});
