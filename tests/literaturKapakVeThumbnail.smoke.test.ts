import test from "node:test";
import assert from "node:assert/strict";

process.env.BUNNY_LEARNING_STORAGE_ZONE = "test-storage";
process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY = "test-key";
process.env.BUNNY_LEARNING_PULL_ZONE = "cdn.test.com";
process.env.BUNNY_LEARNING_TOKEN_KEY = "test-token-key";
process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT = "https://upload.bunny.net";
process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET = "test-shared-secret";

import {
  podcastDestekDosyasiDogrula,
  podcastDestekDosyasiImzasiDogrula,
  kapakYayinKapisiDogrula,
} from "@/lib/ogrenmeAraci/sozlesme";
import {
  yayinThumbnailUrlCoz,
  yayinThumbnailCevabi,
} from "@/lib/ogrenmeAraci/yayinThumbnail";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";

// Magic byte samples
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, // WEBP
  0x56, 0x50, 0x38, 0x20,
]);
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
const DOCX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]); // PK\x03\x04
const TXT_BYTES = new TextEncoder().encode("Bu bir ornek transkript metnidir.");

// ── 1. Kapak Doğrulama: Uzantı, MIME ve Magic Byte Birebir Uyum Testleri ──
test("Kapak beyanı: JPG/JPEG doğru uzantı ve MIME kabul edilir", () => {
  const jpg = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.jpg",
    mimeType: "image/jpeg",
    dosyaBoyutu: 1024 * 500,
  });
  assert.equal(jpg.ok, true);
  if (jpg.ok) assert.equal(jpg.uzanti, "jpg");

  const jpeg = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.jpeg",
    mimeType: "image/jpeg",
    dosyaBoyutu: 1024 * 500,
  });
  assert.equal(jpeg.ok, true);
  if (jpeg.ok) assert.equal(jpeg.uzanti, "jpeg");
});

test("Kapak beyanı: PNG ve WEBP doğru uzantı ve MIME kabul edilir", () => {
  const png = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.png",
    mimeType: "image/png",
    dosyaBoyutu: 1024 * 500,
  });
  assert.equal(png.ok, true);

  const webp = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.webp",
    mimeType: "image/webp",
    dosyaBoyutu: 1024 * 500,
  });
  assert.equal(webp.ok, true);
});

test("Kapak beyanı: Uyumsuz Uzantı ve MIME kombinasyonları kesinlikle reddedilir", () => {
  // kapak.jpg + image/png -> RED
  const jpgPng = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.jpg",
    mimeType: "image/png",
    dosyaBoyutu: 1024,
  });
  assert.equal(jpgPng.ok, false);

  // kapak.png + image/jpeg -> RED
  const pngJpg = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.png",
    mimeType: "image/jpeg",
    dosyaBoyutu: 1024,
  });
  assert.equal(pngJpg.ok, false);

  // kapak.webp + image/png -> RED
  const webpPng = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.webp",
    mimeType: "image/png",
    dosyaBoyutu: 1024,
  });
  assert.equal(webpPng.ok, false);

  // kapak.pdf + image/png -> RED
  const pdfKapak = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.pdf",
    mimeType: "image/png",
    dosyaBoyutu: 1024,
  });
  assert.equal(pdfKapak.ok, false);
});

test("Kapak beyanı: Dosya boyutu sınırları (0 bayt ve >20MB) korunur", () => {
  const sifir = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.jpg",
    mimeType: "image/jpeg",
    dosyaBoyutu: 0,
  });
  assert.equal(sifir.ok, false);

  const asiri = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.jpg",
    mimeType: "image/jpeg",
    dosyaBoyutu: 20 * 1024 * 1024 + 1,
  });
  assert.equal(asiri.ok, false);

  const tamSinir = podcastDestekDosyasiDogrula({
    rol: "kapak",
    dosyaAdi: "kapak.jpg",
    mimeType: "image/jpeg",
    dosyaBoyutu: 20 * 1024 * 1024,
  });
  assert.equal(tamSinir.ok, true);
});

test("Kapak imza doğrulaması: Magic byte uzantıyla birebir eşleşmelidir", () => {
  // JPG dosya adı ve JPEG magic bytes -> GEÇER
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "jpg", JPEG_BYTES), true);
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "jpeg", JPEG_BYTES), true);

  // PNG dosya adı ve PNG magic bytes -> GEÇER
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "png", PNG_BYTES), true);

  // WEBP dosya adı ve WEBP magic bytes -> GEÇER
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "webp", WEBP_BYTES), true);

  // kapak.jpg ancak içerik PNG baytları (hileli dosya) -> RED!
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "jpg", PNG_BYTES), false);

  // kapak.png ancak içerik JPEG baytları -> RED!
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "png", JPEG_BYTES), false);

  // kapak.webp ancak içerik PNG baytları -> RED!
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "webp", PNG_BYTES), false);

  // kapak.jpg ancak PDF baytları -> RED!
  assert.equal(podcastDestekDosyasiImzasiDogrula("kapak", "jpg", PDF_BYTES), false);
});

