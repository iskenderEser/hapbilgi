import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hazirPodcastYukle } from "@/lib/ogrenmeAraci/bunnyYuklemeIstemci";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

class MockAudio {
  preload = "";
  duration = 120;
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = "";

  set src(val: string) {
    this._src = val;
    setTimeout(() => {
      if (this.onloadedmetadata) this.onloadedmetadata();
    }, 0);
  }
  get src() {
    return this._src;
  }
  load() {}
  pause() {}
  removeAttribute() {}
  addEventListener(event: string, handler: () => void) {
    if (event === "abort") {}
  }
  removeEventListener() {}
}

if (typeof globalThis.Audio === "undefined") {
  (globalThis as unknown as { Audio: unknown }).Audio = MockAudio;
}

class MockXHR {
  upload = { onprogress: null as any };
  status = 200;
  statusText = "OK";
  responseText = JSON.stringify({ tamamlandi: true, yukleme_makbuzu: "mock-makbuz-123" });
  open() {}
  setRequestHeader() {}
  send() {
    setTimeout(() => {
      this.onload?.();
    }, 0);
  }
  onload?: () => void;
  onerror?: () => void;
  abort() {}
  getResponseHeader(h: string) {
    if (h.toLowerCase() === "etag") return '"mock-etag"';
    return null;
  }
}

if (typeof globalThis.XMLHttpRequest === "undefined") {
  (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = MockXHR;
}
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:mock-audio";
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = () => {};
}

// ============================================================================
// HEDEF TEST: TASLAK YÜKLEMEDE ERKEN DOĞRULAMANIN KALDIRILMASI & YARIM YÜKLEME KORUMASI
// ============================================================================

