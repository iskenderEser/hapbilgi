import test from "node:test";
import assert from "node:assert/strict";

import { sesTranskriptiOlusturGemini } from "@/lib/ogrenmeAraci/geminiTranscribe";
import { transkriptKuyrukIsle } from "@/lib/ogrenmeAraci/transkriptKuyrukIsleyici";

// ============================================================================
// KOMUT 5 — BACKEND DAVRANIŞ TESTLERİ
// ============================================================================
// Bu testler kaynak kodu veya regex kontrolü yapmaz; doğrudan arka uç fonksiyonlarını
// (sesTranskriptiOlusturGemini, transkriptKuyrukIsle) çalıştırıp çalışma zamanı (runtime)
// dönüş değerlerini, hata kodlarını ve çağrılan davranışları doğrular.
// ============================================================================

const envYedek = { ...process.env };

function mockKuyrukOrtamiKur(geminiKey: string) {
  process.env.GEMINI_API_KEY = geminiKey;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-backend-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key-test";
  process.env.BUNNY_LEARNING_STORAGE_ZONE = "hapbilgi-learning";
  process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY = "mock-bunny-access-key";
  process.env.BUNNY_LEARNING_PULL_ZONE = "pull.bunnycdn.com";
  process.env.BUNNY_LEARNING_TOKEN_KEY = "mock-token-key";
  process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT = "https://upload.bunnycdn.com";
  process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET = "mock-shared-secret";
}

function mockKuyrukOrtamiTemizle() {
  process.env = { ...envYedek };
}

