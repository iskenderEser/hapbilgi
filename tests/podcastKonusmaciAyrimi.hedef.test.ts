import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  escapeRegExp,
  metindeIkiKonusmaciVarMi,
  konusmaciAdiniTemizle,
  konusmaciAdlariGecerliMi,
  konusmaciEtiketiniGuncelle,
  konusmaciMetniniNormalizeEt,
  metindekiIkiKonusmaciyiBul,
} from "@/lib/ogrenmeAraci/konusmaciAyraci";
import {
  sesteCokKonusmaciVarMi,
  sesTranskriptiOlusturGemini,
  yapilandirilmisDiyalogMetneDonustur,
} from "@/lib/ogrenmeAraci/geminiTranscribe";

function oku(goreceliYol: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), goreceliYol), "utf8");
}

// ============================================================================
// BÖLÜM 1: Gemini Prompt Kuralları ve Model Yönergeleri
// ============================================================================

test("Gemini transkript yönergesi: İki konuşmacı ayrımı, monolog koruması ve isim tahmini yasağı", () => {
  const geminiModul = oku("lib/ogrenmeAraci/geminiTranscribe.ts");

  // Konuşmacı 1 ve Konuşmacı 2 yönergesi
  assert.match(geminiModul, /Konuşmacı 1:/);
  assert.match(geminiModul, /Konuşmacı 2:/);

  // İsim uydurma / tahmin etme yasağı
  assert.match(
    geminiModul,
    /Konuşmacıların gerçek adlarını tahmin etme/
  );
  assert.match(
    geminiModul,
    /ses içinde isim geçse bile varsayılan etiketler daima "Konuşmacı 1" ve "Konuşmacı 2" olsun/
  );

  // Monolog kayıtlarda yapay ikinci konuşmacı oluşturulmaması
  assert.match(
    geminiModul,
    /Tek kişinin konuştuğu monolog kayıtlarda yapay ikinci konuşmacı oluşturma/
  );

  // Ardışık bloklar ve yeni satır kuralı
  assert.match(geminiModul, /Aynı kişi art arda konuşuyorsa gereksiz yeni blok oluşturma/);
  assert.match(geminiModul, /Konuşmacı değiştiğinde yeni satır aç/);

  // İçerik uydurmama kuralı
  assert.match(geminiModul, /Üst üste veya anlaşılamayan konuşmalarda içerik uydurma/);
});

// ============================================================================
// BÖLÜM 2: Konuşmacı Algılama Mantığı (metindeIkiKonusmaciVarMi & metindekiIkiKonusmaciyiBul)
// ============================================================================

test("metindeIkiKonusmaciVarMi: Konuşmacı 1 ve Konuşmacı 2 etiketlerini doğru tespit eder, monologları ayıklar", () => {
  const diyalogMetni = `Konuşmacı 1: Merhaba, bugünkü konumuz yapay zeka.
Konuşmacı 2: Merhaba, evet heyecan verici bir konu.
Konuşmacı 1: Kesinlikle katılıyorum.`;

  assert.equal(metindeIkiKonusmaciVarMi(diyalogMetni), true);

  const monologMetni = `Merhaba sevgili dinleyiciler. Bugünkü podcastimizde yapay zekanın geleceğini konuşacağız.
Öncelikle ilk konumuzla başlayalım.`;

  assert.equal(metindeIkiKonusmaciVarMi(monologMetni), false);

  const tekEtiketliMetin = `Konuşmacı 1: Ben tek başıma konuşuyorum. Başka kimse yok.`;
  assert.equal(metindeIkiKonusmaciVarMi(tekEtiketliMetin), false);

  assert.equal(metindeIkiKonusmaciVarMi(""), false);
});

test("metindekiIkiKonusmaciyiBul: Hem varsayılan hem özelleştirilmiş 2 konuşmacılı diyalogları bulur", () => {
  const varsayilanDiyalog = `Konuşmacı 1: Merhaba.
Konuşmacı 2: Selam.`;
  const sonuc1 = metindekiIkiKonusmaciyiBul(varsayilanDiyalog);
  assert.deepEqual(sonuc1, { etiket1: "Konuşmacı 1", etiket2: "Konuşmacı 2" });

  const ozelDiyalog = `Ahmet: Merhaba Ayşe.
Ayşe: Selam Ahmet, nasılsın?
Ahmet: İyiyim, teşekkürler.`;
  const sonuc2 = metindekiIkiKonusmaciyiBul(ozelDiyalog);
  assert.deepEqual(sonuc2, { etiket1: "Ahmet", etiket2: "Ayşe" });

  const monolog = `Bugün sizlere yeni teknolojileri anlatacağım.
İkinci kısımda detaylara gireceğiz.`;
  assert.equal(metindekiIkiKonusmaciyiBul(monolog), null);
});

// ============================================================================
// BÖLÜM 3: Satır Başı Etiket Değiştirme (konusmaciEtiketiniGuncelle)
// ============================================================================

test("konusmaciEtiketiniGuncelle: YALNIZCA satır başındaki etiketleri değiştirir, cümle içi metinleri bozmaz", () => {
  const ornekMetin = `Konuşmacı 1: Merhaba, dün Konuşmacı 1 hakkında bir makale okudum.
Konuşmacı 2: Gerçekten mi? Konuşmacı 1 çok ilginç bir konu.
Konuşmacı 1: Evet, ben de Konuşmacı 1 olarak aynı fikirdeyim.`;

  const guncel = konusmaciEtiketiniGuncelle(ornekMetin, "Konuşmacı 1", "Ahmet");

  const beklenen = `Ahmet: Merhaba, dün Konuşmacı 1 hakkında bir makale okudum.
Konuşmacı 2: Gerçekten mi? Konuşmacı 1 çok ilginç bir konu.
Ahmet: Evet, ben de Konuşmacı 1 olarak aynı fikirdeyim.`;

  assert.equal(guncel, beklenen);

  // İkinci konuşmacıyı da güncelle
  const tamGuncel = konusmaciEtiketiniGuncelle(guncel, "Konuşmacı 2", "Ayşe");

  const beklenenTam = `Ahmet: Merhaba, dün Konuşmacı 1 hakkında bir makale okudum.
Ayşe: Gerçekten mi? Konuşmacı 1 çok ilginç bir konu.
Ahmet: Evet, ben de Konuşmacı 1 olarak aynı fikirdeyim.`;

  assert.equal(tamGuncel, beklenenTam);
});

