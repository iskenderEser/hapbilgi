// Müşteri ana sayfası rafları ile Puanlarım çift taraflı onay sözleşmesi.
// Tavan: iki mutlu yol ve bir red senaryosu.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sayfa = readFileSync("app/eczanem/page.tsx", "utf8");
const navbar = readFileSync("app/eczanem/_components/EczanemMusteriNavbar.tsx", "utf8");
const raf = readFileSync("app/eczanem/_components/EczanemVideoRafi.tsx", "utf8");
const oynatici = readFileSync("app/eczanem/_components/EczanemVideoOynatici.tsx", "utf8");
const videolarRoute = readFileSync("app/eczanem/api/videolar/route.ts", "utf8");
const ilerlemeRoute = readFileSync("app/eczanem/api/izleme/ilerleme/route.ts", "utf8");
const etkilesimRoute = readFileSync("app/eczanem/api/etkilesim/route.ts", "utf8");
const etkilesimSql = readFileSync("scripts/sql/eczanem_musteri_video_etkilesimleri.sql", "utf8");
const puanSayfasi = readFileSync("app/eczanem/puanlarim/page.tsx", "utf8");
const puanlar = readFileSync("app/eczanem/_components/EczanemPuanlarim.tsx", "utf8");
const puanlarRoute = readFileSync("app/eczanem/api/puanlar/route.ts", "utf8");
const siparisRoute = readFileSync("app/eczanem/api/siparis/route.ts", "utf8");
const hesapRoute = readFileSync("app/eczanem/api/siparis/hesap/route.ts", "utf8");

test("mutlu: müşteri ana sayfası belirlenen altı dijital kanal rafını ve ayrı Puanlarım sayfasını sunar", () => {
  const basliklar = [
    "Yeni Öğrenme İçeriklerim",
    "Yarım Bıraktıklarım",
    "En Son Tamamladıklarım",
    "En Çok Beğenilenler",
    "En Çok Favorilenenler",
    "En Çok Tamamlananlar",
  ];
  for (const baslik of basliklar) assert.match(sayfa, new RegExp(`baslik=\"${baslik}\"`));

  assert.match(sayfa, /video\.izleme_basladi && !video\.izlendi/);
  assert.match(sayfa, /puanaGore\("begeni_sayisi"\)/);
  assert.match(sayfa, /puanaGore\("favori_sayisi"\)/);
  assert.match(sayfa, /puanaGore\("izlenme_sayisi"\)/);
  assert.match(raf, /içeriğini sayfaya yerleştir/);
  assert.match(raf, /onBegeni/);
  assert.match(raf, /onFavori/);
  assert.match(raf, /video\.video_puani/);
  assert.match(raf, /video\.soru_sayisi/);
  assert.match(raf, /video\.soru_puani/);
  assert.match(raf, /Her Doğru/);
  assert.match(raf, /son_konum_saniye/);
  assert.match(oynatici, /\/eczanem\/api\/izleme\/ilerleme/);
  assert.match(oynatici, /setCurrentTime\(kaldigiKonum\)/);
  assert.match(oynatici, /maxIzlenenRef/);
  assert.match(oynatici, /player\.onSeeked/);
  assert.match(oynatici, /current > maxIzlenenRef\.current \+ 1/);
  assert.match(oynatici, /Kayıt yalnız yukarıdaki başlatma düğmesine bastığınızda başlar/);
  assert.match(oynatici, /İçeriği tamamladığınızda puanınız otomatik eklenir/);
  assert.doesNotMatch(oynatici, /if \(!res\.ok\)[\s\S]{0,320}izlemeBitirildiRef\.current = false/);
  assert.match(ilerlemeRoute, /\.eq\("musteri_id", kimlik\.musteriId!\)/);
  assert.match(ilerlemeRoute, /\.eq\("tamamlandi_mi", false\)/);
  assert.match(navbar, /href: "\/eczanem\/puanlarim", etiket: "Puanlarım"/);
  assert.match(puanSayfasi, /<EczanemPuanlarim/);
  assert.doesNotMatch(sayfa, /<EczanemPuanlarim/);

  assert.match(videolarRoute, /get_eczanem_musteri_video_etkilesimleri/);
  assert.match(videolarRoute, /\.eq\("musteri_id", musteriId\)[\s\S]*\.in\("eczane_id", aktifEczaneIdler\)/);
  assert.match(etkilesimRoute, /Bu öğrenme yayını size gönderilmemiş/);
  assert.match(etkilesimSql, /CREATE TABLE IF NOT EXISTS public\.eczanem_video_begeniler/);
  assert.match(etkilesimSql, /CREATE TABLE IF NOT EXISTS public\.eczanem_video_favoriler/);
  assert.match(etkilesimSql, /pg_advisory_xact_lock/);
  assert.match(etkilesimSql, /ADD COLUMN IF NOT EXISTS son_konum_saniye/);
});

test("mutlu: ürün puanı 1 kutuluk talebe dönüşür, onayda kullanılan puanlara taşınır", () => {
  assert.match(puanlar, /Ürün \/ Barkod/);
  assert.match(puanlar, /İzleme/);
  assert.match(puanlar, /Cevaplama/);
  assert.match(puanlar, /Toplam Puan/);
  assert.match(puanlar, /İndirim/);
  assert.match(puanlar, /Puanı Kullan/);
  assert.match(puanlar, /Kullanılan Puanlar/);
  assert.match(puanlar, /adet: 1/);
  assert.match(puanlar, /puanınız eczane onaylayana kadar düşmez/);
  assert.match(puanlarRoute, /indirimHesapla\(ozet\.kullanilabilir_puan/);
  assert.match(puanlarRoute, /siparis\.durum === "onaylandi"/);
  assert.match(siparisRoute, /İndirim talebi gönderildi — eczane onayı bekleniyor/);
});

test("red: kart açılışı izleme yazamaz; kapsam dışı talep ve belirsiz durum dili geri gelemez", () => {
  assert.doesNotMatch(oynatici, /useEffect\([\s\S]{0,500}handleBaslat/);
  assert.match(oynatici, /ilkOynatmaZorunlu: true/);
  assert.match(oynatici, /handleOynat[\s\S]*\/eczanem\/api\/izleme\/baslat[\s\S]*oynat\(\)/);
  assert.match(videolarRoute, /if \(yayinError\) return hataYaniti/);
  assert.match(siparisRoute, /\.in\("eczane_id", kimlik\.eczaneIdler!\)[\s\S]*\.in\("urun_id", izinliUrunIdler\)/);
  assert.match(siparisRoute, /if \(!kimlik\.eczaneIdler!\.includes\(eczane_id\)\) return rolHatasi/);
  assert.match(hesapRoute, /if \(!kimlik\.eczaneIdler!\.includes\(eczane_id\)\) return rolHatasi/);
  assert.match(puanlarRoute, /\.in\("eczane_id", eczaneIdler\)/);
  assert.match(puanlarRoute, /\.in\("firma_id", firmaIdler\)/);
  assert.match(puanlarRoute, /\.gte\("created_at", altSinir\)/);
  assert.match(puanlar, /Onaylanmadı/);
  assert.match(puanlar, /İptal Edildi/);
  assert.doesNotMatch([sayfa, navbar, raf, puanSayfasi, puanlar].join("\n"), /Düştü|Reddedildi|Reddedilen\/Düşen/);
});
