import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import SahaVideoRaflari from "@/components/ana-sayfa/SahaVideoRaflari";
import VideoBolumu from "@/components/ana-sayfa/VideoBolumu";
import YayindakiVideoBolumu from "@/app/(panel)/yayindaki-videolar/_components/YayindakiVideoBolumu";
import type { SahaAnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import type { YayindakiVideo } from "@/lib/video/yayindakiVideolar";

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

const sahaVideoRaflariKodu = readFileSync("components/ana-sayfa/SahaVideoRaflari.tsx", "utf8");
const videoBolumuKodu = readFileSync("components/ana-sayfa/VideoBolumu.tsx", "utf8");
const yayindakiVideoBolumuKodu = readFileSync("app/(panel)/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx", "utf8");
const klasorGridKodu = readFileSync("app/(panel)/yayindaki-videolar/_components/KlasorGrid.tsx", "utf8");
const yayindakiVideolarPageKodu = readFileSync("app/(panel)/yayindaki-videolar/page.tsx", "utf8");

function ornekSahaVideoUret(id: string, urunAdi: string): SahaAnaSayfaVideo {
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
    izlenme_sayisi: 50,
    begeni_sayisi: 10,
    favori_sayisi: 4,
    begeni_mi: false,
    favori_mi: false,
    daha_once_izledi: false,
    icerik_turu: "video",
    arac_id: `arac-${id}`,
    arac_turu: "video",
  };
}

function ornekYayindakiVideoUret(id: string, urunAdi: string): YayindakiVideo {
  return {
    yayin_id: id,
    urun_adi: urunAdi,
    teknik_adi: `Teknik ${urunAdi}`,
    video_url: "https://example.com/video.mp4",
    thumbnail_url: "https://example.com/thumb.jpg",
    video_puani: 15,
    extra_puan: 5,
    yayin_tarihi: "2026-09-20",
    icerik_turu: "video",
    ileri_sarma_acik: false,
    izlenme_sayisi: 25,
    begeni_sayisi: 8,
    favori_sayisi: 2,
    arac_id: `arac-${id}`,
    arac_turu: "video",
    ureten_rol: "pm",
    ureten_ad_soyad: "Ahmet Yılmaz",
    hedef_roller: ["utt", "bm"],
  };
}

// --------------------------------------------------------------------------
// 1. STATİK MİMARİ VE SÖZLEŞME DENETİMLERİ
// --------------------------------------------------------------------------

test("Faz 3 mimari: SahaVideoRaflari MobilYayinAkisi kullanır ve bağımsız 2+5 state'i barındırmaz", () => {
  assert.match(sahaVideoRaflariKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/);
  assert.match(sahaVideoRaflariKodu, /<MobilYayinAkisi<SahaAnaSayfaVideo>/);

  // Bağımsız state ve slice kodlarının kalktığını doğrula
  assert.doesNotMatch(sahaVideoRaflariKodu, /useState\(2\)/);
  assert.doesNotMatch(sahaVideoRaflariKodu, /setGorunenSayisi/);
  assert.doesNotMatch(sahaVideoRaflariKodu, /videolar\.slice\(0,\s*gorunenSayisi\)/);
  assert.doesNotMatch(sahaVideoRaflariKodu, /varsayilanAcik/);
});

test("Faz 3 mimari: VideoBolumu MobilYayinAkisi ve YayinKarti kullanır, sahte 0 değerleri basmaz", () => {
  assert.match(videoBolumuKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/);
  assert.match(videoBolumuKodu, /import \{ YayinKarti \} from "@\/components\/yayin\/YayinKarti"/);
  assert.match(videoBolumuKodu, /<MobilYayinAkisi<AnaSayfaVideo>/);

  // Sahte 0 etkileşim / izlenme kapatılmış olmalı
  assert.match(videoBolumuKodu, /etkilesimGoster=\{false\}/);
  assert.match(videoBolumuKodu, /izlenmeGoster=\{false\}/);
});

test("Faz 3 mimari: YayindakiVideoBolumu MobilYayinAkisi kullanır ve masaüstü yatay/grid desteğini korur", () => {
  assert.match(yayindakiVideoBolumuKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/);
  assert.match(yayindakiVideoBolumuKodu, /<MobilYayinAkisi<YayindakiVideo>/);
});

