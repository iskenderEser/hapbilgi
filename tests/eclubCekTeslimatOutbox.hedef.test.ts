import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CEK_TALEP_DURUMLARI } from "@/lib/eclub/store/eclubStoreTipler";

const oku = (yol: string) => readFileSync(yol, "utf8");
const sql = oku("scripts/sql/eclub_cek_teslimat_outbox.sql");
const adminApi = oku("app/admin/eclub-cek-teslimat/api/cek-talepleri/route.ts");

test("outbox şeması e-posta ve push işlerini ortak sözleşmede tutar", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.eclub_cek_teslimat_outbox/);
  assert.match(sql, /kanal text NOT NULL CHECK \(kanal IN \('eposta','push'\)\)/);
  assert.match(sql, /durum text NOT NULL DEFAULT 'bekliyor' CHECK \(durum IN \('bekliyor','isleniyor','tamamlandi','basarisiz'\)\)/);
  assert.match(sql, /UNIQUE \(talep_id, kanal, alici_kisi_id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE public\.eclub_cek_teslimat_outbox FROM PUBLIC, anon, authenticated/);
});

test("çek kodu ve bütün teslimat işleri aynı transaction içinde oluşturulur", () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /pg_advisory_xact_lock\([\s\S]*?eclub-cek-teslimat-outbox-faz-3a/);
  assert.match(sql, /SELECT \* INTO v_t[\s\S]*?FOR UPDATE;/);
  assert.match(sql, /SET durum = 'teslimat_bekliyor',[\s\S]*?cek_kodu = btrim\(p_cek_kodu\)/);
  assert.match(sql, /VALUES \([\s\S]*?'eposta'/);
  assert.match(sql, /SELECT v_olay_id, p_talep_id, 'push'/);
  assert.match(sql, /COMMIT;\s*$/);
});

test("e-posta yalnız aktif ana eczacıya, push bütün aktif hesaplara hazırlanır", () => {
  assert.match(sql, /lower\(k\.rol\) = 'eczaci'/);
  assert.match(sql, /cardinality\(v_eczaci_idleri\) IS DISTINCT FROM 1/);
  assert.match(sql, /Eczanenin tek bir aktif ana eczacı hesabı bulunmalıdır/);
  const pushDali = sql.slice(sql.indexOf("SELECT v_olay_id, p_talep_id, 'push'"));
  assert.match(pushDali, /ke\.aktif_mi = true/);
  assert.match(pushDali, /k\.auth_user_id IS NOT NULL/);
  assert.doesNotMatch(pushDali, /lower\(k\.rol\)/);
});

test("aynı veya farklı kodla tekrar çağrı güvenli ve idempotenttir", () => {
  assert.match(sql, /v_t\.durum IN \('teslimat_bekliyor','cek_kodlari_gonderildi'\)/);
  assert.match(sql, /v_t\.cek_kodu = btrim\(p_cek_kodu\)/);
  assert.match(sql, /daha önce farklı bir çek kodu kaydedilmiş/);
  assert.match(sql, /ON CONFLICT \(talep_id, kanal, alici_kisi_id\) DO NOTHING/g);
});

test("Faz 3A gönderim yapmaz ve admin isteğinde worker çağırmaz", () => {
  assert.doesNotMatch(sql, /eclub_store_cek_eposta_kuyrugu/);
  assert.doesNotMatch(sql, /INSERT INTO public\.eclub_bildirimler/);
  assert.doesNotMatch(adminApi, /eclubCekEpostaKuyrugunuTuket/);
  assert.match(adminApi, /e-posta ve push teslimat kuyruğuna alındı/);
});

test("kanonik çek durumları teslimat bekleme aşamasını içerir", () => {
  assert.ok(CEK_TALEP_DURUMLARI.includes("teslimat_bekliyor"));
});
