import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sesTranskriptiOlusturGemini } from "@/lib/ogrenmeAraci/geminiTranscribe";

// ============================================================================
// CANLI ENTEGRASYON TESTİ: GEMINI 3.5 TRANSCRIBE SES TRANSKRİPSİYONU
// ============================================================================
// Bu test doğrudan Google Generative Language API Files & generateContent
// servislerini ve üretim sesTranskriptiOlusturGemini fonksiyonunu kullanır.
// CI/offline testleri engellememesi için açıkça çalıştırılan canlı test dosyasıdır.
// Güvenlik: API anahtarı, ses baytları veya transkriptin tamamı asla loglanmaz.

test("Canlı Gemini 3.5 Transcribe Entegrasyonu: Gerçek ses dosyası ile transkript üretimi ve temizleme", async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  assert.ok(apiKey && apiKey.length > 5, "Canlı test için GEMINI_API_KEY ortam değişkeni tanımlı olmalıdır.");

  const model = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe";
  assert.equal(model, "gemini-3.5-transcribe", "Canlı ses transkripsiyon modeli gemini-3.5-transcribe olmalıdır.");

  const sesDosyaYolu = path.resolve(process.cwd(), "tests/fixtures/podcast_ornek.m4a");
  assert.ok(fs.existsSync(sesDosyaYolu), "podcast_ornek.m4a armatür dosyası mevcut olmalıdır.");

  const sesBaytlari = fs.readFileSync(sesDosyaYolu);
  assert.ok(sesBaytlari.length > 1000, "Ses dosyası baytları boş veya bozuk olmamalıdır.");

  // HapBilgi üretim fonksiyonunu doğrudan çağır
  const sonuc = await sesTranskriptiOlusturGemini({
    sesBaytlari: new Uint8Array(sesBaytlari),
    mimeType: "audio/mp4",
    dosyaAdi: "podcast_ornek.m4a",
  });

  // Hata durumunda mock/bypass olmadan testi başarısız kıl
  if (!sonuc.ok) {
    assert.fail(`Gemini canlı transkripsiyon başarısız oldu. Hata kodu: ${sonuc.hataKodu}, Detay: ${sonuc.detay}`);
  }

  assert.equal(sonuc.ok, true, "Transkripsiyon sonucu ok: true olmalıdır.");
  assert.equal(sonuc.kullanilanModel, "gemini-3.5-transcribe", "Kullanılan model gemini-3.5-transcribe olmalıdır.");
  assert.ok(typeof sonuc.metin === "string", "Transkript metni metinsel bir dize olmalıdır.");
  assert.ok(sonuc.metin.length >= 10, "Transkript metni en az 10 karakter olmalıdır.");

  const kucukMetin = sonuc.metin.toLocaleLowerCase("tr-TR");
  const podcastIceriyor = kucukMetin.includes("podcast");
  const transkripsiyonIceriyor = kucukMetin.includes("transkripsiyon") || kucukMetin.includes("transkript");

  assert.ok(
    podcastIceriyor,
    "Transkript ses armatüründeki 'podcast' kelimesini içermelidir."
  );
  assert.ok(
    transkripsiyonIceriyor,
    "Transkript ses armatüründeki 'transkripsiyon'/'transkript' kelimesini içermelidir."
  );
});