test("Podcast transkript regresyon kontrolü: TXT, PDF, DOCX doğrulaması korunur", () => {
  assert.equal(podcastDestekDosyasiDogrula({ rol: "transkript", dosyaAdi: "notlar.txt", mimeType: "text/plain", dosyaBoyutu: 500 }).ok, true);
  assert.equal(podcastDestekDosyasiDogrula({ rol: "transkript", dosyaAdi: "notlar.pdf", mimeType: "application/pdf", dosyaBoyutu: 500 }).ok, true);
  assert.equal(podcastDestekDosyasiDogrula({ rol: "transkript", dosyaAdi: "notlar.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", dosyaBoyutu: 500 }).ok, true);

  assert.equal(podcastDestekDosyasiImzasiDogrula("transkript", "txt", TXT_BYTES), true);
  assert.equal(podcastDestekDosyasiImzasiDogrula("transkript", "pdf", PDF_BYTES), true);
  assert.equal(podcastDestekDosyasiImzasiDogrula("transkript", "docx", DOCX_BYTES), true);
});

// ── 2. Literatür ve Podcast Yayın Kapısı / Kapak Kapısı Mantığı ──
test("kapakYayinKapisiDogrula: Kapak seçilmemişse devam eder", () => {
  const sonuc = kapakYayinKapisiDogrula({
    kapakYolu: null,
    metadata: {},
  });
  assert.equal(sonuc.ok, true);
});

test("kapakYayinKapisiDogrula: Kapak bekleniyorsa veya bekleyen_destek_yollari varsa reddeder", () => {
  const sonuc1 = kapakYayinKapisiDogrula({
    kapakYolu: null,
    metadata: { kapak_bekleniyor: true },
  });
  assert.equal(sonuc1.ok, false);

  const sonuc2 = kapakYayinKapisiDogrula({
    kapakYolu: null,
    metadata: { bekleyen_destek_yollari: { kapak: "yollar/kapak.png" } },
  });
  assert.equal(sonuc2.ok, false);
});

test("kapakYayinKapisiDogrula: Kapak yolu var ancak doğrulanmamışsa reddeder", () => {
  const sonuc = kapakYayinKapisiDogrula({
    kapakYolu: "yollar/kapak.png",
    metadata: { kapak_dogrulandi: false },
  });
  assert.equal(sonuc.ok, false);
});

test("kapakYayinKapisiDogrula: Kapak yolu var ve doğrulanmışsa kabul eder", () => {
  const sonuc = kapakYayinKapisiDogrula({
    kapakYolu: "yollar/kapak.png",
    metadata: { kapak_dogrulandi: true },
  });
  assert.equal(sonuc.ok, true);
});

// ── 3. Tekil yayinThumbnailUrlCoz Çözümleyicisi Tür Kuralları ──
test("yayinThumbnailUrlCoz: Video için mevcut thumbnail_url döner", () => {
  const url = yayinThumbnailUrlCoz({
    arac_turu: "video",
    thumbnail_url: "https://bunny.net/thumb.jpg",
    arac_kapak_yolu: "ogrenme-araclari/video/kapak.png",
  });
  assert.equal(url, "https://bunny.net/thumb.jpg");
});

test("yayinThumbnailUrlCoz: Podcast YALNIZCA kapak_dogrulandi === true ise imzalı CDN URL döner", () => {
  const onayli = yayinThumbnailUrlCoz({
    arac_turu: "podcast",
    arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
    kapak_dogrulandi: true,
  });
  assert.ok(typeof onayli === "string");
  assert.ok(onayli.includes("kapak.png"));
  assert.ok(onayli.includes("token="));

  // Doğrulanmamış podcast kapağı -> null döner (istemcide varsayılan kapak devreye girer)
  const onaysiz = yayinThumbnailUrlCoz({
    arac_turu: "podcast",
    arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
    kapak_dogrulandi: false,
  });
  assert.equal(onaysiz, null);

  // metadata içinde kapak_dogrulandi olanı da tanır
  const metadataOnayli = yayinThumbnailUrlCoz({
    arac_turu: "podcast",
    arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
    arac_metadata: { kapak_dogrulandi: true },
    metadata: { bekleyen_destek_yollari: { kapak: "gizli/kapak.png" } },
  });
  assert.ok(typeof metadataOnayli === "string");
});

