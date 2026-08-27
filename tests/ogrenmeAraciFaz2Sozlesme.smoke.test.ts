import test from "node:test";
import assert from "node:assert/strict";

import {
  ARAC_DOSYA_POLITIKASI,
  dosyaBeyaniDogrula,
  dosyaImzasiDogrula,
  metadataDogrula,
  tamamlamaKanitiDogrula,
  yayinKapisiDogrula,
} from "@/lib/ogrenmeAraci/sozlesme";
import {
  FLIP_PDF_ARACI,
  GORSEL_ARACI,
  PODCAST_ARACI,
  VIDEO_ARACI,
} from "@/lib/ogrenmeAraci/sunucu";
import { OGRENME_ARACI_TURLERI, YENI_OGRENME_ARACI_TURLERI, type OgrenmeAraciKaydi } from "@/lib/ogrenmeAraci/tipler";

const arac = (aracTuru: OgrenmeAraciKaydi["aracTuru"], ek: Partial<OgrenmeAraciKaydi["metadata"]> = {}): OgrenmeAraciKaydi => ({
  aracId: "a1",
  talepId: "t1",
  aracTuru,
  kaynak: "iu",
  dosyaYolu: "f/t/podcast/a1.mp3",
  kapakYolu: null,
  metadataDogrulandi: true,
  metadata: {
    mimeType: "audio/mpeg",
    dosyaBoyutu: 100,
    checksumSha256: "a".repeat(64),
    sureSaniye: 100,
    sayfaSayisi: null,
    genislik: null,
    yukseklik: null,
    ek: {},
    ...ek,
  },
});

test("kanonik araç sözleşmesi video ile üç yeni aracı birbirinden ayırır", () => {
  assert.deepEqual(OGRENME_ARACI_TURLERI, ["video", "podcast", "gorsel", "flip_pdf"]);
  assert.deepEqual(YENI_OGRENME_ARACI_TURLERI, ["podcast", "gorsel", "flip_pdf"]);
  assert.deepEqual(
    [VIDEO_ARACI.aracTuru, PODCAST_ARACI.aracTuru, GORSEL_ARACI.aracTuru, FLIP_PDF_ARACI.aracTuru],
    OGRENME_ARACI_TURLERI,
  );
});

test("dosya beyanı uzantı, MIME ve boyutu birlikte doğrular", () => {
  assert.deepEqual(dosyaBeyaniDogrula({ aracTuru: "podcast", dosyaAdi: "bolum.MP3", mimeType: "audio/mpeg", dosyaBoyutu: 42 }), { ok: true, uzanti: "mp3" });
  assert.equal(dosyaBeyaniDogrula({ aracTuru: "podcast", dosyaAdi: "bolum.pdf", mimeType: "audio/mpeg", dosyaBoyutu: 42 }).ok, false);
  assert.equal(dosyaBeyaniDogrula({ aracTuru: "gorsel", dosyaAdi: "gorsel.png", mimeType: "text/plain", dosyaBoyutu: 42 }).ok, false);
  assert.equal(dosyaBeyaniDogrula({ aracTuru: "flip_pdf", dosyaAdi: "brosur.pdf", mimeType: "application/pdf", dosyaBoyutu: ARAC_DOSYA_POLITIKASI.flip_pdf.azamiBayt + 1 }).ok, false);
});

test("dosya imzası beyan edilen araçtan bağımsız gerçek türü sınar", () => {
  assert.equal(dosyaImzasiDogrula("flip_pdf", new TextEncoder().encode("%PDF-1.7")), true);
  assert.equal(dosyaImzasiDogrula("gorsel", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
  assert.equal(dosyaImzasiDogrula("gorsel", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(dosyaImzasiDogrula("podcast", new TextEncoder().encode("ID3demo")), true);
  assert.equal(dosyaImzasiDogrula("flip_pdf", new TextEncoder().encode("<html>")), false);
});

test("araca özel metadata yayın öncesinde zorunludur", () => {
  assert.equal(metadataDogrula("podcast", arac("podcast").metadata), true);
  assert.equal(metadataDogrula("podcast", arac("podcast", { sureSaniye: null }).metadata), false);
  assert.equal(metadataDogrula("flip_pdf", arac("flip_pdf", { mimeType: "application/pdf", sureSaniye: null, sayfaSayisi: 8 }).metadata), true);
  assert.equal(metadataDogrula("gorsel", arac("gorsel", { mimeType: "image/png", sureSaniye: null, genislik: 1200, yukseklik: 800 }).metadata), true);
});

test("tamamlama kanıtı araç türüyle eşleşmeden soru hakkı üretmez", () => {
  const tarih = new Date().toISOString();
  assert.equal(tamamlamaKanitiDogrula("podcast", { aracTuru: "podcast", surum: 1, olusturulmaTarihi: tarih, veri: { dogrulanmisSaniye: 95, sonaUlasti: true } }), true);
  assert.equal(tamamlamaKanitiDogrula("video", { aracTuru: "podcast", surum: 1, olusturulmaTarihi: tarih, veri: { dogrulanmisSaniye: 95, sonaUlasti: true } }), false);
  assert.equal(tamamlamaKanitiDogrula("gorsel", { aracTuru: "gorsel", surum: 1, olusturulmaTarihi: tarih, veri: { aktifIncelemeSaniye: 12, kullaniciOnayi: true } }), true);
  assert.equal(tamamlamaKanitiDogrula("flip_pdf", { aracTuru: "flip_pdf", surum: 1, olusturulmaTarihi: tarih, veri: { toplamSayfa: 3, okunanSayfalar: [1, 2] } }), false);
});

test("ortak yayın kapısı onay, metadata, soru ve puanı birlikte ister", () => {
  assert.deepEqual(yayinKapisiDogrula({ aracTuru: "podcast", aracDurumu: "onaylandi", metadataDogrulandi: true, soruSayisi: 2, puan: 10 }), { ok: true });
  assert.equal(yayinKapisiDogrula({ aracTuru: "podcast", aracDurumu: "inceleme bekleniyor", metadataDogrulandi: true, soruSayisi: 2, puan: 10 }).ok, false);
  assert.equal(yayinKapisiDogrula({ aracTuru: "podcast", aracDurumu: "onaylandi", metadataDogrulandi: false, soruSayisi: 2, puan: 10 }).ok, false);
  assert.equal(yayinKapisiDogrula({ aracTuru: "podcast", aracDurumu: "onaylandi", metadataDogrulandi: true, soruSayisi: 0, puan: 10 }).ok, false);
  assert.equal(yayinKapisiDogrula({ aracTuru: "podcast", aracDurumu: "onaylandi", metadataDogrulandi: true, soruSayisi: 2, puan: null }).ok, false);
});

test("ortak sunucu ilerlemeyi birleştirir ve kanıtı araç türüyle üretir", async () => {
  const podcast = arac("podcast");
  const ilerleme = await PODCAST_ARACI.ilerlemeKaydet(null, {
    dogrulanmisSaniye: 98,
    onayliAtlananSaniye: 0,
    sonKonumSaniye: 100,
    sonaUlasti: true,
  });
  assert.equal(await PODCAST_ARACI.tamamlanabilirMi(podcast, ilerleme), true);
  const kanit = await PODCAST_ARACI.tamamla(podcast, ilerleme);
  assert.equal(kanit.aracTuru, "podcast");
  assert.equal(await PODCAST_ARACI.soruHakkiKaniti(kanit), true);
  assert.equal(await VIDEO_ARACI.soruHakkiKaniti(kanit), false);
});