test("Faz 3 mimari: KlasorGrid ve yayindaki-videolar page.tsx arama alanı değişimlerini sifirlamaAnahtari'na bağlar", () => {
  // page.tsx arama alanını KlasorGrid'e iletir
  assert.match(yayindakiVideolarPageKodu, /aramaAlani=\{liste\.arama\.alanAnahtari\}/);

  // KlasorGrid aramaAlani prop'unu sifirlamaAnahtari'na ekler
  assert.match(klasorGridKodu, /aramaAlani\?: string/);
  assert.match(klasorGridKodu, /sifirlamaAnahtari=.*aramaAlani.*aramaMetni/);
});

// --------------------------------------------------------------------------
// 2. ETKİLEŞİM VE RENDER TESTLERİ
// --------------------------------------------------------------------------

test("SahaVideoRaflari: mobilde 2 kartla başlar, Daha Fazla Göster ile 7 karta açılır ve masaüstü rafı korunur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const videolar = Array.from({ length: 8 }, (_, i) =>
    ornekSahaVideoUret(`saha-${i + 1}`, `Saha İçerik ${i + 1}`),
  );

  let secilenId = "";

  await act(async () => {
    root.render(
      createElement(SahaVideoRaflari, {
        videolar,
        onVideoSec: (v) => {
          secilenId = v.yayin_id;
        },
      }),
    );
  });

  // Masaüstü kayan rafı bulunmalı (hidden sm:block içinde)
  const masaustuRaf = container.querySelector(".snap-x");
  assert.ok(masaustuRaf, "Masaüstü yatay kayan rafı bulunmalı");

  // Mobil akışında başlangıçta tam 2 kart görünmeli
  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobil akış konteyneri bulunmalı");
  const mobilKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(mobilKartlar.length, 2, "Mobilde başlangıçta tam 2 kart gösterilmeli");

  // Devam butonu "+5 (6 içerik kaldı)"
  const btn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(btn, "Devam butonu mobilde bulunmalı");
  assert.match(btn.textContent ?? "", /Daha Fazla Göster \(\+5\)/);

  // Butona tıkla -> 7 kart olmalı
  await act(async () => {
    btn.click();
  });

  const guncelMobilKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(guncelMobilKartlar.length, 7, "Tıklamadan sonra mobilde 7 kart olmalı");

  // Karta tıklanması onVideoSec'i tetiklemeli
  const ilkKart = mobilKapsayici.querySelector(".grid > div");
  assert.ok(ilkKart, "İlk kart bulunmalı");
  const kartTiklaBtn = ilkKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(kartTiklaBtn, "Karta tıklama alanı bulunmalı");
  await act(async () => {
    (kartTiklaBtn as HTMLElement).click();
  });
  assert.ok(secilenId.startsWith("saha-"), "Karta tıklanması onVideoSec callback'ini tetiklemeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("VideoBolumu: mobilde 2 kartla başlar, masaüstü grid içeriğini korur, kart tıklaması onVideoSec tetikler", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const videolar = Array.from({ length: 6 }, (_, i) =>
    ornekSahaVideoUret(`yonetici-${i + 1}`, `Yönetici Video ${i + 1}`),
  );

  let secilenId = "";

  await act(async () => {
    root.render(
      createElement(VideoBolumu, {
        videolar,
        onVideoSec: (v) => {
          secilenId = v.yayin_id;
        },
      }),
    );
  });

  // Masaüstü ızgarası hidden sm:block içinde
  const masaustuGrid = container.querySelector(".hidden.sm\\:block .grid");
  assert.ok(masaustuGrid, "Masaüstü ızgarası korunmalı");

  // Mobilde başlangıçta 2 kart
  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobil akış bulunmalı");
  const kartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(kartlar.length, 2, "Mobilde başlangıçta 2 kart olmalı");

  // Karta tıklanması onVideoSec callback'ini doğru yayın kimliğiyle tetiklemeli
  const ilkKart = mobilKapsayici.querySelector(".grid > div");
  assert.ok(ilkKart, "Mobil ilk kart bulunmalı");
  const kartTiklaBtn = ilkKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(kartTiklaBtn, "Karta tıklama alanı bulunmalı");
  await act(async () => {
    (kartTiklaBtn as HTMLElement).click();
  });
  assert.equal(secilenId, "yonetici-1", "Karta tıklanması onVideoSec'i doğru yayın kimliği ile tetiklemeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("YayindakiVideoBolumu: mobilde 2 kartla başlar, 7 karta açılır, sifirlamaAnahtari ile 2 karta döner ve ring vurgusu uygulanır", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const videolar = Array.from({ length: 8 }, (_, i) =>
    ornekYayindakiVideoUret(`yayin-${i + 1}`, `Yayındaki Video ${i + 1}`),
  );

  let oynaticiAcildi = false;
  let onerilenVideoId = "";

  await act(async () => {
    root.render(
      createElement(YayindakiVideoBolumu, {
        videolar,
        yatayMi: true,
        oneriModu: true,
        secilenYayinlar: ["yayin-1"],
        sifirlamaAnahtari: "kapsam-a",
        onVideoSec: () => {
          oynaticiAcildi = true;
        },
        onOneriSec: (v) => {
          onerilenVideoId = v.yayin_id;
        },
      }),
    );
  });

  // Mobilde yatay raf dayatılmamalı, MobilYayinAkisi (sm:hidden) 2 kartla başlamalı
  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi konteyneri bulunmalı");
  const baslangicKartlari = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(baslangicKartlari.length, 2, "Mobilde yatayMi dayatılmamalı ve başlangıçta 2 kart olmalı");

  // Seçili yayında border/ring görsel vurgusunun gerçekten uygulandığını doğrula
  const seciliKartVurgusu = mobilKapsayici.querySelector(".ring-2");
  assert.ok(seciliKartVurgusu, "Seçili yayında ring-2 görsel vurgusu uygulanmalı");
  assert.match(seciliKartVurgusu.className, /border-\[#2f7fc7\]/, "Seçili yayında mavi border sınıfı bulunmalı");

  // Butonla 7 karta açıldığını doğrula
  const devamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(devamBtn, "Daha Fazla Göster butonu bulunmalı");
  assert.match(devamBtn.textContent ?? "", /Daha Fazla Göster \(\+5\)/);

  await act(async () => {
    devamBtn.click();
  });

  const acilmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(acilmisKartlar.length, 7, "Devam butonuna tıklanınca 7 kart görünmeli");

  // sifirlamaAnahtari değişince tekrar 2 karta döndüğünü doğrula
  await act(async () => {
    root.render(
      createElement(YayindakiVideoBolumu, {
        videolar,
        yatayMi: true,
        oneriModu: true,
        secilenYayinlar: ["yayin-1"],
        sifirlamaAnahtari: "kapsam-b",
        onVideoSec: () => {
          oynaticiAcildi = true;
        },
        onOneriSec: (v) => {
          onerilenVideoId = v.yayin_id;
        },
      }),
    );
  });

  const sifirlanmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(sifirlanmisKartlar.length, 2, "sifirlamaAnahtari değişince liste tekrar 2 karta dönmeli");

  // Öneri butonuna tıklandığında stopPropagation ile onVideoSec açılmamalı, onOneriSec tetiklenmeli
  const oneriBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Öneriden Çıkar") || b.textContent?.includes("Öneriye Ekle"),
  );
  assert.ok(oneriBtn, "Öneri seçim butonu bulunmalı");

  await act(async () => {
    oneriBtn.click();
  });

  assert.equal(onerilenVideoId, "yayin-1", "onOneriSec callback'i tıklanan yayını iletmeli");
  assert.equal(oynaticiAcildi, false, "Öneri seçildiğinde oynatıcı açılmamalı (stopPropagation korunmalı)");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("Yayindaki Videolar: aramaAlani değişince 7 karttan 2'ye sıfırlanır, aynı anahtarda veri yenilenince 7 kart korunur", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const testVideolari = Array.from({ length: 8 }, (_, i) =>
    ornekYayindakiVideoUret(`yayin-grid-${i + 1}`, `Yayındaki Video ${i + 1}`),
  );

  function KlasorAramaSimulasyonu({
    videolar,
    aramaAlani,
    aramaMetni,
  }: {
    videolar: YayindakiVideo[];
    aramaAlani: string;
    aramaMetni: string;
  }) {
    // KlasorGrid içindeki YayindakiVideoBolumu kullanımını simüle eder
    const sifirlamaAnahtari = `klasor-1-${aramaAlani}-${aramaMetni}`;
    return createElement(YayindakiVideoBolumu, {
      videolar,
      yatayMi: false,
      sifirlamaAnahtari,
    });
  }

  // 1. Başlangıçta 8 kayıt (2 kart gösterilmeli)
  await act(async () => {
    root.render(
      createElement(KlasorAramaSimulasyonu, {
        videolar: testVideolari,
        aramaAlani: "tumu",
        aramaMetni: "Video",
      }),
    );
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi konteyneri bulunmalı");
  const baslangicKartlari = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(baslangicKartlari.length, 2, "Başlangıçta tam 2 kart olmalı");

  // 2. Devam butonuna bas -> 7 kart olmalı
  const devamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(devamBtn, "Daha Fazla Göster butonu bulunmalı");
  await act(async () => {
    devamBtn.click();
  });

  const acilmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(acilmisKartlar.length, 7, "Devam butonu sonrası 7 kart olmalı");

  // 3. Yalnızca aramaAlani değiştiğinde (aramaMetni aynı), DOM 2 karta sıfırlanmalı
  await act(async () => {
    root.render(
      createElement(KlasorAramaSimulasyonu, {
        videolar: testVideolari,
        aramaAlani: "urun",
        aramaMetni: "Video",
      }),
    );
  });

  const sifirlanmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(
    sifirlanmisKartlar.length,
    2,
    "Yalnızca aramaAlani değiştiğinde mobil görünüm kesin olarak 2 karta dönmeli",
  );

  // 4. Tekrar 7 karta aç
  const yeniDevamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(yeniDevamBtn);
  await act(async () => {
    yeniDevamBtn.click();
  });
  assert.equal(mobilKapsayici.querySelectorAll(".grid > div").length, 7);

  // 5. Aynı sıfırlama anahtarında veri yenilendiğinde 7 kart KORUNMALI
  const yenilenmisVideolar = testVideolari.map((v) => ({ ...v, urun_adi: `${v.urun_adi} Yenilenen` }));
  await act(async () => {
    root.render(
      createElement(KlasorAramaSimulasyonu, {
        videolar: yenilenmisVideolar,
        aramaAlani: "urun",
        aramaMetni: "Video",
      }),
    );
  });

  const korunanKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(
    korunanKartlar.length,
    7,
    "Aynı sıfırlama anahtarında veri yenilendiğinde açık 7 kart korunmalı",
  );

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("HOYK Puan Görünürlüğü: Saha, Yayın ve Yönetici bileşenlerinde video_puani ve extra_puan gösterilir", async () => {
  // Statik kod denetimi: puanGoster={false} engeli kaldırılmış olmalı
  assert.doesNotMatch(sahaVideoRaflariKodu, /puanGoster=\{false\}/);
  assert.doesNotMatch(yayindakiVideoBolumuKodu, /puanGoster=\{false\}/);

  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  // 1. SahaVideoRaflari render denetimi
  const sahaVideolari = [ornekSahaVideoUret("saha-puan-1", "Saha Puan Video")];
  await act(async () => {
    root.render(
      createElement(SahaVideoRaflari, {
        videolar: sahaVideolari,
        onVideoSec: () => {},
      }),
    );
  });
  assert.match(container.textContent ?? "", /10\s*(P|Puan)/, "SahaVideoRaflari video puanını göstermeli");
  assert.match(container.textContent ?? "", /\+5 Extra/, "SahaVideoRaflari ekstra puanını göstermeli");

  // 2. YayindakiVideoBolumu render denetimi
  const yayindakiVideolar = [ornekYayindakiVideoUret("yayin-puan-1", "Yayındaki Puan Video")];
  await act(async () => {
    root.render(
      createElement(YayindakiVideoBolumu, {
        videolar: yayindakiVideolar,
        onVideoSec: () => {},
      }),
    );
  });
  assert.match(container.textContent ?? "", /15\s*(P|Puan)/, "YayindakiVideoBolumu video puanını göstermeli");
  assert.match(container.textContent ?? "", /\+5 Extra/, "YayindakiVideoBolumu ekstra puanını göstermeli");

  // 3. VideoBolumu render denetimi
  const yoneticiVideolari = [
    {
      ...ornekSahaVideoUret("yonetici-puan-1", "Yönetici Puan Video"),
      video_puani: 20,
      extra_puan: 10,
    },
  ];
  await act(async () => {
    root.render(
      createElement(VideoBolumu, {
        videolar: yoneticiVideolari,
        onVideoSec: () => {},
      }),
    );
  });
  assert.match(container.textContent ?? "", /20/, "VideoBolumu video puanını göstermeli");
  assert.match(container.textContent ?? "", /\+10 Extra/, "VideoBolumu ekstra puanını göstermeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
