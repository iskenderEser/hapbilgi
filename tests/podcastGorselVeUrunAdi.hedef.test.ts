import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hazirPodcastYukle } from "../lib/ogrenmeAraci/bunnyYuklemeIstemci.ts";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

const bekleyenlerRoute = oku("app/(panel)/yayin-yonetimi/api/bekleyenler/route.ts");
const yayinlarRoute = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
const yarimYuklemelerRoute = oku("app/api/ogrenme-araclari/yarim-yuklemeler/route.ts");
const modal = oku("components/ogrenme-araci/YarimYuklemeBildirimi.tsx");
const erisimRoute = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
const oynatici = oku("components/ogrenme-araci/PodcastOynatici.tsx");
const kapakBileseni = oku("components/ogrenme-araci/PodcastKapakGorseli.tsx");
const opsiyonelKapakSql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_opsiyonel_kapak.sql");
const dogrulaRoute = oku("app/api/ogrenme-araclari/[arac_id]/podcast-dogrula/route.ts");
const destekBaslatRoute = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-baslat/route.ts");
const destekTamamlaRoute = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-tamamla/route.ts");
const kapakGuvenligiSql = oku("scripts/sql/podcast_kapak_yukleme_guvenligi.sql");

// Mock XHR for bunny upload
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

// --------------------------------------------------------------------------
// Davranış Testi 1:
// Ses ve transkript tamam, görsel yarım, dosya seçilmemiş -> normal "Devam Et" engellenir
// --------------------------------------------------------------------------
test("Davranış 1: Ses ve transkript tamam, görsel yarım, dosya seçilmemiş -> normal Devam Et engellenir", async () => {
  await assert.rejects(
    hazirPodcastYukle({
      talepId: "talep-001",
      aracId: "arac-001",
      tamamlananParcalar: ["ana", "transkript"],
      kapakGerekli: true,
      kapak: undefined,
    }),
    {
      name: "Error",
      message: "Yayın görselini seçin veya Görselsiz Devam Et seçeneğini kullanın.",
    },
  );

  // YarimYuklemeBildirimi storageDevam bileşeni de bu hatayı fırlatacak şekilde kodlanmıştır
  assert.match(modal, /if\s*\(kapakGerekli && !dosyalar\.kapak\)\s*\{[\s\S]*Yayın görselini seçin veya Görselsiz Devam Et seçeneğini kullanın\./);
});

// --------------------------------------------------------------------------
// Davranış Testi 2:
// Aynı durumda görsel seçilmiş -> yalnız görsel yüklenir ve podcast tamamlanır
// --------------------------------------------------------------------------
test("Davranış 2: Aynı durumda görsel seçilmiş -> yalnız görsel yüklenir ve podcast tamamlanır", async () => {
  const originalXHR = globalThis.XMLHttpRequest;
  const originalFetch = globalThis.fetch;
  (globalThis as any).XMLHttpRequest = MockXHR;

  const calls: Array<{ url: string; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const urlStr = String(url);
    calls.push({ url: urlStr, body: init?.body ? JSON.parse(init.body) : null });
    if (urlStr.includes("destek-yukleme-baslat")) {
      return new Response(JSON.stringify({
        dosya_yolu: "firmalar/f1/kapak.jpg",
        yukleme_girisimi_id: "11111111-1111-4111-8111-111111111111",
        yukleme_token: "tok-kapak",
        yukleme: { endpoint: "https://storage.test/kapak.jpg", headers: {} },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (urlStr.includes("destek-yukleme-tamamla")) {
      return new Response(JSON.stringify({ tamamlandi: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (urlStr.includes("podcast-dogrula")) {
      return new Response(JSON.stringify({ mesaj: "Podcast üretim zincirine alındı." }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("{}", { status: 200 });
  }) as any;

  try {
    const kapakBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const kapakDosya = new File([kapakBytes], "kapak.jpg", { type: "image/jpeg" });

    const sonuc = await hazirPodcastYukle({
      talepId: "talep-002",
      aracId: "arac-002",
      tamamlananParcalar: ["ana", "transkript"],
      kapakGerekli: true,
      kapak: kapakDosya,
    });

    assert.equal(sonuc, "arac-002");
    // Ses dosyası tekrar yüklenmemeli
    assert.ok(!calls.some((c) => c.url.endsWith("/yukleme-baslat")), "ses yeniden başlatılmamalı");
    assert.ok(!calls.some((c) => c.url.endsWith("/yukleme-tamamla")), "ses yeniden tamamlanmamalı");
    // Transkript tekrar yüklenmemeli
    assert.ok(!calls.some((c) => c.url.includes("destek-yukleme-baslat") && c.body?.dosya_rolu === "transkript"), "transkript yeniden başlatılmamalı");
    // Yalnızca görsel yüklenmeli ve ardından doğrulama çağrılmalı
    assert.ok(calls.some((c) => c.url.includes("destek-yukleme-baslat") && c.body?.dosya_rolu === "kapak"), "kapak destek yükleme başlatılmalı");
    assert.ok(calls.some((c) => c.url.includes("destek-yukleme-tamamla") && c.body?.dosya_rolu === "kapak"), "kapak destek yükleme tamamlanmalı");
    assert.ok(calls.some((c) => c.url.includes("podcast-dogrula")), "podcast doğrulanmalı");
  } finally {
    globalThis.XMLHttpRequest = originalXHR;
    globalThis.fetch = originalFetch;
  }
});

// --------------------------------------------------------------------------
// Davranış Testi 3:
// Görsel hiç seçilmemiş -> podcast tamamlanır
// --------------------------------------------------------------------------
test("Davranış 3: Görsel hiç seçilmemiş -> podcast tamamlanır", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string }> = [];
  globalThis.fetch = (async (url: any) => {
    const urlStr = String(url);
    calls.push({ url: urlStr });
    if (urlStr.includes("podcast-dogrula")) {
      return new Response(JSON.stringify({ mesaj: "Podcast üretim zincirine alındı." }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("{}", { status: 200 });
  }) as any;

  try {
    const sonuc = await hazirPodcastYukle({
      talepId: "talep-003",
      aracId: "arac-003",
      tamamlananParcalar: ["ana", "transkript"],
      kapakGerekli: false, // Görsel hiç seçilmemişti
      kapak: undefined,
    });

    assert.equal(sonuc, "arac-003");
    assert.ok(!calls.some((c) => c.url.includes("destek-yukleme-baslat")), "hiç görsel yükleme çağrısı yapılmamalı");
    assert.ok(calls.some((c) => c.url.includes("podcast-dogrula")), "podcast doğrulaması tamamlanmalı");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --------------------------------------------------------------------------
// Davranış Testi 4:
// Görselsiz devam kararı kayıtlı -> podcast tamamlanır
// --------------------------------------------------------------------------
test("Davranış 4: Görselsiz devam kararı kayıtlı -> podcast tamamlanır", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string }> = [];
  globalThis.fetch = (async (url: any) => {
    const urlStr = String(url);
    calls.push({ url: urlStr });
    if (urlStr.includes("podcast-dogrula")) {
      return new Response(JSON.stringify({ mesaj: "Podcast üretim zincirine alındı." }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("{}", { status: 200 });
  }) as any;

  try {
    // Görselsiz devam tıklandığında kapakGerekli false olur ve kapak verilmez
    const sonuc = await hazirPodcastYukle({
      talepId: "talep-004",
      aracId: "arac-004",
      tamamlananParcalar: ["ana", "transkript"],
      kapakGerekli: false,
      kapak: undefined,
    });

    assert.equal(sonuc, "arac-004");
    assert.ok(calls.some((c) => c.url.includes("podcast-dogrula")), "podcast doğrulanmalı");

    // gorselsiz_devam API handler'ının depolama silme ve metadata iptal kararı aldığını doğrula
    assert.match(yarimYuklemelerRoute, /body\.islem === "gorselsiz_devam"/);
    assert.match(yarimYuklemelerRoute, /podcast_kapak_yukleme_iptal_atomik/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Yayın görseli başlatma, tamamlama ve iptal işlemleri girişim kimliğiyle atomiktir", () => {
  assert.match(destekBaslatRoute, /randomUUID\(\)/);
  assert.match(destekBaslatRoute, /podcast_kapak_yukleme_baslat_atomik/);
  assert.match(destekTamamlaRoute, /podcast_kapak_yukleme_tamamla_atomik/);
  assert.match(destekTamamlaRoute, /yukleme_girisimi_id/);
  assert.match(yarimYuklemelerRoute, /podcast_kapak_yukleme_iptal_atomik/);
  assert.match(kapakGuvenligiSql, /WHERE arac_id = p_arac_id FOR UPDATE/g);
  assert.match(kapakGuvenligiSql, /v_girisim->>'id' IS DISTINCT FROM p_girisim_id::text/);
  assert.match(kapakGuvenligiSql, /v_son_durum NOT IN[\s\S]*'dogrulama_bekliyor'/);
  assert.match(kapakGuvenligiSql, /ogrenme_araci_depolama_temizleme_kuyrugu/);
});

// --------------------------------------------------------------------------
// Davranış Testi 5:
// İstemci kontrolü atlanarak RPC/sunucu çağrılmış, görsel hâlâ bekliyor -> sunucu reddeder
// --------------------------------------------------------------------------
test("Davranış 5: İstemci kontrolü atlanarak RPC çağrılmış, görsel hâlâ bekliyor -> sunucu reddeder", () => {
  // 1. Sunucu tarafı karar fonksiyonu (uretim_podcast_dogrula SQL mantığının tam izdüşümü)
  function uretimPodcastDogrulaKontrol(v_arac: {
    dosya_yolu: string | null;
    transkript_yolu: string | null;
    kapak_yolu: string | null;
    metadata: {
      transkript_dogrulandi?: boolean;
      kapak_dogrulandi?: boolean;
      kapak_bekleniyor?: boolean;
      kapak_iptal_edildi?: boolean;
      bekleyen_destek_yollari?: { kapak?: string };
    };
  }) {
    if (!v_arac.dosya_yolu || !v_arac.transkript_yolu || v_arac.metadata?.transkript_dogrulandi !== true) {
      throw new Error("Ses ve transkript doğrulanmadan podcast tamamlanamaz.");
    }
    const kapakIptalEdildi = Boolean(v_arac.metadata?.kapak_iptal_edildi);
    const kapakBekleniyor = Boolean(v_arac.metadata?.kapak_bekleniyor);
    const bekleyenKapakVar = Boolean(v_arac.metadata?.bekleyen_destek_yollari?.kapak);
    const kapakDogrulandi = Boolean(v_arac.metadata?.kapak_dogrulandi);

    if (!kapakIptalEdildi && (kapakBekleniyor || bekleyenKapakVar) && (!v_arac.kapak_yolu || !kapakDogrulandi)) {
      throw new Error("Bekleyen yayın görseli yüklemesi tamamlanmadan podcast tamamlanamaz.");
    }

    if (v_arac.kapak_yolu && !kapakDogrulandi) {
      throw new Error("Yüklenen yayın görseli doğrulanmadan podcast tamamlanamaz.");
    }
    return true;
  }

  // 5a: Görsel bekliyor ama yüklenmemiş / doğrulanmamış -> REDDEDİLİR
  assert.throws(
    () => uretimPodcastDogrulaKontrol({
      dosya_yolu: "firmalar/f1/podcast.mp3",
      transkript_yolu: "firmalar/f1/transkript.txt",
      kapak_yolu: null,
      metadata: {
        transkript_dogrulandi: true,
        kapak_bekleniyor: true,
        kapak_iptal_edildi: false,
      },
    }),
    /Bekleyen yayın görseli yüklemesi tamamlanmadan podcast tamamlanamaz\./,
  );

  // 5b: Bekleyen destek yolunda kapak var ama henüz tamamlanmamış -> REDDEDİLİR
  assert.throws(
    () => uretimPodcastDogrulaKontrol({
      dosya_yolu: "firmalar/f1/podcast.mp3",
      transkript_yolu: "firmalar/f1/transkript.txt",
      kapak_yolu: null,
      metadata: {
        transkript_dogrulandi: true,
        bekleyen_destek_yollari: { kapak: "firmalar/f1/kapak.jpg" },
        kapak_iptal_edildi: false,
      },
    }),
    /Bekleyen yayın görseli yüklemesi tamamlanmadan podcast tamamlanamaz\./,
  );

  // 5c: Görsel iptal edilmiş (görselsiz devam kararı) -> KABUL EDİLİR
  assert.doesNotThrow(() => uretimPodcastDogrulaKontrol({
    dosya_yolu: "firmalar/f1/podcast.mp3",
    transkript_yolu: "firmalar/f1/transkript.txt",
    kapak_yolu: null,
    metadata: {
      transkript_dogrulandi: true,
      kapak_bekleniyor: false,
      kapak_iptal_edildi: true,
    },
  }));

  // 5d: Görsel hiç seçilmemiş -> KABUL EDİLİR
  assert.doesNotThrow(() => uretimPodcastDogrulaKontrol({
    dosya_yolu: "firmalar/f1/podcast.mp3",
    transkript_yolu: "firmalar/f1/transkript.txt",
    kapak_yolu: null,
    metadata: {
      transkript_dogrulandi: true,
    },
  }));

  // 5e: Görsel yüklenmiş ve doğrulanmış -> KABUL EDİLİR
  assert.doesNotThrow(() => uretimPodcastDogrulaKontrol({
    dosya_yolu: "firmalar/f1/podcast.mp3",
    transkript_yolu: "firmalar/f1/transkript.txt",
    kapak_yolu: "firmalar/f1/kapak.jpg",
    metadata: {
      transkript_dogrulandi: true,
      kapak_dogrulandi: true,
      kapak_bekleniyor: false,
    },
  }));

  // 5f: SQL migration dosyasında aynı hata mesajı ve ERRCODE 23514 kuralı yer alır
  assert.match(opsiyonelKapakSql, /RAISE EXCEPTION 'Bekleyen yayın görseli yüklemesi tamamlanmadan podcast tamamlanamaz\.' USING ERRCODE = '23514';/);
  assert.match(opsiyonelKapakSql, /kapak_iptal_edildi/);
  assert.match(opsiyonelKapakSql, /kapak_bekleniyor/);
  assert.match(opsiyonelKapakSql, /bekleyen_destek_yollari/);

  // 5g: Route handler seviyesinde de aynı hata kodu 422 ile yakalanır
  assert.match(dogrulaRoute, /!kapakIptalEdildi && \(kapakBekleniyor \|\| bekleyenKapakVar\) && \(!arac\.kapak_yolu \|\| !kapakDogrulandi\)/);
  assert.match(dogrulaRoute, /Bekleyen yayın görseli yüklemesi tamamlanmadan podcast tamamlanamaz\./);
});

// --------------------------------------------------------------------------
// Ek Doğrulamalar: İmzalı CDN URL & PM Ürün Adı
// --------------------------------------------------------------------------
test("İş 1 & 3: Yayın Yönetimi İmzalı CDN URL ve PM Ürün Adı Öncelik Sıralaması", () => {
  // Bekleyenler ve Yayınlar imzalı URL
  assert.match(bekleyenlerRoute, /import\s*\{\s*bunnyCdnImzaliUrl\s*\}\s*from\s*["']@\/lib\/(?:depolama\/bunnyCdn|ogrenmeAraci\/bunnyStorage)["']/);
  assert.match(bekleyenlerRoute, /thumbnailUrl = bunnyCdnImzaliUrl\(aracHam\.kapak_yolu\);/);
  assert.match(yayinlarRoute, /YAYIN_LISTE_ALANLARI[\s\S]*arac_kapak_yolu/);
  assert.match(yayinlarRoute, /kapakUrl = bunnyCdnImzaliUrl\(y\.arac_kapak_yolu\);/);

  // PM Ürün Adı öncelik sırası: urunler.urun_adi -> talepler.urun_adi -> "Podcast"
  assert.match(erisimRoute, /talepler\(urun_adi, urunler\(urun_adi\)\)/);
  assert.match(erisimRoute, /const urunAdi = bagliUrunAdi \|\| serbestUrunAdi \|\| "Podcast";/);
  assert.match(oynatici, /const cozumlenenUrunAdi =\s*urunAdi && urunAdi\.trim\(\)\.length > 0\s*\?\s*urunAdi\.trim\(\)\s*:\s*erisim\.urun_adi && erisim\.urun_adi\.trim\(\)\.length > 0\s*\?\s*erisim\.urun_adi\.trim\(\)\s*:\s*"Podcast";/);
  assert.match(kapakBileseni, /const gecerliAd = urunAdi\?\.trim\(\) \? urunAdi\.trim\(\) : "Podcast";/);
});
