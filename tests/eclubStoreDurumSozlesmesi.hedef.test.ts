import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CEK_KODU_GORUNUR_DURUMLARI,
  CEK_TALEP_ADMIN_DURUMLARI,
  CEK_TALEP_DURUMLARI,
  CEK_TALEP_DURUM_META,
  CEK_TALEP_ISLEMDE_DURUMLARI,
} from "@/lib/eclub/store/eclubStoreTipler";
import { ECLUB_SIPARIS_DURUMLARI } from "@/lib/eclub/store/ekipSiparis";

const oku = (yol: string) => readFileSync(yol, "utf8");

test("çek talebi için tek kanonik durum sözleşmesi kullanılır", () => {
  assert.deepEqual(CEK_TALEP_DURUMLARI, [
    "beklemede",
    "bm_onayinda",
    "tm_onayinda",
    "onaylandi",
    "teslimat_bekliyor",
    "cek_kodlari_gonderildi",
    "iptal",
  ]);
  assert.equal(ECLUB_SIPARIS_DURUMLARI, CEK_TALEP_DURUMLARI);
  assert.deepEqual(Object.keys(CEK_TALEP_DURUM_META), [...CEK_TALEP_DURUMLARI]);
  assert.ok(!CEK_TALEP_DURUMLARI.some((durum) => ["hazirlaniyor", "kargoda", "teslim_edildi"].includes(durum)));
});

test("işlem, admin ve kod görünürlüğü durum kümeleri açıktır", () => {
  assert.deepEqual(CEK_TALEP_ISLEMDE_DURUMLARI, [
    "beklemede", "bm_onayinda", "tm_onayinda", "onaylandi", "teslimat_bekliyor",
  ]);
  assert.deepEqual(CEK_TALEP_ADMIN_DURUMLARI, [
    "onaylandi", "teslimat_bekliyor", "cek_kodlari_gonderildi",
  ]);
  assert.deepEqual(CEK_KODU_GORUNUR_DURUMLARI, [
    "teslimat_bekliyor", "cek_kodlari_gonderildi",
  ]);
});

test("firma, eczane ve admin ekranları ortak sözleşmeyi tüketir", () => {
  const firmaApi = oku("app/(panel)/eclub/cek-onay-takip/api/route.ts");
  const firmaSayfasi = oku("app/(panel)/eclub/cek-onay-takip/page.tsx");
  const eczaneStore = oku("app/(panel)/eclub/store/page.tsx");
  const eczaneTalepleri = oku("app/(panel)/eclub/cek-taleplerim/page.tsx");
  const adminApi = oku("app/admin/eclub-cek-teslimat/api/cek-talepleri/route.ts");
  const adminTablo = oku("app/admin/eclub-cek-teslimat/_components/EclubStoreSiparislerSekmesi.tsx");

  assert.match(firmaApi, /CEK_TALEP_ISLEMDE_DURUMLARI/);
  assert.match(firmaSayfasi, /CEK_KODU_GORUNUR_DURUMLARI/);
  assert.match(eczaneStore, /CEK_TALEP_DURUM_META/);
  assert.match(eczaneTalepleri, /CEK_TALEP_DURUM_META/);
  assert.match(adminApi, /CEK_TALEP_ADMIN_DURUMLARI/);
  assert.match(adminTablo, /CEK_TALEP_ADMIN_DURUMLARI/);
  for (const kaynak of [firmaApi, firmaSayfasi, eczaneStore, eczaneTalepleri, adminApi, adminTablo]) {
    assert.doesNotMatch(kaynak, /"hazirlaniyor"|"kargoda"|"teslim_edildi"/);
  }
});

test("kanonik durumlar teslimat transaction şemasıyla aynıdır", () => {
  const sql = oku("scripts/sql/eclub_cek_teslimat_outbox.sql");
  const sqlDurumlari = sql.match(/CHECK \(durum IN \(([^)]+)\)\);/)?.[1]
    .split(",")
    .map((deger) => deger.trim().replaceAll("'", ""));
  assert.deepEqual(sqlDurumlari, [...CEK_TALEP_DURUMLARI]);
});
