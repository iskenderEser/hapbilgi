import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CEK_TALEP_DURUMLARI, CEK_TALEP_DURUM_META } from "@/lib/eclub/store/eclubStoreTipler";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sql = oku("scripts/sql/eclub_store_tm_son_onay.sql");
const adminApi = oku("app/admin/eclub-cek-teslimat/api/cek-talepleri/route.ts");

test("TM onayı kanonik talep durumlarına eklendi", () => {
  assert.ok(CEK_TALEP_DURUMLARI.includes("tm_onayinda"));
  assert.equal(CEK_TALEP_DURUM_META.tm_onayinda.etiket, "TM Onayında");
  assert.equal(CEK_TALEP_DURUM_META.onaylandi.etiket, "TM Onayladı / Kod Bekliyor");
});

test("Faz 2C SQL şema alanlarını transaction içinde ekler", () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /pg_advisory_xact_lock\([\s\S]*?eclub-tm-son-onay-faz-2c/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS tm_id uuid REFERENCES public\.kullanicilar/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS tm_onay_tarihi timestamptz/);
  assert.match(sql, /CHECK \(durum IN \('beklemede','bm_onayinda','tm_onayinda','onaylandi','cek_kodlari_gonderildi','iptal'\)\)/);
  assert.match(sql, /COMMIT;\s*$/);
});

test("BM onayı talebi doğrudan Admine değil tek aktif TM'ye gönderir", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eclub_store_bm_onayla/);
  assert.match(sql, /cardinality\(v_tm_idler\) IS DISTINCT FROM 1/);
  assert.match(sql, /SET durum = 'tm_onayinda',[\s\S]*?tm_id = v_tm_id[\s\S]*?bm_onay_tarihi = now\(\)/);
  assert.doesNotMatch(sql.match(/CREATE OR REPLACE FUNCTION public\.eclub_store_bm_onayla[\s\S]*?END \$f\$;/)?.[0] ?? "", /SET durum = 'onaylandi'/);
});

test("yalnız atanmış TM son onayla Admin aşamasını açar", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eclub_store_tm_onayla/);
  assert.match(sql, /lower\(rol\) = 'tm'/);
  assert.match(sql, /t\.tm_id IS DISTINCT FROM p_tm_id OR t\.durum <> 'tm_onayinda'/);
  assert.match(sql, /SET durum = 'onaylandi',[\s\S]*?tm_onay_tarihi = now\(\)/);
  assert.match(sql, /Talep TM tarafından onaylanmış değil\./);
});

test("Admin yalnız TM onayından geçen talepleri görür ve işler", () => {
  assert.match(adminApi, /CEK_TALEP_ADMIN_DURUMLARI/);
  assert.match(adminApi, /query = query\.in\("durum", \[\.\.\.CEK_TALEP_ADMIN_DURUMLARI\]\)/);
  assert.match(adminApi, /tm_id, tm_onay_tarihi/);
});
