import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement, act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import { UttKayanVideoRafi, type UttVideo } from "@/components/video/UttVideoKarti";

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

const uttVideoKartiKodu = readFileSync("components/video/UttVideoKarti.tsx", "utf8");
const uttAnaSayfaKodu = readFileSync("components/ana-sayfa/UttAnaSayfa.tsx", "utf8");
const uyeOnerilerKodu = readFileSync("app/(panel)/oneriler/_components/UyeOnerilerGorunumu.tsx", "utf8");

function ornekVideoUret(id: string, urunAdi: string): UttVideo {
  return {
    yayin_id: id,
    urun_adi: urunAdi,
    teknik_adi: `Teknik ${urunAdi}`,
    video_url: "https://example.com/video.mp4",
    thumbnail_url: "https://example.com/thumb.jpg",
    video_puani: 10,
    yayin_tarihi: "2026-09-20",
    extra_puan: 5,
    ileri_sarma_acik: false,
    izlenme_sayisi: 42,
    begeni_sayisi: 5,
    favori_sayisi: 3,
    begeni_mi: false,
    favori_mi: false,
    daha_once_izledi: false,
    icerik_turu: "video",
    arac_id: `arac-${id}`,
  };
}

// --------------------------------------------------------------------------
// 1. STATİK MİMARİ VE SÖZLEŞME DENETİMLERİ
// --------------------------------------------------------------------------

test("Faz 2 mimari: UttKayanVideoRafi MobilYayinAkisi kullanır ve bağımsız 2+5 state'i barındırmaz", () => {
  assert.match(uttVideoKartiKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/);
  assert.match(uttVideoKartiKodu, /<MobilYayinAkisi<T>/);

  // Bağımsız state ve slice kodlarının kalktığını doğrula
  assert.doesNotMatch(uttVideoKartiKodu, /useState\(2\)/);
  assert.doesNotMatch(uttVideoKartiKodu, /setGorunenSayisi/);
  assert.doesNotMatch(uttVideoKartiKodu, /videolar\.slice\(0,\s*gorunenSayisi\)/);
  assert.doesNotMatch(uttVideoKartiKodu, /varsayilanAcik/);
});

test("Faz 2 mimari: UttAnaSayfa Kategori ve Aktif Durum listelerini MobilYayinAkisi'ne bağlar, Tanbur korunur", () => {
  assert.match(uttAnaSayfaKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/);

  // KategoriYayinlariGoster içinde MobilYayinAkisi kullanımı
  assert.match(uttAnaSayfaKodu, /<MobilYayinAkisi<Video>[\s\S]*sifirlamaAnahtari=.*kategoriBaslik/);

  // aktifDurumVideolari içinde MobilYayinAkisi kullanımı
  assert.match(uttAnaSayfaKodu, /<MobilYayinAkisi<Video>[\s\S]*sifirlamaAnahtari=\{aktifDurumFiltresi\}/);

  // KayanRaf çağrılarından varsayilanAcik kalkmalı
  assert.doesNotMatch(uttAnaSayfaKodu, /<KayanRaf[\s\S]*varsayilanAcik=/);

  // UTT Hayalet Tanbur korunmalı
  assert.match(uttAnaSayfaKodu, /<HayaletTanburSecici[\s\S]*bolumler=\{tanburBolumleri\}/);
});

test("Faz 2 mimari: UyeOnerilerGorunumu MobilYayinAkisi kullanır ve oneri_id anahtarını korur", () => {
  assert.match(uyeOnerilerKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/);
  assert.match(uyeOnerilerKodu, /<MobilYayinAkisi<OneriKaydi>/);
  assert.match(uyeOnerilerKodu, /kayitAnahtari=\{\(o\)\s*=>\s*o\.oneri_id\}/);

  // Öneri künye bilgileri korunmalı
  assert.match(uyeOnerilerKodu, /Öneren/);
  assert.match(uyeOnerilerKodu, /Başlangıç/);
  assert.match(uyeOnerilerKodu, /Bitiş/);
  assert.match(uyeOnerilerKodu, /\+10/);
});

// --------------------------------------------------------------------------
// 2. DOĞRUDAN BİLEŞEN ETKİLEŞİMİ VE RENDER TESTLERİ
// --------------------------------------------------------------------------