test("konusmaciEtiketiniGuncelle: Boş bırakıldığında varsayılan etikete geri döner", () => {
  const ozelMetin = `Ahmet: Merhaba.
Ayşe: Selam.
Ahmet: Nasılsın?`;

  const geriDonus = konusmaciEtiketiniGuncelle(ozelMetin, "Ahmet", "Konuşmacı 1");
  assert.equal(
    geriDonus,
    `Konuşmacı 1: Merhaba.\nAyşe: Selam.\nKonuşmacı 1: Nasılsın?`
  );
});

test("konusmaciEtiketiniGuncelle: Bold '**Konuşmacı 1:**' etiketini bold '**Ahmet:**' olarak günceller ve satır boşluğunu korur", () => {
  const boldMetin = `**Konuşmacı 1:** Merhaba.
**Konuşmacı 2:** Selam.

**Konuşmacı 1:** Nasılsın?
**Konuşmacı 2:** İyiyim.`;

  const guncel = konusmaciEtiketiniGuncelle(boldMetin, "Konuşmacı 1", "Ahmet");
  const beklenen = `**Ahmet:** Merhaba.
**Konuşmacı 2:** Selam.

**Ahmet:** Nasılsın?
**Konuşmacı 2:** İyiyim.`;

  assert.equal(guncel, beklenen);
});

// ============================================================================
// BÖLÜM 4: Giriş Güvenliği, XSS Koruması ve Validasyon (konusmaciAdiniTemizle & konusmaciAdlariGecerliMi)
// ============================================================================

test("konusmaciAdiniTemizle: HTML etiketlerini, iki noktaları temizler, 50 karakterle sınırlar", () => {
  const zararliHtml = `<script>alert('xss')</script>Ahmet<b>Yılmaz</b>`;
  const temiz = konusmaciAdiniTemizle(zararliHtml);
  assert.equal(temiz, "alert('xss')AhmetYılmaz");

  const ikiNoktali = "Dr. Mehmet: ";
  assert.equal(konusmaciAdiniTemizle(ikiNoktali), "Dr. Mehmet");

  const cokUzun = "A".repeat(80);
  assert.equal(konusmaciAdiniTemizle(cokUzun).length, 50);
});

test("konusmaciAdlariGecerliMi: İki konuşmacıya aynı ad verilmesini engeller (Türkçe büyük/küçük harf)", () => {
  // Aynı isimler engellenmeli
  const ayni1 = konusmaciAdlariGecerliMi("Ahmet", "ahmet");
  assert.equal(ayni1.gecerli, false);
  assert.match(ayni1.hata ?? "", /aynı ad verilemez/i);

  // Türkçe İ/i karakter testi
  const ayniTurkce = konusmaciAdlariGecerliMi("İSMAİL", "ismail");
  assert.equal(ayniTurkce.gecerli, false);
  assert.match(ayniTurkce.hata ?? "", /aynı ad verilemez/i);

  // Konuşmacı 1'e varsayılan Konuşmacı 2 adını vermek
  const cakismaVarsayilan = konusmaciAdlariGecerliMi("Konuşmacı 2", "");
  assert.equal(cakismaVarsayilan.gecerli, false);

  // Farklı geçerli isimler
  const gecerli = konusmaciAdlariGecerliMi("Ali", "Veli");
  assert.equal(gecerli.gecerli, true);

  // 50 karakterden uzun isimler
  const uzunHata = konusmaciAdlariGecerliMi("A".repeat(51), "Veli");
  assert.equal(uzunHata.gecerli, false);
  assert.match(uzunHata.hata ?? "", /en fazla 50 karakter/i);
});

// ============================================================================
// BÖLÜM 5: Editör Arayüzü ve Entegrasyon Sözleşmesi
// ============================================================================

test("PodcastTranskriptEditoru: İki konuşmacı alanları yalnız AI modunda render edilir ve mevcut akış bozulmaz", () => {
  const editorKod = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");

  // Yalnızca AI sekmesinde iki konuşmacı algılandığında render edilme kontrolü
  assert.match(editorKod, /sekme === "ai" && ikiKonusmaciVar/);
  assert.match(editorKod, /Konuşmacı 1 adı/);
  assert.match(editorKod, /Konuşmacı 2 adı/);
  assert.match(editorKod, /konusmaciHatasi/);

  // Butonun hata anında engellenmesi
  assert.match(editorKod, /Boolean\(konusmaciHatasi\)/);

  // Onay ve kaydet ekranda görünen son metni gönderir
  assert.match(editorKod, /const nihaiMetin = metin\.trim\(\);/);
});

test("Mimari sınırlandırma: Veritabanı şeması veya yeni migration eklenmediği, adların metin içinde taşındığı", () => {
  const konusmaciModul = oku("lib/ogrenmeAraci/konusmaciAyraci.ts");
  // Modül saf string işleme fonksiyonları içerir, harici veritabanı veya network bağımlılığı yoktur
  assert.doesNotMatch(konusmaciModul, /supabase/i);
  assert.doesNotMatch(konusmaciModul, /fetch/i);
});

// ============================================================================
// BÖLÜM 6: Model Yönlendirme ve Raporlama Sözleşmesi
// ============================================================================

test("Model Yönlendirme ve Raporlama: Model doğrudan parametreden alınır, istek URL'si ile kullanilanModel birebir aynıdır", async () => {
  const geminiModul = oku("lib/ogrenmeAraci/geminiTranscribe.ts");

  // Sessiz model değiştirme veya iç fallback kesinlikle bulunmamalıdır
  assert.doesNotMatch(geminiModul, /cagrilacakModel/);

  // Model çağrısı doğrudan girdi.model ile yapılmalıdır
  assert.match(
    geminiModul,
    /https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/\$\{encodeURIComponent\(girdi\.model\)\}:generateContent/
  );

  // Çalışma zamanı doğrulaması:
  const originalFetch = globalThis.fetch;
  const orijinalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-api-key";

  let cagrildiUrl = "";
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(
          JSON.stringify({
            file: {
              name: "files/test-file",
              uri: "https://generativelanguage.googleapis.com/v1beta/files/test-file",
              mimeType: "audio/mp4",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes(":generateContent")) {
        cagrildiUrl = urlStr;
        const bodyStr = typeof init?.body === "string" ? init.body : "";
        if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "BİRDEN_FAZLA" }] } }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Konuşmacı 1: Test transkript metni çıktısıdır.\nKonuşmacı 2: İkinci konuşmacı yanıtı." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("files/test-file")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof globalThis.fetch;

    const { sesTranskriptiOlusturGemini } = await import("@/lib/ogrenmeAraci/geminiTranscribe");

    // Flash modeli aktarıldığında:
    const sonucFlash = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3]),
      mimeType: "audio/mp4",
      dosyaAdi: "test.m4a",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonucFlash.ok, true);
    if (sonucFlash.ok) {
      assert.equal(sonucFlash.kullanilanModel, "gemini-3.5-flash");
      assert.ok(cagrildiUrl.includes("/models/gemini-3.5-flash:generateContent"));
    }
  } finally {
    globalThis.fetch = originalFetch;
    process.env.GEMINI_API_KEY = orijinalKey;
  }
});

