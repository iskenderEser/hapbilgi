import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { GlobalWindow } from "happy-dom";
import YayindakiVideoBolumu from "@/app/(panel)/yayindaki-videolar/_components/YayindakiVideoBolumu";
import {
  VideoListesi,
  BekleyenListesi,
  GonderilenListesi,
} from "@/app/(panel)/challenge-club/page";
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

const ureticiKatalogKodu = readFileSync("app/(panel)/yayindaki-videolar/_components/UreticiYayinKatalogu.tsx", "utf8");
const sizinYayinlarinizKodu = readFileSync("app/(panel)/sizin-yayinlariniz/page.tsx", "utf8");
const tumYayinlarKodu = readFileSync("app/(panel)/tum-yayinlar/page.tsx", "utf8");
const challengeClubKodu = readFileSync("app/(panel)/challenge-club/page.tsx", "utf8");

function ornekYayindakiVideoUret(id: string, urunAdi: string): YayindakiVideo {
  return {
    yayin_id: id,
    urun_adi: urunAdi,
    teknik_adi: `Teknik ${urunAdi}`,
    video_url: "https://example.com/video.mp4",
    thumbnail_url: "https://example.com/thumb.jpg",
    video_puani: 10,
    yayin_tarihi: "2026-09-20",
    extra_puan: 0,
    ileri_sarma_acik: false,
    izlenme_sayisi: 25,
    begeni_sayisi: 7,
    favori_sayisi: 3,
    begeni_mi: false,
    favori_mi: false,
    daha_once_izledi: false,
    icerik_turu: "video",
    arac_id: `arac-${id}`,
    arac_turu: "video",
    ureten_ad_soyad: "Ahmet Yılmaz",
    ureten_rol: "pm",
    hedef_roller: ["utt", "bm"],
    talep_no: 101,
    firma_adi: "HapBilgi",
  };
}

// ─── KAPSAM A: ÜRETİCİ KATALOGLARI MİMARİ VE SÖZLEŞME TESTLERİ ────────────────

test("Faz 4 Mimari - Kapsam A: Sizin Yayınlarınız ve Tüm Yayınlar doğru kapsam parametresi iletir", () => {
  assert.match(sizinYayinlarinizKodu, /kapsam="benim"/, "sizin-yayinlariniz kapsam='benim' olmalı");
  assert.match(tumYayinlarKodu, /kapsam="digerleri"/, "tum-yayinlar kapsam='digerleri' olmalı");
});