test("UttKayanVideoRafi: mobilde 2 kartla başlar, Daha Fazla Göster ile 7 karta açılır ve masaüstü rafı korunur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const videolar = Array.from({ length: 8 }, (_, i) =>
    ornekVideoUret(`v-${i + 1}`, `Video ${i + 1}`),
  );

  let begenilenId = "";
  let tiklananId = "";

  await act(async () => {
    root.render(
      createElement(UttKayanVideoRafi<UttVideo>, {
        baslik: "Kaldığınız Yerden Devam Edin",
        videolar,
        onVideoClick: (v) => {
          tiklananId = v.yayin_id;
        },
        onBegeni: (_e, id) => {
          begenilenId = id;
        },
        onFavori: () => {},
        sifirlamaAnahtari: "tanbur-tumu",
      }),
    );
  });

  // Masaüstü kayan rafı bulunmalı (hidden sm:block içinde)
  const masaustuRaf = container.querySelector(".snap-x");
  assert.ok(masaustuRaf, "Masaüstü yatay kayan rafı bulunmalı");
  assert.equal(masaustuRaf.querySelectorAll(".snap-start").length, 8, "Masaüstü rafında tüm 8 video olmalı");

  // Mobil akışında başlangıçta tam 2 kart görünmeli
  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobil akış konteyneri bulunmalı");
  const mobilKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(mobilKartlar.length, 2, "Mobilde başlangıçta tam 2 kart gösterilmeli");

  // Devam butonu "+5 (6 içerik kaldı)" şeklinde olmalı
  const btn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(btn, "Devam butonu mobilde bulunmalı");
  assert.match(btn.textContent ?? "", /Daha Fazla Göster \(\+5\)/);
  assert.match(btn.textContent ?? "", /6 içerik kaldı/);

  // Butona tıkla -> 2 + 5 = 7 kart olmalı
  await act(async () => {
    btn?.click();
  });

  const guncelMobilKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(guncelMobilKartlar.length, 7, "Tıklamadan sonra mobilde 7 kart olmalı");

  // Şimdi buton "+1 (1 içerik kaldı)" göstermeli
  const guncelBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(guncelBtn);
  assert.match(guncelBtn.textContent ?? "", /Daha Fazla Göster \(\+1\)/);
  assert.match(guncelBtn.textContent ?? "", /1 içerik kaldı/);

  // sifirlamaAnahtari değişince (örn. tanbur bölümü değişti) kartlar tekrar 2'ye dönmeli
  await act(async () => {
    root.render(
      createElement(UttKayanVideoRafi<UttVideo>, {
        baslik: "Kaldığınız Yerden Devam Edin",
        videolar,
        onVideoClick: (v) => {
          tiklananId = v.yayin_id;
        },
        onBegeni: (_e, id) => {
          begenilenId = id;
        },
        onFavori: () => {},
        sifirlamaAnahtari: "tanbur-yeni",
      }),
    );
  });

  const sifirlanmisKartlar = container.querySelector(".sm\\:hidden")?.querySelectorAll(".grid > div");
  assert.equal(sifirlanmisKartlar?.length, 2, "sifirlamaAnahtari değişince mobil görünüm 2 karta sıfırlanmalı");

  // Kart ve beğeni tıklama doğrulamaları
  const ilkKart = mobilKapsayici.querySelector(".grid > div");
  const kartTiklaBtn = ilkKart?.querySelector("div[class*='cursor-pointer']");
  if (kartTiklaBtn) {
    await act(async () => {
      (kartTiklaBtn as HTMLElement).click();
    });
    assert.equal(tiklananId, "v-1", "Karta tıklanması ilgili videoyu açmalı");
  }

  const begeniBtn = ilkKart?.querySelector("button");
  if (begeniBtn) {
    await act(async () => {
      begeniBtn.click();
    });
    assert.equal(begenilenId, "v-1", "Beğeniye tıklanması onBegeni callback'ini tetiklemeli");
  }

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("UttKayanVideoRafi: kartAlti (ekstra izleme bilgisi) hem mobil hem masaüstünde korunur", () => {
  const videolar = [
    {
      ...ornekVideoUret("v-1", "Ekstra Video"),
      bu_turda_izleme: 2,
      bu_ay_extra_kazanildi: true,
      extra_kalan: 0,
    },
  ];

  const html = renderToStaticMarkup(
    createElement(UttKayanVideoRafi<UttVideo & { bu_turda_izleme: number; bu_ay_extra_kazanildi: boolean; extra_kalan: number }>, {
      baslik: "Ekstra İzlediklerim",
      videolar,
      onVideoClick: () => {},
      onBegeni: () => {},
      onFavori: () => {},
      kartAlti: (v) => createElement("span", { className: "ozel-ekstra-rozet" }, `Turda: ${v.bu_turda_izleme}`),
    }),
  );

  assert.match(html, /ozel-ekstra-rozet/);
  assert.match(html, /Turda: 2/);
});
