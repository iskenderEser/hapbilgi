import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE = "video.test.b-cdn.net";

import { yayinThumbnailIstemciCoz } from "@/lib/ogrenmeAraci/thumbnailIstemci";

const oku = (yol: string) => readFileSync(yol, "utf8");

test("istemci thumbnail çözümleyicisi sunucu URL'sini öncelikli kullanır", () => {
  assert.equal(yayinThumbnailIstemciCoz({
    arac_turu: "flip_pdf",
    thumbnail_url: "https://cdn.test/literatur.jpg",
    video_url: "https://iframe.mediadelivery.net/embed/1/yanlis-video",
  }), "https://cdn.test/literatur.jpg");
});

test("istemci thumbnail çözümleyicisi eski türetmeyi yalnız video için uygular", () => {
  const videoUrl = "https://iframe.mediadelivery.net/embed/1/video-123";
  assert.equal(
    yayinThumbnailIstemciCoz({ arac_turu: "video", video_url: videoUrl }),
    "https://video.test.b-cdn.net/video-123/thumbnail.jpg",
  );
  for (const arac_turu of ["podcast", "gorsel", "flip_pdf"] as const) {
    assert.equal(yayinThumbnailIstemciCoz({ arac_turu, video_url: videoUrl }), null);
  }
});

test("Faz 2 dağıtım ve öneri yüzeyleri ortak çözümleyici ile tür bazlı kapağı kullanır", () => {
  const ortakDagitimOzeti = oku("components/ogrenme-araci/DagitimIcerikOzeti.tsx");
  assert.match(ortakDagitimOzeti, /yayinThumbnailIstemciCoz\(icerik\)/);
  assert.match(ortakDagitimOzeti, /<AracVarsayilanKapak/);

  for (const dosya of [
    "app/(panel)/eczanem/utt/_components/UttVideoGonderimSatiri.tsx",
    "app/(panel)/eclub/videolarim/_components/VideoGonderimSatiri.tsx",
    "components/challenge-club/ChallengeGonderPaneli.tsx",
  ]) {
    assert.match(oku(dosya), /<DagitimIcerikOzeti/, `${dosya} ortak dağıtım özetini kullanmalı`);
  }

  const dosyalar = [
    "app/(panel)/eczanem/eczane/_components/EczanemVideoGonderimSatiri.tsx",
    "app/(panel)/oneriler/_components/BmOneriTakibi.tsx",
    "app/(panel)/oneriler/_components/TmOneriTakibi.tsx",
    "components/ana-sayfa/SahaVideoRaflari.tsx",
    "components/ana-sayfa/VideoBolumu.tsx",
    "app/eczanem/_components/EczanemVideoRafi.tsx",
    "app/(panel)/oneriler/page.tsx",
    "components/video/UttVideoKarti.tsx",
    "app/(panel)/yayindaki-videolar/_components/BmOneriPaneli.tsx",
    "app/(panel)/yayin-yonetimi/_components/Yardimcilar.tsx",
    "app/(panel)/yayin-yonetimi/_components/YayinSatir.tsx",
    "app/(panel)/yayindaki-videolar/_components/YayindakiVideoBolumu.tsx",
    "app/(panel)/eclub/panel/_components/EclubFirmaVideoKatalogu.tsx",
  ];

  const ortakYayinKarti = oku("components/yayin/YayinKarti.tsx");
  assert.match(ortakYayinKarti, /yayinThumbnailIstemciCoz\(/);
  assert.match(ortakYayinKarti, /<AracVarsayilanKapak/);

  for (const dosya of dosyalar) {
    const kaynak = oku(dosya);
    const yayinKartiKullaniyor = /<YayinKarti|YayinKarti\(/.test(kaynak);
    if (yayinKartiKullaniyor) {
      assert.ok(true);
    } else {
      assert.match(kaynak, /yayinThumbnailIstemciCoz\(/, `${dosya} ortak çözümleyiciyi kullanmalı`);
      assert.match(kaynak, /<AracVarsayilanKapak/, `${dosya} tür bazlı varsayılan kapak kullanmalı`);
    }
  }
});

test("BM ve TM mobil/masaüstü kartları fallback ve video oynatma kapısını birlikte uygular", () => {
  for (const dosya of [
    "app/(panel)/oneriler/_components/BmOneriTakibi.tsx",
    "app/(panel)/oneriler/_components/TmOneriTakibi.tsx",
  ]) {
    const kaynak = oku(dosya);
    assert.equal((kaynak.match(/<AracVarsayilanKapak/g) ?? []).length, 2);
    assert.equal((kaynak.match(/const videoOynatilabilir/g) ?? []).length, 2);
  }
});

test("Yayın yönetimi liste ve kart görünümleri resim hatasında (404) onError ile fallback kapağa geçer", () => {
  const yardimcilar = oku("app/(panel)/yayin-yonetimi/_components/Yardimcilar.tsx");
  const yayinSatir = oku("app/(panel)/yayin-yonetimi/_components/YayinSatir.tsx");

  assert.match(yardimcilar, /onError=\{/);
  assert.match(yardimcilar, /<AracVarsayilanKapak/);

  assert.match(yayinSatir, /onError=\{/);
  assert.match(yayinSatir, /<AracVarsayilanKapak/);
});