test("Faz 4 Mimari - Kapsam A: UreticiYayinKatalogu seçim kartlarını korur, tanbur barındırmaz ve sifirlamaKapsami iletir", () => {
  // Seçim kartları (HedefKitleKartlari ve DepartmanKartlari) 2+5 listesine dönüştürülmemeli
  assert.match(ureticiKatalogKodu, /function HedefKitleKartlari/, "HedefKitleKartlari korunmalı");
  assert.match(ureticiKatalogKodu, /function DepartmanKartlari/, "DepartmanKartlari korunmalı");
  assert.doesNotMatch(ureticiKatalogKodu, /HedefKitleKartlari[\s\S]*?MobilYayinAkisi/, "Hedef kitle seçim kartı MobilYayinAkisi'ne bağlanmamalı");
  assert.doesNotMatch(ureticiKatalogKodu, /DepartmanKartlari[\s\S]*?MobilYayinAkisi/, "Departman seçim kartı MobilYayinAkisi'ne bağlanmamalı");

  // Tanbur eklenmemeli
  assert.doesNotMatch(ureticiKatalogKodu, /TanburSecici/, "Üretici kataloğuna tanbur eklenmemeli");

  // sifirlamaKapsami kapsam, hedef kitle, departman, yayın türü ve arama metnini içermeli
  assert.match(ureticiKatalogKodu, /const sifirlamaKapsami = `\$\{kapsam\}-\$\{kapsam === "benim"/, "sifirlamaKapsami gerçek filtreleri içermeli");
  assert.match(ureticiKatalogKodu, /sifirlamaKapsami=\{sifirlamaKapsami\}/, "YayinRaflari'na sifirlamaKapsami iletilmeli");
});

// ─── KAPSAM B: CHALLENGE CLUB MİMARİ VE SÖZLEŞME TESTLERİ ────────────────────

test("Faz 4 Mimari - Kapsam B: ChallengeClubPage MobilYayinAkisi kullanır, challenge_id anahtarını korur ve tanbur içermez", () => {
  // MobilYayinAkisi import edilmiş olmalı
  assert.match(challengeClubKodu, /import MobilYayinAkisi from "@\/components\/yayin\/MobilYayinAkisi"/, "MobilYayinAkisi import edilmiş olmalı");

  // Tanbur barındırmamalı
  assert.doesNotMatch(challengeClubKodu, /TanburSecici/, "Challenge Club'a tanbur eklenmemeli");

  // GonderilenListesi ve BekleyenListesi kayitAnahtari olarak challenge_id kullanmalı
  assert.match(challengeClubKodu, /kayitAnahtari=\{\(c\) => c\.challenge_id\}/, "Challenge akışlarında challenge_id benzersiz anahtar olmalı");

  // Sekme değişiminde sifirlamaAnahtari iletilmeli
  assert.match(challengeClubKodu, /sifirlamaAnahtari=\{aktifTab\}/, "Sekme değişiminde sifirlamaAnahtari={aktifTab} iletilmeli");

  // Masaüstü görünümü için CcRaf ve KartSarici korunmalı
  assert.match(challengeClubKodu, /export function CcRaf/, "CcRaf masaüstü için korunmalı");
  assert.match(challengeClubKodu, /export function KartSarici/, "KartSarici masaüstü için korunmalı");
});

// ─── KAPSAM A: ÜRETİCİ KATALOGLARI DOM ETKİLEŞİM TESTLERİ ────────────────────

test("Kapsam A - Üretici: YayindakiVideoBolumu mobilde 2 kartla başlar, 7 karta açılır ve üreten bilgisi görünür", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const videolar = Array.from({ length: 8 }, (_, i) =>
    ornekYayindakiVideoUret(`uretim-${i + 1}`, `Üretim Yayını ${i + 1}`),
  );

  let secilenYayinId = "";

  await act(async () => {
    root.render(
      createElement(YayindakiVideoBolumu, {
        videolar,
        yatayMi: true,
        uretenBilgisiGoster: true,
        sifirlamaAnahtari: "benim-utt-tumu-",
        onVideoSec: (video) => {
          secilenYayinId = video.yayin_id;
        },
      }),
    );
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi konteyneri bulunmalı");

  // 1. Başlangıçta 2 kart gösterilmeli
  const baslangicKartlari = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(baslangicKartlari.length, 2, "Mobilde başlangıçta 2 kart olmalı");

  // 2. Üreten bilgisi render edilmiş olmalı
  assert.match(mobilKapsayici.textContent ?? "", /PM Ahmet Yılmaz/, "Üreten kısa rolü ve adı görünmeli");

  // 3. Devam butonu 5 kart açmalı
  const devamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(devamBtn, "Daha Fazla Göster butonu bulunmalı");

  await act(async () => {
    devamBtn.click();
  });

  const acilmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(acilmisKartlar.length, 7, "Daha Fazla Göster ile 7 karta açılmalı");

  // 4. Karta tıklandığında onVideoSec tetiklenmeli
  const ilkKart = mobilKapsayici.querySelector(".grid > div");
  assert.ok(ilkKart, "Mobil ilk kart bulunmalı");
  const kartTiklaBtn = ilkKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(kartTiklaBtn, "Karta tıklama alanı bulunmalı");
  await act(async () => {
    (kartTiklaBtn as HTMLElement).click();
  });
  assert.equal(secilenYayinId, "uretim-1", "Karta tıklanması doğru yayın kimliği ile onVideoSec'i tetiklemeli");

  // 5. sifirlamaAnahtari değişince tekrar 2 karta dönmeli
  await act(async () => {
    root.render(
      createElement(YayindakiVideoBolumu, {
        videolar,
        yatayMi: true,
        uretenBilgisiGoster: true,
        sifirlamaAnahtari: "benim-bm-tumu-",
        onVideoSec: (video) => {
          secilenYayinId = video.yayin_id;
        },
      }),
    );
  });

  const sifirlanmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(sifirlanmisKartlar.length, 2, "Hedef/filtre anahtarı değişince akış tekrar 2 karta dönmeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ─── KAPSAM B: CHALLENGE CLUB DOM ETKİLEŞİM TESTLERİ ─────────────────────────

test("Kapsam B - Challenge Club: VideoListesi mobilde 2 kartla başlar, 7 karta açılır ve kilitli geçişi yönetir", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const videolar = Array.from({ length: 8 }, (_, i) => ({
    yayin_id: `cc-video-${i + 1}`,
    urun_adi: `CC Video ${i + 1}`,
    teknik_adi: `Teknik Video ${i + 1}`,
    video_url: "https://example.com/cc.mp4",
    thumbnail_url: "https://example.com/thumb.jpg",
    video_puani: 15,
    yayin_tarihi: "2026-09-20",
    tamamlandi_mi: false,
    kilitli: i === 0, // İlk video kilitli
  }));

  let izlenenYayinId = "";
  let kilitliGecildi = false;
  let begenilenYayinId = "";
  let favorilenenYayinId = "";

  await act(async () => {
    root.render(
      createElement(VideoListesi, {
        videolar,
        sifirlamaAnahtari: "izlenecek",
        onIzle: (id) => {
          izlenenYayinId = id;
        },
        onKilitliGecis: () => {
          kilitliGecildi = true;
        },
        onBegeni: (_e, id) => {
          begenilenYayinId = id;
        },
        onFavori: (_e, id) => {
          favorilenenYayinId = id;
        },
      }),
    );
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi bulunmalı");

  // 1. 2 kartla başlamalı
  const baslangicKartlari = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(baslangicKartlari.length, 2, "VideoListesi mobilde 2 kartla başlamalı");

  // 2. Kilitli kart uyarısı kontrolü
  assert.match(mobilKapsayici.textContent ?? "", /Bu video için gelen challenge var/, "Kilitli video uyarısı görünmeli");

  // 3. Kilitli karta tıklandığında onKilitliGecis tetiklenmeli (izleme açılmamalı)
  const ilkKart = baslangicKartlari[0];
  const ilkKartTikla = ilkKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(ilkKartTikla, "İlk karta tıklama alanı bulunmalı");
  await act(async () => {
    (ilkKartTikla as HTMLElement).click();
  });
  assert.equal(kilitliGecildi, true, "Kilitli karta tıklanınca onKilitliGecis tetiklenmeli");
  assert.equal(izlenenYayinId, "", "Kilitli kart doğrudan izleme başlatmamalı");

  // 4. Kilitsiz karta tıklandığında onIzle tetiklenmeli
  const ikinciKart = baslangicKartlari[1];
  const ikinciKartTikla = ikinciKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(ikinciKartTikla, "İkinci karta tıklama alanı bulunmalı");
  await act(async () => {
    (ikinciKartTikla as HTMLElement).click();
  });
  assert.equal(izlenenYayinId, "cc-video-2", "Kilitsiz kart onIzle'yi tetiklemeli");

  // 5. Beğeni ve favori etkileşimleri tetiklenmeli
  const begeniBtn = ilkKart.querySelector("button[aria-label*='Beğen']");
  assert.ok(begeniBtn, "Beğeni butonu bulunmalı");
  await act(async () => {
    (begeniBtn as HTMLElement).click();
  });
  assert.equal(begenilenYayinId, "cc-video-1", "Beğeni butonu onBegeni'yi tetiklemeli");

  const favoriBtn = ilkKart.querySelector("button[aria-label*='Favori']");
  assert.ok(favoriBtn, "Favori butonu bulunmalı");
  await act(async () => {
    (favoriBtn as HTMLElement).click();
  });
  assert.equal(favorilenenYayinId, "cc-video-1", "Favori butonu onFavori'yi tetiklemeli");

  // 6. Daha Fazla Göster butonu ile 7 karta açılmalı
  const devamBtn = Array.from(mobilKapsayici.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Daha Fazla Göster"),
  );
  assert.ok(devamBtn, "Daha Fazla Göster butonu bulunmalı");
  await act(async () => {
    devamBtn.click();
  });
  const acilmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(acilmisKartlar.length, 7, "7 karta açılmalı");

  // 7. sifirlamaAnahtari değişince 2 karta dönmeli
  await act(async () => {
    root.render(
      createElement(VideoListesi, {
        videolar,
        sifirlamaAnahtari: "bekleyen",
        onIzle: () => {},
        onKilitliGecis: () => {},
        onBegeni: () => {},
        onFavori: () => {},
      }),
    );
  });
  const sifirlanmisKartlar = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(sifirlanmisKartlar.length, 2, "Sekme/anahtar değişince 2 karta dönmeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("Kapsam B - Challenge Club: BekleyenListesi challenge_id kimliğini korur ve gönderen/durum şeridini gösterir", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  // Aynı yayin_id'ye sahip fakat iki farklı challenge kaydı
  const bekleyenler = [
    {
      challenge_id: "ch-101",
      yayin_id: "ortak-yayin-1",
      created_at: "2026-09-20",
      izlendi_mi: false,
      durum: "bekliyor" as const,
      gonderen: { ad: "Zeynep", soyad: "Kaya" },
      urun_adi: "Kardiyoloji HapBilgi",
    },
    {
      challenge_id: "ch-102",
      yayin_id: "ortak-yayin-1", // Aynı yayın!
      created_at: "2026-09-20",
      izlendi_mi: false,
      durum: "bekliyor" as const,
      gonderen: { ad: "Murat", soyad: "Demir" },
      urun_adi: "Kardiyoloji HapBilgi",
    },
    {
      challenge_id: "ch-103",
      yayin_id: "yayin-2",
      created_at: "2026-09-20",
      izlendi_mi: true,
      durum: "izlendi" as const,
      gonderen: { ad: "Can", soyad: "Yıldız" },
      urun_adi: "Diyabet HapBilgi",
    },
  ];

  let tiklananYayinId = "";
  let tiklananChallengeId: string | undefined = "";

  await act(async () => {
    root.render(
      createElement(BekleyenListesi, {
        bekleyenler,
        sifirlamaAnahtari: "bekleyen",
        onIzle: (yayinId, challengeId) => {
          tiklananYayinId = yayinId;
          tiklananChallengeId = challengeId;
        },
        onBegeni: () => {},
        onFavori: () => {},
      }),
    );
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi bulunmalı");

  // 1. İki farklı challenge aynı yayin_id'ye sahip olsa bile ayrı ayrı render edilmeli (birleştirilmemeli)
  const baslangicKartlari = mobilKapsayici.querySelectorAll(".grid > div");
  assert.equal(baslangicKartlari.length, 2, "Mobilde ilk 2 challenge görünmeli");

  // 2. Gönderen bilgileri ve durum metinleri ayrı ayrı görünmeli
  assert.match(mobilKapsayici.textContent ?? "", /Zeynep Kaya · Bekliyor/, "İlk challenge gönderen/durum görünmeli");
  assert.match(mobilKapsayici.textContent ?? "", /Murat Demir · Bekliyor/, "İkinci challenge gönderen/durum görünmeli");

  // 3. Bekleyen challenge tıklandığında challenge_id parametresi iletilmeli
  const ilkKart = baslangicKartlari[0];
  const ilkKartTikla = ilkKart.querySelector("div[class*='cursor-pointer']");
  assert.ok(ilkKartTikla, "Kart tıklama alanı bulunmalı");
  await act(async () => {
    (ilkKartTikla as HTMLElement).click();
  });
  assert.equal(tiklananYayinId, "ortak-yayin-1", "Yayın ID iletilmeli");
  assert.equal(tiklananChallengeId, "ch-101", "Bekleyen challenge izlenirken challenge_id korunarak iletilmeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test("Kapsam B - Challenge Club: GonderilenListesi alıcı ve durum şeridini doğru sunar", async () => {
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container);

  const gonderdiklerim = [
    {
      challenge_id: "gond-1",
      yayin_id: "yayin-3",
      created_at: "2026-09-20",
      izlendi_mi: true,
      durum: "izlendi" as const,
      alan: { ad: "Ayşe", soyad: "Öztürk" },
      urun_adi: "Onkoloji HapBilgi",
    },
  ];

  let tiklananYayinId = "";

  await act(async () => {
    root.render(
      createElement(GonderilenListesi, {
        gonderdiklerim,
        sifirlamaAnahtari: "gonderilen",
        onIzle: (yayinId) => {
          tiklananYayinId = yayinId;
        },
        onBegeni: () => {},
        onFavori: () => {},
      }),
    );
  });

  const mobilKapsayici = container.querySelector(".sm\\:hidden");
  assert.ok(mobilKapsayici, "Mobilde MobilYayinAkisi bulunmalı");

  // 1. Alıcı bilgisi ve İzlendi durumu görünmeli
  assert.match(mobilKapsayici.textContent ?? "", /Alıcı: Ayşe Öztürk · İzlendi/, "Alıcı ve durum şeridi görünmeli");

  // 2. Karta tıklandığında onIzle çalışmalı
  const kart = mobilKapsayici.querySelector(".grid > div");
  assert.ok(kart, "Kart bulunmalı");
  const kartTikla = kart.querySelector("div[class*='cursor-pointer']");
  assert.ok(kartTikla, "Karta tıklama alanı bulunmalı");
  await act(async () => {
    (kartTikla as HTMLElement).click();
  });
  assert.equal(tiklananYayinId, "yayin-3", "Gönderilen challenge yayını onIzle'yi tetiklemeli");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
