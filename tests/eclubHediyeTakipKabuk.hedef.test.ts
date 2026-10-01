import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(yol, "utf8");
const istemci = oku("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx");
const toggle = oku("app/(panel)/eclub/hediye-takip/_components/HediyeTakipToggle.tsx");
const statlar = oku("app/(panel)/eclub/hediye-takip/_components/TakipStatKartlari.tsx");

test("Hediye Takip kabuğu başlık, stat kartları, toggle ve içerik sırasını korur", () => {
  const baslik = istemci.indexOf("<header>");
  const stat = istemci.indexOf("<TakipStatKartlari");
  const kapsul = istemci.indexOf("<HediyeTakipToggle");
  const filtreler = istemci.indexOf("<CekTakipFiltreleri");
  const liste = istemci.indexOf("<CekTakipListesi");

  assert.ok(baslik >= 0 && baslik < stat);
  assert.ok(stat < kapsul);
  assert.ok(kapsul < filtreler);
  assert.ok(filtreler < liste);
  assert.match(istemci, /useState<HediyeTakipTuru>\("cek"\)/);
});

test("toggle iki seçeneği gösterir; sipariş tarafı ayrı istemciye bağlıdır", () => {
  assert.match(istemci, />Hediye Takibi</);
  assert.match(toggle, /key: "cek", label: "Çek Takibi"/);
  assert.match(toggle, /key: "siparis", label: "Sipariş Takibi"/);
  assert.match(istemci, /<SiparisTakipIstemcisi onStatlar=\{setSiparisStatlari\}/);
});

test("stat kartları iki takip türünün doğrulanabilir durumlarını gösterir", () => {
  for (const etiket of ["Toplam Talep", "Onay Sürecinde", "Teslimat Sürecinde", "Tamamlanan"]) {
    assert.match(statlar, new RegExp(etiket));
  }
  for (const etiket of ["Sipariş Verilen", "UTT İncelemesi Bekliyor", "UTT Onayladı", "Çek Talebi İptal"]) {
    assert.match(statlar, new RegExp(etiket));
  }
  assert.doesNotMatch(statlar, /Depoya İletilen|Hedef depoya aktarılanlar/);
  assert.match(statlar, /siparisStatlari\.utt_onayladi/);
  assert.match(istemci, /<TakipStatKartlari takipTuru=\{takipTuru\}/);
});