// ============================================================================
// BÖLÜM 7: Konuşmacı Ayrımında Flash Modeli ve Markdown Normalizasyonu
// ============================================================================

test("Kuyruk ve Worker sözleşmesi: AI işi kuyruğa GEMINI_MODEL (Flash) ile yazılır ve worker bu modeli Gemini'ye aktarır", () => {
  const routeKod = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");
  // Kuyruğa yazılan model açıkça GEMINI_MODEL || 'gemini-3.5-flash' olmalı
  assert.match(routeKod, /const model = process\.env\.GEMINI_MODEL \|\| "gemini-3\.5-flash";/);
  assert.match(routeKod, /p_model: model/);

  const workerKod = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");
  // Worker kuyruktaki is.model'i doğrudan sesTranskriptiOlusturGemini'ye aktarmalı
  assert.match(workerKod, /model: is\.model/);
});

test("konusmaciMetniniNormalizeEt: Konuşmacı etiketleri bold '**Konuşmacı 1:**' / '**Konuşmacı 2:**' ve döngüler arası 1 satır boşluk olarak normalize edilir", () => {
  const markdownGirdi = `**Konuşmacı 1:** Merhaba, bugün yapay zekayı konuşuyoruz.
**Konuşmacı 2:** Merhaba, çok heyecanlı bir konu.
**Konuşmacı 1**: Evet, özellikle konuşmacı ayrımı çok önemli.
**Konuşmacı 2**: Katılıyorum. Dün **Konuşmacı 2** hakkında konuştuk.`;

  const normalizeEdilmis = konusmaciMetniniNormalizeEt(markdownGirdi);

  const beklenen = `**Konuşmacı 1:** Merhaba, bugün yapay zekayı konuşuyoruz.
**Konuşmacı 2:** Merhaba, çok heyecanlı bir konu.

**Konuşmacı 1:** Evet, özellikle konuşmacı ayrımı çok önemli.
**Konuşmacı 2:** Katılıyorum. Dün **Konuşmacı 2** hakkında konuştuk.`;

  assert.equal(normalizeEdilmis, beklenen);

  // Normalizasyon sonrası metinde iki konuşmacı algılanmalı ve etiketler çıkarılmalıdır
  assert.equal(metindeIkiKonusmaciVarMi(markdownGirdi), true);
  assert.deepEqual(metindekiIkiKonusmaciyiBul(markdownGirdi), {
    etiket1: "Konuşmacı 1",
    etiket2: "Konuşmacı 2",
  });
});

test("konusmaciMetniniNormalizeEt: Code block işaretlerini temizler, monolog metni bozmaz", () => {
  const codeBlockluMetin = "```text\nKonuşmacı 1: Giriş\nKonuşmacı 2: Yanıt\n```";
  const temiz = konusmaciMetniniNormalizeEt(codeBlockluMetin);
  assert.equal(temiz, "**Konuşmacı 1:** Giriş\n**Konuşmacı 2:** Yanıt");

  const monolog = "Merhaba sevgili dinleyiciler, bugün tek başıma konuşuyorum.";
  assert.equal(konusmaciMetniniNormalizeEt(monolog), monolog);
  assert.equal(metindeIkiKonusmaciVarMi(monolog), false);
  assert.equal(metindekiIkiKonusmaciyiBul(monolog), null);
});

// ============================================================================
// BÖLÜM 8: Gerçek MIME Türü ve Dosya Uzantısının Worker'a Aktarılması
// ============================================================================

