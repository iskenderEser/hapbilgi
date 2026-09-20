import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement, Fragment, act } from "react";
import { createRoot } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import { VideoRafi } from "@/app/(panel)/eclub/panel/_components/EclubFirmaVideoKatalogu";
import type { PanelOneri } from "@/app/(panel)/eclub/panel/_hooks/useEclubPanel";
import EczanemVideoRafi from "@/app/eczanem/_components/EczanemVideoRafi";
import type { EczanemMusteriVideo } from "@/app/eczanem/_types";
import { useListe } from "@/components/liste/useListe";
import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";

// Test ortamı için DOM hazırlığı
const win = new GlobalWindow();
for (const key of Object.getOwnPropertyNames(win)) {
  if (!(key in globalThis)) {
    // @ts-expect-error global DOM setup
    globalThis[key] = win[key];
  }
}
globalThis.window = win as unknown as Window & typeof globalThis;
globalThis.document = win.document as unknown as Document;
// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// @ts-expect-error react act flag
win.IS_REACT_ACT_ENVIRONMENT = true;

const eclubKatalogKodu = readFileSync("app/(panel)/eclub/panel/_components/EclubFirmaVideoKatalogu.tsx", "utf8");
const eczanemVideoRafiKodu = readFileSync("app/eczanem/_components/EczanemVideoRafi.tsx", "utf8");
const eczanemPageKodu = readFileSync("app/eczanem/page.tsx", "utf8");
const yayinYonetimiKodu = readFileSync("app/(panel)/yayin-yonetimi/page.tsx", "utf8");
const useListeKodu = readFileSync("components/liste/useListe.ts", "utf8");
const mobilYayinAkisiKodu = readFileSync("components/yayin/MobilYayinAkisi.tsx", "utf8");

function ornekEclubOneri(id: string, yayinId: string, urunAdi: string, izlendiMi = false): PanelOneri {
  return {
    oneri_id: id,
    yayin_id: yayinId,
    firma_id: "firma-1",
    urun_adi: urunAdi,
    teknik_adi: `Teknik ${urunAdi}`,
    video_url: "https://example.com/video.mp4",
    thumbnail_url: "https://example.com/thumb.jpg",
    video_puani: 10,
    soru_puani: 5,
    soru_sayisi: 2,
    created_at: "2026-09-20",
    oneri_baslangic: "2026-09-20",
    oneri_bitis: "2026-09-30",
    izlendi_mi: izlendiMi,
    oneri_durumu: "izlenecek",
    kalan_gun: 10,
    begeni_sayisi: 4,
    favori_sayisi: 2,
    begeni_mi: false,
    favori_mi: false,
    arac_id: `arac-${yayinId}`,
    arac_turu: "video",
  };
}

function ornekEczanemVideo(gonderimId: string, yayinId: string, urunAdi: string, izlendi = false): EczanemMusteriVideo {
  return {
    gonderim_id: gonderimId,
    yayin_id: yayinId,
    urun_adi: urunAdi,
    teknik_adi: `Teknik ${urunAdi}`,
    video_url: "https://example.com/video.mp4",
    thumbnail_url: "https://example.com/thumb.jpg",
    video_puani: 20,
    soru_puani: 5,
    soru_sayisi: 3,
    gelis_tarihi: "2026-09-20",
    izlendi,
    izleme_basladi: !izlendi,
    son_konum_saniye: izlendi ? 0 : 45,
    izleme_baslangic: "2026-09-20",
    izleme_bitis: izlendi ? "2026-09-21" : null,
    begeni_sayisi: 8,
    favori_sayisi: 3,
    begeni_mi: false,
    favori_mi: false,
    arac_id: `arac-${yayinId}`,
    arac_turu: "video",
    eczane_id: "ecz-1",
    eczane_adi: "Şifa Eczanesi",
    firma_id: "frm-1",
    firma_adi: "HapBilgi İlaç",
    urun_id: "urn-1",
  };
}

// ─── MİMARİ VE SÖZLEŞME DOĞRULAMALARI ────────────────────────────────────────

