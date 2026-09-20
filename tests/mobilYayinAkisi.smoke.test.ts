import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MobilYayinAkisi, {
  hesaplaMobilYayinGorunumu,
  MobilYayinEtkilesimKontrolcusu,
} from "@/components/yayin/MobilYayinAkisi";

interface OrnekKayit {
  id: string;
  baslik: string;
}

// --------------------------------------------------------------------------
// 1. KULLANICI ETKİLEŞİMİ VE YAŞAM DÖNGÜSÜ DOĞRULAMA TESTLERİ
// --------------------------------------------------------------------------

test("kullanıcı etkileşimi: ilk açılışta yalnızca 2 kart görünmeli", () => {
  const kayitlar: OrnekKayit[] = Array.from({ length: 10 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  const kontrolcu = new MobilYayinEtkilesimKontrolcusu({
    kayitlar,
    sifirlamaAnahtari: "tumu",
    baslangicSayisi: 2,
    adimSayisi: 5,
  });

  const durum = kontrolcu.durum();
  assert.equal(durum.gorunenKayitlar.length, 2, "İlk açılışta tam 2 kart olmalı");
  assert.equal(durum.kalanSayisi, 8, "Kalan kayıt sayısı 8 olmalı");
  assert.equal(durum.acilacakSayi, 5, "Sonraki açılacak kayıt sayısı 5 olmalı");
  assert.equal(durum.devamDugmesiGoster, true, "Devam düğmesi açık olmalı");
});

test("kullanıcı etkileşimi: her tıklamada en fazla 5 yeni kart açılmalı", () => {
  const kayitlar: OrnekKayit[] = Array.from({ length: 10 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  const kontrolcu = new MobilYayinEtkilesimKontrolcusu({
    kayitlar,
    sifirlamaAnahtari: "tumu",
  });

  const ilkDurum = kontrolcu.durum();
  assert.equal(ilkDurum.gorunenKayitlar.length, 2);

  // Kullanıcı "Daha Fazla Göster"e tıklar
  kontrolcu.dahaFazlaTikla();
  const sonrakiDurum = kontrolcu.durum();

  const yeniAcilanSayisi = sonrakiDurum.gorunenKayitlar.length - ilkDurum.gorunenKayitlar.length;
  assert.equal(yeniAcilanSayisi, 5, "Tıklamada tam 5 yeni kart açılmalı (2 -> 7)");
  assert.equal(sonrakiDurum.gorunenKayitlar.length, 7);
  assert.equal(sonrakiDurum.kalanSayisi, 3);
  assert.equal(sonrakiDurum.acilacakSayi, 3);
  assert.equal(sonrakiDurum.devamDugmesiGoster, true);
});

test("kullanıcı etkileşimi: son adımda yalnızca kalan kayıtlar açılmalı ve düğme kalkmalı", () => {
  const kayitlar: OrnekKayit[] = Array.from({ length: 8 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  const kontrolcu = new MobilYayinEtkilesimKontrolcusu({
    kayitlar,
    sifirlamaAnahtari: "tumu",
  });

  // İlk tıklama: 2 -> 7
  kontrolcu.dahaFazlaTikla();
  const adim1 = kontrolcu.durum();
  assert.equal(adim1.gorunenKayitlar.length, 7);
  assert.equal(adim1.kalanSayisi, 1);
  assert.equal(adim1.acilacakSayi, 1);

  // İkinci tıklama (son adım): yalnızca kalan 1 kayıt açılmalı (7 -> 8)
  kontrolcu.dahaFazlaTikla();
  const sonAdim = kontrolcu.durum();
  assert.equal(sonAdim.gorunenKayitlar.length, 8);
  assert.equal(sonAdim.kalanSayisi, 0, "Kalan kayıt sıfır olmalı");
  assert.equal(sonAdim.acilacakSayi, 0);
  assert.equal(sonAdim.devamDugmesiGoster, false, "Liste bitince devam düğmesi kalkmalı");
});

test("kullanıcı etkileşimi: sifirlamaAnahtari değişince görünür kayıt sayısı tekrar 2'ye dönmeli", () => {
  const kayitlar: OrnekKayit[] = Array.from({ length: 10 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  const kontrolcu = new MobilYayinEtkilesimKontrolcusu({
    kayitlar,
    sifirlamaAnahtari: "kategori-A",
  });

  // Kullanıcı listeyi 7'ye kadar açar
  kontrolcu.dahaFazlaTikla();
  assert.equal(kontrolcu.durum().gorunenKayitlar.length, 7);

  // Filtre/arama değişir (sifirlamaAnahtari değişti)
  kontrolcu.sifirlamaAnahtariGuncelle("kategori-B");
  const sifirlanmisDurum = kontrolcu.durum();

  assert.equal(
    sifirlanmisDurum.gorunenKayitlar.length,
    2,
    "Filtre değiştiğinde liste tekrar başlangıçtaki 2 kayda dönmeli",
  );
  assert.equal(sifirlanmisDurum.kalanSayisi, 8);
});

test("kullanıcı etkileşimi: aynı sifirlamaAnahtari altında veri yenilenince kullanıcının açtığı kayıt sayısı korunmalı", () => {
  const ilkKayitlar: OrnekKayit[] = Array.from({ length: 10 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  const kontrolcu = new MobilYayinEtkilesimKontrolcusu({
    kayitlar: ilkKayitlar,
    sifirlamaAnahtari: "kategori-A",
  });

  // Kullanıcı listeyi 7'ye kadar açar
  kontrolcu.dahaFazlaTikla();
  assert.equal(kontrolcu.durum().gorunenKayitlar.length, 7);

  // Arka plandan aynı filtre için güncellenmiş yeni kayıtlar gelir (örneğin beğeni güncellendi veya yeni kayıt eklendi)
  const guncelKayitlar: OrnekKayit[] = Array.from({ length: 12 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Güncel Video ${i + 1}`,
  }));

  kontrolcu.veriGuncelle(guncelKayitlar);
  kontrolcu.sifirlamaAnahtariGuncelle("kategori-A"); // anahtar değişmedi

  const korunanDurum = kontrolcu.durum();
  assert.equal(
    korunanDurum.gorunenKayitlar.length,
    7,
    "Aynı filtre altında veri yenilendiğinde kullanıcının açtığı 7 kart korunmalı",
  );
  assert.equal(korunanDurum.kalanSayisi, 5, "12 - 7 = 5 içerik kaldı");
});

// --------------------------------------------------------------------------
// 2. DOM TEKİL ID VE GÜVENLİ POZİTİF TAMSAYI DOĞRULAMALARI
// --------------------------------------------------------------------------

test("DOM tekil id: bolumId değeri dış kapsayıcı ve h2 üzerinde yinelenmez", () => {
  const html = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: [{ id: "1", baslik: "Test Video" }],
      kayitAnahtari: (k) => k.id,
      renderKart: (k) => createElement("div", null, k.baslik),
      baslik: "Bölüm Başlığı",
      bolumId: "bolum-123",
    }),
  );

  // Dış kapsayıcı id="bolum-123" ve aria-labelledby="bolum-123-baslik" taşımalı
  assert.match(html, /id="bolum-123"/);
  assert.match(html, /aria-labelledby="bolum-123-baslik"/);

  // Başlık ise id="bolum-123-baslik" taşımalı
  assert.match(html, /<h2 id="bolum-123-baslik"/);

  // DOM genelinde id="bolum-123" tam olarak 1 kez geçmeli (yinelenme olmamalı)
  const idEslesmeleri = html.match(/id="bolum-123"/g);
  assert.equal(idEslesmeleri?.length, 1, "id='bolum-123' DOM'da yalnızca bir kez bulunmalıdır");
});

test("güvenli pozitif tamsayı: baslangicSayisi ve adimSayisi sınır değerlerinde güvenli çalışır", () => {
  const sonuc = hesaplaMobilYayinGorunumu(10, 0, -5);
  assert.equal(sonuc.gorunenSayisi, 0);
  assert.equal(sonuc.acilacakSayi, 5, "Geçersiz adım sayısı güvenli varsayılana (5) düşmelidir");

  const html = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: Array.from({ length: 6 }, (_, i) => ({ id: `${i}`, baslik: `V${i}` })),
      kayitAnahtari: (k) => k.id,
      renderKart: (k) => createElement("span", null, k.baslik),
      baslangicSayisi: -1, // geçersiz
      adimSayisi: 0,       // geçersiz
    }),
  );

  // Geçersiz (-1) baslangicSayisi güvenli varsayılana (2) düşmeli -> V0 ve V1 render edilmeli, V2 edilmemeli
  assert.match(html, /V0/);
  assert.match(html, /V1/);
  assert.doesNotMatch(html, /V2/);
  // Geçersiz (0) adimSayisi güvenli varsayılana (5) düşmeli -> 6 kayıt, 2 görünür, kalan 4 iken açılacak 4
  assert.match(html, /Daha Fazla Göster \(\+4\)/);
  assert.match(html, /\(4 içerik kaldı\)/);
});

// --------------------------------------------------------------------------
// 3. STATİK HESAPLAMA VE SINIR TESTLERİ
// --------------------------------------------------------------------------

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

  const adim1 = hesaplaMobilYayinGorunumu(8, 7, 5);
  assert.equal(adim1.gorunenSayisi, 7);
  assert.equal(adim1.kalanSayisi, 1);
  assert.equal(adim1.acilacakSayi, 1);
  assert.equal(adim1.devamDugmesiGoster, true);

  const adim2 = hesaplaMobilYayinGorunumu(8, 12, 5);
  assert.equal(adim2.gorunenSayisi, 8);
  assert.equal(adim2.kalanSayisi, 0);
  assert.equal(adim2.acilacakSayi, 0);
  assert.equal(adim2.devamDugmesiGoster, false);
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

  assert.match(html, /Video 1/);
  assert.match(html, /Video 2/);
  assert.doesNotMatch(html, /Video 3/);
  assert.doesNotMatch(html, /Video 4/);
  assert.doesNotMatch(html, /Video 5/);
  assert.match(html, /Daha Fazla Göster \(\+3\)/);
  assert.match(html, /\(3 içerik kaldı\)/);
  assert.match(html, />5<\/span>/);
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