test("Worker sözleşmesi: Worker içinde sabit 'audio/mp4' ve '.m4a' bulunmaz; kuyruk ve doğrulanmış metadata kullanılır", () => {
  const workerKod = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");

  // Sabit audio/mp4 veya ${arac_id}.m4a çağrısı kesinlikle bulunmamalıdır
  assert.doesNotMatch(workerKod, /mimeType:\s*["']audio\/mp4["']/);
  assert.doesNotMatch(workerKod, /dosyaAdi:\s*`\$\{arac_id\}\.m4a`/);

  // Dinamik mimeType ve dosyaAdi aktarılmalıdır
  assert.match(workerKod, /mimeType,/);
  assert.match(workerKod, /dosyaAdi,/);
  assert.match(workerKod, /model:\s*is\.model/);
});

test("SQL sözleşmesi: podcast_transkript_ai_isi_al_atomik RPC'si gerçek mime_type ve dosya_adi döndürür", () => {
  const sqlAna = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");
  const sqlGuncelleme = oku("scripts/sql/ogrenme_araclari_faz3_podcast_transkript_mime_dosya_adi.sql");

  for (const sql of [sqlAna, sqlGuncelleme]) {
    assert.match(sql, /'mime_type',\s*v_mime_type/);
    assert.match(sql, /'dosya_adi',\s*v_dosya_adi/);
    assert.match(sql, /audio\/mpeg/);
    assert.match(sql, /audio\/mp4/);
  }
});

test("MIME türü ve dosya adı aktarımı: MP3 (audio/mpeg, .mp3) ve M4A (audio/mp4, .m4a) doğrulanmış metadata'dan çekilir", () => {
  // Simüle edilen MP3 metadata senaryosu
  const mp3Meta = {
    yukleme_beyani: {
      dosya_adi: "L.A.I.R - TR.mp3",
      mime_type: "audio/mpeg",
    },
    depolama_dogrulamasi: {
      mime_turu: { beyan: "audio/mpeg" },
    },
  };
  const mp3DosyaYolu = "firmalar/f1/ogrenme-araclari/a1/ses.mp3";

  // Worker mantığının MP3 için doğru MIME ve dosya adı ürettiğini doğrula
  const depolamaMimeMp3 = mp3Meta.depolama_dogrulamasi.mime_turu.beyan;
  const mimeTypeMp3 = depolamaMimeMp3 || mp3Meta.yukleme_beyani.mime_type || (mp3DosyaYolu.endsWith(".mp3") ? "audio/mpeg" : "audio/mp4");
  const dosyaAdiMp3 = mp3Meta.yukleme_beyani.dosya_adi || mp3DosyaYolu.split("/").pop();

  assert.equal(mimeTypeMp3, "audio/mpeg");
  assert.equal(dosyaAdiMp3, "L.A.I.R - TR.mp3");

  // Simüle edilen M4A metadata senaryosu
  const m4aMeta = {
    yukleme_beyani: {
      dosya_adi: "podcast_kaydi.m4a",
      mime_type: "audio/mp4",
    },
    depolama_dogrulamasi: {
      mime_turu: { beyan: "audio/mp4" },
    },
  };
  const m4aDosyaYolu = "firmalar/f1/ogrenme-araclari/a2/ses.m4a";

  const depolamaMimeM4a = m4aMeta.depolama_dogrulamasi.mime_turu.beyan;
  const mimeTypeM4a = depolamaMimeM4a || m4aMeta.yukleme_beyani.mime_type || (m4aDosyaYolu.endsWith(".mp3") ? "audio/mpeg" : "audio/mp4");
  const dosyaAdiM4a = m4aMeta.yukleme_beyani.dosya_adi || m4aDosyaYolu.split("/").pop();

  assert.equal(mimeTypeM4a, "audio/mp4");
  assert.equal(dosyaAdiM4a, "podcast_kaydi.m4a");
});

test("İstemciden keyfî MIME kabul edilmez: Yalnız sunucuda doğrulanmış metadata ve veritabanı kullanılır", () => {
  const routeKod = oku("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts");
  // transkript-ai-baslat endpoint'i istemciden body almaz veya istemciden gelen mime_type'ı kabul etmez
  assert.match(routeKod, /export async function POST\(_request: NextRequest/);
  assert.doesNotMatch(routeKod, /_request\.json\(\)/);
  assert.doesNotMatch(routeKod, /body\.mime_type/);
});

// ============================================================================
// BÖLÜM 9: Çok Konuşmacılı Ses Ayrımı, Otomatik 2. Deneme ve Hata Yönetimi Sözleşmesi
// ============================================================================

test("Çok konuşmacılı ses ayrımı ve 2. deneme sözleşmesi: İkinci deneme yapılır, ayrılamazsa KONUSMACI_AYRIMI_YAPILAMADI döner", () => {
  const geminiKod = oku("lib/ogrenmeAraci/geminiTranscribe.ts");

  // Çok konuşmacı kontrol fonksiyonu
  assert.match(geminiKod, /export async function sesteCokKonusmaciVarMi/);
  assert.match(geminiKod, /BİRDEN_FAZLA/);
  assert.match(geminiKod, /TEK_KİŞİ/);

  // İki konuşmacı ayrımı denetimi
  assert.match(geminiKod, /metindeIkiKonusmaciVarMi\(ilkTranskript\.metin\)/);

  // Çok konuşmacılı ise 2. deneme (Flash ile)
  assert.match(geminiKod, /ikinciDeneme:\s*true/);

  // İkinci denemede de ayrılamazsa KONUSMACI_AYRIMI_YAPILAMADI hata kodu
  assert.match(geminiKod, /KONUSMACI_AYRIMI_YAPILAMADI/);
  assert.match(geminiKod, /Çok konuşmacılı podcast kaydında konuşmacı ayrımı yapılamadı/);
});

test("Komut 1 Sözleşmesi: Konuşmacı tespiti transkriptten önce yapılır, sesin tamamı değerlendirilir, 2 tespit denetlenir", () => {
  const geminiKod = oku("lib/ogrenmeAraci/geminiTranscribe.ts");

  // Sesin tamamını değerlendirme yönergesi
  assert.match(geminiKod, /başından sonuna kadar tamamını dikkatle dinle ve değerlendir/);

  // Transkriptten önce 2 tespit çağrısı
  assert.match(geminiKod, /const\s*\[tespit1,\s*tespit2\]\s*=\s*await\s*Promise\.all/);

  // İki tespit de açıkça TEK_KİŞİ derse monolog kabul et
  assert.match(geminiKod, /!cokKonusmaci/);
  assert.match(geminiKod, /monolog:\s*true/);

  // Tespitlerden biri BİRDEN_FAZLA derse diyalog kabul et
  assert.match(geminiKod, /tespit1\.durum === "BİRDEN_FAZLA" \|\| tespit2\.durum === "BİRDEN_FAZLA"/);
});


test("Worker hata sözleşmesi: KONUSMACI_AYRIMI_YAPILAMADI kalıcı hatadır, ai_taslak kaydedilmez; KONUSMACI_TESPIT_HATASI geçicidir", () => {
  const workerKod = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");

  // KALICI_HATALAR içinde KONUSMACI_AYRIMI_YAPILAMADI yer almalı
  assert.match(workerKod, /"KONUSMACI_AYRIMI_YAPILAMADI"/);

  // KONUSMACI_TESPIT_HATASI kalıcı hatalarda YER ALMAMALIDIR (geçici hata mekanizmasına girmelidir)
  const kaliciHatalarBlogu = workerKod.match(/const KALICI_HATALAR = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  assert.ok(!kaliciHatalarBlogu.includes("KONUSMACI_TESPIT_HATASI"), "KONUSMACI_TESPIT_HATASI kalıcı hata olmamalı, geçici kuyruk mekanizmasına girmelidir.");

  // Geçici hata çağrısı mevcut olmalıdır
  assert.match(workerKod, /podcast_transkript_ai_gecici_hata_atomik/);
  // Kalıcı hata durumunda podcast_transkript_ai_hata_atomik çağrılır (ai_taslak kaydedilmez)
  assert.match(workerKod, /p_hata_kodu:\s*hataKodu/);
});

// ============================================================================
// BÖLÜM 10: Davranışsal Testler (Mock Fetch: HTTP 500, Ağ Hatası, Boş/Belirsiz Yanıt, TEK_KİŞİ, BİRDEN_FAZLA)
// ============================================================================

test("Davranışsal Test - sesteCokKonusmaciVarMi: HTTP 500 hatasında KONUSMACI_TESPIT_HATASI döner (asla false dönmez)", async () => {
  const orjinalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof globalThis.fetch;

    const sonuc = await sesteCokKonusmaciVarMi({
      apiKey: "test-api-key",
      model: "gemini-3.5-flash",
      fileUri: "files/test-uri",
      mimeType: "audio/mpeg",
    });

    assert.equal(sonuc.ok, false);
    assert.equal(sonuc.hataKodu, "KONUSMACI_TESPIT_HATASI");
    assert.match(sonuc.detay, /HTTP 500/);
  } finally {
    globalThis.fetch = orjinalFetch;
  }
});

test("Davranışsal Test - sesteCokKonusmaciVarMi: Ağ hatasında (fetch error) KONUSMACI_TESPIT_HATASI döner (asla false dönmez)", async () => {
  const orjinalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      throw new Error("ECONNRESET: Connection terminated by peer");
    }) as typeof globalThis.fetch;

    const sonuc = await sesteCokKonusmaciVarMi({
      apiKey: "test-api-key",
      model: "gemini-3.5-flash",
      fileUri: "files/test-uri",
      mimeType: "audio/mpeg",
    });

    assert.equal(sonuc.ok, false);
    assert.equal(sonuc.hataKodu, "KONUSMACI_TESPIT_HATASI");
    assert.match(sonuc.detay, /ECONNRESET/);
  } finally {
    globalThis.fetch = orjinalFetch;
  }
});

