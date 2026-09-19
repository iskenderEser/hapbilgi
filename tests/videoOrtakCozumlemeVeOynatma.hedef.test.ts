import test from "node:test";
import assert from "node:assert/strict";

process.env.BUNNY_LIBRARY_ID = "707975";
process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID = "707975";

import {
  yayinVideoUrlCoz,
  bunnyEmbedUrlUret,
  yayinThumbnailCevabi,
} from "@/lib/ogrenmeAraci/yayinThumbnail";
import { detectProvider, bunnyEmbedUrl } from "@/lib/video/videoPlayer";

test("bunnyEmbedUrlUret: 36 karakterlik Bunny GUID'ini embed URL'sine dönüştürür", () => {
  const guid = "a5b3e8fd-f447-4d03-b2e3-c5ea95abfc8a";
  const sonuc = bunnyEmbedUrlUret(guid);
  assert.equal(sonuc, "https://player.mediadelivery.net/embed/707975/a5b3e8fd-f447-4d03-b2e3-c5ea95abfc8a");
});

test("bunnyEmbedUrlUret: mevcut embed URL'sini korur, /play/ formatını /embed/'e dönüştürür", () => {
  const embed = "https://player.mediadelivery.net/embed/707975/a5b3e8fd-f447-4d03-b2e3-c5ea95abfc8a";
  assert.equal(bunnyEmbedUrlUret(embed), embed);

  const play = "https://player.mediadelivery.net/play/707975/a5b3e8fd-f447-4d03-b2e3-c5ea95abfc8a";
  assert.equal(bunnyEmbedUrlUret(play), embed);
});

test("yayinVideoUrlCoz: video yayınlarında ham GUID'i çözümler", () => {
  const guid = "e8ac67b5-ca31-4874-ae1c-439cc71a4665";
  const videoYayin = {
    yayin_id: "y-1",
    arac_turu: "video",
    video_url: guid,
  };
  assert.equal(yayinVideoUrlCoz(videoYayin), `https://player.mediadelivery.net/embed/707975/${guid}`);
});

test("yayinVideoUrlCoz: dosya_yolu ve metadata fallback zincirini doğru işletir", () => {
  const guid = "e8ac67b5-ca31-4874-ae1c-439cc71a4665";
  const yayinDosyaYolu = {
    yayin_id: "y-2",
    arac_turu: "video",
    video_url: null,
    arac_dosya_yolu: guid,
  };
  assert.equal(yayinVideoUrlCoz(yayinDosyaYolu), `https://player.mediadelivery.net/embed/707975/${guid}`);

  const yayinMetadata = {
    yayin_id: "y-3",
    arac_turu: "video",
    video_url: null,
    arac_metadata: {
      legacy_video_url: `https://player.mediadelivery.net/embed/707975/${guid}`,
    },
  };
  assert.equal(yayinVideoUrlCoz(yayinMetadata), `https://player.mediadelivery.net/embed/707975/${guid}`);
});

test("yayinVideoUrlCoz: video dışındaki araç türlerinde null döner", () => {
  assert.equal(yayinVideoUrlCoz({ arac_turu: "podcast", video_url: "guid" }), null);
  assert.equal(yayinVideoUrlCoz({ arac_turu: "gorsel", video_url: "guid" }), null);
  assert.equal(yayinVideoUrlCoz({ arac_turu: "flip_pdf", video_url: "guid" }), null);
});

test("yayinThumbnailCevabi: video yayınında video_url'i otomatik çözümler", () => {
  const guid = "e8ac67b5-ca31-4874-ae1c-439cc71a4665";
  const sonuc = yayinThumbnailCevabi({
    yayin_id: "y-4",
    arac_id: "a-4",
    arac_turu: "video",
    video_url: guid,
    thumbnail_url: "https://bunny.net/thumb.jpg",
  });
  assert.equal(sonuc.video_url, `https://player.mediadelivery.net/embed/707975/${guid}`);
  assert.equal(sonuc.thumbnail_url, "https://bunny.net/thumb.jpg");
});

test("videoPlayer: istemci katmanında detectProvider ve bunnyEmbedUrl ham GUID desteği", () => {
  const guid = "a5b3e8fd-f447-4d03-b2e3-c5ea95abfc8a";
  assert.equal(detectProvider(guid), "bunny");
  assert.equal(bunnyEmbedUrl(guid), `https://player.mediadelivery.net/embed/707975/${guid}`);
});