test("yayinThumbnailUrlCoz: Literatür (flip_pdf) YALNIZCA kapak_dogrulandi === true ise imzalı CDN URL döner", () => {
  const onayli = yayinThumbnailUrlCoz({
    arac_turu: "flip_pdf",
    arac_kapak_yolu: "ogrenme-araclari/literatur/kapak.jpg",
    kapak_dogrulandi: true,
  });
  assert.ok(typeof onayli === "string");
  assert.ok(onayli.includes("kapak.jpg"));
  assert.ok(onayli.includes("token="));

  // Doğrulanmamış Literatür kapağı -> null döner
  const onaysiz = yayinThumbnailUrlCoz({
    arac_turu: "flip_pdf",
    arac_kapak_yolu: "ogrenme-araclari/literatur/kapak.jpg",
    kapak_dogrulandi: false,
  });
  assert.equal(onaysiz, null);

  // Kapaksız Literatür -> null döner
  const kapaksiz = yayinThumbnailUrlCoz({
    arac_turu: "flip_pdf",
    arac_dosya_yolu: "ogrenme-araclari/literatur/belge.pdf",
  });
  assert.equal(kapaksiz, null);
});

test("yayinThumbnailUrlCoz: Dijital Broşür (gorsel) öncelikle ana görsel yolunu imzalar", () => {
  const brosur = yayinThumbnailUrlCoz({
    arac_turu: "gorsel",
    arac_dosya_yolu: "ogrenme-araclari/brosurler/katalog.png",
  });
  assert.ok(typeof brosur === "string");
  assert.ok(brosur.includes("katalog.png"));
  assert.ok(brosur.includes("token="));

  // dosya_yolu fallback'i
  const fallbackBrosur = yayinThumbnailUrlCoz({
    arac_turu: "gorsel",
    dosya_yolu: "ogrenme-araclari/brosurler/eski_katalog.png",
  });
  assert.ok(typeof fallbackBrosur === "string");
  assert.ok(fallbackBrosur.includes("eski_katalog.png"));
});

// ── 4. Güvenlik: Ham Bunny Storage Yolu Gizleme (yayinThumbnailCevabi) ──
test("yayinThumbnailCevabi: Ham Bunny Storage yollarını API cevabından tamamen temizler", () => {
  const yayinVerisi = {
    yayin_id: "yayin-123",
    urun_adi: "Forma XL",
    arac_turu: "gorsel",
    arac_dosya_yolu: "ogrenme-araclari/brosurler/forma_xl.png",
    arac_kapak_yolu: "ogrenme-araclari/brosurler/forma_xl_kapak.png",
    dosya_yolu: "ogrenme-araclari/brosurler/eski.png",
    kapak_yolu: "ogrenme-araclari/brosurler/ham_kapak.png",
    transkript_yolu: "ogrenme-araclari/transkriptler/trans.txt",
    arac_transkript_yolu: "ogrenme-araclari/transkriptler/trans2.txt",
    arac_metadata: { kapak_dogrulandi: true },
    video_puani: 100,
  };

  const yanit = yayinThumbnailCevabi(yayinVerisi);

  // İmzalı CDN URL'si üretilmeli
  assert.ok(typeof yanit.thumbnail_url === "string");
  assert.ok(yanit.thumbnail_url.includes("forma_xl.png"));
  assert.ok(yanit.thumbnail_url.includes("token="));

  // Ham yollar yanıt nesnesinde ASLA bulunmamalıdır!
  assert.equal("arac_dosya_yolu" in yanit, false);
  assert.equal("arac_kapak_yolu" in yanit, false);
  assert.equal("dosya_yolu" in yanit, false);
  assert.equal("kapak_yolu" in yanit, false);
  assert.equal("transkript_yolu" in yanit, false);
  assert.equal("arac_transkript_yolu" in yanit, false);
  assert.equal("arac_metadata" in yanit, false);
  assert.equal("metadata" in yanit, false);

  // Diğer alanlar korunmalı
  assert.equal(yanit.yayin_id, "yayin-123");
  assert.equal(yanit.urun_adi, "Forma XL");
  assert.equal(yanit.video_puani, 100);
});

// ── 5. Client Fallback: AracVarsayilanKapak Entegrasyonu ──
test("Client Fallback: AracVarsayilanKapak 4 tür için de hatasız render edilir", () => {
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"] as const) {
    const render = AracVarsayilanKapak({ aracTuru: tur, urunAdi: "Deneme İlacı" });
    assert.ok(render !== null);
    assert.equal(typeof render, "object");
  }
});
