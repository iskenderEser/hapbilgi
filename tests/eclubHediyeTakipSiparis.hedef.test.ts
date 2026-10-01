import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { siparisTakipDurumunuCoz, siparisTakipStatlariniHesapla } from "@/lib/eclub/hediyeTakip/siparisTakip";
import { siparisTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/siparisTakipFiltreleri";

const oku = (path: string) => readFileSync(path, "utf8");
const api = oku("app/(panel)/eclub/hediye-takip/api/siparis-takip/route.ts");
const liste = oku("app/(panel)/eclub/hediye-takip/_components/SiparisTakipListesi.tsx");
const istemci = oku("app/(panel)/eclub/hediye-takip/_components/SiparisTakipIstemcisi.tsx");
const filtreler = oku("app/(panel)/eclub/hediye-takip/_components/SiparisTakipFiltreleri.tsx");
const sorgu = oku("lib/eclub/hediyeTakip/siparisTakipListesi.ts");

test("Sipariş Takip kanonik çek durumlarını sipariş durumlarına çözer", () => {
  assert.equal(siparisTakipDurumunuCoz("beklemede"), "onay_bekliyor");
  assert.equal(siparisTakipDurumunuCoz("bm_onayinda"), "depo_surecinde");
  assert.equal(siparisTakipDurumunuCoz("onaylandi"), "teslimat_bekliyor");
  assert.equal(siparisTakipDurumunuCoz("cek_kodlari_gonderildi"), "tamamlandi");
  assert.equal(siparisTakipDurumunuCoz("iptal"), "iptal");
  assert.deepEqual(siparisTakipStatlariniHesapla(["onay_bekliyor", "depo_surecinde", "teslimat_bekliyor", "tamamlandi", "iptal"]), { toplam: 5, onay_bekliyor: 1, depo_surecinde: 1, teslimat_bekliyor: 1, tamamlandi: 1 });
});

test("Sipariş Takip filtreleri ve API'si Çek Takip state'inden ayrıdır", () => {
  assert.equal(siparisTakipFiltreleriniParseEt(new URLSearchParams("durum=depo_surecinde&offset=30&limit=30")).ok, true);
  assert.equal(siparisTakipFiltreleriniParseEt(new URLSearchParams("durum=gecersiz")).ok, false);
  assert.match(api, /siparisTakipFiltreleriniParseEt/);
  assert.match(api, /siparisTakipVerisiniGetir/);
  assert.match(istemci, /BOS_SIPARIS_TAKIP_FILTRELERI/);
});

test("Sipariş listesi depo/şube tercihlerini ve UTT görevini masaüstü ve mobilde gösterir", () => {
  assert.match(sorgu, /eclub_eczane_depo_tercihleri/);
  assert.match(sorgu, /ecza_depo_subeleri/);
  assert.match(liste, /Depo tercihlerini kontrol et/);
  assert.match(liste, /lg:block/);
  assert.match(liste, /lg:hidden/);
  for (const durum of ["onay_bekliyor", "depo_surecinde", "teslimat_bekliyor", "tamamlandi", "iptal"]) assert.match(liste, new RegExp(durum));
  for (const id of ["eczane", "urun", "durum", "baslangic", "bitis"]) assert.match(filtreler, new RegExp(`id=\"siparis-takip-${id}\"`));
});
