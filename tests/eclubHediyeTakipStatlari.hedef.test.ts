import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI,
  CEK_TAKIP_TAMAMLANAN_TALEP_DURUMLARI,
  CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI,
  cekTakipStatGrubu,
  cekTakipStatlariniHesapla,
} from "@/lib/eclub/hediyeTakip/cekTakipStatlari";

const kaynak = readFileSync("lib/eclub/hediyeTakip/cekTakipStatlari.ts", "utf8");
const api = readFileSync("app/(panel)/eclub/hediye-takip/api/cek-takip/route.ts", "utf8");

test("onay statı UTT, BM ve TM onay adımlarını birlikte sayar", () => {
  assert.deepEqual(CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI, ["beklemede", "bm_onayinda", "tm_onayinda"]);
  for (const durum of CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI) {
    assert.equal(cekTakipStatGrubu(durum), "onay_surecinde");
  }
});

test("teslimat statı kod bekleyen ve dağıtım kuyruğundaki talepleri sayar", () => {
  assert.deepEqual(CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI, ["onaylandi", "teslimat_bekliyor"]);
  for (const durum of CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI) {
    assert.equal(cekTakipStatGrubu(durum), "teslimat_surecinde");
  }
});

test("tamamlanan statı yalnız bütün teslimatları biten talebi sayar", () => {
  assert.deepEqual(CEK_TAKIP_TAMAMLANAN_TALEP_DURUMLARI, ["cek_kodlari_gonderildi"]);
  assert.equal(cekTakipStatGrubu("cek_kodlari_gonderildi"), "tamamlanan");
});

test("iptal kaydı yalnız toplam geçmişinde kalır", () => {
  assert.equal(cekTakipStatGrubu("iptal"), null);
  assert.deepEqual(
    cekTakipStatlariniHesapla(["beklemede", "bm_onayinda", "tm_onayinda", "onaylandi", "teslimat_bekliyor", "cek_kodlari_gonderildi", "iptal"]),
    { toplam: 7, onay_surecinde: 3, teslimat_surecinde: 2, tamamlanan: 1 },
  );
});

test("stat hesabı firma ve UTT kapsamı ile durum dışındaki liste filtrelerini uygular", () => {
  assert.match(kaynak, /match\(cekTakipTalepKapsami\(kapsam\)\)/);
  assert.match(kaynak, /filtreler\.eczane_id/);
  assert.match(kaynak, /filtreler\.kisi_id/);
  assert.match(kaynak, /filtreler\.urun_id/);
  assert.match(kaynak, /filtreler\.baslangic/);
  assert.match(kaynak, /filtreler\.bitis/);
  assert.doesNotMatch(kaynak, /filtreler\.durum/);
  assert.match(api, /cekTakipStatlariniGetir\(adminSupabase, erisim\.kapsam, filtreSonucu\.filtreler\)/);
});
