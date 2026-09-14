import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aracYuklemeAyarlari } from "../app/(panel)/talepler/_components/VideoYukleme.tsx";
import { dosyaTipiRenk, PODCAST_FORMATLAR, GORSEL_FORMATLAR, FLIP_PDF_FORMATLAR, VIDEO_FORMATLAR } from "../app/(panel)/talepler/_types.ts";

test("aracYuklemeAyarlari öğrenme aracı türüne göre buton, format ve metinleri dinamik döner", () => {
  const podcast = aracYuklemeAyarlari("podcast");
  assert.equal(podcast.butonMetni, "Podcast Ekle");
  assert.equal(podcast.accept, PODCAST_FORMATLAR);
  assert.match(podcast.aciklama, /mp3/);
  assert.equal(podcast.yukleniyorMetni, "Podcast yükleniyor...");

  const gorsel = aracYuklemeAyarlari("gorsel");
  assert.equal(gorsel.butonMetni, "Görsel / Broşür Ekle");
  assert.equal(gorsel.accept, GORSEL_FORMATLAR);
  assert.match(gorsel.aciklama, /png/);
  assert.equal(gorsel.yukleniyorMetni, "Görsel yükleniyor...");

  const flipPdf = aracYuklemeAyarlari("flip_pdf");
  assert.equal(flipPdf.butonMetni, "Literatür Ekle");
  assert.equal(flipPdf.accept, FLIP_PDF_FORMATLAR);
  assert.match(flipPdf.aciklama, /pdf/);
  assert.equal(flipPdf.yukleniyorMetni, "Literatür yükleniyor...");

  const video = aracYuklemeAyarlari("video");
  assert.equal(video.butonMetni, "Video Ekle");
  assert.equal(video.accept, VIDEO_FORMATLAR);
  assert.match(video.aciklama, /mp4/);
  assert.equal(video.yukleniyorMetni, "Video yükleniyor...");

  const varsayilan = aracYuklemeAyarlari(null);
  assert.equal(varsayilan.butonMetni, "Video Ekle");
});

test("dosyaTipiRenk yeni öğrenme araçlarının uzantılarını (audio, webp) destekler", () => {
  assert.equal(dosyaTipiRenk("kayit.mp3").etiket, "POD");
  assert.equal(dosyaTipiRenk("ses.m4a").etiket, "POD");
  assert.equal(dosyaTipiRenk("audio.aac").etiket, "POD");
  assert.equal(dosyaTipiRenk("brosur.webp").etiket, "IMG");
  assert.equal(dosyaTipiRenk("dokuman.pdf").etiket, "PDF");
  assert.equal(dosyaTipiRenk("egitim.mp4").etiket, "VID");
});

test("HazirVideoYukleme bileşeni VideoYukleme'ye ogrenmeAraciTuru propunu iletir", () => {
  const hazir = readFileSync("app/(panel)/talepler/_components/HazirVideoYukleme.tsx", "utf8");
  assert.match(hazir, /ogrenmeAraciTuru=\{ogrenmeAraciTuru\}/);
});

test("AdimIcerigi bileşeni HazirVideoYukleme'ye talep.ogrenme_araci_turu propunu iletir", () => {
  const adim = readFileSync("app/(panel)/talepler/_components/AdimIcerigi.tsx", "utf8");
  assert.match(adim, /<HazirVideoYukleme[^>]*ogrenmeAraciTuru=\{talep\.ogrenme_araci_turu\}/);
});