test("Davranışsal Test 1: İki TEK_KİŞİ sonucu monolog kabul edilir ve yapay etiket üretilmez", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "mock-test-key-davranis-1";

  let dosyaYuklendi = false;
  let dosyaSilindi = false;
  let tespitSayisi = 0;
  let transkripsiyonCagrildi = false;

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      // 1. Dosya yükleme mock'u
      if (urlStr.includes("/upload/v1beta/files")) {
        dosyaYuklendi = true;
        return new Response(JSON.stringify({
          file: {
            name: "files/test-monolog-ses",
            uri: "https://generativelanguage.googleapis.com/files/test-monolog-ses",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 2. Dosya silme mock'u
      if (urlStr.includes("files/test-monolog-ses") && init?.method === "DELETE") {
        dosyaSilindi = true;
        return new Response("", { status: 200 });
      }

      // 3. Konuşmacı tespiti çağrıları (İkisi de açıkça TEK_KİŞİ dönüyor)
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        tespitSayisi++;
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "TEK_KİŞİ" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 4. Monolog transkripsiyon çağrısı
      transkripsiyonCagrildi = true;
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: "Bugünkü podcast bölümümüzde yapay zeka konusunu baştan sona tek başıma ele alıyorum." }]
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    // Gerçek backend fonksiyonunu çalıştır
    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([10, 20, 30, 40]),
      mimeType: "audio/mpeg",
      dosyaAdi: "monolog-kayit.mp3",
      model: "gemini-3.5-flash",
    });

    // Davranışsal doğrulamalar:
    assert.equal(dosyaYuklendi, true, "Ses dosyası Gemini Files API'sine yüklenmelidir.");
    assert.equal(tespitSayisi, 2, "İki bağımsız konuşmacı tespiti çalıştırılmalıdır.");
    assert.equal(transkripsiyonCagrildi, true, "Transkripsiyon üretimi çağrılmalıdır.");
    assert.equal(dosyaSilindi, true, "Geçici Gemini dosyası işlem sonunda silinmelidir.");

    assert.equal(sonuc.ok, true, "Sonuç başarılı olmalıdır.");
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 1, "İki TEK_KİŞİ tespiti sonucu konuşmacı sayısı kesinlikle 1 olmalıdır.");
      assert.equal(sonuc.metin.includes("Konuşmacı 1:"), false, "Monologda yapay Konuşmacı 1: etiketi bulunmamalıdır.");
      assert.equal(sonuc.metin.includes("Konuşmacı 2:"), false, "Monologda yapay Konuşmacı 2: etiketi bulunmamalıdır.");
      assert.match(sonuc.metin, /Bugünkü podcast bölümümüzde/, "Orijinal metin içeriği korunmalıdır.");
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test 2A: Tespitlerden biri BİRDEN_FAZLA ise (TEK_KİŞİ + BİRDEN_FAZLA) diyalog kabul edilir", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "mock-test-key-davranis-2a";

  let tespitSayaci = 0;
  let diyalogSemaIstendi = false;

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/test-diyalog-ses-a",
            uri: "https://generativelanguage.googleapis.com/files/test-diyalog-ses-a",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("files/test-diyalog-ses-a") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }

      // Tespit 1: TEK_KİŞİ, Tespit 2: BİRDEN_FAZLA
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        tespitSayaci++;
        const cevap = tespitSayaci === 1 ? "TEK_KİŞİ" : "BİRDEN_FAZLA";
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: cevap }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Diyalog transkripsiyon çağrısı
      if (bodyStr.includes("responseSchema") || bodyStr.includes("speaker")) {
        diyalogSemaIstendi = true;
        const yapilandirilmis = JSON.stringify([
          { speaker: 1, text: "Merhabalar, bugünkü konuğumuzla birlikteyiz." },
          { speaker: 2, text: "Merhabalar, davetiniz için teşekkür ederim." },
        ]);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: yapilandirilmis }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "diyalog-test-a.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(diyalogSemaIstendi, true, "BİRDEN_FAZLA tespitiyle diyalog şeması devreye girmelidir.");
    assert.equal(sonuc.ok, true);
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 2, "Tespitlerden biri BİRDEN_FAZLA olduğunda sonuç diyalog (2 konuşmacı) olmalıdır.");
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 1:?\*{0,2}:?\s*Merhabalar, bugünkü konuğumuzla birlikteyiz\./);
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 2:?\*{0,2}:?\s*Merhabalar, davetiniz için teşekkür ederim\./);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test 2B: Tespitlerden biri BİRDEN_FAZLA ise (BİRDEN_FAZLA + TEK_KİŞİ) diyalog kabul edilir", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "mock-test-key-davranis-2b";

  let tespitSayaci = 0;

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/test-diyalog-ses-b",
            uri: "https://generativelanguage.googleapis.com/files/test-diyalog-ses-b",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("files/test-diyalog-ses-b") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }

      // Tespit 1: BİRDEN_FAZLA, Tespit 2: TEK_KİŞİ
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        tespitSayaci++;
        const cevap = tespitSayaci === 1 ? "BİRDEN_FAZLA" : "TEK_KİŞİ";
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: cevap }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Diyalog transkripsiyon çağrısı
      const yapilandirilmis = JSON.stringify([
        { speaker: 1, text: "İlk konuşmacı açılışı yaptı." },
        { speaker: 2, text: "İkinci konuşmacı görüşlerini bildirdi." },
      ]);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: yapilandirilmis }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "diyalog-test-b.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonuc.ok, true);
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 2, "Biri BİRDEN_FAZLA olduğunda diyalog kabul edilmelidir.");
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 1:?\*{0,2}:?\s*İlk konuşmacı açılışı yaptı\./);
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 2:?\*{0,2}:?\s*İkinci konuşmacı görüşlerini bildirdi\./);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test 3: Hatalı veya belirsiz tespit geçici hataya (KONUSMACI_TESPIT_HATASI) girer", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "mock-test-key-davranis-3";

  // --- Senaryo 3.1: Tespit çağrısında HTTP 500 hatası ---
  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/test-hata-ses",
            uri: "https://generativelanguage.googleapis.com/files/test-hata-ses",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("files/test-hata-ses") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }

      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response("Internal Server Error", { status: 500 });
      }

      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;

    const sonuc500 = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2]),
      mimeType: "audio/mpeg",
      dosyaAdi: "hata-500.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonuc500.ok, false, "HTTP 500 alan tespit başarısız olmalıdır.");
    if (!sonuc500.ok) {
      assert.equal(
        sonuc500.hataKodu,
        "KONUSMACI_TESPIT_HATASI",
        "Tespit hatası açıkça geçici hata kodu (KONUSMACI_TESPIT_HATASI) olmalıdır."
      );
    }

    // --- Senaryo 3.2: Belirsiz / Çelişkili model cevabı ---
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/test-belirsiz-ses",
            uri: "https://generativelanguage.googleapis.com/files/test-belirsiz-ses",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("files/test-belirsiz-ses") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }

      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "Emin değilim, arka planda bazı gürültüler var." }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;

    const sonucBelirsiz = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2]),
      mimeType: "audio/mpeg",
      dosyaAdi: "belirsiz.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonucBelirsiz.ok, false, "Belirsiz cevap alan tespit başarısız sayılmalıdır.");
    if (!sonucBelirsiz.ok) {
      assert.equal(
        sonucBelirsiz.hataKodu,
        "KONUSMACI_TESPIT_HATASI",
        "Belirsiz cevap geçici hata kodu (KONUSMACI_TESPIT_HATASI) ile sonuçlanmalıdır."
      );
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test 4: Diyalog iki denemede de ayrılamazsa KONUSMACI_AYRIMI_YAPILAMADI döner (ai_taslak kaydedilmez)", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "mock-test-key-davranis-4";

  let transcribeDenemesi = 0;

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/test-ayrilamayan-ses",
            uri: "https://generativelanguage.googleapis.com/files/test-ayrilamayan-ses",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes("files/test-ayrilamayan-ses") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }

      // Konuşmacı tespiti: Açıkça BİRDEN_FAZLA tespit edildi
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "BİRDEN_FAZLA" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Transkripsiyon çağrısı
      if (bodyStr.includes("responseSchema") || bodyStr.includes("speaker")) {
        transcribeDenemesi++;
        // Her iki denemede de model yalnızca tek konuşmacı (speaker: 1) blokları dönsün
        const tekKonusmaciJson = JSON.stringify([
          { speaker: 1, text: `Deneme ${transcribeDenemesi}: İkinci konuşmacı tespit edilemedi, düz metin gibi çıktı.` }
        ]);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: tekKonusmaciJson }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([5, 6, 7, 8]),
      mimeType: "audio/mpeg",
      dosyaAdi: "ayrilamayan-diyalog.mp3",
      model: "gemini-3.5-flash",
    });

    // 1. deneme başarısız olunca 2. deneme yapılmalıdır:
    assert.equal(transcribeDenemesi, 2, "İki konuşmacı ayrımı sağlanamayınca 1 kez tekrar denenmelidir (toplam 2 deneme).");

    // İki deneme sonunda da ayrılamadığı için sonuç başarısız olmalıdır:
    assert.equal(sonuc.ok, false, "Ayrılamayan diyalog kesinlikle başarılı kabul edilmemelidir.");
    if (!sonuc.ok) {
      assert.equal(
        sonuc.hataKodu,
        "KONUSMACI_AYRIMI_YAPILAMADI",
        "Hata kodu KONUSMACI_AYRIMI_YAPILAMADI olmalıdır."
      );
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test 5 (Kuyruk/Worker Seviyesi): KONUSMACI_TESPIT_HATASI alan iş podcast_transkript_ai_gecici_hata_atomik ile geçici hataya alınır", async () => {
  const orjinalFetch = globalThis.fetch;
  mockKuyrukOrtamiKur("mock-test-key-davranis-5");

  let geciciHataRpcCagrildi = false;
  let kaliciHataRpcCagrildi = false;
  let tamamlaRpcCagrildi = false;
  let cagirilanHataKodu = "";

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      // 1. Supabase RPC: podcast_transkript_ai_isi_al_atomik
      if (urlStr.includes("/rpc/podcast_transkript_ai_isi_al_atomik")) {
        return new Response(JSON.stringify({
          is_id: "11111111-1111-1111-1111-111111111111",
          arac_id: "22222222-2222-2222-2222-222222222222",
          talep_id: "33333333-3333-3333-3333-333333333333",
          dosya_yolu: "ogrenme_araclari/22222222-2222-2222-2222-222222222222/ses.mp3",
          ai_girisim_id: "44444444-4444-4444-4444-444444444444",
          model: "gemini-3.5-flash",
          mime_type: "audio/mpeg",
          dosya_adi: "ses.mp3",
          deneme_sayisi: 1,
          max_deneme: 3,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 2. Bunny Storage dosya indirme
      if (urlStr.includes("storage.bunnycdn.com") || urlStr.includes("ses.mp3")) {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }

      // 3. Supabase ogrenme_araclari SELECT (girişim kontrolü)
      if (urlStr.includes("/rest/v1/ogrenme_araclari")) {
        return new Response(JSON.stringify({
          metadata: {
            transkript: {
              ai_girisim_id: "44444444-4444-4444-4444-444444444444",
              durum: "ai_isleniyor",
            },
          },
          mime_type: "audio/mpeg",
          dosya_yolu: "ogrenme_araclari/22222222-2222-2222-2222-222222222222/ses.mp3",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 4. Gemini Files API mock
      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/test-worker-ses",
            uri: "https://generativelanguage.googleapis.com/files/test-worker-ses",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-worker-ses") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }

      // 5. Gemini Konuşmacı tespiti mock'u -> HTTP 500 hatası verdir (KONUSMACI_TESPIT_HATASI)
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response("Model busy error", { status: 500 });
      }

      // 6. Supabase RPC: podcast_transkript_ai_gecici_hata_atomik
      if (urlStr.includes("/rpc/podcast_transkript_ai_gecici_hata_atomik")) {
        geciciHataRpcCagrildi = true;
        try {
          const parsed = JSON.parse(bodyStr);
          cagirilanHataKodu = parsed.p_hata_kodu;
        } catch {}
        return new Response(JSON.stringify(true), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 7. Supabase RPC: podcast_transkript_ai_hata_atomik (Kalıcı hata)
      if (urlStr.includes("/rpc/podcast_transkript_ai_hata_atomik")) {
        kaliciHataRpcCagrildi = true;
        return new Response(JSON.stringify(true), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 8. Supabase RPC: podcast_transkript_ai_tamamla_atomik
      if (urlStr.includes("/rpc/podcast_transkript_ai_tamamla_atomik")) {
        tamamlaRpcCagrildi = true;
        return new Response(JSON.stringify(true), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    // Gerçek kuyruk işleyiciyi çalıştır
    const isleyiciSonucu = await transkriptKuyrukIsle();

    assert.equal(isleyiciSonucu.islendi, true, "İş kuyruktan alınıp işlenmiş olmalıdır.");
    assert.equal(isleyiciSonucu.basarili, false, "Hata aldığı için başarılı olmamalıdır.");
    assert.equal(isleyiciSonucu.hataKodu, "KONUSMACI_TESPIT_HATASI", "Hata kodu KONUSMACI_TESPIT_HATASI olmalıdır.");

    assert.equal(geciciHataRpcCagrildi, true, "KONUSMACI_TESPIT_HATASI geçici hata atomik RPC'sine gönderilmelidir.");
    assert.equal(cagirilanHataKodu, "KONUSMACI_TESPIT_HATASI", "RPC'ye aktarılan hata kodu eşleşmelidir.");
    assert.equal(kaliciHataRpcCagrildi, false, "Geçici hata kesinlikle kalıcı hata RPC'sini çağırmamalıdır.");
    assert.equal(tamamlaRpcCagrildi, false, "Hatalı iş kesinlikle tamamlama RPC'sini çağırmamalıdır.");
  } finally {
    globalThis.fetch = orjinalFetch;
    mockKuyrukOrtamiTemizle();
  }
});

test("Davranışsal Test 6 (Kuyruk/Worker Seviyesi): KONUSMACI_AYRIMI_YAPILAMADI alan iş kalıcı hataya alınır ve ASLA ai_taslak kaydedilmez", async () => {
  const orjinalFetch = globalThis.fetch;
  mockKuyrukOrtamiKur("mock-test-key-davranis-6");

  let kaliciHataRpcCagrildi = false;
  let geciciHataRpcCagrildi = false;
  let tamamlaRpcCagrildi = false;
  let cagirilanHataKodu = "";

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      // 1. Supabase RPC: podcast_transkript_ai_isi_al_atomik
      if (urlStr.includes("/rpc/podcast_transkript_ai_isi_al_atomik")) {
        return new Response(JSON.stringify({
          is_id: "55555555-5555-5555-5555-555555555555",
          arac_id: "66666666-6666-6666-6666-666666666666",
          talep_id: "77777777-7777-7777-7777-777777777777",
          dosya_yolu: "ogrenme_araclari/66666666-6666-6666-6666-666666666666/ses.mp3",
          ai_girisim_id: "88888888-8888-8888-8888-888888888888",
          model: "gemini-3.5-flash",
          mime_type: "audio/mpeg",
          dosya_adi: "ses.mp3",
          deneme_sayisi: 1,
          max_deneme: 3,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 2. Bunny Storage dosya indirme
      if (urlStr.includes("storage.bunnycdn.com") || urlStr.includes("ses.mp3")) {
        return new Response(new Uint8Array([10, 20, 30, 40]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }

      // 3. Supabase ogrenme_araclari SELECT (girişim kontrolü)
      if (urlStr.includes("/rest/v1/ogrenme_araclari")) {
        return new Response(JSON.stringify({
          metadata: {
            transkript: {
              ai_girisim_id: "88888888-8888-8888-8888-888888888888",
              durum: "ai_isleniyor",
            },
          },
          mime_type: "audio/mpeg",
          dosya_yolu: "ogrenme_araclari/66666666-6666-6666-6666-666666666666/ses.mp3",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 4. Gemini Files API
      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/test-worker-ses-2",
            uri: "https://generativelanguage.googleapis.com/files/test-worker-ses-2",
            mimeType: "audio/mpeg",
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-worker-ses-2") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }

      // 5. Konuşmacı tespiti -> BİRDEN_FAZLA dönsün
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "BİRDEN_FAZLA" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 6. Transkripsiyon çağrısı -> İki denemede de tek konuşmacı dönsün (ayrılamadı)
      if (bodyStr.includes("responseSchema") || bodyStr.includes("speaker")) {
        const tekKonusmaciJson = JSON.stringify([
          { speaker: 1, text: "Yalnız tek konuşmacı var, ikinci konuşmacı ayrımı yapılamadı." }
        ]);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: tekKonusmaciJson }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 7. Supabase RPC: podcast_transkript_ai_hata_atomik (Kalıcı hata)
      if (urlStr.includes("/rpc/podcast_transkript_ai_hata_atomik")) {
        kaliciHataRpcCagrildi = true;
        try {
          const parsed = JSON.parse(bodyStr);
          cagirilanHataKodu = parsed.p_hata_kodu;
        } catch {}
        return new Response(JSON.stringify(true), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 8. Supabase RPC: podcast_transkript_ai_gecici_hata_atomik
      if (urlStr.includes("/rpc/podcast_transkript_ai_gecici_hata_atomik")) {
        geciciHataRpcCagrildi = true;
        return new Response(JSON.stringify(true), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 9. Supabase RPC: podcast_transkript_ai_tamamla_atomik
      if (urlStr.includes("/rpc/podcast_transkript_ai_tamamla_atomik")) {
        tamamlaRpcCagrildi = true;
        return new Response(JSON.stringify(true), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    // Gerçek kuyruk işleyiciyi çalıştır
    const isleyiciSonucu = await transkriptKuyrukIsle();

    assert.equal(isleyiciSonucu.islendi, true, "İş işlenmiş olmalıdır.");
    assert.equal(isleyiciSonucu.basarili, false, "Ayrılamayan diyalog başarılı sayılmamalıdır.");
    assert.equal(isleyiciSonucu.hataKodu, "KONUSMACI_AYRIMI_YAPILAMADI", "Hata kodu KONUSMACI_AYRIMI_YAPILAMADI olmalıdır.");

    // En kritik güvenceler:
    assert.equal(tamamlaRpcCagrildi, false, "tamamla_atomik (ai_taslak) RPC'si KESİNLİKLE çağrılmamalıdır!");
    assert.equal(kaliciHataRpcCagrildi, true, "podcast_transkript_ai_hata_atomik kalıcı hata RPC'si çağrılmalıdır.");
    assert.equal(cagirilanHataKodu, "KONUSMACI_AYRIMI_YAPILAMADI", "Kalıcı hata kodu KONUSMACI_AYRIMI_YAPILAMADI olmalıdır.");
    assert.equal(geciciHataRpcCagrildi, false, "Ayrılamayan diyalog geçici hataya alınmamalıdır.");
  } finally {
    globalThis.fetch = orjinalFetch;
    mockKuyrukOrtamiTemizle();
  }
});
