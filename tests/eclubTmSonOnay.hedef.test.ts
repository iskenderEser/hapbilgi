import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ECLUB_SIPARIS_DURUMLARI, ECLUB_SIPARIS_DURUM_ETIKETLERI } from "@/lib/eclub/store/ekipSiparis";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sql = oku("scripts/sql/eclub_store_tm_son_onay.sql");
const api = oku("app/(panel)/eclub/cek-onay-takip/api/route.ts");
const sayfa = oku("app/(panel)/eclub/cek-onay-takip/page.tsx");
const adminApi = oku("app/admin/eclub-cek-teslimat/api/cek-talepleri/route.ts");

test("TM onayı kanonik talep durumlarına eklendi", () => {
  assert.ok(ECLUB_SIPARIS_DURUMLARI.includes("tm_onayinda"));
  assert.equal(ECLUB_SIPARIS_DURUM_ETIKETLERI.tm_onayinda, "TM Onayında");
  assert.equal(ECLUB_SIPARIS_DURUM_ETIKETLERI.onaylandi, "TM Onayladı / Kod Bekliyor");
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

test("firma API ve tablo ekranı TM rolüne yalnız kendi son onay aksiyonunu verir", () => {
  assert.match(api, /if \(action === "tm_onayla"\)/);
  assert.match(api, /if \(rol !== "tm"\)/);
  assert.match(api, /t\.tm_id !== kullanici\.kullanici_id \|\| t\.durum !== "tm_onayinda"/);
  assert.match(api, /adminSupabase\.rpc\("eclub_store_tm_onayla"/);
  assert.match(sayfa, /const isTm = kullaniciRol === "tm"/);
  assert.match(sayfa, /isTm && s\.durum === "tm_onayinda"/);
  assert.match(sayfa, /topluOnayCalistir\("tm_onayla"\)/);
  assert.match(sayfa, /Son Onayı Ver/);
});

test("Admin yalnız TM onayından geçen talepleri görür ve işler", () => {
  assert.match(adminApi, /CEK_TALEP_ADMIN_DURUMLARI/);
  assert.match(adminApi, /query = query\.in\("durum", \[\.\.\.CEK_TALEP_ADMIN_DURUMLARI\]\)/);
  assert.match(adminApi, /tm_id, tm_onay_tarihi/);
});
