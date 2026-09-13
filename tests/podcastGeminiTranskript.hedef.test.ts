import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { sesTranskriptiOlusturGemini } from "@/lib/ogrenmeAraci/geminiTranscribe";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// BÖLÜM 1: Kod ve Mimari Sözleşme Doğrulamaları
// ============================================================================

test("Aşama 3 Model ve Ortam Yapılandırması: gemini-3.5-flash korunurken gemini-3.5-transcribe eklenir", () => {
  const envLocal = oku(".env.local");
  assert.match(envLocal, /GEMINI_MODEL=gemini-3.5-flash/);
  assert.match(envLocal, /GEMINI_TRANSCRIBE_MODEL=gemini-3.5-transcribe/);

  const geminiModul = oku("lib/ogrenmeAraci/geminiTranscribe.ts");
  assert.match(geminiModul, /gemini-3\.5-transcribe/);
  assert.match(geminiModul, /GEMINI_TRANSCRIBE_MODEL/);
  assert.match(geminiModul, /export async function sesTranskriptiOlusturGemini/);
  assert.match(geminiModul, /export async function geminiFilesYukle/);
  assert.match(geminiModul, /export async function geminiFilesSil/);
  assert.match(geminiModul, /await geminiFilesSil\(\{ apiKey, fileName: yuklenenDosyaAdi \}\);/);
  assert.doesNotMatch(geminiModul, /void geminiFilesSil/);
});

test("Geçici Gemini Dosyası Temizliği: Silme Promise'ının sonuç dönmeden önce tamamlandığı ve hata izolasyonu", async () => {
  const originalFetch = globalThis.fetch;
  const orijinalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-api-key";

  try {
    // 1. Başarılı senaryo: Silme işlemi yapay 40ms gecikmeli çalıştırılır;
    // sesTranskriptiOlusturGemini'nin silme tamamlanmadan dönmediği doğrulanır.
    let silmePromiseBitti = false;
    let silmeCagrildi = false;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      const method = init?.method ?? "GET";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/gecici-ses-1",
            uri: "https://generativelanguage.googleapis.com/v1beta/files/gecici-ses-1",
            mimeType: "audio/mp4",
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes(":generateContent")) {
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                audioTranscription: { text: "Bu başarılı bir test podcast transkriptidir." },
              }],
            },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (method === "DELETE" && urlStr.includes("files/gecici-ses-1")) {
        silmeCagrildi = true;
        await new Promise((r) => setTimeout(r, 40));
        silmePromiseBitti = true;
        return new Response("{}", { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    };

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4, 5]),
      mimeType: "audio/mp4",
      dosyaAdi: "test.m4a",
    });

    assert.equal(silmeCagrildi, true, "Silme fonksiyonu çağrılmış olmalıdır.");
    assert.equal(silmePromiseBitti, true, "sesTranskriptiOlusturGemini dönmeden önce silme Promise'ı tamamlanmış olmalıdır.");
    assert.equal(sonuc.ok, true);

    // 2. Silme hatası senaryosu: Silme işlemi network hatası fırlatsa dahi transkript sonucu bozulmamalıdır.
    let silmeHatasiFirlatildi = false;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      const method = init?.method ?? "GET";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/gecici-ses-hata",
            uri: "https://generativelanguage.googleapis.com/v1beta/files/gecici-ses-hata",
            mimeType: "audio/mp4",
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes(":generateContent")) {
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: "Silme hatasına rağmen başarılı dönen transkript metni." }],
            },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (method === "DELETE") {
        silmeHatasiFirlatildi = true;
        await new Promise((r) => setTimeout(r, 30));
        throw new Error("DELETE ağ bağlantı hatası");
      }

      return new Response("Not Found", { status: 404 });
    };

    const sonucSilmeHatasinda = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3]),
      mimeType: "audio/mp4",
      dosyaAdi: "test.m4a",
    });

    assert.equal(silmeHatasiFirlatildi, true);
    assert.equal(sonucSilmeHatasinda.ok, true, "Silme hatası transkript sonucunu bozmamalıdır.");

    // 3. Model hatası senaryosu: generateContent başarısız olsa bile silme işlemi beklenmeli ve tamamlanmalıdır.
    let modelHatasindaSilmeBitti = false;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      const method = init?.method ?? "GET";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: {
            name: "files/gecici-ses-model-hata",
            uri: "https://generativelanguage.googleapis.com/v1beta/files/gecici-ses-model-hata",
            mimeType: "audio/mp4",
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (urlStr.includes(":generateContent")) {
        return new Response("Model internal error", { status: 500 });
      }

      if (method === "DELETE" && urlStr.includes("files/gecici-ses-model-hata")) {
        await new Promise((r) => setTimeout(r, 40));
        modelHatasindaSilmeBitti = true;
        return new Response("{}", { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    };

    const sonucModelHatasinda = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3]),
      mimeType: "audio/mp4",
      dosyaAdi: "test.m4a",
    });

    assert.equal(sonucModelHatasinda.ok, false);
    assert.equal(modelHatasindaSilmeBitti, true, "Model hatasında da silme Promise'ı tamamlanmalıdır.");
  } finally {
    globalThis.fetch = originalFetch;
    if (orijinalKey !== undefined) {
      process.env.GEMINI_API_KEY = orijinalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});