test("Faz 5 Mimari: E-Club VideoRafi MobilYayinAkisi kullanır, oneri_id anahtarını korur ve tanbur içermez", () => {
  assert.match(eclubKatalogKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/, "MobilYayinAkisi import edilmiş olmalı");
  assert.match(eclubKatalogKodu, /kayitAnahtari=\{\(oneri\) => oneri\.oneri_id\}/, "kayitAnahtari oneri_id olmalı");
  assert.match(eclubKatalogKodu, /sifirlamaAnahtari=\{sifirlamaAnahtari\}/, "sifirlamaAnahtari MobilYayinAkisi'ne iletilmeli");
  assert.match(eclubKatalogKodu, /masaustuIcerik=\{masaustuIcerik\}/, "Masaüstü rafı masaustuIcerik slotunda korunmalı");
  assert.doesNotMatch(eclubKatalogKodu, /TanburSecici/, "E-Club kataloguna tanbur eklenmemeli");
});

test("Faz 5 Mimari: EczanemVideoRafi MobilYayinAkisi kullanır, bolumId iletir, gonderim_id anahtarını korur ve tanbur içermez", () => {
  assert.match(eczanemVideoRafiKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/, "MobilYayinAkisi import edilmiş olmalı");
  assert.match(eczanemVideoRafiKodu, /kayitAnahtari=\{\(video\) => `\$\{baslik\}-\$\{video\.gonderim_id\}`\}/, "kayitAnahtari gonderim_id'yi korumalı");
  assert.match(eczanemVideoRafiKodu, /bolumId=\{bolumId\}/, "bolumId MobilYayinAkisi'ne iletilmeli");
  assert.match(eczanemVideoRafiKodu, /baslik=\{\s*<h2/, "baslik prop'u düz string yerine özel h2 React elementi olarak verilmeli");
  assert.doesNotMatch(eczanemVideoRafiKodu, /<h2[^>]*\bid=/, "Başlıkta manuel id bulunmamalı; kimliği MobilYayinAkisi üretmeli");
  assert.match(eczanemVideoRafiKodu, /masaustuIcerik=\{masaustuIcerik\}/, "Masaüstü rafı masaustuIcerik slotunda korunmalı");
  assert.match(eczanemPageKodu, /sifirlamaAnahtari: sifirlamaKapsami/, "eczanem/page.tsx sifirlamaAnahtari iletmeli");
  assert.doesNotMatch(eczanemVideoRafiKodu, /TanburSecici/, "Eczanem bileşenine tanbur eklenmemeli");
});

test("Faz 5 Mimari: YayinYonetimi aktif yayınlar kartGorunumu MobilYayinAkisi'ne filtrelenmis ile bağlıdır, tam sıfırlama anahtarı taşır", () => {
  assert.match(yayinYonetimiKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/, "YayinYonetimi MobilYayinAkisi import etmeli");
  assert.match(yayinYonetimiKodu, /kayitlar=\{yayindaListe\.filtrelenmis\}/, "Aktif yayınlar MobilYayinAkisi'ne filtrelenmis tam listesiyle bağlanmalı");
  assert.match(
    yayinYonetimiKodu,
    /sifirlamaAnahtari=\{`\$\{aktifAnaSekme\}-\$\{aktifSekme\}-\$\{yayindaListe\.arama\.alanAnahtari\}-\$\{yayindaListe\.arama\.aranan\}`\}/,
    "Sıfırlama anahtarı aktifAnaSekme, aktifSekme, alanAnahtari ve aranan içermeli",
  );
  assert.match(useListeKodu, /filtrelenmis:\s*suzulmus/, "useListe filtrelenmis alanını dışarı vermeli");
  assert.doesNotMatch(mobilYayinAkisiKodu, /cloneElement/, "MobilYayinAkisi cloneElement kullanmamalı");
  assert.doesNotMatch(mobilYayinAkisiKodu, /isValidElement/, "MobilYayinAkisi isValidElement kullanmamalı");
  // Bekleyen ve durdurulan sekmelerindeki işlem satırları korunmalı
  assert.match(yayinYonetimiKodu, /<BekleyenSatir/, "BekleyenSatir işlem satırları korunmalı");
});

// ─── DOM ETKİLEŞİM VE 2+5 TESTLERİ ──────────────────────────────────────────

test("E-Club: VideoRafi mobilde 2 kartla başlar, 7 karta açılır, firma değişince 2 karta döner ve oneri_id ayrımını korur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  // Aynı yayin_id'ye sahip fakat iki farklı oneri_id
  const oneriler = Array.from({ length: 8 }, (_, i) =>
    ornekEclubOneri(`oneri-${i + 1}`, i < 2 ? "ayni-yayin-id" : `yayin-${i + 1}`, `E-Club İçerik ${i + 1}`),
  );

  let secilenOneriId = "";
  let begenilenYayinId = "";
  let favorilenenYayinId = "";

  await act(async () => {
    root.render(
      createElement(VideoRafi, {
        baslik: "Tüm İçerikler",
        videolar: oneriler,
        etkilesimAktif: true,
        sifirlamaAnahtari: "firma-1-tumu",
        onVideoSec: (oneri) => {
          secilenOneriId = oneri.oneri_id;
        },
        onBegeni: (id) => {
          begenilenYayinId = id;
        },
        onFavori: (id) => {
          favorilenenYayinId = id;
        },
      }),
    );
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi bulunmalı");

  // 1. Mobilde 2 kartla başlamalı ve içerik genişliğini kullanmalı (w-full)
  const baslangicKartlari = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(baslangicKartlari.length, 2, "Mobilde başlangıçta 2 kart olmalı");
  assert.match(baslangicKartlari[0].className, /w-full/, "Mobilde kart w-full olmalı");

  // 2. Kalan gün ve oynat rozetleri görünmeli
  assert.match(mobilKapsayici.textContent ?? "", /10 gün/, "Öneri kalan gün rozeti görünmeli");

  // 3. Daha Fazla Göster ile 7 karta açılmalı
  const devamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(devamBtn, "Daha Fazla Göster butonu bulunmalı");

  await act(async () => {
    devamBtn.click();
  });

  const acilmisKartlar = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(acilmisKartlar.length, 7, "Daha Fazla Göster ile 7 karta açılmalı");

  // 4. Karta tıklandığında onVideoSec tetiklenmeli
  const ilkKart = baslangicKartlari[0];
  const ilkKartTikla = ilkKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(ilkKartTikla, "İlk karta tıklama alanı bulunmalı");
  await act(async () => {
    (ilkKartTikla as HTMLElement).click();
  });
  assert.equal(secilenOneriId, "oneri-1", "Karta tıklama doğru oneri_id ile onVideoSec'i tetiklemeli");

  // 5. Beğeni / favori tetiklenmeli
  const begeniBtn = ilkKart.querySelector("button[aria-label*='Beğen']");
  assert.ok(begeniBtn, "Beğeni butonu bulunmalı");
  await act(async () => {
    (begeniBtn as HTMLElement).click();
  });
  assert.equal(begenilenYayinId, "ayni-yayin-id", "Beğeni tetiklenmeli");

  const favoriBtn = ilkKart.querySelector("button[aria-label*='Favori']");
  assert.ok(favoriBtn, "Favori butonu bulunmalı");
  await act(async () => {
    (favoriBtn as HTMLElement).click();
  });
  assert.equal(favorilenenYayinId, "ayni-yayin-id", "Favori tetiklenmeli");

  // 6. Firma/filtre değiştiğinde liste 2 karta dönmeli
  await act(async () => {
    root.render(
      createElement(VideoRafi, {
        baslik: "Tüm İçerikler",
        videolar: oneriler,
        etkilesimAktif: true,
        sifirlamaAnahtari: "firma-2-tumu",
        onVideoSec: () => {},
        onBegeni: () => {},
        onFavori: () => {},
      }),
    );
  });

  const sifirlanmisKartlar = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(sifirlanmisKartlar.length, 2, "Firma filtresi değişince liste tekrar 2 karta dönmeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("Eczanem: EczanemVideoRafi mobilde 2 kartla başlar, 7 karta açılır, gonderim_id ve puan alanlarını eksiksiz korur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const videolar = Array.from({ length: 8 }, (_, i) =>
    ornekEczanemVideo(`gond-${i + 1}`, i < 2 ? "ortak-yayin-id" : `yayin-${i + 1}`, `Eczanem Video ${i + 1}`, i === 0),
  );

  let secilenGonderimId = "";
  let begenilenGonderimId = "";
  let favorilenenGonderimId = "";

  await act(async () => {
    root.render(
      createElement(EczanemVideoRafi, {
        baslik: "Yeni Öğrenme İçeriklerim",
        videolar,
        bosMesaj: "Yeni öğrenme içeriğiniz bulunmuyor.",
        sifirlamaAnahtari: "tum-tumu",
        onVideoSec: (video) => {
          secilenGonderimId = video.gonderim_id;
        },
        onBegeni: (video) => {
          begenilenGonderimId = video.gonderim_id;
        },
        onFavori: (video) => {
          favorilenenGonderimId = video.gonderim_id;
        },
      }),
    );
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi bulunmalı");

  // 1. Mobilde 2 kartla başlamalı ve tam genişlik kullanmalı
  const baslangicKartlari = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(baslangicKartlari.length, 2, "Mobilde başlangıçta 2 kart olmalı");
  assert.match(baslangicKartlari[0].className, /w-full/, "Mobilde kart w-full olmalı");

  // 2. Eczane adı, tamamlama puanı (20 p), soru sayısı (3 ad), doğru puanı (5 p) render edilmiş olmalı
  assert.match(mobilKapsayici.textContent ?? "", /Şifa Eczanesi/, "Eczane adı görünmeli");
  assert.match(mobilKapsayici.textContent ?? "", /20 p/, "Tamamlama puanı görünmeli");
  assert.match(mobilKapsayici.textContent ?? "", /3 ad/, "Soru sayısı görünmeli");
  assert.match(mobilKapsayici.textContent ?? "", /5 p/, "Her doğru puanı görünmeli");

  // 3. Durum rozetleri: ilk kart tamamlandı, ikinci kart devam et
  assert.match(mobilKapsayici.textContent ?? "", /Tamamlandı/, "Tamamlandı rozeti görünmeli");
  assert.match(mobilKapsayici.textContent ?? "", /Devam Et/, "Devam et rozeti görünmeli");

  // 4. Daha Fazla Göster ile 7 karta açılmalı
  const devamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(devamBtn, "Daha Fazla Göster butonu bulunmalı");

  await act(async () => {
    devamBtn.click();
  });

  const acilmisKartlar = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(acilmisKartlar.length, 7, "Daha Fazla Göster ile 7 karta açılmalı");

  // 5. Karta tıklanınca onVideoSec tetiklenmeli
  const ilkKart = baslangicKartlari[0];
  const ilkKartTikla = ilkKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(ilkKartTikla, "İlk karta tıklama alanı bulunmalı");
  await act(async () => {
    (ilkKartTikla as HTMLElement).click();
  });
  assert.equal(secilenGonderimId, "gond-1", "Karta tıklama doğru gonderim_id ile onVideoSec'i tetiklemeli");

  // 6. Beğeni ve favori butonları gonderim_id ile tetiklenmeli
  const begeniBtn = ilkKart.querySelector("button[aria-label*='Beğen']");
  assert.ok(begeniBtn, "Beğeni butonu bulunmalı");
  await act(async () => {
    (begeniBtn as HTMLElement).click();
  });
  assert.equal(begenilenGonderimId, "gond-1", "Beğeni doğru gonderim ile tetiklenmeli");

  const favoriBtn = ilkKart.querySelector("button[aria-label*='Favori']");
  assert.ok(favoriBtn, "Favori butonu bulunmalı");
  await act(async () => {
    (favoriBtn as HTMLElement).click();
  });
  assert.equal(favorilenenGonderimId, "gond-1", "Favori doğru gonderim ile tetiklenmeli");

  // 7. Kapsam/filtre değiştiğinde liste tekrar 2 karta dönmeli
  await act(async () => {
    root.render(
      createElement(EczanemVideoRafi, {
        baslik: "Yeni Öğrenme İçeriklerim",
        videolar,
        bosMesaj: "Yeni öğrenme içeriğiniz bulunmuyor.",
        sifirlamaAnahtari: "eczane-1-tumu",
        onVideoSec: () => {},
        onBegeni: () => {},
        onFavori: () => {},
      }),
    );
  });

  const sifirlanmisKartlar = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(sifirlanmisKartlar.length, 2, "Kapsam filtresi değişince liste tekrar 2 karta dönmeli");

  // 8. Eczanem section/aria-labelledby/id tekilliğini DOM üzerinden doğrula
  const section = container.querySelector("section");
  assert.ok(section, "EczanemVideoRafi bir section render etmeli");
  const sectionId = section.getAttribute("id");
  const labelledBy = section.getAttribute("aria-labelledby");
  assert.ok(sectionId, "section id (bolumId) taşımalı");
  assert.ok(labelledBy, "section aria-labelledby taşımalı");
  assert.equal(labelledBy, `${sectionId}-baslik`, "aria-labelledby section id'sine '-baslik' eklenerek türetilmeli");

  const baslikKapsayici = container.querySelector(`#${labelledBy}`);
  assert.ok(baslikKapsayici, "aria-labelledby hedefi DOM'da bulunmalı");
  assert.equal(baslikKapsayici.textContent?.trim(), "Yeni Öğrenme İçeriklerim", "Görünür başlık doğru metni içermeli");

  const h2El = baslikKapsayici.querySelector("h2");
  assert.ok(h2El, "Hedef kapsayıcı içinde semantik h2 bulunmalı");
  assert.equal(h2El.textContent?.trim(), "Yeni Öğrenme İçeriklerim", "h2 doğru metni içermeli");
  assert.match(h2El.className, /text-base/, "text-base sınıfı korunmalı");
  assert.match(h2El.className, /font-black/, "font-black sınıfı korunmalı");
  assert.match(h2El.className, /tracking-\[-0\.015em\]/, "tracking-[-0.015em] sınıfı korunmalı");
  assert.match(h2El.className, /text-\[#1e344a\]/, "text-[#1e344a] sınıfı korunmalı");
  assert.match(h2El.className, /md:text-lg/, "md:text-lg sınıfı korunmalı");
  assert.match(h2El.className, /truncate/, "truncate sınıfı korunmalı");

  const idliElemanlar = Array.from(container.querySelectorAll("[id]"));
  const idListesi = idliElemanlar.map((el) => el.getAttribute("id")!);
  const tekilIdler = new Set(idListesi);
  assert.equal(idListesi.length, tekilIdler.size, `DOM'da yinelenen ID bulunmamalı: ${idListesi.join(", ")}`);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("MobilYayinAkisi a11y regresyon koruması: Fragment başlıkta console hatası vermez, kendi id'si olan başlık aria-labelledby bağlantısını bozmaz", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const consoleErrors: string[] = [];
  const consoleWarns: string[] = [];
  const orjError = console.error;
  const orjWarn = console.warn;
  console.error = (...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(" "));
    orjError(...args);
  };
  console.warn = (...args: unknown[]) => {
    consoleWarns.push(args.map(String).join(" "));
    orjWarn(...args);
  };

  try {
    // 1. Fragment başlık testi: console.error ve console.warn oluşmamalı
    await act(async () => {
      root.render(
        createElement(MobilYayinAkisi<{ id: string }>, {
          bolumId: "bolum-frag",
          kayitlar: [{ id: "1" }],
          kayitAnahtari: (k) => k.id,
          renderKart: () => createElement("div", null, "Kart"),
          baslik: createElement(
            Fragment,
            null,
            createElement("span", null, "Fragment Başlık"),
          ),
        }),
      );
    });

    const fragHatalari = consoleErrors.filter((e) =>
      e.includes("Invalid prop `id` supplied to `React.Fragment`"),
    );
    const fragUyarilari = consoleWarns.filter((w) =>
      w.includes("Invalid prop `id` supplied to `React.Fragment`"),
    );
    assert.equal(fragHatalari.length, 0, "Fragment başlık render edildiğinde id uyarısı oluşmamalı");
    assert.equal(fragUyarilari.length, 0, "Fragment başlık render edildiğinde id uyarısı oluşmamalı");

    // 2. Kendi id'si olan React element başlık testi: section aria-labelledby bağlantısı bozulmamalı
    await act(async () => {
      root.render(
        createElement(MobilYayinAkisi<{ id: string }>, {
          bolumId: "bolum-ozel-id",
          kayitlar: [{ id: "1" }],
          kayitAnahtari: (k) => k.id,
          renderKart: () => createElement("div", null, "Kart"),
          baslik: createElement(
            "h3",
            { id: "ozel-baslik-kimligi", className: "font-bold" },
            "Özel ID Başlık",
          ),
        }),
      );
    });

    const ozelSection = container.querySelector("#bolum-ozel-id");
    assert.ok(ozelSection, "Section bolumId ile render edilmeli");
    const ozelLabelledBy = ozelSection.getAttribute("aria-labelledby");
    assert.equal(ozelLabelledBy, "bolum-ozel-id-baslik", "section aria-labelledby güvenli kapsayıcı kimliğini göstermeli");

    const hedefKapsayici = container.querySelector(`#${ozelLabelledBy}`);
    assert.ok(hedefKapsayici, "aria-labelledby ile işaret edilen kapsayıcı DOM'da bulunmalı");
    const icBaslik = hedefKapsayici.querySelector("#ozel-baslik-kimligi");
    assert.ok(icBaslik, "Kendi id'si olan iç başlık kapsayıcı içinde korunmalı");
  } finally {
    console.error = orjError;
    console.warn = orjWarn;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
});

test("Yayın Yönetimi: En az 12 aktif yayında mobilde 2 → 7 → 12 açılır, masaüstünde 10 kayıt korunur, filtre değişince sıfırlanır ve veri yenilenince kart sayısı korunur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  interface TestYayin {
    yayin_id: string;
    urun_adi: string;
    firma_adi: string;
  }

  // En az 12 aktif yayın (14 kayıt)
  const yayinlar: TestYayin[] = Array.from({ length: 14 }, (_, i) => ({
    yayin_id: `yayin-${i + 1}`,
    urun_adi: `Ürün ${String(i + 1).padStart(2, "0")}`,
    firma_adi: i % 2 === 0 ? "Firma Alfa" : "Firma Beta",
  }));

  function YayinYonetimiTestBileseni({
    videolar,
    aktifAnaSekme = "hedef_eczane",
    aktifSekme = "yayinda",
  }: {
    videolar: TestYayin[];
    aktifAnaSekme?: string;
    aktifSekme?: string;
  }) {
    const yayindaListe = useListe<TestYayin>({
      veri: videolar,
      aramaAlanlari: [
        { anahtar: "urun_adi", etiket: "Ürün Adı", deger: (y) => y.urun_adi },
        { anahtar: "firma_adi", etiket: "Firma Adı", deger: (y) => y.firma_adi },
      ],
      adim: 10,
    });

    return createElement(
      "div",
      null,
      createElement(
        "div",
        { className: "arama-kontrolleri" },
        createElement("button", {
          "data-testid": "btn-alan-firma",
          onClick: () => yayindaListe.arama.alanDegistir("firma_adi"),
        }),
        createElement("button", {
          "data-testid": "btn-alan-urun",
          onClick: () => yayindaListe.arama.alanDegistir("urun_adi"),
        }),
        createElement("input", {
          "data-testid": "input-arama",
          value: yayindaListe.arama.aranan,
          onChange: (e: { target: { value: string } }) => yayindaListe.arama.aramaDegistir(e.target.value),
        }),
      ),
      createElement(MobilYayinAkisi<TestYayin>, {
        kayitlar: yayindaListe.filtrelenmis,
        kayitAnahtari: (y) => y.yayin_id,
        renderKart: (y) =>
          createElement(
            "div",
            { className: "w-full", "data-testid": `kart-${y.yayin_id}` },
            y.urun_adi,
          ),
        sayacGoster: false,
        sifirlamaAnahtari: `${aktifAnaSekme}-${aktifSekme}-${yayindaListe.arama.alanAnahtari}-${yayindaListe.arama.aranan}`,
        masaustuIcerik: createElement(
          "div",
          { "data-testid": "masaustu-icerik" },
          createElement(
            "div",
            { className: "grid grid-cols-5" },
            yayindaListe.gorunen.map((y) =>
              createElement("div", { key: y.yayin_id, className: "masaustu-kart" }, y.urun_adi),
            ),
          ),
          yayindaListe.dahaVar
            ? createElement(
                "button",
                {
                  "data-testid": "masaustu-daha-fazla",
                  onClick: yayindaListe.dahaFazlaGoster,
                },
                "Daha Fazla Göster",
              )
            : null,
        ),
      }),
    );
  }

  await act(async () => {
    root.render(createElement(YayinYonetimiTestBileseni, { videolar: yayinlar }));
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi bulunmalı");

  // 1. Masaüstü görünümü yayindaListe.gorunen ile ilk 10 kaydı göstermeli
  const masaustuKapsayici = container.querySelector("[data-testid='masaustu-icerik']");
  assert.ok(masaustuKapsayici, "Masaüstü içerik bulunmalı");
  const masaustuKartlarIlk = masaustuKapsayici.querySelectorAll(".masaustu-kart");
  assert.equal(masaustuKartlarIlk.length, 10, "Masaüstünde başlangıçta tam 10 kayıt görünmeli");
  const masaustuDahaFazlaBtn = masaustuKapsayici.querySelector("[data-testid='masaustu-daha-fazla']");
  assert.ok(masaustuDahaFazlaBtn, "Masaüstünde Daha Fazla Göster düğmesi bulunmalı");

  // 2. Mobilde akış 2 kayıtla başlamalı
  const mobilKartlarIlk = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(mobilKartlarIlk.length, 2, "Mobil başlangıçta tam 2 kart göstermeli");

  // 3. Mobilde 2 → 7 açılmalı
  let mobilDahaFazlaBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(mobilDahaFazlaBtn, "Mobilde ilk 'Daha Fazla Göster' butonu olmalı");
  await act(async () => {
    mobilDahaFazlaBtn!.click();
  });
  const mobilKartlarYedi = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(mobilKartlarYedi.length, 7, "Mobilde ilk tıklamada 7 karta açılmalı");

  // 4. Mobilde 7 → 12 açılmalı
  mobilDahaFazlaBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(mobilDahaFazlaBtn, "Mobilde ikinci 'Daha Fazla Göster' butonu olmalı");
  await act(async () => {
    mobilDahaFazlaBtn!.click();
  });
  const mobilKartlarOnIki = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(mobilKartlarOnIki.length, 12, "Mobilde ikinci tıklamada 12 karta açılmalı");

  // 5. Mobilde 12 → 14 (tüm liste) açılmalı ve hiçbir kayıt erişilemez kalmamalı
  mobilDahaFazlaBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(mobilDahaFazlaBtn, "Mobilde üçüncü 'Daha Fazla Göster' butonu olmalı");
  await act(async () => {
    mobilDahaFazlaBtn!.click();
  });
  const mobilKartlarSon = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(mobilKartlarSon.length, 14, "Mobilde 14 kaydın tümü açılabilmeli");
  const kalanBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.equal(kalanBtn, undefined, "Tüm kayıtlar açıldığında Daha Fazla Göster butonu kapanmalı");

  // 6. Masaüstü Daha Fazla Göster tıklanınca 14'e tamamlanmalı
  await act(async () => {
    (masaustuDahaFazlaBtn as HTMLButtonElement).click();
  });
  const masaustuKartlarSon = masaustuKapsayici.querySelectorAll(".masaustu-kart");
  assert.equal(masaustuKartlarSon.length, 14, "Masaüstünde Daha Fazla Göster ile tüm kayıtlar açılmalı");

  // 7. Aynı sıfırlama anahtarında veri yenilenirse açık kart sayısı KORUNMALI
  const yenilenmisYayinlar = yayinlar.map((y) => ({ ...y, urun_adi: `${y.urun_adi} (Güncel)` }));
  await act(async () => {
    root.render(createElement(YayinYonetimiTestBileseni, { videolar: yenilenmisYayinlar }));
  });
  const yenilemeSonrasiKartlar = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(
    yenilemeSonrasiKartlar.length,
    14,
    "Aynı sıfırlama anahtarında veri yenilenince açık kart sayısı korunmalı",
  );

  // 8. Arama alanı veya anahtarı değişince mobil akış kesin olarak 2 karta dönmeli
  const alanFirmaBtn = container.querySelector("[data-testid='btn-alan-firma']");
  assert.ok(alanFirmaBtn, "Arama alanı değiştirme butonu bulunmalı");
  await act(async () => {
    (alanFirmaBtn as HTMLButtonElement).click();
  });
  const aramaAlaniDegisimiSonrasiKartlar = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(
    aramaAlaniDegisimiSonrasiKartlar.length,
    2,
    "Arama alanı (alanAnahtari) değiştiğinde mobil liste kesin olarak 2 karta dönmeli",
  );

  // 9. Hedef kapsam (aktifAnaSekme) değiştiğinde mobil akış kesin olarak 2 karta dönmeli
  const yenidenDevamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(yenidenDevamBtn);
  await act(async () => {
    yenidenDevamBtn!.click();
  });
  assert.equal(mobilKapsayici.querySelectorAll(".grid-cols-1 > div").length, 7);

  await act(async () => {
    root.render(
      createElement(YayinYonetimiTestBileseni, {
        videolar: yenilenmisYayinlar,
        aktifAnaSekme: "hedef_hekim",
      }),
    );
  });
  const sekmeDegisimiSonrasiKartlar = mobilKapsayici.querySelectorAll(".grid-cols-1 > div");
  assert.equal(
    sekmeDegisimiSonrasiKartlar.length,
    2,
    "Hedef kapsam (aktifAnaSekme) değiştiğinde mobil liste kesin olarak 2 karta dönmeli",
  );

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
