import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const liste = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipListesi.tsx", "utf8");
const kart = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipKarti.tsx", "utf8");
const istemci = readFileSync("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx", "utf8");

test("ilk yükleme ayrı ve görünür bir durum olarak sunulur", () => {
  assert.match(istemci, /useState\(true\)/);
  assert.match(istemci, /setCekYukleniyor\(true\)/);
  assert.match(istemci, /setCekYukleniyor\(false\)/);
  assert.match(liste, /Çek talepleri yükleniyor/);
  assert.match(liste, /animate-spin/);
});

test("filtreli ve filtresiz boş sonuçlar farklı metinlerle anlatılır", () => {
  assert.match(istemci, /Object\.values\(cekFiltreleri\)\.some\(Boolean\)/);
  assert.match(liste, /Filtrelere uygun çek talebi bulunamadı/);
  assert.match(liste, /Henüz çek talebi bulunmuyor/);
  assert.match(liste, /Filtreleri değiştirerek yeniden deneyin/);
  assert.match(liste, /Oluşturulan çek talepleri burada görüntülenecek/);
});

test("401 ve 403 yanıtları genel API hatasından ayrılır", () => {
  assert.match(istemci, /yanit\.status === 401 \|\| yanit\.status === 403 \? "yetkisiz" : "api"/);
  assert.match(liste, /Bu alana erişim yetkiniz bulunmuyor/);
  assert.match(liste, /Çek talepleri yüklenemedi/);
});

test("API hatası yeniden deneme işlemini sunar", () => {
  assert.match(liste, /Yeniden Dene/);
  assert.match(liste, /tur === "api"/);
  assert.match(istemci, /onYenidenDene=\{\(\) => setYenilemeAnahtari\(\(deger\) => deger \+ 1\)\}/);
});

test("işlem sürerken masaüstü satırı ve mobil kart kilitlenir", () => {
  assert.match(liste, /const satirKilitli = islemdekiTalepId === talep\.talep_id/);
  assert.match(liste, /aria-busy=\{satirKilitli\}/);
  assert.match(liste, /opacity-70/);
  assert.match(kart, /aria-busy=\{islemde\}/);
  assert.match(kart, /disabled=\{islemde\}/);
});

test("liste ve işlem hataları aynı API hata durumuna bağlanır", () => {
  assert.match(istemci, /Daha fazla çek talebi alınamadı/);
  assert.match(istemci, /Çek talebi BM onayına gönderilemedi/);
  assert.match(istemci, /setCekHatasi\(\{/);
});
