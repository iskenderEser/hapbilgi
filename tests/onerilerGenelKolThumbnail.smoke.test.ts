import test from "node:test";
import assert from "node:assert/strict";

process.env.BUNNY_LEARNING_STORAGE_ZONE = "test-storage";
process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY = "test-key";
process.env.BUNNY_LEARNING_PULL_ZONE = "cdn.test.com";
process.env.BUNNY_LEARNING_TOKEN_KEY = "test-token-key";
process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT = "https://upload.bunny.net";
process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET = "test-shared-secret";

import { oneriListesiThumbnailZenginlestir } from "@/lib/ogrenmeAraci/yayinThumbnail";

test("Öneri API genel kolu: Doğrulanmamış Podcast/Literatür kapağında RPC'den eski thumbnail_url gelse bile cevapta kullanılmaz", () => {
  const oneriListesi = [
    {
      oneri_id: "o-pod-1",
      yayin_id: "y-pod-1",
      urun_adi: "Kardiyoloji Podcast",
      thumbnail_url: "https://eski-rpc-sunucusu.com/unverified-podcast.jpg",
      video_url: null,
    },
    {
      oneri_id: "o-pdf-1",
      yayin_id: "y-pdf-1",
      urun_adi: "Klinik Literatür PDF",
      thumbnail_url: "https://eski-rpc-sunucusu.com/unverified-literature.jpg",
      video_url: null,
    },
  ];

  const yayinDetaylari = [
    {
      yayin_id: "y-pod-1",
      arac_id: "arac-pod-1",
      arac_turu: "podcast",
      arac_kapak_yolu: "ogrenme-araclari/podcast/kapak_1.png",
      arac_dosya_yolu: "ogrenme-araclari/podcast/ses_1.mp3",
      arac_metadata: { kapak_dogrulandi: false },
    },
    {
      yayin_id: "y-pdf-1",
      arac_id: "arac-pdf-1",
      arac_turu: "flip_pdf",
      arac_kapak_yolu: "ogrenme-araclari/flip-pdf/kapak_1.png",
      arac_dosya_yolu: "ogrenme-araclari/flip-pdf/dokuman_1.pdf",
      arac_metadata: { kapak_dogrulandi: false },
    },
  ];

  const sonuc = oneriListesiThumbnailZenginlestir(oneriListesi, yayinDetaylari);

  assert.equal(sonuc.length, 2);
  // Eski RPC thumbnail_url ASLA sızmamalı, doğrulanmamışsa null olmalı
  assert.equal(sonuc[0].thumbnail_url, null);
  assert.notEqual(sonuc[0].thumbnail_url, "https://eski-rpc-sunucusu.com/unverified-podcast.jpg");

  assert.equal(sonuc[1].thumbnail_url, null);
  assert.notEqual(sonuc[1].thumbnail_url, "https://eski-rpc-sunucusu.com/unverified-literature.jpg");
});

test("Öneri API genel kolu: Doğrulanmış kapakta imzalı thumbnail döndürülür", () => {
  const oneriListesi = [
    {
      oneri_id: "o-pod-2",
      yayin_id: "y-pod-2",
      urun_adi: "Doğrulanmış Podcast",
      thumbnail_url: null,
    },
    {
      oneri_id: "o-pdf-2",
      yayin_id: "y-pdf-2",
      urun_adi: "Doğrulanmış Literatür",
      thumbnail_url: null,
    },
  ];

  const yayinDetaylari = [
    {
      yayin_id: "y-pod-2",
      arac_id: "arac-pod-2",
      arac_turu: "podcast",
      arac_kapak_yolu: "ogrenme-araclari/podcast/onayli_kapak.png",
      arac_metadata: { kapak_dogrulandi: true },
    },
    {
      yayin_id: "y-pdf-2",
      arac_id: "arac-pdf-2",
      arac_turu: "flip_pdf",
      arac_kapak_yolu: "ogrenme-araclari/flip-pdf/onayli_kapak.png",
      arac_metadata: { kapak_dogrulandi: true },
    },
  ];

  const sonuc = oneriListesiThumbnailZenginlestir(oneriListesi, yayinDetaylari);

  assert.ok(typeof sonuc[0].thumbnail_url === "string");
  assert.ok(sonuc[0].thumbnail_url.includes("onayli_kapak.png"));
  assert.ok(sonuc[0].thumbnail_url.includes("token="));

  assert.ok(typeof sonuc[1].thumbnail_url === "string");
  assert.ok(sonuc[1].thumbnail_url.includes("onayli_kapak.png"));
  assert.ok(sonuc[1].thumbnail_url.includes("token="));
});

