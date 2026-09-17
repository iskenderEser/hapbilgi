import assert from "node:assert/strict";
import test from "node:test";

process.env.BUNNY_LEARNING_STORAGE_ZONE = "test-storage";
process.env.BUNNY_LEARNING_STORAGE_ACCESS_KEY = "test-key";
process.env.BUNNY_LEARNING_PULL_ZONE = "cdn.test.com";
process.env.BUNNY_LEARNING_TOKEN_KEY = "test-token-key";
process.env.BUNNY_LEARNING_UPLOAD_ENDPOINT = "https://upload.bunny.net";
process.env.BUNNY_LEARNING_UPLOAD_SHARED_SECRET = "test-shared-secret";
process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE = "video-cdn.test.com";

import { yayinThumbnailIstemciCoz } from "../lib/ogrenmeAraci/thumbnailIstemci.ts";
import {
  oneriListesiThumbnailZenginlestir,
  yayinThumbnailCevabi,
} from "../lib/ogrenmeAraci/yayinThumbnail.ts";
import {
  aracHedefMatrisi,
  TUKETIM_ARACLARI,
  yayinFixture,
} from "./helpers/tuketimSenaryosu.ts";

const SIMDI_MS = Date.parse("2026-09-17T08:00:00.000Z");
const HAM_ALANLAR = [
  "arac_kapak_yolu",
  "arac_dosya_yolu",
  "dosya_yolu",
  "kapak_yolu",
  "transkript_yolu",
  "arac_transkript_yolu",
  "arac_metadata",
  "metadata",
] as const;

function imzaliCdnUrlMi(deger: unknown): deger is string {
  return typeof deger === "string"
    && deger.startsWith("https://cdn.test.com/")
    && deger.includes("token=")
    && deger.includes("expires=");
}

test("20 araç-hedef liste kaydı kimliğini korur ve ham depolama yolunu istemciye sızdırmaz", () => {
  for (const yayin of aracHedefMatrisi()) {
    const cevap = yayinThumbnailCevabi(yayin, SIMDI_MS) as Record<string, unknown>;

    assert.equal(cevap.yayin_id, yayin.yayin_id, `${yayin.arac_turu} × ${yayin.hedef_roller[0]} yayın kimliği`);
    assert.equal(cevap.arac_id, yayin.arac_id, `${yayin.arac_turu} × ${yayin.hedef_roller[0]} araç kimliği`);
    assert.equal(cevap.arac_turu, yayin.arac_turu, `${yayin.arac_turu} × ${yayin.hedef_roller[0]} araç türü`);
    assert.equal(cevap.urun_adi, yayin.urun_adi);
    assert.deepEqual(cevap.hedef_roller, yayin.hedef_roller);

    for (const alan of HAM_ALANLAR) {
      assert.equal(alan in cevap, false, `${yayin.arac_turu} × ${yayin.hedef_roller[0]} ${alan} sızdırdı`);
    }

    if (yayin.arac_turu === "video") {
      assert.equal(cevap.thumbnail_url, yayin.thumbnail_url);
      assert.equal(String(cevap.thumbnail_url).includes("token="), false);
    } else {
      assert.ok(imzaliCdnUrlMi(cevap.thumbnail_url), `${yayin.arac_turu} × ${yayin.hedef_roller[0]} imzalı thumbnail üretmedi`);
      const beklenenDosya = yayin.arac_turu === "gorsel"
        ? yayin.arac_dosya_yolu
        : yayin.arac_kapak_yolu;
      assert.ok(String(cevap.thumbnail_url).includes(String(beklenenDosya)));
    }
  }
});

test("öneri/liste zenginleştirmesi eski thumbnail ve araç bilgisini merkezi yayın detayıyla değiştirir", () => {
  const yayinlar = aracHedefMatrisi();
  const liste = yayinlar.map((yayin) => ({
    yayin_id: yayin.yayin_id,
    baslik: `Liste ${yayin.urun_adi}`,
    arac_id: "eski-arac",
    arac_turu: "video",
    thumbnail_url: "https://eski.test/guvensiz.jpg",
    arac_dosya_yolu: "istemciye/sizmamali.dat",
    metadata: { gizli: true },
  }));

  const cevap = oneriListesiThumbnailZenginlestir(liste, yayinlar, SIMDI_MS);
  assert.equal(cevap.length, 20);

  for (const [indeks, kayit] of cevap.entries()) {
    const yayin = yayinlar[indeks];
    assert.equal(kayit.arac_id, yayin.arac_id);
    assert.equal(kayit.arac_turu, yayin.arac_turu);
    assert.equal("arac_dosya_yolu" in kayit, false);
    assert.equal("metadata" in kayit, false);
    assert.notEqual(kayit.thumbnail_url, "https://eski.test/guvensiz.jpg");
    assert.equal(yayinThumbnailIstemciCoz(kayit), kayit.thumbnail_url);
  }
});

test("kapaksız veya doğrulanmamış araçlar güvenli biçimde tür bazlı varsayılan kapağa düşer", () => {
  const ornekler = [
    { ...yayinFixture("podcast", "utt"), arac_metadata: {}, arac_kapak_yolu: "podcast/onaysiz.webp" },
    { ...yayinFixture("flip_pdf", "bm"), arac_metadata: { kapak_dogrulandi: false }, arac_kapak_yolu: "literatur/onaysiz.webp" },
    { ...yayinFixture("gorsel", "eczaci"), arac_dosya_yolu: "", arac_kapak_yolu: null },
  ];

  for (const yayin of ornekler) {
    const cevap = yayinThumbnailCevabi(yayin, SIMDI_MS);
    assert.equal(cevap.thumbnail_url, null, yayin.arac_turu);
    assert.equal(yayinThumbnailIstemciCoz(cevap), null, `${yayin.arac_turu} eski genel fallback'e dönmemeli`);
  }
});

test("istemci yalnız video için mevcut video fallback davranışını sürdürür", () => {
  const video = yayinThumbnailIstemciCoz({
    arac_turu: "video",
    thumbnail_url: null,
    video_url: "https://iframe.mediadelivery.net/embed/123/abc",
  });
  assert.ok(typeof video === "string");

  for (const arac_turu of TUKETIM_ARACLARI.filter((tur) => tur !== "video")) {
    assert.equal(
      yayinThumbnailIstemciCoz({ arac_turu, thumbnail_url: null, video_url: "https://video.test/legacy" }),
      null,
      arac_turu,
    );
  }
});
