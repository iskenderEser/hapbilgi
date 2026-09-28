import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { icerikUret } from "@/lib/push/icerik";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sql = oku("scripts/sql/eclub_cek_push_worker.sql");
const worker = oku("lib/eclub/store/cekPushKuyrukIsleyici.ts");
const tipler = oku("lib/push/tipler.ts");
const cron = oku("app/api/cron/eclub-cek-eposta/route.ts");

test("push işi eşzamanlı workerlar arasında güvenli sahiplenilir", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.eclub_cek_push_isi_al/);
  assert.match(sql, /kanal = 'push'/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /deneme_sayisi = deneme_sayisi \+ 1/);
  assert.match(sql, /lease_bitis = now\(\) \+ make_interval/);
  assert.match(sql, /JOIN public\.eclub_kisi_eczane ke/);
  assert.match(sql, /ke\.aktif_mi = true/);
  assert.match(sql, /ke\.eczane_id = \(v_is\.payload ->> 'eczane_id'\)::uuid/);
});

test("yeni çek teslim olay türü ayarlara ve tip sözleşmesine eklenir", () => {
  assert.match(tipler, /\| "eclub_cek_teslim"/);
  assert.match(sql, /'push_olay_aktif'/);
  assert.match(sql, /'\{"eclub_cek_teslim": true\}'::jsonb/);
  assert.match(sql, /ON CONFLICT \(anahtar\) DO UPDATE/);
});

test("çek push içeriği yalnız E-Club çalışan rollerine ve çek ekranına gider", () => {
  const eczaci = icerikUret("eclub_cek_teslim", "eczaci", { bagId: "talep-1" });
  const teknisyen = icerikUret("eclub_cek_teslim", "eczane_teknisyeni", { bagId: "talep-1" });
  assert.equal(eczaci?.govde, "Eczanenizin Migros hediye çeki hazır.");
  assert.equal(eczaci?.url, "/eclub/cek-taleplerim?talep_id=talep-1");
  assert.equal(teknisyen?.url, "/eclub/cek-taleplerim?talep_id=talep-1");
  assert.equal(icerikUret("eclub_cek_teslim", "utt", { bagId: "talep-1" }), null);
});

test("worker yalnız gerçek gönderim sonrası push outbox işini tamamlar", () => {
  assert.match(worker, /rpc\("eclub_cek_push_isi_al"/);
  assert.match(worker, /pushYayinlaSonuclu\([\s\S]*?"eclub_cek_teslim"/);
  assert.match(worker, /sonuc\.gonderilen < 1/);
  assert.match(worker, /PUSH_ABONELIK_YOK/);
  assert.match(worker, /rpc\("eclub_cek_teslimat_tamamla"/);
  assert.match(worker, /p_kanal: "push"/);
  assert.match(worker, /rpc\("eclub_cek_teslimat_hata"/);
});

test("mevcut korumalı cron e-posta ve push workerlarını birlikte çalıştırır", () => {
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /Promise\.all/);
  assert.match(cron, /eclubCekEpostaKuyrugunuTuket\(10\)/);
  assert.match(cron, /eclubCekPushKuyrugunuTuket\(10\)/);
});