test("Öneri API genel kolu: Dijital Broşür için arac_dosya_yolu üzerinden imzalı thumbnail üretilir", () => {
  const oneriListesi = [
    {
      oneri_id: "o-db-1",
      yayin_id: "y-db-1",
      urun_adi: "Yeni Ürün Dijital Broşürü",
      thumbnail_url: null,
    },
  ];

  const yayinDetaylari = [
    {
      yayin_id: "y-db-1",
      arac_id: "arac-db-1",
      arac_turu: "gorsel",
      arac_dosya_yolu: "ogrenme-araclari/brosurler/urun_tanitimi.png",
      arac_kapak_yolu: null,
      arac_metadata: null,
    },
  ];

  const sonuc = oneriListesiThumbnailZenginlestir(oneriListesi, yayinDetaylari);

  assert.ok(typeof sonuc[0].thumbnail_url === "string");
  assert.ok(sonuc[0].thumbnail_url.includes("urun_tanitimi.png"));
  assert.ok(sonuc[0].thumbnail_url.includes("token="));
});

test("Öneri API genel kolu: Video thumbnail davranışı korunur", () => {
  const oneriListesi = [
    {
      oneri_id: "o-vid-1",
      yayin_id: "y-vid-1",
      urun_adi: "Eğitim Videosu",
      thumbnail_url: "https://video.bunnycdn.com/thumbs/vid1.jpg",
      video_url: "https://video.bunnycdn.com/play/vid1.mp4",
    },
  ];

  const yayinDetaylari = [
    {
      yayin_id: "y-vid-1",
      arac_id: "arac-vid-1",
      arac_turu: "video",
      thumbnail_url: "https://video.bunnycdn.com/thumbs/vid1.jpg",
      video_url: "https://video.bunnycdn.com/play/vid1.mp4",
    },
  ];

  const sonuc = oneriListesiThumbnailZenginlestir(oneriListesi, yayinDetaylari);

  assert.equal(sonuc[0].thumbnail_url, "https://video.bunnycdn.com/thumbs/vid1.jpg");
  assert.equal(sonuc[0].video_url, "https://video.bunnycdn.com/play/vid1.mp4");
});

test("Öneri API genel kolu: Ham Storage yolları ve kapak metadata'sı API cevabında bulunmaz", () => {
  const oneriListesi = [
    {
      oneri_id: "o-s-1",
      yayin_id: "y-s-1",
      urun_adi: "Test Yayını",
      arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
      arac_dosya_yolu: "ogrenme-araclari/podcast/ses.mp3",
      dosya_yolu: "ogrenme-araclari/podcast/ses.mp3",
      kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
      transkript_yolu: "ogrenme-araclari/podcast/t.txt",
      arac_transkript_yolu: "ogrenme-araclari/podcast/t.txt",
      arac_metadata: { kapak_dogrulandi: true },
      metadata: { kapak_dogrulandi: true },
    },
  ];

  const yayinDetaylari = [
    {
      yayin_id: "y-s-1",
      arac_id: "arac-s-1",
      arac_turu: "podcast",
      arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
      arac_dosya_yolu: "ogrenme-araclari/podcast/ses.mp3",
      arac_metadata: { kapak_dogrulandi: true },
    },
  ];

  const sonuc = oneriListesiThumbnailZenginlestir(oneriListesi, yayinDetaylari);

  assert.equal("arac_kapak_yolu" in sonuc[0], false);
  assert.equal("arac_dosya_yolu" in sonuc[0], false);
  assert.equal("dosya_yolu" in sonuc[0], false);
  assert.equal("kapak_yolu" in sonuc[0], false);
  assert.equal("transkript_yolu" in sonuc[0], false);
  assert.equal("arac_transkript_yolu" in sonuc[0], false);
  assert.equal("arac_metadata" in sonuc[0], false);
  assert.equal("metadata" in sonuc[0], false);
});

test("Öneri API genel kolu: arac_id ve arac_turu alanları cevapta bulunur", () => {
  const oneriListesi = [
    { oneri_id: "o-1", yayin_id: "y-1", urun_adi: "Ürün 1" },
    { oneri_id: "o-2", yayin_id: "y-2", urun_adi: "Ürün 2" },
    { oneri_id: "o-3", yayin_id: "y-3", urun_adi: "Ürün 3" },
    { oneri_id: "o-4", yayin_id: "y-4", urun_adi: "Ürün 4" },
  ];

  const yayinDetaylari = [
    { yayin_id: "y-1", arac_id: "arac-v-1", arac_turu: "video" },
    { yayin_id: "y-2", arac_id: "arac-p-1", arac_turu: "podcast" },
    { yayin_id: "y-3", arac_id: "arac-db-1", arac_turu: "gorsel" },
    { yayin_id: "y-4", arac_id: "arac-pdf-1", arac_turu: "flip_pdf" },
  ];

  const sonuc = oneriListesiThumbnailZenginlestir(oneriListesi, yayinDetaylari);

  assert.equal(sonuc[0].arac_id, "arac-v-1");
  assert.equal(sonuc[0].arac_turu, "video");

  assert.equal(sonuc[1].arac_id, "arac-p-1");
  assert.equal(sonuc[1].arac_turu, "podcast");

  assert.equal(sonuc[2].arac_id, "arac-db-1");
  assert.equal(sonuc[2].arac_turu, "gorsel");

  assert.equal(sonuc[3].arac_id, "arac-pdf-1");
  assert.equal(sonuc[3].arac_turu, "flip_pdf");
});
