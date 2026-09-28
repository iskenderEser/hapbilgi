import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ECLUB_CEK_AKISI_FIXTURE as seed } from "./fixtures/eclubCekAkisi.fixture";

const oku = (yol: string) => readFileSync(yol, "utf8");
const talepSql = oku("scripts/sql/eclub_cek_talebi_ana_eczaci.sql");
const tmSql = oku("scripts/sql/eclub_store_tm_son_onay.sql");
const outboxSql = oku("scripts/sql/eclub_cek_teslimat_outbox.sql");
const epostaSql = oku("scripts/sql/eclub_cek_eposta_worker.sql");
const pushSql = oku("scripts/sql/eclub_cek_push_worker.sql");
const bildirimSql = oku("scripts/sql/eclub_cek_uygulama_bildirimleri.sql");
const ekipApi = oku("app/(panel)/eclub/siparisler/api/route.ts");
const adminApi = oku("app/admin/eclub-store/api/siparis/route.ts");
const cronApi = oku("app/api/cron/eclub-cek-eposta/route.ts");

test("Faz 6 seed'i e-posta ve tüm aktif çalışan teslimat hedeflerini sabitler", () => {
  const aktifler = seed.kisiler.filter((kisi) => kisi.aktifMi && kisi.authUserId);
  const epostaAlicilari = aktifler.filter((kisi) => kisi.rol === "eczaci" && kisi.eposta);

  assert.deepEqual(epostaAlicilari.map((kisi) => kisi.kisiId), [seed.kisiler[0].kisiId]);
  assert.deepEqual(aktifler.map((kisi) => kisi.kisiId), [seed.kisiler[0].kisiId, seed.kisiler[1].kisiId]);
  assert.ok(!aktifler.some((kisi) => kisi.kisiId === seed.kisiler[2].kisiId));
});

test("çek talebi ana eczacıdan UTT, BM, TM ve admin teslimatına sıralı ilerler", () => {
  assert.match(talepSql, /SELECT lower\(btrim\(k\.rol\)\)[\s\S]*?IF v_rol <> 'eczaci'/);
  assert.match(talepSql, /'beklemede'/);

  assert.match(ekipApi, /action === "bm_onayina_gonder"[\s\S]*?\["utt", "kd_utt"\]/);
  assert.match(ekipApi, /action === "bm_onayla"[\s\S]*?rol !== "bm"/);
  assert.match(ekipApi, /action === "tm_onayla"[\s\S]*?rol !== "tm"/);
  assert.match(ekipApi, /t\.firma_id !== kullanici\.firma_id/);

  assert.match(tmSql, /SET durum = 'tm_onayinda'/);
  assert.match(tmSql, /SET durum = 'onaylandi'/);
  assert.match(adminApi, /adminGirisKontrol\(\)/);
  assert.match(adminApi, /eclub_store_admin_kod_teslim/);
  assert.match(outboxSql, /v_t\.durum <> 'onaylandi' OR v_t\.tm_id IS NULL OR v_t\.tm_onay_tarihi IS NULL/);
  assert.match(outboxSql, /SET durum = 'teslimat_bekliyor'/);
  assert.match(epostaSql, /WHERE talep_id = v_talep_id AND durum = 'teslimat_bekliyor'/);
});

test("çek e-postası yalnız ana eczacıya, push ve uygulama bildirimi tüm aktif hesaplara gider", () => {
  assert.match(outboxSql, /lower\(k\.rol\) = 'eczaci'/);
  assert.match(outboxSql, /cardinality\(v_eczaci_idleri\) IS DISTINCT FROM 1/);
  assert.match(outboxSql, /'eposta', v_eczaci_idleri\[1\]/);

  const pushAliciSecimi = outboxSql.match(/INSERT INTO public\.eclub_cek_teslimat_outbox\([\s\S]*?'push'[\s\S]*?ON CONFLICT \(talep_id, kanal, alici_kisi_id\) DO NOTHING;/)?.[0] ?? "";
  assert.match(pushAliciSecimi, /ke\.aktif_mi = true/);
  assert.match(pushAliciSecimi, /k\.auth_user_id IS NOT NULL/);
  assert.doesNotMatch(pushAliciSecimi, /lower\(k\.rol\)/);

  assert.match(bildirimSql, /ke\.aktif_mi = true/);
  assert.match(bildirimSql, /k\.auth_user_id IS NOT NULL/);
  assert.doesNotMatch(bildirimSql, /lower\(k\.rol\)/);
});

test("outbox, worker RPC'leri ve cron dış erişime kapalıdır", () => {
  assert.match(outboxSql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(outboxSql, /REVOKE ALL ON TABLE public\.eclub_cek_teslimat_outbox FROM PUBLIC, anon, authenticated/);
  assert.match(outboxSql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.eclub_cek_teslimat_outbox TO service_role/);
  assert.match(epostaSql, /REVOKE ALL ON FUNCTION public\.eclub_cek_eposta_isi_al\(integer\) FROM PUBLIC, anon, authenticated/);
  assert.match(epostaSql, /GRANT EXECUTE ON FUNCTION public\.eclub_cek_teslimat_tamamla\(uuid, text\) TO service_role/);
  assert.match(pushSql, /REVOKE ALL ON FUNCTION public\.eclub_cek_push_isi_al\(integer\) FROM PUBLIC, anon, authenticated/);
  assert.match(cronApi, /!process\.env\.CRON_SECRET/);
  assert.match(cronApi, /authorization[\s\S]*?Bearer \$\{process\.env\.CRON_SECRET\}/);
  assert.match(cronApi, /status: 401/);
});

test("teslimat ancak e-posta ve bütün push işleri tamamlanınca kapanır", () => {
  assert.match(epostaSql, /WHERE talep_id = v_talep_id AND durum <> 'tamamlandi'/);
  assert.match(epostaSql, /SET durum = 'cek_kodlari_gonderildi'/);
  assert.match(pushSql, /kanal = 'push'/);
  assert.match(pushSql, /JOIN public\.eclub_kisi_eczane ke[\s\S]*?ke\.aktif_mi = true/);
});
