import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const toggle = readFileSync("app/(panel)/eclub/hediye-takip/_components/HediyeTakipToggle.tsx", "utf8");
const filtreler = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipFiltreleri.tsx", "utf8");
const kart = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipKarti.tsx", "utf8");
const liste = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipListesi.tsx", "utf8");
const istemci = readFileSync("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx", "utf8");

test("takip toggle'ı sekme semantiği, aria-selected ve klavye dolaşımı kullanır", () => {
  assert.match(toggle, /role="tablist"/);
  assert.match(toggle, /role="tab"/);
  assert.match(toggle, /aria-selected=\{aktif\}/);
  assert.match(toggle, /tabIndex=\{aktif \? 0 : -1\}/);
  for (const tus of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
    assert.match(toggle, new RegExp(`event\\.key === "${tus}"`));
  }
  assert.match(istemci, /role="tabpanel"/);
  assert.match(istemci, /aria-labelledby=/);
});

test("altı filtre etiketi kendi form alanına açıkça bağlıdır", () => {
  for (const id of ["eczane", "uye", "urun", "durum", "baslangic", "bitis"]) {
    assert.match(filtreler, new RegExp(`htmlFor="cek-takip-${id}"`));
    assert.match(filtreler, new RegExp(`id="cek-takip-${id}"`));
  }
});

test("talep durumu renk dışında görünür metin ve erişilebilir ad taşır", () => {
  assert.match(kart, /Talep durumu: \$\{meta\.etiket\}/);
  assert.match(kart, />\s*\{meta\.etiket\}\s*</);
});

test("aynı işlem eşzamanlı ikinci kez başlatılamaz", () => {
  assert.match(istemci, /const islemKilidi = useRef<string \| null>\(null\)/);
  assert.match(istemci, /if \(islemKilidi\.current \|\| islem !== "bm_onayina_gonder"\) return/);
  assert.match(istemci, /islemKilidi\.current = talepId/);
  assert.match(istemci, /islemKilidi\.current = null/);
  assert.match(kart, /disabled=\{islemde\}/);
});

test("mobil liste yatay taşmayı ve uzun adların yerleşimi bozmasını engeller", () => {
  assert.match(istemci, /overflow-x-hidden/);
  assert.match(liste, /grid min-w-0 grid-cols-1[\s\S]*?overflow-hidden[\s\S]*?lg:hidden/);
  assert.match(kart, /min-w-0 max-w-full overflow-hidden/);
  assert.match(kart, /\[overflow-wrap:anywhere\]/);
  assert.match(kart, /break-words/);
});
