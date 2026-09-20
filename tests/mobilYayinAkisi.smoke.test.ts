import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MobilYayinAkisi, { hesaplaMobilYayinGorunumu } from "@/components/yayin/MobilYayinAkisi";

interface OrnekKayit {
  id: string;
  baslik: string;
}

test("hesaplaMobilYayinGorunumu: 0 kayıt durumunda devam düğmesi üretmez ve kalan sıfırdır", () => {
  const sonuc = hesaplaMobilYayinGorunumu(0, 2, 5);
  assert.equal(sonuc.gorunenSayisi, 0);
  assert.equal(sonuc.kalanSayisi, 0);
  assert.equal(sonuc.acilacakSayi, 0);
  assert.equal(sonuc.devamDugmesiGoster, false);
});

test("hesaplaMobilYayinGorunumu: 1 kayıt durumunda 1 görünür, devam düğmesi üretmez", () => {
  const sonuc = hesaplaMobilYayinGorunumu(1, 2, 5);
  assert.equal(sonuc.gorunenSayisi, 1);
  assert.equal(sonuc.kalanSayisi, 0);
  assert.equal(sonuc.acilacakSayi, 0);
  assert.equal(sonuc.devamDugmesiGoster, false);
});

test("hesaplaMobilYayinGorunumu: 2 kayıt durumunda 2 görünür, devam düğmesi üretmez", () => {
  const sonuc = hesaplaMobilYayinGorunumu(2, 2, 5);
  assert.equal(sonuc.gorunenSayisi, 2);
  assert.equal(sonuc.kalanSayisi, 0);
  assert.equal(sonuc.acilacakSayi, 0);
  assert.equal(sonuc.devamDugmesiGoster, false);
});

test("hesaplaMobilYayinGorunumu: 3 kayıt durumunda önce 2 görünür, düğmede +1 ve kalan 1 çıkar", () => {
  const ilk = hesaplaMobilYayinGorunumu(3, 2, 5);
  assert.equal(ilk.gorunenSayisi, 2);
  assert.equal(ilk.kalanSayisi, 1);
  assert.equal(ilk.acilacakSayi, 1);
  assert.equal(ilk.devamDugmesiGoster, true);

  // 1 tıklama sonra (2 + 5 = 7 kota)
  const tiklandi = hesaplaMobilYayinGorunumu(3, 7, 5);
  assert.equal(tiklandi.gorunenSayisi, 3);
  assert.equal(tiklandi.kalanSayisi, 0);
  assert.equal(tiklandi.devamDugmesiGoster, false);
});

test("hesaplaMobilYayinGorunumu: 7 kayıt durumunda önce 2 görünür, tek tıklamada 7'ye ulaşır", () => {
  const ilk = hesaplaMobilYayinGorunumu(7, 2, 5);
  assert.equal(ilk.gorunenSayisi, 2);
  assert.equal(ilk.kalanSayisi, 5);
  assert.equal(ilk.acilacakSayi, 5);
  assert.equal(ilk.devamDugmesiGoster, true);

  // 1 tıklama sonra
  const tiklandi = hesaplaMobilYayinGorunumu(7, 7, 5);
  assert.equal(tiklandi.gorunenSayisi, 7);
  assert.equal(tiklandi.kalanSayisi, 0);
  assert.equal(tiklandi.devamDugmesiGoster, false);
});

test("hesaplaMobilYayinGorunumu: 8 kayıt durumunda 2 -> 7 -> 8 adım zinciri eksiksiz çalışır", () => {
  const ilk = hesaplaMobilYayinGorunumu(8, 2, 5);
  assert.equal(ilk.gorunenSayisi, 2);
  assert.equal(ilk.kalanSayisi, 6);
  assert.equal(ilk.acilacakSayi, 5);
  assert.equal(ilk.devamDugmesiGoster, true);

  // İlk tıklama (2 + 5 = 7)
  const adim1 = hesaplaMobilYayinGorunumu(8, 7, 5);
  assert.equal(adim1.gorunenSayisi, 7);
  assert.equal(adim1.kalanSayisi, 1);
  assert.equal(adim1.acilacakSayi, 1);
  assert.equal(adim1.devamDugmesiGoster, true);

  // İkinci tıklama (7 + 5 = 12 kota, toplam 8)
  const adim2 = hesaplaMobilYayinGorunumu(8, 12, 5);
  assert.equal(adim2.gorunenSayisi, 8);
  assert.equal(adim2.kalanSayisi, 0);
  assert.equal(adim2.acilacakSayi, 0);
  assert.equal(adim2.devamDugmesiGoster, false);
});

