import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { siparisTakipDurumu, siparisTakipStatlariniHesapla } from "../lib/eclub/hediyeTakip/siparisTakip.ts";
import { siparisTakipFiltreleriniParseEt } from "../lib/eclub/hediyeTakip/siparisTakipFiltreleri.ts";
import { depoOzetParcalari } from "../lib/eclub/depo.ts";

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
    toplam: 3, inceleme_bekliyor: 1, utt_onayladi: 1, bm_onayladi: 0, talep_iptal: 1,
  });
});

test("sipariş filtreleri geçersiz tarih, durum ve sayfalamayı reddeder", () => {
  assert.equal(siparisTakipFiltreleriniParseEt(new URLSearchParams()).ok, true);
  for (const sorgu of ["durum=depoya_iletildi", "baslangic=2026-02-30", "offset=-1", "limit=101", "eczane_id=x"]) {
    assert.equal(siparisTakipFiltreleriniParseEt(new URLSearchParams(sorgu)).ok, false);
  }
});

test("BM onayı UTT kontrolünden sonra ayrı aşamadır; çek aşaması sipariş onayı sayılmaz", () => {
  const tarih = "2026-10-04T12:00:00Z";
  assert.equal(siparisTakipDurumu("onaylandi", null), "inceleme_bekliyor");
  assert.equal(siparisTakipDurumu("tm_onayinda", tarih), "utt_onayladi");
  assert.equal(siparisTakipDurumu("beklemede", tarih, tarih), "bm_onayladi");
  assert.equal(siparisTakipDurumu("iptal", tarih, tarih), "talep_iptal");
  assert.equal(siparisTakipDurumu("beklemede", null, tarih), "inceleme_bekliyor");
  assert.deepEqual(siparisTakipStatlariniHesapla(["inceleme_bekliyor", "utt_onayladi", "bm_onayladi", "talep_iptal"]), {
    toplam: 4, inceleme_bekliyor: 1, utt_onayladi: 1, bm_onayladi: 1, talep_iptal: 1,
  });
  assert.equal(siparisTakipFiltreleriniParseEt(new URLSearchParams("durum=bm_onayladi")).ok, true);
});

test("BM sipariş SQL'i kapsam, UTT önkoşulu ve tek onayı korur; çek durumunu değiştirmez", () => {
  const bmSql = oku("scripts/sql/eclub_siparis_bm_onay.sql");
  assert.match(bmSql, /bm\.firma_id = t\.firma_id/);
  assert.match(bmSql, /bm\.takim_id = utt\.takim_id AND bm\.bolge_id = utt\.bolge_id/);
  assert.match(bmSql, /FOR UPDATE OF t/);
  assert.match(bmSql, /s\.utt_id = v_talep\.utt_id FOR UPDATE/);
  assert.match(bmSql, /talep_id uuid PRIMARY KEY REFERENCES public\.eclub_siparis_utt_onaylari/);
  assert.match(bmSql, /v_talep\.durum = 'iptal'/);
  assert.doesNotMatch(bmSql, /UPDATE public\.eclub_store_cek_talepleri/);
  assert.match(bmSql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
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

test("arayüz gerçek depo ve şube verisini ayrı sütunlarda gösterir, teslim edildiğini iddia etmez", () => {
  assert.match(istemci, /api\/siparis-takip/);
  assert.match(istemci, /onStatlar\(yeni\.statlar\)/);
  assert.match(arayuz, /Siparişi Onayla/);
  assert.match(arayuz, /baslik: 'Depo'/);
  assert.match(arayuz, /baslik: 'Şube'/);
  assert.match(arayuz, /depoOzetParcalari\(tercih\)/);
  assert.doesNotMatch(arayuz, /tercih\.il|tercih\.ilce|tercih\.adres/);
  assert.match(arayuz, /talep\.depo_tercihleri\.map/);
  assert.match(arayuz, /TercihListesi satirlar=\{depoSatirlari\} alan="depo"/);
  assert.match(arayuz, /TercihListesi satirlar=\{depoSatirlari\} alan="sube"/);
  assert.match(liste, /depo_tercihleri:/);
  assert.match(liste, /depo_tercih_detaylari:/);
  assert.match(liste, /depo_adi: depo\.depo_adi/);
  assert.match(liste, /sube_adi: depo\.sube_adi/);
  assert.doesNotMatch(arayuz, /Depoya iletildi|Teslim edildi/);
});

test("sipariş tablosu çek takibiyle ortak bilgi başlıklarını ayrı sütunlarda kullanır", () => {
  for (const baslik of [
    "Talep Tarihi", "Dönem", "Ürün Adı", "Öğrenme Aracı", "Sipariş Tercihi", "Satış Koşulu",
    "Talep Eden Eczane", "Kullanılan Puan", "Çek Tutarı", "Depo", "Şube",
    "Sipariş Durumu", "İşlem",
  ]) {
    assert.match(arayuz, new RegExp(`baslik: '${baslik}'`));
  }
  assert.match(arayuz, /talep\.urun\.gorunen_urun_id/);
  assert.match(arayuz, /talep\.ogrenme_araci\.gorunen_talep_id/);
  assert.match(arayuz, /siparisTercihi\(talep\)/);
  assert.match(arayuz, /"Zorunlu" : "Tercihli"/);
  assert.match(arayuz, /function SiparisDurumu/);
  assert.match(arayuz, /talep\.utt_onay_tarihi[\s\S]*Onaylandı/);
  assert.doesNotMatch(arayuz, /`Onay: \$\{tarih\(talep\.utt_onay_tarihi\)\}`/);
  assert.match(arayuz, /\(uttGoster \|\| saltOkunur\) && <td[^>]*><SiparisDurumu/);
  assert.match(arayuz, /!saltOkunur && <td[^>]*><OnayButonu/);
  assert.match(liste, /v_yayin_kunye \( urun_id, arac_turu \)/);
  assert.match(liste, /v_yayin_detay/);
  assert.match(liste, /gorunen_urun_id/);
  assert.match(liste, /talepIdGoster/);
  assert.doesNotMatch(arayuz, /hour:|minute:/);
});

test("sipariş tablosu UTT kayıtlı eczane listesindeki depo ve şube özetini kullanır", () => {
  assert.deepEqual(depoOzetParcalari({
    depo_adi: "ÇAM ECZA DEPOSU SAĞLIK VE EĞİTİM HİZM. NAK. İNŞ. SAN. TİC. A.Ş.",
    sube_adi: "ANKARA ŞUBESİ",
    il: "Ankara",
  }), { depo: "Çam Ecza", sube: "Ankara Şube" });
  assert.deepEqual(depoOzetParcalari({ depo_adi: "ALLIANCE HEALTHCARE", sube_adi: null, il: "İstanbul" }), {
    depo: "Alliance",
    sube: null,
  });
});
