import test from "node:test";
import assert from "node:assert/strict";

process.env.BUNNY_LEARNING_STORAGE_ZONE = "test-storage";
process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY = "test-key";
process.env.BUNNY_LEARNING_PULL_ZONE = "cdn.test.com";
process.env.BUNNY_LEARNING_TOKEN_KEY = "test-token-key";
process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT = "https://upload.bunny.net";
process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET = "test-shared-secret";

import { yayinThumbnailUrlCoz, yayinlariThumbnailIleZenginlestir } from "@/lib/ogrenmeAraci/yayinThumbnail";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";

test("yayinThumbnailUrlCoz video için mevcut thumbnail_url'i korur", () => {
  const sonuc = yayinThumbnailUrlCoz({
    arac_turu: "video",
    thumbnail_url: "https://bunny.net/thumb.jpg",
  });
  assert.equal(sonuc, "https://bunny.net/thumb.jpg");
});

test("yayinThumbnailUrlCoz podcast/flip_pdf/gorsel için kapak_yolu varsa imzalı cdn url üretir", () => {
  const sonuc = yayinThumbnailUrlCoz({
    arac_turu: "podcast",
    arac_kapak_yolu: "ogrenme-araclari/podcast/kapak.png",
  });
  assert.ok(typeof sonuc === "string");
  assert.ok(sonuc.includes("kapak.png"));
  assert.ok(sonuc.includes("token="));
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
    { yayin_id: "3", arac_turu: "podcast", arac_kapak_yolu: "pod.png" },
  ];
  const zenginlestirilmis = yayinlariThumbnailIleZenginlestir(yayinlar);
  assert.equal(zenginlestirilmis[0].thumbnail_url, "https://img.com/v.jpg");
  assert.ok(zenginlestirilmis[1].thumbnail_url?.includes("brosur.jpg"));
  assert.ok(zenginlestirilmis[2].thumbnail_url?.includes("pod.png"));
});

test("AracVarsayilanKapak 4 öğrenme aracı türü için de JSX elemanı döner", () => {
  const turler = ["video", "podcast", "gorsel", "flip_pdf"] as const;
  for (const tur of turler) {
    const el = AracVarsayilanKapak({ aracTuru: tur, urunAdi: "Test Ürünü" });
    assert.ok(el !== null);
    assert.equal(typeof el, "object");
  }
});
