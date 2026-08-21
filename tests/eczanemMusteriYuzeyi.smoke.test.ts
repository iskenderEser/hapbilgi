// Müşteri yüzeyi tasarım ve izleme/indirim güvenlik sözleşmesi.
// Tavan: bir mutlu yol ve bir red senaryosu.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sayfa = readFileSync("app/eczanem/page.tsx", "utf8");
const oynatici = readFileSync("app/eczanem/_components/EczanemVideoOynatici.tsx", "utf8");
const kasa = readFileSync("app/eczanem/_components/EczanemKasa.tsx", "utf8");
const videolarRoute = readFileSync("app/eczanem/api/videolar/route.ts", "utf8");
const siparisRoute = readFileSync("app/eczanem/api/siparis/route.ts", "utf8");
const hesapRoute = readFileSync("app/eczanem/api/siparis/hesap/route.ts", "utf8");
const authProvider = readFileSync("app/providers/AuthProvider.tsx", "utf8");
const puanlar = readFileSync("app/eczanem/_components/EczanemPuanlarim.tsx", "utf8");
const puanlarRoute = readFileSync("app/eczanem/api/puanlar/route.ts", "utf8");

test("mutlu: müşteri videosunu Play ile başlatır ve puanını onaylı indirim talebine dönüştürür", () => {
  assert.match(sayfa, /HapBilgi Eczanem/);
  assert.match(sayfa, /videosunu sayfaya yerleştir/);
  assert.match(sayfa, /thumbnailUrlUret\(video\.video_url\)/);
  assert.match(sayfa, /video\.video_puani/);
  assert.match(sayfa, /video\.soru_sayisi/);
  assert.match(sayfa, /video\.soru_puani/);
  assert.match(kasa, /Puanla indirim/);
  assert.match(sayfa, /<EczanemPuanlarim/);
  assert.match(puanlar, /Puanlarım/);
  assert.match(puanlar, /İzlemeden kalan/);
  assert.match(puanlar, /Doğru cevaptan kalan/);
  assert.match(puanlar, /En yakın son kullanım/);
  assert.match(sayfa, /aria-label="Sayfayı yenile"/);
  assert.doesNotMatch(puanlar, /YenileButonu/);
  assert.doesNotMatch(kasa, /YenileButonu/);
  assert.match(puanlarRoute, /const grupAnahtari = \(eczaneId: string, urunId: string\)/);
  assert.doesNotMatch(authProvider, /`\$\{data\.ad\} \$\{data\.soyad\}`/);
  assert.match(oynatici, /ilkOynatmaZorunlu: true/);
  assert.match(oynatici, /handleOynat[\s\S]*\/eczanem\/api\/izleme\/baslat[\s\S]*oynat\(\)/);
  assert.match(kasa, /İndirim talebini eczanenize gönderelim mi/);
  assert.match(kasa, /Puanınız şimdi düşmez; eczaneniz onayladığında işlem kesinleşir/);
});

test("red: kart açılışı izleme yazamaz; API hatası boş veri ve kapsam dışı eczane başarılı görünemez", () => {
  assert.doesNotMatch(oynatici, /useEffect\([\s\S]{0,500}handleBaslat/);
  assert.match(sayfa, /!videoHazir && videoHatasi/);
  assert.match(kasa, /!veriHazir && veriHatasi/);
  assert.match(videolarRoute, /if \(yayinError\) return hataYaniti/);
  assert.match(videolarRoute, /video_puani, soru_puani, video_basi_soru_sayisi/);
  assert.match(siparisRoute, /\.in\("eczane_id", kimlik\.eczaneIdler!\)[\s\S]*\.in\("urun_id", izinliUrunIdler\)/);
  assert.match(siparisRoute, /if \(!kimlik\.eczaneIdler!\.includes\(eczane_id\)\) return rolHatasi/);
  assert.match(hesapRoute, /if \(!kimlik\.eczaneIdler!\.includes\(eczane_id\)\) return rolHatasi/);
  assert.match(puanlarRoute, /\.in\("eczane_id", eczaneIdler\)/);
  assert.match(puanlarRoute, /\.in\("firma_id", firmaIdler\)/);
  assert.match(puanlarRoute, /\.gte\("created_at", altSinir\)/);
  assert.doesNotMatch(puanlarRoute, /groupBy\(["']urun_id["']\)/);
});
