import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sql = oku("scripts/sql/eclub_cek_eposta_worker.sql");
const worker = oku("lib/eclub/store/cekEpostaKuyrukIsleyici.ts");
const cron = oku("app/api/cron/eclub-cek-eposta/route.ts");

test("e-posta işi eşzamanlı workerlar arasında güvenli sahiplenilir", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eclub_cek_eposta_isi_al/);
  assert.match(sql, /kanal = 'eposta'/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /deneme_sayisi = deneme_sayisi \+ 1/);
  assert.match(sql, /lease_bitis = now\(\) \+ make_interval/);
});

test("başarılı iş tamamlanır, tüm kanallar bitmeden talep teslim edildi sayılmaz", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eclub_cek_teslimat_tamamla/);
  assert.match(sql, /WHERE outbox_id = p_outbox_id[\s\S]*?AND kanal = p_kanal[\s\S]*?AND durum = 'isleniyor'/);
  assert.match(sql, /WHERE talep_id = v_talep_id AND durum <> 'tamamlandi'/);
  assert.match(sql, /SET durum = 'cek_kodlari_gonderildi'/);
  assert.match(sql, /WHERE talep_id = v_talep_id AND durum = 'teslimat_bekliyor'/);
});

test("hatalı işler sınırlı ve gecikmeli yeniden denemeye alınır", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eclub_cek_teslimat_hata/);
  assert.match(sql, /SET durum = 'basarisiz'/);
  assert.match(sql, /least\(3600,[\s\S]*?power\(2, greatest\(deneme_sayisi - 1, 0\)\)/);
  assert.match(sql, /deneme_sayisi < max_deneme/);
});

test("worker yeni outbox RPC'lerini ve Resend idempotency anahtarını kullanır", () => {
  assert.match(worker, /rpc\("eclub_cek_eposta_isi_al"/);
  assert.match(worker, /rpc\("eclub_cek_teslimat_tamamla"/);
  assert.match(worker, /rpc\("eclub_cek_teslimat_hata"/);
  assert.match(worker, /"Idempotency-Key": `eclub-cek\/\$\{is\.outbox_id\}`/);
  assert.match(worker, /process\.env\.RESEND_API_KEY/);
  assert.match(worker, /process\.env\.ECLUB_CEK_EMAIL_FROM/);
  assert.doesNotMatch(worker, /p_kanal: "push"/);
});

test("e-posta içeriğindeki değişken alanlar HTML kaçışından geçirilir", () => {
  assert.match(worker, /const htmlKacir/);
  assert.match(worker, /htmlKacir\(is\.alici_adi/);
  assert.match(worker, /htmlKacir\(is\.cek_tutari_tl\)/);
  assert.match(worker, /htmlKacir\(is\.cek_kodu\)/);
});

test("cron yalnız Bearer CRON_SECRET ile workerı çalıştırır", () => {
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /authorization/);
  assert.match(cron, /Bearer \$\{process\.env\.CRON_SECRET\}/);
  assert.match(cron, /eclubCekEpostaKuyrugunuTuket\(10\)/);
});