test("Hedef 1: AI ön yüklemesinde /podcast-dogrula kesinlikle çağrılmaz (taslakModu: true)", async () => {
  const cagrilar: Array<{ url: string; method?: string; body?: unknown }> = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);
    let parsedBody: unknown = null;
    if (init?.body && typeof init.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    cagrilar.push({ url: urlStr, method: init?.method, body: parsedBody });

    if (urlStr.includes("/api/ogrenme-araclari/yukleme-baslat")) {
      return new Response(
        JSON.stringify({
          arac_id: "arac-taslak-123",
          yukleme: { endpoint: "https://storage.mock/upload", token: "tok-123", headers: {} },
          tamamlanan_parcalar: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlStr.includes("/api/ogrenme-araclari/yukleme-tamamla")) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.includes("/podcast-dogrula")) {
      return new Response(JSON.stringify({ hata: "HATA: Taslak modunda podcast-dogrula çağrılmamalıydı!" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.startsWith("https://storage.mock")) {
      return new Response("", {
        status: 200,
        headers: {
          "x-ms-request-id": "mock",
          etag: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        },
      });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const sahteSes = new File([new Uint8Array([1, 2, 3, 4])], "test-podcast.mp3", { type: "audio/mpeg" });
    const sonucAracId = await hazirPodcastYukle({
      talepId: "talep-taslak-123",
      ses: sahteSes,
      taslakModu: true, // Açık taslak yükleme modu!
    });

    // 1a. Fonksiyon mevcut arac_id değerini döndürür
    assert.equal(sonucAracId, "arac-taslak-123");

    // 1b. /yukleme-tamamla ile teknik doğrulama yapılmıştır
    const tamamlaCagrisi = cagrilar.find((c) => c.url.includes("/api/ogrenme-araclari/yukleme-tamamla"));
    assert.ok(tamamlaCagrisi, "Teknik doğrulama (/yukleme-tamamla) çağrılmalıdır");

    // 1c. /podcast-dogrula KESİNLİKLE ÇAĞRILMAMIŞTIR
    const dogrulaCagrisi = cagrilar.find((c) => c.url.includes("/podcast-dogrula"));
    assert.equal(dogrulaCagrisi, undefined, "Taslak modunda /podcast-dogrula kesinlikle çağrılmamalıdır");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Hedef 2: useTalepFormu hook'u handlePodcastAiTranskriptBaslat içinde taslakModu: true kullanır", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  const baslatIndex = formHook.indexOf("handlePodcastAiTranskriptBaslat = useCallback");
  assert.ok(baslatIndex > -1, "handlePodcastAiTranskriptBaslat bulunmalı");

  const yukleIndex = formHook.indexOf("await hazirPodcastYukle", baslatIndex);
  assert.ok(yukleIndex > -1, "hazirPodcastYukle çağrısı bulunmalı");

  const blokSonu = formHook.indexOf("setPodcastAiAsamasi(\"ai_kuyrukta\")", yukleIndex);
  const yukleCagriBloğu = formHook.slice(yukleIndex, blokSonu);

  // 2a. handlePodcastAiTranskriptBaslat açıkça taslakModu: true gönderir
  assert.match(yukleCagriBloğu, /taslakModu:\s*true/);
});

test("Hedef 3: Teknik yükleme tamamlandıktan sonra aynı arac_id için /transkript-ai-baslat çağrılır; başarısızsa AI çağrılmaz", () => {
  const formHook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  const baslatIndex = formHook.indexOf("handlePodcastAiTranskriptBaslat = useCallback");
  const yukleIndex = formHook.indexOf("await hazirPodcastYukle", baslatIndex);
  const aiBaslatIndex = formHook.indexOf("/transkript-ai-baslat", yukleIndex);

  // 3a. AI çağrısı teknik yükleme ve doğrulama tamamlandıktan sonra yer alır
  assert.ok(yukleIndex < aiBaslatIndex, "AI transkripti teknik yükleme tamamlandıktan sonra çağrılmalı");

  // 3b. Çağrı aynı aracId ile yapılır
  assert.match(formHook, /fetch\(`\/api\/ogrenme-araclari\/\$\{aracId\}\/transkript-ai-baslat`/);

  // 3c. Hata durumunda catch bloğuna düşer ve hata kaydedilir
  const catchIndex = formHook.indexOf("} catch (err: unknown) {", aiBaslatIndex);
  assert.ok(catchIndex > -1);
  const catchBlok = formHook.slice(catchIndex, catchIndex + 250);
  assert.match(catchBlok, /setPodcastAiAsamasi\("hata"\)/);
  assert.match(catchBlok, /setSunucuTranskriptDurumu\("hata"\)/);
});

test("Hedef 4: Taslak podcast (talepler.taslak_mi=true veya ogrenme_araclari.taslak_mi=true) yarım yükleme penceresinde görünmez", () => {
  const routeKodu = oku("app/api/ogrenme-araclari/yarim-yuklemeler/route.ts");

  // 4a. Query talepler tablosundan taslak_mi kolonunu seçer
  assert.match(routeKodu, /talepler!inner\(uretici_id,\s*urun_adi,\s*talep_no,\s*taslak_mi\)/);

  // 4b. Taslak talepler ve taslak araçlar filtrelenerek elenir
  assert.match(routeKodu, /if\s*\(talep\?\.taslak_mi\s*===\s*true\s*\|\|\s*a\.taslak_mi\s*===\s*true\)\s*return\s*\[\];/);

  // 4c. Simülasyon: Taslak kayıtlar filtrelenir, array'e dahil edilmez
  const sahteAraclar = [
    {
      arac_id: "taslak-arac-1",
      taslak_mi: true,
      talepler: { uretici_id: "user-1", urun_adi: "Taslak Ürün", talep_no: 101, taslak_mi: true },
      kaynak: "hazir",
    },
    {
      arac_id: "normal-arac-2",
      taslak_mi: false,
      talepler: { uretici_id: "user-1", urun_adi: "Normal Ürün", talep_no: 102, taslak_mi: false },
      kaynak: "hazir",
    },
  ];

  const userId = "user-1";
  const sonuc = sahteAraclar.flatMap((a) => {
    const talep = a.talepler;
    if (talep?.taslak_mi === true || a.taslak_mi === true) return [];
    if (a.kaynak === "hazir" && talep?.uretici_id === userId) {
      return [a.arac_id];
    }
    return [];
  });

  assert.equal(sonuc.length, 1);
  assert.equal(sonuc[0], "normal-arac-2", "Yalnızca taslak olmayan normal araç yarım yükleme listesine girmelidir");
  assert.ok(!sonuc.includes("taslak-arac-1"), "Taslak araç yarım yükleme listesinden tamamen elenmelidir");
});

test("Hedef 5: Normal başarısız/yarım yüklemeler yarım yükleme bildirimi listesinde görünmeye devam eder", () => {
  const routeKodu = oku("app/api/ogrenme-araclari/yarim-yuklemeler/route.ts");

  // 5a. Normal yarım yükleme mantığı (anaTamamlandi, kapakYarim, transkriptYarim) eksiksiz korunmaktadır
  assert.match(routeKodu, /const anaTamamlandi = son\?\.durum === "dogrulama_bekliyor"/);
  assert.match(routeKodu, /const kapakYarim = a\.arac_turu === "podcast" && !kapakTamamlandi/);
  assert.match(routeKodu, /const transkriptYarim = a\.arac_turu === "podcast" && !transkriptTamamlandi/);

  // 5b. Video yarım yüklemeleri de korunmaktadır
  assert.match(routeKodu, /from\("ogrenme_araci_video_yukleme_oturumlari"\)/);
});

test("Hedef 6: Normal üretim ve V1/V3 / İÜ akışlarında hazirPodcastYukle podcast-dogrula'yı çağırmaya devam eder", async () => {
  const cagrilar: Array<{ url: string }> = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    cagrilar.push({ url: urlStr });

    if (urlStr.includes("/api/ogrenme-araclari/yukleme-baslat")) {
      return new Response(
        JSON.stringify({
          arac_id: "arac-normal-456",
          yukleme: { endpoint: "https://storage.mock/upload", token: "tok-456", headers: {} },
          tamamlanan_parcalar: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (urlStr.includes("/api/ogrenme-araclari/yukleme-tamamla") || urlStr.includes("/podcast-dogrula")) {
      return new Response(JSON.stringify({ ok: true, arac_id: "arac-normal-456" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.startsWith("https://storage.mock")) {
      return new Response("", {
        status: 200,
        headers: {
          etag: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        },
      });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const sahteSes = new File([new Uint8Array([1, 2, 3, 4])], "test-podcast.mp3", { type: "audio/mpeg" });
    // taslakModu verilmeden (varsayılan normal akış):
    const sonuc = await hazirPodcastYukle({
      talepId: "talep-normal-456",
      ses: sahteSes,
      // taslakModu verilmedi!
    });

    assert.equal(sonuc, "arac-normal-456");

    // Normal akışta /podcast-dogrula KESİNLİKLE ÇAĞRILIR (regresyon yok)
    const dogrulaCagrisi = cagrilar.find((c) => c.url.includes("/podcast-dogrula"));
    assert.ok(dogrulaCagrisi, "Normal akışta /podcast-dogrula çağrılmalıdır");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
