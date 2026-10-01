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
  const icerik = istemci.indexOf("takip içeriği");

  assert.ok(baslik >= 0 && baslik < stat);
  assert.ok(stat < kapsul);
  assert.ok(kapsul < icerik);
  assert.match(istemci, /useState<HediyeTakipTuru>\("cek"\)/);
});

test("geleneksel kapsül Çek Takip ve Sipariş Takip arasında geçiş sağlar", () => {
  assert.match(toggle, /key: "cek", label: "Çek Takip"/);
  assert.match(toggle, /key: "siparis", label: "Sipariş Takip"/);
  assert.match(toggle, /PeriyotButonlari<HediyeTakipTuru>/);
});

test("stat kartları seçilen takip türüne göre ayrı başlıklar taşır", () => {
  for (const etiket of ["Toplam Talep", "Onay Sürecinde", "Teslimat Sürecinde", "Sipariş Verilen", "İşlem Bekleyen", "Depoya İletilen"]) {
    assert.match(statlar, new RegExp(etiket));
  }
  assert.match(statlar, /takipTuru === "cek" \? CEK_STATLARI : SIPARIS_STATLARI/);
});
