import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(yol, "utf8");
const onkontrol = oku("scripts/sql/eclub_hediye_takip_test_verisi_onkontrol.sql");
const ekle = oku("scripts/sql/eclub_hediye_takip_test_verisi_ekle.sql");
const temizle = oku("scripts/sql/eclub_hediye_takip_test_verisi_temizle.sql");

const HEDEF_UTT = "765b6890-183f-4518-b887-07003ff5cdc7";

test("Hediye Takibi görünüm testi yalnız bilinen UTT ve 111 test eczanesi kapsamındadır", () => {
  for (const kaynak of [onkontrol, ekle, temizle]) assert.match(kaynak, new RegExp(HEDEF_UTT));
  assert.match(onkontrol, /em\.kaynak = 'test'/);
  assert.match(onkontrol, /em\.gln LIKE '111%'/);
  assert.match(ekle, /em\.kaynak = 'test'/);
  assert.match(ekle, /em\.gln LIKE '111%'/);
  assert.match(ekle, /eclub_eczane_depolari_hazir/);
});

test("test yayını gerçek görünen ürün ve talep kimlikleri hazır olan kayıttan seçilir", () => {
  for (const kaynak of [onkontrol, ekle]) {
    assert.match(kaynak, /u\.gorunen_urun_id/);
    assert.match(kaynak, /k\.talep_no IS NOT NULL/);
    assert.match(kaynak, /f\.firma_adi/);
  }
  assert.doesNotMatch(ekle, /INSERT INTO public\.urunler/);
  assert.doesNotMatch(ekle, /INSERT INTO public\.talepler/);
});

test("sekiz sabit talep bütün çek ve sipariş görünüm durumlarını örnekler", () => {
  const idler = [...ekle.matchAll(/'e1100000-0000-4000-8000-00000000000[1-8]'/g)].map((x) => x[0]);
  assert.ok(new Set(idler).size === 8);
  for (const durum of [
    "beklemede", "bm_onayinda", "tm_onayinda", "onaylandi",
    "teslimat_bekliyor", "cek_kodlari_gonderildi", "iptal",
  ]) assert.match(ekle, new RegExp(`'${durum}'`));
  assert.match(ekle, /eclub_siparis_utt_onaylari/);
  assert.match(ekle, /depo_tercihleri_snapshot/);
});

test("sekiz talep üç eczane ve üç farklı ürün arasında dağıtılır", () => {
  assert.match(ekle, /cardinality\(v_eczane_idleri\), 0\) <> 3/);
  assert.match(ekle, /cardinality\(v_yayin_idleri\), 0\) <> 3/);
  assert.match(ekle, /DISTINCT ON \(k\.urun_id\)/);
  for (const sira of [1, 2, 3]) {
    assert.match(ekle, new RegExp(`v_eczane_idleri\\[${sira}\\]`));
    assert.match(ekle, new RegExp(`v_yayin_idleri\\[${sira}\\]`));
  }
  assert.match(onkontrol, /test_paketi_calistirilabilir/);
  assert.match(onkontrol, /cekli_urun_sayisi/);
});

test("iki ek test eczanesi sabit GLN ile oluşturulur ve temizlikte kaldırılır", () => {
  for (const gln of ["1119000000001", "1119000000002"]) {
    assert.match(ekle, new RegExp(gln));
    assert.match(temizle, new RegExp(gln));
  }
  assert.match(ekle, /INSERT INTO public\.eclub_eczane_master/);
  assert.match(ekle, /INSERT INTO public\.eclub_eczaneler/);
  assert.match(ekle, /INSERT INTO public\.eclub_eczane_firma/);
  assert.match(ekle, /INSERT INTO public\.eclub_utt_eczane/);
  assert.match(ekle, /INSERT INTO public\.eclub_eczane_depo_tercihleri/);
  assert.match(ekle, /INSERT INTO public\.eclub_kisi_eczane/);
  assert.match(temizle, /DELETE FROM public\.eclub_eczane_master/);
});

test("test verisi gerçek iş akışı ve bildirim RPC'lerini çalıştırmaz", () => {
  assert.doesNotMatch(ekle, /\.rpc\(/);
  assert.doesNotMatch(ekle, /eclub_store_bm_onayina_gonder\s*\(/);
  assert.doesNotMatch(ekle, /eclub_store_bm_onayla\s*\(/);
  assert.doesNotMatch(ekle, /eclub_store_tm_onayla\s*\(/);
  assert.doesNotMatch(ekle, /eclub_store_admin_kod_teslim\s*\(/);
  assert.doesNotMatch(ekle, /INSERT INTO public\.eclub_bildirimler/);
});

test("bekleyen outbox örnekleri worker tarafından sahiplenilemez", () => {
  assert.match(ekle, /'bekliyor', 1, 1, '2099-12-31 00:00:00\+03'/);
  assert.match(ekle, /deneme_sayisi=max_deneme/);
  assert.doesNotMatch(ekle, /'bekliyor', 0, [1-9]/);
});

test("temizlik yalnız sabit test talep zincirini çocuklardan ebeveyne kaldırır", () => {
  const siparis = temizle.indexOf("DELETE FROM public.eclub_siparis_utt_onaylari");
  const outbox = temizle.indexOf("DELETE FROM public.eclub_cek_teslimat_outbox");
  const talepler = temizle.indexOf("DELETE FROM public.eclub_store_cek_talepleri");
  assert.ok(siparis >= 0 && siparis < talepler);
  assert.ok(outbox >= 0 && outbox < talepler);
  assert.match(temizle, /t\.donem_kodu NOT IN/);
  assert.doesNotMatch(temizle, /DELETE FROM public\.kullanicilar/);
  assert.match(temizle, /DELETE FROM public\.eclub_eczaneler e\s+WHERE e\.gln IN \('1119000000001', '1119000000002'\)/);
  assert.doesNotMatch(temizle, /DELETE FROM public\.yayin_yonetimi/);
  assert.doesNotMatch(temizle, /DELETE FROM public\.eclub_kazanilan_puanlar/);
});