test("hesaplaMobilYayinGorunumu: negatif veya sınır dışı değerlerde güvenli kalır", () => {
  const sonuc = hesaplaMobilYayinGorunumu(-5, -2, 5);
  assert.equal(sonuc.gorunenSayisi, 0);
  assert.equal(sonuc.kalanSayisi, 0);
  assert.equal(sonuc.acilacakSayi, 0);
  assert.equal(sonuc.devamDugmesiGoster, false);
});

test("MobilYayinAkisi: 0 kayıtta özel boş durumu render eder ve devam butonu üretmez", () => {
  const html = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: [],
      kayitAnahtari: (k) => k.id,
      renderKart: (k) => createElement("div", { className: "kart" }, k.baslik),
      baslik: "Test Başlığı",
      bosDurum: createElement("p", { className: "ozel-bos" }, "Hiç içerik yok"),
    }),
  );

  assert.match(html, /Test Başlığı/);
  assert.match(html, /ozel-bos/);
  assert.match(html, /Hiç içerik yok/);
  assert.doesNotMatch(html, /Daha Fazla Göster/);
});

test("MobilYayinAkisi: 5 kayıtta DOM'a yalnızca ilk 2 kart basılır, gizli DOM düğümü üretilmez", () => {
  const kayitlar: OrnekKayit[] = [
    { id: "1", baslik: "Video 1" },
    { id: "2", baslik: "Video 2" },
    { id: "3", baslik: "Video 3" },
    { id: "4", baslik: "Video 4" },
    { id: "5", baslik: "Video 5" },
  ];

  const html = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar,
      kayitAnahtari: (k) => `kart-${k.id}`,
      renderKart: (k) => createElement("span", { className: "yayin-karti" }, k.baslik),
      baslik: "Öğrenme Rafları",
    }),
  );

  // İlk 2 kart DOM'da olmalı
  assert.match(html, /Video 1/);
  assert.match(html, /Video 2/);

  // Kalan 3 kart mobil DOM'da kesinlikle ÜRETİLMEMELİ (slice kuralı)
  assert.doesNotMatch(html, /Video 3/);
  assert.doesNotMatch(html, /Video 4/);
  assert.doesNotMatch(html, /Video 5/);

  // Düğme ve sayaç metinleri
  assert.match(html, /Daha Fazla Göster \(\+3\)/);
  assert.match(html, /\(3 içerik kaldı\)/);
  assert.match(html, />5<\/span>/); // toplam sayaç rozeti
});

test("MobilYayinAkisi: yükleniyor ve hata durumlarını doğru çerçeveyle sunar", () => {
  const yukleniyorHtml = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: [],
      kayitAnahtari: (k) => k.id,
      renderKart: () => null,
      yukleniyor: true,
      yukleniyorIcerik: createElement("div", { className: "ozel-spinner" }, "Yükleniyor..."),
    }),
  );
  assert.match(yukleniyorHtml, /ozel-spinner/);

  const hataHtml = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: [],
      kayitAnahtari: (k) => k.id,
      renderKart: () => null,
      hataMesaji: "Ağ bağlantısı koptu",
    }),
  );
  assert.match(hataHtml, /Ağ bağlantısı koptu/);
});

test("MobilYayinAkisi: masaüstü içeriği verildiğinde responsive sm:hidden ve hidden sm:block sınıflarını uygular", () => {
  const html = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: [{ id: "1", baslik: "Mobil Kart" }],
      kayitAnahtari: (k) => k.id,
      renderKart: (k) => createElement("div", null, k.baslik),
      masaustuIcerik: createElement("div", { className: "masaustu-raf" }, "Masaüstü Rafı"),
    }),
  );

  assert.match(html, /sm:hidden/);
  assert.match(html, /hidden sm:block/);
  assert.match(html, /masaustu-raf/);
  assert.match(html, /Mobil Kart/);
});
