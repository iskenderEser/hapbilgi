import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { siparisTakipDurumu, siparisTakipStatlariniHesapla } from "../lib/eclub/hediyeTakip/siparisTakip.ts";
import { siparisTakipFiltreleriniParseEt } from "../lib/eclub/hediyeTakip/siparisTakipFiltreleri.ts";

const oku = (yol: string) => readFileSync(yol, "utf8");
const liste = oku("lib/eclub/hediyeTakip/siparisTakipListesi.ts");
const api = oku("app/(panel)/eclub/hediye-takip/api/siparis-takip/route.ts");
const onay = oku("app/(panel)/eclub/hediye-takip/api/siparis-takip/[talepId]/route.ts");
const sql = oku("scripts/sql/eclub_siparis_utt_takip.sql");
const istemci = oku("app/(panel)/eclub/hediye-takip/_components/SiparisTakipIstemcisi.tsx");
const arayuz = oku("app/(panel)/eclub/hediye-takip/_components/SiparisTakipListesi.tsx");

test("sipariş durumu çek onay basamağından değil UTT onayından türetilir", () => {
  assert.equal(siparisTakipDurumu("bm_onayinda", null), "inceleme_bekliyor");
  assert.equal(siparisTakipDurumu("beklemede", "2026-10-01T12:00:00Z"), "utt_onayladi");
  assert.equal(siparisTakipDurumu("iptal", "2026-10-01T12:00:00Z"), "talep_iptal");
  assert.deepEqual(siparisTakipStatlariniHesapla(["inceleme_bekliyor", "utt_onayladi", "talep_iptal"]), {
    toplam: 3, inceleme_bekliyor: 1, utt_onayladi: 1, talep_iptal: 1,
  });
});

test("sipariş filtreleri geçersiz tarih, durum ve sayfalamayı reddeder", () => {
  assert.equal(siparisTakipFiltreleriniParseEt(new URLSearchParams()).ok, true);
  for (const sorgu of ["durum=depoya_iletildi", "baslangic=2026-02-30", "offset=-1", "limit=101", "eczane_id=x"]) {
    assert.equal(siparisTakipFiltreleriniParseEt(new URLSearchParams(sorgu)).ok, false);
  }
});

test("liste yalnız verilmiş siparişleri firma ve UTT kapsamında alır", () => {
  assert.match(liste, /match\(cekTakipTalepKapsami\(kapsam\)\)/);
  assert.match(liste, /eq\("siparis_verildi_mi", true\)/);
  assert.match(liste, /neq\("siparis_tipi", "siparissiz_cek"\)/);
  assert.match(liste, /eclub_siparis_utt_onaylari/);
  assert.match(api, /cekTakipKapsaminiCoz\(admin, user\.id\)/);
});

test("UTT onayı ayrı ve atomiktir; mükerrer onay engellenir", () => {
  assert.match(onay, /body\?\.islem !== "utt_onayla"/);
  assert.match(onay, /eclub_siparis_utt_onayla/);
  assert.match(sql, /talep_id uuid PRIMARY KEY/);
  assert.match(sql, /FOR UPDATE OF t/);
  assert.match(sql, /t\.utt_id = p_utt_id/);
  assert.match(sql, /siparis_verildi_mi/);
  assert.match(sql, /v_talep\.durum = 'iptal'/);
  assert.match(sql, /eclub_eczane_depolari_hazir/);
  assert.doesNotMatch(sql, /bm_onayina_gonder|bm_id|bildirim/);
});

test("arayüz gerçek veriyi gösterir, depoya teslim edildiğini iddia etmez", () => {
  assert.match(istemci, /api\/siparis-takip/);
  assert.match(istemci, /onStatlar\(yeni\.statlar\)/);
  assert.match(arayuz, /Siparişi Onayla/);
  assert.match(arayuz, /Güncel depo \/ şube tercihleri/);
  assert.doesNotMatch(arayuz, /Depoya iletildi|Teslim edildi/);
});