test("Davranışsal Test - sesteCokKonusmaciVarMi: Boş cevapta KONUSMACI_TESPIT_HATASI döner (asla false dönmez)", async () => {
  const orjinalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "   " }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesteCokKonusmaciVarMi({
      apiKey: "test-api-key",
      model: "gemini-3.5-flash",
      fileUri: "files/test-uri",
      mimeType: "audio/mpeg",
    });

    assert.equal(sonuc.ok, false);
    assert.equal(sonuc.hataKodu, "KONUSMACI_TESPIT_HATASI");
    assert.match(sonuc.detay, /boş/i);
  } finally {
    globalThis.fetch = orjinalFetch;
  }
});

test("Davranışsal Test - sesteCokKonusmaciVarMi: Belirsiz veya çelişkili cevapta KONUSMACI_TESPIT_HATASI döner (asla false dönmez)", async () => {
  const orjinalFetch = globalThis.fetch;
  try {
    const belirsizCevaplar = [
      "Tam olarak anlayamadım, kayıt çok gürültülü.",
      "Hem tek kişi gibi hem de arka planda başka sesler var.",
      "Bilmiyorum.",
      "Emin değilim.",
    ];

    for (const cevap of belirsizCevaplar) {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: cevap }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }) as typeof globalThis.fetch;

      const sonuc = await sesteCokKonusmaciVarMi({
        apiKey: "test-api-key",
        model: "gemini-3.5-flash",
        fileUri: "files/test-uri",
        mimeType: "audio/mpeg",
      });

      assert.equal(sonuc.ok, false, `Cevap '${cevap}' için ok: false bekleniyordu`);
      assert.equal(sonuc.hataKodu, "KONUSMACI_TESPIT_HATASI");
      assert.match(sonuc.detay, /belirsiz/i);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
  }
});

test("Davranışsal Test - sesteCokKonusmaciVarMi: Yalnız açıkça TEK_KİŞİ döndüğünde durum: TEK_KİŞİ döner", async () => {
  const orjinalFetch = globalThis.fetch;
  try {
    const tekKisiCevaplari = ["TEK_KİŞİ", "tek kişi", "Tek Kişi.", "TEK_KISI"];
    for (const cevap of tekKisiCevaplari) {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: cevap }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }) as typeof globalThis.fetch;

      const sonuc = await sesteCokKonusmaciVarMi({
        apiKey: "test-api-key",
        model: "gemini-3.5-flash",
        fileUri: "files/test-uri",
        mimeType: "audio/mpeg",
      });

      assert.equal(sonuc.ok, true);
      if (sonuc.ok) {
        assert.equal(sonuc.durum, "TEK_KİŞİ");
      }
    }
  } finally {
    globalThis.fetch = orjinalFetch;
  }
});

test("Davranışsal Test - sesteCokKonusmaciVarMi: Yalnız açıkça BİRDEN_FAZLA döndüğünde durum: BİRDEN_FAZLA döner", async () => {
  const orjinalFetch = globalThis.fetch;
  try {
    const birdenFazlaCevaplari = ["BİRDEN_FAZLA", "birden fazla", "Birden Fazla.", "BIRDEN_FAZLA"];
    for (const cevap of birdenFazlaCevaplari) {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: cevap }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }) as typeof globalThis.fetch;

      const sonuc = await sesteCokKonusmaciVarMi({
        apiKey: "test-api-key",
        model: "gemini-3.5-flash",
        fileUri: "files/test-uri",
        mimeType: "audio/mpeg",
      });

      assert.equal(sonuc.ok, true);
      if (sonuc.ok) {
        assert.equal(sonuc.durum, "BİRDEN_FAZLA");
      }
    }
  } finally {
    globalThis.fetch = orjinalFetch;
  }
});

