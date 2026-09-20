import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import { VideoRafi } from "@/app/(panel)/eclub/panel/_components/EclubFirmaVideoKatalogu";
import type { PanelOneri } from "@/app/(panel)/eclub/panel/_hooks/useEclubPanel";
import EczanemVideoRafi from "@/app/eczanem/_components/EczanemVideoRafi";
import type { EczanemMusteriVideo } from "@/app/eczanem/_types";

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

test("Faz 5 Mimari: EczanemVideoRafi MobilYayinAkisi kullanır, gonderim_id anahtarını korur ve tanbur içermez", () => {
  assert.match(eczanemVideoRafiKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/, "MobilYayinAkisi import edilmiş olmalı");
  assert.match(eczanemVideoRafiKodu, /kayitAnahtari=\{\(video\) => `\$\{baslik\}-\$\{video\.gonderim_id\}`\}/, "kayitAnahtari gonderim_id'yi korumalı");
  assert.match(eczanemVideoRafiKodu, /masaustuIcerik=\{masaustuIcerik\}/, "Masaüstü rafı masaustuIcerik slotunda korunmalı");
  assert.match(eczanemPageKodu, /sifirlamaAnahtari: sifirlamaKapsami/, "eczanem/page.tsx sifirlamaAnahtari iletmeli");
  assert.doesNotMatch(eczanemVideoRafiKodu, /TanburSecici/, "Eczanem bileşenine tanbur eklenmemeli");
});

test("Faz 5 Mimari: YayinYonetimi aktif yayınlar kartGorunumu MobilYayinAkisi'ne bağlıdır, işlem satırları korunur", () => {
  assert.match(yayinYonetimiKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/, "YayinYonetimi MobilYayinAkisi import etmeli");
  assert.match(yayinYonetimiKodu, /<MobilYayinAkisi[\s\S]*?kayitlar=\{yayindaListe\.gorunen\}[\s\S]*?kartGorunumu/, "Aktif yayınlar MobilYayinAkisi'ne bağlanmalı");
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

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
