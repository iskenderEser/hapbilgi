import test from "node:test";
import assert from "node:assert/strict";

process.env.BUNNY_LEARNING_STORAGE_ZONE = "test-storage";
process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY = "test-key";
process.env.BUNNY_LEARNING_PULL_ZONE = "cdn.test.com";
process.env.BUNNY_LEARNING_TOKEN_KEY = "test-token-key";
process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT = "https://upload.bunny.net";
process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET = "test-shared-secret";
process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE = "video.test.b-cdn.net";

import { yayinThumbnailUrlCoz, yayinlariThumbnailIleZenginlestir, yayinThumbnailCevabi } from "@/lib/ogrenmeAraci/yayinThumbnail";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";

test("yayinThumbnailUrlCoz video için mevcut thumbnail_url'i korur", () => {
  const sonuc = yayinThumbnailUrlCoz({
    arac_turu: "video",
    thumbnail_url: "https://bunny.net/thumb.jpg",
  });
  assert.equal(sonuc, "https://bunny.net/thumb.jpg");
});

test("yayinThumbnailUrlCoz ortak modeldeki video URL'sinden thumbnail üretir", () => {
  const videoId = "75d8a68b-5ff7-4c54-a84b-fdeed0ed09c8";
  const sonuc = yayinThumbnailUrlCoz({
    arac_turu: "video",
    thumbnail_url: null,
    arac_dosya_yolu: `https://iframe.mediadelivery.net/embed/12345/${videoId}`,
  });
  assert.equal(sonuc, `https://video.test.b-cdn.net/${videoId}/thumbnail.jpg`);
});

test("yayinThumbnailUrlCoz podcast/flip_pdf için kapak_yolu ancak kapak_dogrulandi ise imzalı cdn url üretir", () => {
  const onayli = yayinThumbnailUrlCoz({
    arac_turu: "podcast",
    arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
    kapak_dogrulandi: true,
  });
  assert.ok(typeof onayli === "string");
  assert.ok(onayli.includes("kapak.png"));
  assert.ok(onayli.includes("token="));

  const onaysiz = yayinThumbnailUrlCoz({
    arac_turu: "podcast",
    arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
  });
  assert.equal(onaysiz, null);
});

test("yayinThumbnailUrlCoz gorsel (dijital brosur) kapaksız ise dosyanın kendisini kapak olarak imzalar", () => {
  const sonuc = yayinThumbnailUrlCoz({
    arac_turu: "gorsel",
    arac_dosya_yolu: "ogrenme-araclari/brosurler/urun_katalogu.png",
  });
  assert.ok(typeof sonuc === "string");
  assert.ok(sonuc.includes("urun_katalogu.png"));
  assert.ok(sonuc.includes("token="));
});

test("yayinlariThumbnailIleZenginlestir dizi içindeki tüm öğrenme araçlarını dönüştürür", () => {
  const yayinlar = [
    { yayin_id: "1", arac_turu: "video", thumbnail_url: "https://img.com/v.jpg" },
    { yayin_id: "2", arac_turu: "gorsel", arac_dosya_yolu: "brosur.jpg" },
    { yayin_id: "3", arac_turu: "podcast", arac_kapak_yolu: "pod.png", kapak_dogrulandi: true },
  ];
  const zenginlestirilmis = yayinlariThumbnailIleZenginlestir(yayinlar);
  assert.equal(zenginlestirilmis[0].thumbnail_url, "https://img.com/v.jpg");
  assert.ok(zenginlestirilmis[1].thumbnail_url?.includes("brosur.jpg"));
  assert.ok(zenginlestirilmis[2].thumbnail_url?.includes("pod.png"));
});

test("yayinThumbnailCevabi ham depolama yollarını siler, arac_id ve arac_turu'nu korur", () => {
  const hamYayin = {
    yayin_id: "y-1",
    arac_id: "a-1",
    arac_turu: "gorsel",
    arac_kapak_yolu: "kapaklar/k.jpg",
    arac_dosya_yolu: "brosurler/b.jpg",
    dosya_yolu: "brosurler/b.jpg",
    kapak_yolu: "kapaklar/k.jpg",
    transkript_yolu: "t.pdf",
    arac_transkript_yolu: "t.pdf",
    arac_metadata: { kapak_dogrulandi: true },
    video_url: null,
  };
  const sonuc = yayinThumbnailCevabi(hamYayin);
  assert.equal(sonuc.yayin_id, "y-1");
  assert.equal(sonuc.arac_id, "a-1");
  assert.equal(sonuc.arac_turu, "gorsel");
  assert.ok(sonuc.thumbnail_url?.includes("brosurler/b.jpg"));
  assert.equal("arac_kapak_yolu" in sonuc, false);
  assert.equal("arac_dosya_yolu" in sonuc, false);
  assert.equal("dosya_yolu" in sonuc, false);
  assert.equal("kapak_yolu" in sonuc, false);
  assert.equal("transkript_yolu" in sonuc, false);
  assert.equal("arac_transkript_yolu" in sonuc, false);
  assert.equal("arac_metadata" in sonuc, false);
});

test("AracVarsayilanKapak 4 öğrenme aracı türü için de JSX elemanı döner", () => {
  const turler = ["video", "podcast", "gorsel", "flip_pdf"] as const;
  for (const tur of turler) {
    const el = AracVarsayilanKapak({ aracTuru: tur, urunAdi: "Test Ürünü" });
    assert.ok(el !== null);
    assert.equal(typeof el, "object");
  }
});