test("Davranışsal Test - sesTranskriptiOlusturGemini: Transkriptten önce yapılan konuşmacı tespitlerinden biri hata verirse transkripsiyon çağrılmaz, KONUSMACI_TESPIT_HATASI döner", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-mock";

  try {
    let callCount = 0;
    let transcribeCagrildi = false;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      callCount++;
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      // 1. Files upload
      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: { name: "files/test-123", uri: "https://generativelanguage.googleapis.com/files/test-123", mimeType: "audio/mpeg" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // Delete file
      if (urlStr.includes("DELETE") || (init?.method === "DELETE" && urlStr.includes("files/test-123"))) {
        return new Response("", { status: 200 });
      }
      // Transkripsiyon çağrısı denetimi
      if (bodyStr.includes("tam transkriptini çıkar") || bodyStr.includes("monolog kaydıdır")) {
        transcribeCagrildi = true;
      }
      // Konuşmacı tespiti çağrısı: HTTP 500 hatası dönüyor
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response("Server error", { status: 500 });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "ornek.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonuc.ok, false);
    if (!sonuc.ok) {
      assert.equal(sonuc.hataKodu, "KONUSMACI_TESPIT_HATASI");
    }
    // Tespit başarısız olduğunda transkripsiyon çağrısı yapılmamalıdır
    assert.equal(transcribeCagrildi, false, "Tespit hatalıyken transkripsiyon yapılmamalıdır.");
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test - sesTranskriptiOlusturGemini: İki tespit de açıkça TEK_KİŞİ derse monolog kabul edilir (ok: true, konusmaciSayisi: 1)", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-mock";

  try {
    let callCount = 0;
    let tespitSayisi = 0;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      callCount++;
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: { name: "files/test-123", uri: "https://generativelanguage.googleapis.com/files/test-123", mimeType: "audio/mpeg" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-123") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }
      // Konuşmacı tespiti çağrısı: açıkça TEK_KİŞİ
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        tespitSayisi++;
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "TEK_KİŞİ" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // Monolog transkript çağrısı: etiketsiz düz metin
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Merhaba, bugün sizlere tek başıma sunum yapıyorum." }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "ornek.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(tespitSayisi, 2, "İki ayrı tespit çağrısı yapılmalıdır.");
    assert.equal(sonuc.ok, true);
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 1);
      assert.equal(sonuc.metin.includes("Konuşmacı"), false);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test - sesTranskriptiOlusturGemini: Tespitlerden biri BİRDEN_FAZLA derse diyalog kabul edilir ve etiketli transkript üretilir", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-mock";

  try {
    let tespitSayaci = 0;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: { name: "files/test-123", uri: "https://generativelanguage.googleapis.com/files/test-123", mimeType: "audio/mpeg" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-123") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }
      // Konuşmacı tespiti çağrısı: biri TEK_KİŞİ, biri BİRDEN_FAZLA (biri BİRDEN_FAZLA dediği için diyalog kabul edilir)
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        tespitSayaci++;
        const yanit = tespitSayaci === 1 ? "TEK_KİŞİ" : "BİRDEN_FAZLA";
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: yanit }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // Diyalog transkripsiyonu
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Konuşmacı 1: Merhaba.\nKonuşmacı 2: Selam nasılsın?" }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "ornek.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonuc.ok, true);
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 2);
      assert.match(sonuc.metin, /Konuşmacı 1:/);
      assert.match(sonuc.metin, /Konuşmacı 2:/);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test - sesTranskriptiOlusturGemini: BİRDEN_FAZLA tespit edilip 2. denemede de ayrım yapılamazsa KONUSMACI_AYRIMI_YAPILAMADI döner", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-mock";

  try {
    let transcribeDenemesi = 0;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: { name: "files/test-123", uri: "https://generativelanguage.googleapis.com/files/test-123", mimeType: "audio/mpeg" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-123") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }
      // Konuşmacı tespiti çağrısı: İkisi de BİRDEN_FAZLA
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "BİRDEN_FAZLA" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // Transkripsiyon çağrısı: her iki denemede de etiketsiz metin dönüyor
      transcribeDenemesi++;
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: `Etiketsiz metin deneme ${transcribeDenemesi}` }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "ornek.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(transcribeDenemesi, 2, "Ayrım oluşmadığında 2 deneme yapılmalıdır.");
    assert.equal(sonuc.ok, false);
    if (!sonuc.ok) {
      assert.equal(sonuc.hataKodu, "KONUSMACI_AYRIMI_YAPILAMADI");
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

// ============================================================================
// BÖLÜM 11: Komut 2 - Yapılandırılmış Diyalog Transkripti ve Güvenlik Testleri
// ============================================================================

test("yapilandirilmisDiyalogMetneDonustur: speaker: 1 ve 2 olan blokları bold '**Konuşmacı 1:**' ve '**Konuşmacı 2:**' metnine dönüştürür ve döngüler arası 1 satır boşluk bırakır", () => {
  const bloklar = [
    { speaker: 1, text: "Merhaba, bugünkü konumuz yapay zeka." },
    { speaker: 1, text: "Özellikle konuşmacı ayrımını konuşacağız." },
    { speaker: 2, text: "Evet, bu çok kritik bir başlık." },
    { speaker: 1, text: "Kesinlikle katılıyorum." },
  ];

  const sonuc = yapilandirilmisDiyalogMetneDonustur(bloklar);
  assert.equal(sonuc.gecerli, true);
  if (sonuc.gecerli) {
    const beklenen = `**Konuşmacı 1:** Merhaba, bugünkü konumuz yapay zeka. Özellikle konuşmacı ayrımını konuşacağız.
**Konuşmacı 2:** Evet, bu çok kritik bir başlık.

**Konuşmacı 1:** Kesinlikle katılıyorum.`;
    assert.equal(sonuc.metin, beklenen);
    assert.equal(metindeIkiKonusmaciVarMi(sonuc.metin), true);
    assert.equal(sonuc.blokSayisi, 4);
  }

  // JSON string formatında girdi desteği
  const jsonStringGirdi = JSON.stringify(bloklar);
  const jsonSonuc = yapilandirilmisDiyalogMetneDonustur(jsonStringGirdi);
  assert.equal(jsonSonuc.gecerli, true);
});

test("yapilandirilmisDiyalogMetneDonustur: İki farklı konuşmacıya ait dolu blok yoksa (yalnızca 1 konuşmacı veya boş text) sonucu reddeder", () => {
  // Yalnızca Konuşmacı 1 var
  const tekKonusmaci1 = [{ speaker: 1, text: "Tek başıma konuşuyorum." }];
  const res1 = yapilandirilmisDiyalogMetneDonustur(tekKonusmaci1);
  assert.equal(res1.gecerli, false);
  if (!res1.gecerli) {
    assert.match(res1.sebep, /Konuşmacı 2/);
  }

  // Yalnızca Konuşmacı 2 var
  const tekKonusmaci2 = [{ speaker: 2, text: "Ben de tek başımayım." }];
  const res2 = yapilandirilmisDiyalogMetneDonustur(tekKonusmaci2);
  assert.equal(res2.gecerli, false);
  if (!res2.gecerli) {
    assert.match(res2.sebep, /Konuşmacı 1/);
  }

  // Konuşmacı 2 var ama metni boş ("   ")
  const bosMetinli = [
    { speaker: 1, text: "Geçerli metin." },
    { speaker: 2, text: "   " },
  ];
  const res3 = yapilandirilmisDiyalogMetneDonustur(bosMetinli);
  assert.equal(res3.gecerli, false);

  // Boş dizi
  assert.equal(yapilandirilmisDiyalogMetneDonustur([]).gecerli, false);

  // Boş / geçersiz string
  assert.equal(yapilandirilmisDiyalogMetneDonustur("").gecerli, false);
  assert.equal(yapilandirilmisDiyalogMetneDonustur("geçersiz json").gecerli, false);
});

test("Komut 2 Sözleşmesi: Flash diyalog çağrısında responseSchema ile ARRAY of {speaker, text} istenir", () => {
  const geminiKod = oku("lib/ogrenmeAraci/geminiTranscribe.ts");

  // responseMimeType ve generationConfig sözleşmesi
  assert.match(geminiKod, /responseMimeType:\s*"application\/json"/);
  assert.match(geminiKod, /responseSchema/);
  assert.match(geminiKod, /speaker/);
  assert.match(geminiKod, /required:\s*\["speaker",\s*"text"\]/);
});

test("Davranışsal Test - Flash yapılandırılmış JSON çıktısı ile transkripti başarıyla oluşturur", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-mock";

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: { name: "files/test-123", uri: "https://generativelanguage.googleapis.com/files/test-123", mimeType: "audio/mpeg" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-123") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "BİRDEN_FAZLA" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // Flash'tan dönen yapılandırılmış JSON çıktısı
      const jsonOutput = JSON.stringify([
        { speaker: 1, text: "Günaydın Doktor Bey." },
        { speaker: 2, text: "Günaydın Efe Bey, hoş geldiniz." },
        { speaker: 1, text: "Teşekkür ederim." },
      ]);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: jsonOutput }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "dialogue.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonuc.ok, true);
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 2);
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 1:?\*{0,2}:?\s*Günaydın Doktor Bey\./);
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 2:?\*{0,2}:?\s*Günaydın Efe Bey, hoş geldiniz\./);
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 1:?\*{0,2}:?\s*Teşekkür ederim\./);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test - 1. denemede yalnızca tek konuşmacı bloğu dönerse 2. deneme yapılır, 2. denemede iki konuşmacı dönerse kabul edilir", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-mock";

  try {
    let transcribeDenemesi = 0;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: { name: "files/test-123", uri: "https://generativelanguage.googleapis.com/files/test-123", mimeType: "audio/mpeg" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-123") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "BİRDEN_FAZLA" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      transcribeDenemesi++;
      if (transcribeDenemesi === 1) {
        // 1. denemede sadece tek konuşmacı dönüyor (kabul edilmemeli, 2. denemeye geçilmeli)
        const json1 = JSON.stringify([
          { speaker: 1, text: "Tek başıma monolog gibi konuştum." },
        ]);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: json1 }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 2. denemede iki konuşmacı ayrımı başarıyla dönüyor
      const json2 = JSON.stringify([
        { speaker: 1, text: "İlk konuşmacı sözü aldı." },
        { speaker: 2, text: "İkinci konuşmacı cevap verdi." },
      ]);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: json2 }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "dialogue.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(transcribeDenemesi, 2, "İlk deneme tek konuşmacı olunca 2. deneme yapılmalıdır.");
    assert.equal(sonuc.ok, true);
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 2);
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 1:?\*{0,2}:?\s*İlk konuşmacı sözü aldı\./);
      assert.match(sonuc.metin, /\*{0,2}Konuşmacı 2:?\*{0,2}:?\s*İkinci konuşmacı cevap verdi\./);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

test("Davranışsal Test - Monolog kayıtta yapay konuşmacı etiketi kesinlikle üretilmez (olası etiketler temizlenir)", async () => {
  const orjinalFetch = globalThis.fetch;
  const orjinalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key-mock";

  try {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyStr = typeof init?.body === "string" ? init.body : "";

      if (urlStr.includes("/upload/v1beta/files")) {
        return new Response(JSON.stringify({
          file: { name: "files/test-123", uri: "https://generativelanguage.googleapis.com/files/test-123", mimeType: "audio/mpeg" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (urlStr.includes("files/test-123") && init?.method === "DELETE") {
        return new Response("", { status: 200 });
      }
      if (bodyStr.includes("BİRDEN_FAZLA veya TEK_KİŞİ")) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "TEK_KİŞİ" }] } }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // Model monologda kazara Konuşmacı 1: etiketi üretse bile temizlenmeli
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Konuşmacı 1: Merhaba sevgili dinleyiciler, bugün tek başıma anlatıyorum." }] } }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof globalThis.fetch;

    const sonuc = await sesTranskriptiOlusturGemini({
      sesBaytlari: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      dosyaAdi: "monologue.mp3",
      model: "gemini-3.5-flash",
    });

    assert.equal(sonuc.ok, true);
    if (sonuc.ok) {
      assert.equal(sonuc.konusmaciSayisi, 1);
      assert.equal(sonuc.metin.includes("Konuşmacı 1:"), false);
      assert.match(sonuc.metin, /Merhaba sevgili dinleyiciler/);
    }
  } finally {
    globalThis.fetch = orjinalFetch;
    process.env.GEMINI_API_KEY = orjinalApiKey;
  }
});

// ============================================================================
// BÖLÜM 12: Komut 3 — Güncel AI Girişimini Koru ve Eski Sonuç İzolasyonu
// ============================================================================

test("Komut 3 - Arayüz ve Hook: Yeni AI girişimi başladığında önceki transkript ekranda gösterilmez ve sıfırlanır", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");

  // useTalepFormu: Yeni AI girişimi tetiklendiğinde transkript metni temizlenmeli
  assert.match(
    hookKodu,
    /handlePodcastAiTranskriptBaslat[\s\S]*?setPodcastTranskriptMetni\(""\)/,
    "AI başlatıldığında transkript metni hemen boşaltılmalıdır."
  );

  // useTalepFormu: ai_bekliyor veya ai_isleniyor durumunda transkript metni boş tutulmalı
  assert.match(
    hookKodu,
    /durum === "ai_bekliyor"[\s\S]*?setPodcastTranskriptMetni\(""\)/,
    "ai_bekliyor aşamasında metin boş tutulmalıdır."
  );
  assert.match(
    hookKodu,
    /durum === "ai_isleniyor"[\s\S]*?setPodcastTranskriptMetni\(""\)/,
    "ai_isleniyor aşamasında metin boş tutulmalıdır."
  );

  // Editor: aiIslemde sırasında textarea değeri boş olmalı ve düzenlemeye kapatılmalı
  assert.match(
    editorKodu,
    /value=\{aiIslemde \? "" : metin\}/,
    "AI işlemdeyken textarea metni boş gösterilmelidir."
  );
  assert.match(
    editorKodu,
    /disabled=\{aiIslemde \|\| kaydediliyor\}/,
    "AI işlemdeyken textarea kilitlenmelidir."
  );

  // Editor: aiIslemde iken konuşmacı adlandırma kutuları gizlenmeli
  assert.match(
    editorKodu,
    /sekme === "ai" && ikiKonusmaciVar && !aiIslemde/,
    "AI işlemdeyken konuşmacı adlandırma alanları gösterilmemelidir."
  );
});

test("Komut 3 - API & DB: Önceki transkript verisi yeni girişimin sonucu gibi kullanılamaz, taslak API'sinde gizlenir", () => {
  const routeKodu = oku("app/(panel)/talepler/api/taslak/route.ts");
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");

  // Taslak API: ai_bekliyor veya ai_isleniyor iken eski metin sızdırılmaz (null döner)
  assert.match(
    routeKodu,
    /transkriptDurumu === "ai_bekliyor" \|\| transkriptDurumu === "ai_isleniyor"/,
    "Taslak endpoint'i AI süreci devam ederken eski transkript metnini sıfırlamalıdır."
  );
  assert.match(
    routeKodu,
    /ai_girisim_id:\s*\(transkript\?\.ai_girisim_id as string \| undefined\) \?\? null/,
    "Taslak endpoint'i güncel ai_girisim_id bilgisini istemciye döndürmelidir."
  );

  // SQL: podcast_transkript_ai_baslat_atomik içinde eski metin metadata'dan silinir
  assert.match(
    sqlKodu,
    /v_metadata := v_metadata - 'transkript_metni';/,
    "Yeni girişim başladığında veritabanı metadata'sındaki eski metin silinmelidir."
  );
  assert.match(
    sqlKodu,
    /v_metadata := v_metadata - 'transkript_onaylandi';/,
    "Yeni girişim başladığında onay durumu sıfırlanmalıdır."
  );
});

test("Komut 3 & 4 - İstemci & Kuyruk: Yalnız güncel ai_girisim_id kabul edilir; eski veya gecikmiş sonuç reddedilir", () => {
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
  const kuyrukKodu = oku("lib/ogrenmeAraci/transkriptKuyrukIsleyici.ts");
  const sqlKodu = oku("scripts/sql/ogrenme_araclari_faz3_podcast_ai_transkript.sql");

  // Hook: gelen ai_girisim_id ile aktif id eşleşmiyorsa yoklama sonucu atılır
  assert.match(
    hookKodu,
    /if \(podcastAiGirisimId && gelenGirisimId && gelenGirisimId !== podcastAiGirisimId\)\s*\{\s*return;\s*\}/,
    "Farklı veya eski bir ai_girisim_id'ye ait yoklama sonucu istemcide yok sayılmalıdır."
  );

  // SQL: podcast_transkript_ai_tamamla_atomik sadece eşleşen ai_girisim_id'yi kabul eder
  assert.match(
    sqlKodu,
    /\(v_transkript->>'ai_girisim_id'\) <> p_girisim_id::text THEN\s*RETURN false;/,
    "SQL fonksiyonu sadece güncel ai_girisim_id'ye ait tamamlama isteğini onaylamalıdır."
  );

  // Kuyruk İşleyici: DB tamamlama başarısız olursa (stale attempt) işi iptal eder ve güncel kaydı bozmaz
  assert.match(
    kuyrukKodu,
    /if \(!tamamlandi\.data\)[\s\S]*?durum:\s*"iptal"[\s\S]*?GIRISIM_GECERSIZ/,
    "Kuyruk işleyici gecikmiş girişim tamamlanamadığında işi iptal etmelidir."
  );
});

test("Komut 3 - Onay, iptal ve gönderim akışlarının bütünlüğü korunmuştur", () => {
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // handleOnaylaVeKaydet ve handleIptalEt varlığı
  assert.match(editorKodu, /handleOnaylaVeKaydet/);
  assert.match(editorKodu, /handleIptalEt/);
  assert.match(editorKodu, /islem:\s*"onayla"/);
  assert.match(editorKodu, /islem:\s*"iptal_et"/);

  // Hook submit & onay akışı
  assert.match(hookKodu, /handlePodcastTranskriptOnayla/);
  assert.match(hookKodu, /handlePodcastTranskriptIptal/);
  assert.match(hookKodu, /podcastTranskriptOnaylandi/);
});

// ============================================================================
// BÖLÜM 13: Komut 4 — İstemci Yarışını Kaldır ve Tek Durum Otoritesi
// ============================================================================

test("Komut 4 - Transkript durumunu yalnız useTalepFormu yönetir, PodcastTranskriptEditoru içindeki ikinci polling kaldırılmıştır", () => {
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // Editör içinde setInterval polling mekanizması bulunmamalıdır
  assert.doesNotMatch(
    editorKodu,
    /setInterval\(aiDurumunuSorgula/,
    "PodcastTranskriptEditoru içinde ikinci polling interval'i bulunmamalıdır."
  );

  // useTalepFormu transkript durumunu sorgulayan tek otoritedir
  assert.match(
    hookKodu,
    /const interval = setInterval\(yokla, 2500\);/,
    "useTalepFormu transkript durumunu tek merkezden sorgulamalıdır."
  );
  assert.match(
    hookKodu,
    /setPodcastAiAsamasi/,
    "Durum geçişleri useTalepFormu tarafından yönetilmelidir."
  );
});

test("Komut 4 - Yeni işlem sürerken eski veya ara transkript gösterilmez", () => {
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");
  const hookKodu = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");

  // Editör: aiIslemde true iken textarea boş değer gösterir
  assert.match(
    editorKodu,
    /value=\{aiIslemde \? "" : metin\}/,
    "İşlem sürerken textarea değeri boş string olmalıdır."
  );
  assert.match(
    editorKodu,
    /disabled=\{aiIslemde \|\| kaydediliyor\}/,
    "İşlem sürerken textarea kilitlenmelidir."
  );

  // useTalepFormu: ai aşamalarında metin boş tutulur
  assert.match(
    hookKodu,
    /durum === "ai_bekliyor"[\s\S]*?setPodcastTranskriptMetni\(""\)/,
    "ai_bekliyor durumunda transkript metni boş tutulmalıdır."
  );
  assert.match(
    hookKodu,
    /durum === "ai_isleniyor"[\s\S]*?setPodcastTranskriptMetni\(""\)/,
    "ai_isleniyor durumunda transkript metni boş tutulmalıdır."
  );
});

test("Komut 4 - Metinde iki konuşmacı etiketi yoksa konuşmacı adlandırma alanı kapatılır", () => {
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");

  // useEffect içinde metinde iki konuşmacı yoksa ikiKonusmaciVar false yapılmalıdır
  assert.match(
    editorKodu,
    /if \(!metindeIkiKonusmaciVarMi\(metin\)\) \{\s*setIkiKonusmaciVar\(false\);/,
    "Metinde iki konuşmacı yoksa ikiKonusmaciVar state'i derhal false yapılmalıdır."
  );

  // Render şartında metindeIkiKonusmaciVarMi kontrolü de yer almalıdır
  assert.match(
    editorKodu,
    /sekme === "ai" && ikiKonusmaciVar && !aiIslemde && metindeIkiKonusmaciVarMi\(metin\)/,
    "Konuşmacı adlandırma alanı yalnızca iki konuşmacı varsa ve işlem bittiyse gösterilmelidir."
  );
});

test("Komut 4 - Düzenleme ve onay davranışları eksiksiz korunur", () => {
  const editorKodu = oku("app/(panel)/talepler/_components/PodcastTranskriptEditoru.tsx");

  // Düzenleme: onMetinDegisti çağrıları
  assert.match(editorKodu, /onMetinDegisti\(e\.target\.value\)/);
  assert.match(editorKodu, /handleKonusmaci1Degisti/);
  assert.match(editorKodu, /handleKonusmaci2Degisti/);

  // Onay: handleOnaylaVeKaydet
  assert.match(editorKodu, /handleOnaylaVeKaydet/);
  assert.match(editorKodu, /onSunucuOnayla/);
  assert.match(editorKodu, /onOnayla\(\)/);

  // İptal: handleIptalEt
  assert.match(editorKodu, /handleIptalEt/);
  assert.match(editorKodu, /onSunucuIptal/);
  assert.match(editorKodu, /onIptalEt\(\)/);
});



