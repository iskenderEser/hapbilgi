import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { GlobalWindow } from "happy-dom";
import MobilYayinAkisi, {
  hesaplaMobilYayinGorunumu,
} from "@/components/yayin/MobilYayinAkisi";

// Test ortamında doğrudan bileşen etkileşimini çalıştırmak için DOM ortamı
const win = new GlobalWindow();
for (const key of Object.getOwnPropertyNames(win)) {
  if (!(key in globalThis)) {
    // @ts-expect-error global mock setup
    globalThis[key] = win[key];
  }
}
globalThis.window = win as unknown as Window & typeof globalThis;
globalThis.document = win.document as unknown as Document;
// @ts-expect-error react act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// @ts-expect-error react act environment flag
win.IS_REACT_ACT_ENVIRONMENT = true;

interface OrnekKayit {
  id: string;
  baslik: string;
}

// --------------------------------------------------------------------------
// 1. DOĞRUDAN BİLEŞEN ETKİLEŞİMİ VE YAŞAM DÖNGÜSÜ TESTLERİ (createRoot + act)
// --------------------------------------------------------------------------

test("doğrudan bileşen etkileşimi: gerçek butona tıklayarak kart sayısı 2 -> 7 -> kalan kayıtlar (10) şeklinde açılır", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const kayitlar: OrnekKayit[] = Array.from({ length: 10 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  // 1. İlk render: yalnızca 2 kart görünmeli
  await act(async () => {
    root.render(
      createElement(MobilYayinAkisi<OrnekKayit>, {
        kayitlar,
        kayitAnahtari: (k) => k.id,
        renderKart: (k) => createElement("div", { className: "yayin-karti-item" }, k.baslik),
        sifirlamaAnahtari: "kategori-1",
      }),
    );
  });

  let kartlar = container.querySelectorAll(".yayin-karti-item");
  assert.equal(kartlar.length, 2, "İlk renderda DOM'da tam 2 kart olmalı");

  // 2. Butona ilk tık: 2 -> 7 (+5)
  let btn = container.querySelector("button");
  assert.ok(btn, "Devam butonu bulunmalı");
  assert.match(btn.textContent ?? "", /Daha Fazla Göster \(\+5\)/);
  assert.match(btn.textContent ?? "", /8 içerik kaldı/);

  await act(async () => {
    btn?.click();
  });

  kartlar = container.querySelectorAll(".yayin-karti-item");
  assert.equal(kartlar.length, 7, "İlk tıklamada DOM'daki kart sayısı 7 olmalı");

  // 3. Butona ikinci tık: 7 -> 10 (+3, son kalanlar)
  btn = container.querySelector("button");
  assert.ok(btn, "İkinci tıklama öncesi buton bulunmalı");
  assert.match(btn.textContent ?? "", /Daha Fazla Göster \(\+3\)/);
  assert.match(btn.textContent ?? "", /3 içerik kaldı/);

  await act(async () => {
    btn?.click();
  });

  kartlar = container.querySelectorAll(".yayin-karti-item");
  assert.equal(kartlar.length, 10, "İkinci tıklamada DOM'daki kart sayısı 10 olmalı");

  // Liste bitince buton DOM'dan kalkmalı
  btn = container.querySelector("button");
  assert.equal(btn, null, "Kayıtlar bitince devam butonu DOM'dan kaldırılmalı");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("doğrudan bileşen etkileşimi: yeni sifirlamaAnahtari ile yeniden render edilince liste 2 karta döner", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const kayitlar: OrnekKayit[] = Array.from({ length: 10 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  // İlk render
  await act(async () => {
    root.render(
      createElement(MobilYayinAkisi<OrnekKayit>, {
        kayitlar,
        kayitAnahtari: (k) => k.id,
        renderKart: (k) => createElement("div", { className: "yayin-karti-item" }, k.baslik),
        sifirlamaAnahtari: "kategori-A",
      }),
    );
  });

  // Kullanıcı butona basıp 7 karta çıkarır
  const btn = container.querySelector("button");
  await act(async () => {
    btn?.click();
  });
  assert.equal(container.querySelectorAll(".yayin-karti-item").length, 7);

  // Kategori/filtre değişir (yeni sifirlamaAnahtari)
  await act(async () => {
    root.render(
      createElement(MobilYayinAkisi<OrnekKayit>, {
        kayitlar,
        kayitAnahtari: (k) => k.id,
        renderKart: (k) => createElement("div", { className: "yayin-karti-item" }, k.baslik),
        sifirlamaAnahtari: "kategori-B",
      }),
    );
  });

  const kartlar = container.querySelectorAll(".yayin-karti-item");
  assert.equal(kartlar.length, 2, "sifirlamaAnahtari değiştiğinde kart sayısı tekrar 2'ye dönmeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("doğrudan bileşen etkileşimi: aynı sifirlamaAnahtari ile veri yenilendiğinde açılmış kart sayısı korunur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const ilkKayitlar: OrnekKayit[] = Array.from({ length: 10 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Video ${i + 1}`,
  }));

  // İlk render
  await act(async () => {
    root.render(
      createElement(MobilYayinAkisi<OrnekKayit>, {
        kayitlar: ilkKayitlar,
        kayitAnahtari: (k) => k.id,
        renderKart: (k) => createElement("div", { className: "yayin-karti-item" }, k.baslik),
        sifirlamaAnahtari: "kategori-A",
      }),
    );
  });

  // Kullanıcı 7 karta açar
  const btn = container.querySelector("button");
  await act(async () => {
    btn?.click();
  });
  assert.equal(container.querySelectorAll(".yayin-karti-item").length, 7);

  // Arka plandan aynı filtre için güncellenmiş veri gelir (12 kayıt)
  const guncelKayitlar: OrnekKayit[] = Array.from({ length: 12 }, (_, i) => ({
    id: `k-${i + 1}`,
    baslik: `Güncel Video ${i + 1}`,
  }));

  await act(async () => {
    root.render(
      createElement(MobilYayinAkisi<OrnekKayit>, {
        kayitlar: guncelKayitlar,
        kayitAnahtari: (k) => k.id,
        renderKart: (k) => createElement("div", { className: "yayin-karti-item" }, k.baslik),
        sifirlamaAnahtari: "kategori-A",
      }),
    );
  });

  const kartlar = container.querySelectorAll(".yayin-karti-item");
  assert.equal(
    kartlar.length,
    7,
    "Aynı filtre altında veri güncellenince kullanıcının açtığı 7 kart korunmalıdır",
  );

  const yeniBtn = container.querySelector("button");
  assert.ok(yeniBtn);
  assert.match(yeniBtn.textContent ?? "", /5 içerik kaldı/, "12 - 7 = 5 içerik kalmalı");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// --------------------------------------------------------------------------
// 2. DOM TEKİL ID, ARIA VE GÜVENLİ POZİTİF TAMSAYI DOĞRULAMALARI
// --------------------------------------------------------------------------

test("DOM tekil id ve aria-labelledby: başlıklı kullanımda doğru id eşleşir, başlıksız kullanımda aria-labelledby eklenmez", () => {
  // Başlıklı kullanım
  const baslikliHtml = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: [{ id: "1", baslik: "Test Video" }],
      kayitAnahtari: (k) => k.id,
      renderKart: (k) => createElement("div", null, k.baslik),
      baslik: "Bölüm Başlığı",
      bolumId: "bolum-123",
    }),
  );

  assert.match(baslikliHtml, /id="bolum-123"/);
  assert.match(baslikliHtml, /aria-labelledby="bolum-123-baslik"/);
  assert.match(baslikliHtml, /<h2 id="bolum-123-baslik"/);
  const idEslesmeleri = baslikliHtml.match(/id="bolum-123"/g);
  assert.equal(idEslesmeleri?.length, 1, "id='bolum-123' DOM'da yalnızca bir kez bulunmalıdır");

  // Başlıksız kullanım
  const basliksizHtml = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: [{ id: "1", baslik: "Test Video" }],
      kayitAnahtari: (k) => k.id,
      renderKart: (k) => createElement("div", null, k.baslik),
      bolumId: "bolum-456",
    }),
  );

  assert.match(basliksizHtml, /id="bolum-456"/);
  assert.doesNotMatch(
    basliksizHtml,
    /aria-labelledby/,
    "Başlık olmadığında var olmayan bir DOM kimliğine aria-labelledby referansı verilmemelidir",
  );
  assert.doesNotMatch(basliksizHtml, /bolum-456-baslik/);
});

test("güvenli pozitif tamsayı: NaN, Infinity ve negatif sayılar varsayılan 2 ve 5 değerlerine düşer", () => {
  // hesaplaMobilYayinGorunumu testleri
  const sonucNaN = hesaplaMobilYayinGorunumu(10, NaN, NaN);
  assert.equal(sonucNaN.gorunenSayisi, 0);
  assert.equal(sonucNaN.acilacakSayi, 5, "NaN adım sayısı varsayılan 5 olmalıdır");

  const sonucInfinity = hesaplaMobilYayinGorunumu(10, 2, Infinity);
  assert.equal(sonucInfinity.gorunenSayisi, 2);
  assert.equal(sonucInfinity.acilacakSayi, 5, "Infinity adım sayısı varsayılan 5 olmalıdır");

  const sonucGecersizToplam = hesaplaMobilYayinGorunumu(Infinity, 2, 5);
  assert.equal(sonucGecersizToplam.gorunenSayisi, 0, "Infinity kayıt sayısı 0 olmalıdır");

  // MobilYayinAkisi bileşen sınırında test
  const html = renderToStaticMarkup(
    createElement(MobilYayinAkisi<OrnekKayit>, {
      kayitlar: Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, baslik: `V${i}` })),
      kayitAnahtari: (k) => k.id,
      renderKart: (k) => createElement("span", null, k.baslik),
      baslangicSayisi: NaN,
      adimSayisi: Infinity,
    }),
  );

  // NaN baslangicSayisi güvenli varsayılana (2) düşmeli -> V0 ve V1 render edilmeli, V2 edilmemeli
  assert.match(html, /V0/);
  assert.match(html, /V1/);
  assert.doesNotMatch(html, /V2/);
  // Infinity adimSayisi güvenli varsayılana (5) düşmeli -> 10 kayıt, 2 görünür, kalan 8 iken açılacak 5
  assert.match(html, /Daha Fazla Göster \(\+5\)/);
  assert.match(html, /\(8 içerik kaldı\)/);
});

// --------------------------------------------------------------------------
// 3. YÜKLENİYOR VE HATA DURUMU TESTLERİ
// --------------------------------------------------------------------------

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
