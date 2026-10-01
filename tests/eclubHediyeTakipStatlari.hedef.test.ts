import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CEK_TAKIP_ONAY_SURECI_TALEP_DURUMLARI,
  CEK_TAKIP_TAMAMLANAN_TALEP_DURUMLARI,
  CEK_TAKIP_TESLIMAT_SURECI_TALEP_DURUMLARI,
  cekTakipStatGrubu,
} from "@/lib/eclub/hediyeTakip/cekTakipStatlari";

const kaynak = readFileSync("lib/eclub/hediyeTakip/cekTakipStatlari.ts", "utf8");

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
  assert.match(kaynak, /kapsamliTalepSayisi\(adminSupabase, kapsam\)/);
});

test("her stat sorgusu 5. adımdaki firma ve UTT kapsamını uygular", () => {
  assert.match(kaynak, /match\(cekTakipTalepKapsami\(kapsam\)\)/);
  assert.match(kaynak, /count: "exact", head: true/);
  assert.match(kaynak, /Promise\.all/);
});