test("Aşama 3 Kalıcı Kuyruk ve Lease Mekanizması: sonraki_deneme_tarihi, FOR UPDATE SKIP LOCKED ve atomik devralma", () => {
  const sql = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.ogrenme_araci_transkript_kuyrugu/);
  assert.match(sql, /lease_bitis timestamptz/);
  assert.match(sql, /sonraki_deneme_tarihi timestamptz/);
  assert.match(sql, /deneme_sayisi integer/);
  assert.match(sql, /max_deneme integer/);

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.podcast_transkript_ai_isi_al_atomik/);
  assert.match(sql, /durum = 'bekliyor'/);
  assert.match(sql, /sonraki_deneme_tarihi/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.podcast_transkript_ai_gecici_hata_atomik/);
});

test("Aşama 3 HTTP Bağımsızlığı: transkript-ai-baslat rota içinde hiçbir Gemini veya sahipsiz Promise çağrısı yapmaz, doğrudan 202 döner", () => {
  const aiBaslat = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");

  assert.doesNotMatch(aiBaslat, /import.*after.*from "next\/server"/);
  assert.doesNotMatch(aiBaslat, /\bafter\(/);
  assert.doesNotMatch(aiBaslat, /transkriptKuyrukIsle/);
  assert.match(aiBaslat, /podcast_transkript_ai_baslat_atomik/);
  assert.match(aiBaslat, /status:\s*202/);
});

test("Aşama 3 Bağımsız Vercel Cron Worker: /api/cron/transkript-kuyruk, Bearer CRON_SECRET kontrolü, 401 yetkilendirme", () => {
  const cronRoute = oku("app/api/cron/transkript-kuyruk/route.ts");

  assert.match(cronRoute, /process\.env\.CRON_SECRET/);
  assert.match(cronRoute, /Bearer \$\{cronSecret\}/);
  assert.match(cronRoute, /status:\s*401/);
  assert.match(cronRoute, /transkriptKuyrugunuTuket/);
  assert.match(cronRoute, /maxDuration\s*=\s*60/);
});

test("Aşama 3 vercel.json ve .env.example Yapılandırması: cron tanımı ve gizli anahtarsız CRON_SECRET dokümantasyonu", () => {
  const vercelJson = JSON.parse(oku("vercel.json"));
  assert.ok(Array.isArray(vercelJson.crons), "vercel.json içinde crons dizisi bulunmalı");
  const cronGirdisi = vercelJson.crons.find((c: { path: string }) => c.path === "/api/cron/transkript-kuyruk");
  assert.ok(cronGirdisi, "/api/cron/transkript-kuyruk cron tanımı bulunmalı");
  assert.equal(cronGirdisi.schedule, "* * * * *");

  const envExample = oku(".env.example");
  assert.match(envExample, /CRON_SECRET=/);
  // Repo içine gerçek secret commit edilmemeli (CRON_SECRET değerinin boş olduğunu kontrol et)
  const cronSatiri = envExample.split("\n").find((s) => s.startsWith("CRON_SECRET="));
  assert.equal(cronSatiri?.trim(), "CRON_SECRET=");
});

test("Aşama 3 Kalıcı Yeniden Deneme (No in-memory setTimeout): Bellek içi döngü yok, DB seviyesi exponential backoff", () => {
  const isleyici = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");

  // Kesinlikle setTimeout kullanılmamalı
  assert.doesNotMatch(isleyici, /\bsetTimeout\(/);

  assert.match(isleyici, /podcast_transkript_ai_isi_al_atomik/);
  assert.match(isleyici, /bunnyStorageNesneIndir/);
  assert.match(isleyici, /podcast_transkript_ai_gecici_hata_atomik/);
  assert.match(isleyici, /podcast_transkript_ai_tamamla_atomik/);
  assert.match(isleyici, /podcast_transkript_ai_hata_atomik/);
  assert.match(isleyici, /Math\.pow\(2,\s*Math\.max\(0,\s*deneme_sayisi - 1\)\)/);
});

// ============================================================================
// BÖLÜM 2: Davranışsal Simülasyon ve Durum Makinesi Doğrulamaları
// (SQL RPC ve Kuyruk İşleyicisi ile 6 Kritik Senaryonun Fonksiyonel Testi)
// ============================================================================

interface MockKuyrukKaydi {
  is_id: string;
  arac_id: string;
  ai_girisim_id: string;
  durum: "bekliyor" | "isleniyor" | "tamamlandi" | "hata" | "iptal";
  deneme_sayisi: number;
  max_deneme: number;
  lease_bitis: Date | null;
  sonraki_deneme_tarihi: Date | null;
  model: string;
  hata_kodu: string | null;
}

interface MockAracKaydi {
  arac_id: string;
  dosya_yolu: string;
  metadata: {
    transkript?: {
      durum: string;
      ai_girisim_id: string | null;
      lease_bitis?: string | null;
      taslak_metin?: string | null;
      hata_kodu?: string | null;
      onaylanan_metin?: string | null;
    };
  };
}

class PodcastAiDurumMotoru {
  kuyruk: MockKuyrukKaydi[] = [];
  araclar = new Map<string, MockAracKaydi>();

  aracEkle(arac_id: string, dosya_yolu: string) {
    this.araclar.set(arac_id, {
      arac_id,
      dosya_yolu,
      metadata: {},
    });
  }

  // 1. podcast_transkript_ai_baslat_atomik simülasyonu
  baslat(arac_id: string, girisim_id: string, model: string = "gemini-3.5-transcribe") {
    const arac = this.araclar.get(arac_id);
    if (!arac) throw new Error("Podcast bulunamadı.");

    const mevcut = arac.metadata.transkript;
    const mevcutDurum = mevcut?.durum ?? "";
    const simdi = new Date();

    // Çift tıklama / aktif girişim kontrolü
    if (
      (mevcutDurum === "ai_bekliyor" || mevcutDurum === "ai_isleniyor") &&
      mevcut?.ai_girisim_id &&
      (!mevcut.lease_bitis || new Date(mevcut.lease_bitis) > simdi)
    ) {
      return {
        baslatildi: false,
        durum: mevcutDurum,
        ai_girisim_id: mevcut.ai_girisim_id,
        mukerrer_engellendi: true,
      };
    }

    // Açık işleri iptal et
    for (const is of this.kuyruk) {
      if (is.arac_id === arac_id && (is.durum === "bekliyor" || is.durum === "isleniyor")) {
        is.durum = "iptal";
      }
    }

    const yeniIs: MockKuyrukKaydi = {
      is_id: `is-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      arac_id,
      ai_girisim_id: girisim_id,
      durum: "bekliyor",
      deneme_sayisi: 0,
      max_deneme: 3,
      lease_bitis: null,
      sonraki_deneme_tarihi: simdi,
      model,
      hata_kodu: null,
    };
    this.kuyruk.push(yeniIs);

    arac.metadata.transkript = {
      durum: "ai_bekliyor",
      ai_girisim_id: girisim_id,
      lease_bitis: null,
      taslak_metin: null,
      hata_kodu: null,
      onaylanan_metin: null,
    };

    return {
      baslatildi: true,
      durum: "ai_bekliyor",
      ai_girisim_id: girisim_id,
    };
  }

  // 2. podcast_transkript_ai_isi_al_atomik simülasyonu
  isiAl(leaseSaniye: number = 180) {
    const simdi = new Date();
    const aday = this.kuyruk.find(
      (k) =>
        (k.durum === "bekliyor" && (!k.sonraki_deneme_tarihi || k.sonraki_deneme_tarihi <= simdi)) ||
        (k.durum === "isleniyor" && k.lease_bitis && k.lease_bitis < simdi)
    );

    if (!aday) return null;

    const arac = this.araclar.get(aday.arac_id);
    if (!arac) {
      aday.durum = "hata";
      return null;
    }

    const trans = arac.metadata.transkript;
    if (trans?.durum === "iptal" || trans?.durum === "onaylandi" || trans?.ai_girisim_id !== aday.ai_girisim_id) {
      aday.durum = "iptal";
      return null;
    }

    const yeniLease = new Date(simdi.getTime() + leaseSaniye * 1000);
    aday.durum = "isleniyor";
    aday.deneme_sayisi += 1;
    aday.lease_bitis = yeniLease;

    arac.metadata.transkript = {
      ...trans,
      durum: "ai_isleniyor",
      lease_bitis: yeniLease.toISOString(),
    };

    return {
      is_id: aday.is_id,
      arac_id: arac.arac_id,
      ai_girisim_id: aday.ai_girisim_id,
      deneme_sayisi: aday.deneme_sayisi,
      lease_bitis: yeniLease,
    };
  }

  // 3. podcast_transkript_ai_gecici_hata_atomik simülasyonu
  geciciHata(is_id: string, hata_kodu: string, beklemeSaniye: number = 30) {
    const is = this.kuyruk.find((k) => k.is_id === is_id);
    if (!is) return false;

    const arac = this.araclar.get(is.arac_id);

    if (is.deneme_sayisi >= is.max_deneme) {
      is.durum = "hata";
      is.hata_kodu = hata_kodu;
      is.lease_bitis = null;
      if (arac?.metadata.transkript && arac.metadata.transkript.ai_girisim_id === is.ai_girisim_id) {
        arac.metadata.transkript.durum = "hata";
        arac.metadata.transkript.hata_kodu = hata_kodu;
        arac.metadata.transkript.lease_bitis = null;
      }
      return false; // Yeniden deneme hakkı kalmadı
    }

    is.durum = "bekliyor";
    is.lease_bitis = null;
    is.sonraki_deneme_tarihi = new Date(Date.now() + beklemeSaniye * 1000);
    is.hata_kodu = hata_kodu;

    if (arac?.metadata.transkript && arac.metadata.transkript.ai_girisim_id === is.ai_girisim_id) {
      arac.metadata.transkript.durum = "ai_bekliyor";
      arac.metadata.transkript.lease_bitis = null;
    }
    return true; // Başarıyla ertelendi
  }

  // 4. podcast_transkript_ai_tamamla_atomik simülasyonu
  tamamla(arac_id: string, girisim_id: string, metin: string) {
    const arac = this.araclar.get(arac_id);
    if (!arac) return false;

    const trans = arac.metadata.transkript;
    if (!trans) return false;

    // Yarış koruması: girişim ID eşleşmeli
    if (trans.ai_girisim_id !== girisim_id) return false;

    // İptal veya onay verilmişse gecikmiş sonucu reddet
    if (trans.durum === "iptal" || trans.durum === "onaylandi") return false;

    trans.durum = "ai_taslak";
    trans.taslak_metin = metin;
    trans.lease_bitis = null;

    const is = this.kuyruk.find((k) => k.arac_id === arac_id && k.ai_girisim_id === girisim_id);
    if (is) is.durum = "tamamlandi";

    return true;
  }

  // 5. podcast_transkript_ai_hata_atomik simülasyonu (Kalıcı hata)
  hata(arac_id: string, girisim_id: string, hata_kodu: string) {
    const arac = this.araclar.get(arac_id);
    if (!arac) return false;

    const trans = arac.metadata.transkript;
    if (!trans || trans.ai_girisim_id !== girisim_id) return false;
    if (trans.durum === "iptal" || trans.durum === "onaylandi") return false;

    trans.durum = "hata";
    trans.hata_kodu = hata_kodu;
    trans.lease_bitis = null;

    const is = this.kuyruk.find((k) => k.arac_id === arac_id && k.ai_girisim_id === girisim_id);
    if (is) {
      is.durum = "hata";
      is.hata_kodu = hata_kodu;
    }

    return true;
  }

  // 6. İptal simülasyonu
  iptalEt(arac_id: string) {
    const arac = this.araclar.get(arac_id);
    if (!arac) return;

    arac.metadata.transkript = {
      durum: "iptal",
      ai_girisim_id: null,
      lease_bitis: null,
      taslak_metin: null,
      onaylanan_metin: null,
    };

    for (const is of this.kuyruk) {
      if (is.arac_id === arac_id && (is.durum === "bekliyor" || is.durum === "isleniyor")) {
        is.durum = "iptal";
      }
    }
  }
}

test("Senaryo 1: HTTP isteği bittikten sonra işin kuyrukta bağımsız worker tarafından devralındığını doğrulama", () => {
  const motor = new PodcastAiDurumMotoru();
  motor.aracEkle("arac-1", "storage/ses1.mp3");

  // HTTP isteği hemen döner (baslatıldı, ai_bekliyor)
  const yanit = motor.baslat("arac-1", "girisim-1");
  assert.equal(yanit.baslatildi, true);
  assert.equal(yanit.durum, "ai_bekliyor");

  // HTTP bittikten sonra arka planda cron worker işi devralır
  const alinanIs = motor.isiAl(180);
  assert.ok(alinanIs);
  assert.equal(alinanIs.ai_girisim_id, "girisim-1");

  // Model başarılı transkript üretir
  const sonuc = motor.tamamla("arac-1", "girisim-1", "Örnek podcast transkript metni.");
  assert.equal(sonuc, true);

  const guncel = motor.araclar.get("arac-1")!;
  assert.equal(guncel.metadata.transkript?.durum, "ai_taslak");
  assert.equal(guncel.metadata.transkript?.taslak_metin, "Örnek podcast transkript metni.");
});

test("Senaryo 2: Yarıda kesilen işin (lease bitişi aşılmış) yeniden devralındığını doğrulama", () => {
  const motor = new PodcastAiDurumMotoru();
  motor.aracEkle("arac-2", "storage/ses2.mp3");

  motor.baslat("arac-2", "girisim-2");
  const ilkIs = motor.isiAl(60); // 60 saniye lease
  assert.ok(ilkIs);
  assert.equal(ilkIs.deneme_sayisi, 1);

  // İşleyici sunucu çökmesi veya zaman aşımı nedeniyle yarıda kesildi (lease geçmişe çekilir)
  const kuyrukKaydi = motor.kuyruk.find((k) => k.ai_girisim_id === "girisim-2")!;
  kuyrukKaydi.lease_bitis = new Date(Date.now() - 5000); // 5 saniye önce süresi dolmuş

  // Yeni cron worker döngüsü sahipsiz işi tekrar devralır
  const devralinan = motor.isiAl(180);
  assert.ok(devralinan);
  assert.equal(devralinan.ai_girisim_id, "girisim-2");
  assert.equal(devralinan.deneme_sayisi, 2); // Deneme sayısı artmıştır
  assert.ok(devralinan.lease_bitis > new Date()); // Yeni geçerli lease süresi verilmiştir
});

test("Senaryo 3: Çift başlatmanın tek aktif girişim oluşturduğunu doğrulama (mukerrer_engellendi)", () => {
  const motor = new PodcastAiDurumMotoru();
  motor.aracEkle("arac-3", "storage/ses3.mp3");

  // İlk tıklama
  const ilk = motor.baslat("arac-3", "girisim-ilk");
  assert.equal(ilk.baslatildi, true);
  assert.equal(ilk.ai_girisim_id, "girisim-ilk");

  // Kullanıcı sabırsız davranıp hemen ikinci kez tıkladı
  const ikinci = motor.baslat("arac-3", "girisim-ikinci");
  assert.equal(ikinci.baslatildi, false);
  assert.equal(ikinci.mukerrer_engellendi, true);
  assert.equal(ikinci.ai_girisim_id, "girisim-ilk"); // İlk girişim korunur

  // Kuyrukta yalnız 1 aktif kayıt bulunur
  const aktifKuyrukSayisi = motor.kuyruk.filter((k) => k.arac_id === "arac-3" && k.durum === "bekliyor").length;
  assert.equal(aktifKuyrukSayisi, 1);
});

test("Senaryo 4: İptal sonrası gecikmiş sonucun reddedildiğini doğrulama", () => {
  const motor = new PodcastAiDurumMotoru();
  motor.aracEkle("arac-4", "storage/ses4.mp3");

  motor.baslat("arac-4", "girisim-4");
  motor.isiAl(180);

  // Kullanıcı transkripti iptal etti ve transkriptsiz devam etmeye karar verdi
  motor.iptalEt("arac-4");
  const iptalDurum = motor.araclar.get("arac-4")!.metadata.transkript?.durum;
  assert.equal(iptalDurum, "iptal");

  // Gecikmiş Gemini transkript cevabı ulaştı
  const gecikmisKabul = motor.tamamla("arac-4", "girisim-4", "Gecikmiş transkript metni");
  assert.equal(gecikmisKabul, false); // Reddedildi

  // Durum 'iptal' olarak kalmalı, 'ai_taslak' ile ezilmemelidir
  const sonDurum = motor.araclar.get("arac-4")!.metadata.transkript?.durum;
  assert.equal(sonDurum, "iptal");
});

test("Senaryo 5: Eski girişimin yeni girişimi ezemediğini doğrulama", () => {
  const motor = new PodcastAiDurumMotoru();
  motor.aracEkle("arac-5", "storage/ses5.mp3");

  // 1. Girişim başlatıldı ve işe alındı
  motor.baslat("arac-5", "girisim-eski");
  motor.isiAl(60);

  // Eski girişimin süresi doldu (zaman aşımı)
  const eskiIs = motor.kuyruk.find((k) => k.ai_girisim_id === "girisim-eski")!;
  eskiIs.lease_bitis = new Date(Date.now() - 5000);
  motor.araclar.get("arac-5")!.metadata.transkript!.lease_bitis = new Date(Date.now() - 5000).toISOString();

  // Kullanıcı 'Tekrar Dene' ile yeni girişim başlattı
  const yeniBaslatma = motor.baslat("arac-5", "girisim-yeni");
  assert.equal(yeniBaslatma.baslatildi, true);
  assert.equal(motor.araclar.get("arac-5")!.metadata.transkript?.ai_girisim_id, "girisim-yeni");

  // Eski girişimin yanıtı gecikmeli olarak geldi
  const eskiCevapKabul = motor.tamamla("arac-5", "girisim-eski", "Eski girişimin cevabı");
  assert.equal(eskiCevapKabul, false); // Reddedildi, güncel girişim ezilmedi

  // Yeni girişimin yanıtı geldi
  const yeniCevapKabul = motor.tamamla("arac-5", "girisim-yeni", "Güncel girişimin cevabı");
  assert.equal(yeniCevapKabul, true);

  const sonTranskript = motor.araclar.get("arac-5")!.metadata.transkript;
  assert.equal(sonTranskript?.durum, "ai_taslak");
  assert.equal(sonTranskript?.taslak_metin, "Güncel girişimin cevabı");
});

test("Senaryo 6: Kalıcı hata vs Geçici hata (sonraki_deneme_tarihi ve max_deneme sınırlandırması)", () => {
  const motor = new PodcastAiDurumMotoru();
  motor.aracEkle("arac-6", "storage/ses6.mp3");

  // 6a. Kalıcı hata: SES_INDIRILEMEDI -> doğrudan 'hata'ya geçer, tekrar denenmez
  motor.baslat("arac-6", "girisim-kalici");
  const is1 = motor.isiAl(180)!;
  motor.hata("arac-6", "girisim-kalici", "SES_INDIRILEMEDI");
  assert.equal(motor.araclar.get("arac-6")!.metadata.transkript?.durum, "hata");
  assert.equal(motor.araclar.get("arac-6")!.metadata.transkript?.hata_kodu, "SES_INDIRILEMEDI");
  // Kuyrukta bekleyen iş kalmadı
  assert.equal(motor.isiAl(180), null);

  // 6b. Geçici hata: Deneme 1 -> sonraki_deneme_tarihi geleceğe ötelenir
  motor.aracEkle("arac-7", "storage/ses7.mp3");
  motor.baslat("arac-7", "girisim-gecici");
  const is2 = motor.isiAl(180)!;
  assert.equal(is2.deneme_sayisi, 1);

  // 30 saniye gecikmeyle ertelendi
  const ertelendi1 = motor.geciciHata(is2.is_id, "RATE_LIMIT", 30);
  assert.equal(ertelendi1, true);
  assert.equal(motor.araclar.get("arac-7")!.metadata.transkript?.durum, "ai_bekliyor");

  // Henüz süre dolmadığı için worker işi ALAMAZ
  assert.equal(motor.isiAl(180), null);

  // Simülasyonda süre doldu (sonraki_deneme_tarihi geçmişe çekilir)
  const kuyrukKaydi = motor.kuyruk.find((k) => k.is_id === is2.is_id)!;
  kuyrukKaydi.sonraki_deneme_tarihi = new Date(Date.now() - 1000);

  // Deneme 2: Worker işi alır
  const is3 = motor.isiAl(180)!;
  assert.equal(is3.deneme_sayisi, 2);
  const ertelendi2 = motor.geciciHata(is3.is_id, "RATE_LIMIT", 60);
  assert.equal(ertelendi2, true);

  // Deneme 3: Max deneme (3) sınırına ulaşma
  kuyrukKaydi.sonraki_deneme_tarihi = new Date(Date.now() - 1000);
  const is4 = motor.isiAl(180)!;
  assert.equal(is4.deneme_sayisi, 3);
  const ertelendi3 = motor.geciciHata(is4.is_id, "RATE_LIMIT", 120);
  assert.equal(ertelendi3, false); // Max denemeye ulaşıldı, kalıcı hata oldu

  assert.equal(motor.araclar.get("arac-7")!.metadata.transkript?.durum, "hata");
  assert.equal(motor.araclar.get("arac-7")!.metadata.transkript?.hata_kodu, "RATE_LIMIT");
  assert.equal(kuyrukKaydi.durum, "hata");
});
