import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toastVaryant } from "../lib/uretim/toastMesaj.ts";
import { podcastDestekDosyasiDogrula } from "../lib/ogrenmeAraci/sozlesme.ts";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const form = oku("app/(panel)/talepler/_components/YeniTalepFormV2.tsx");
const hook = oku("app/(panel)/talepler/_hooks/useTalepFormu.ts");
const route = oku("app/(panel)/talepler/api/route.ts");
const destekBaslat = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-baslat/route.ts");
const destekTamamla = oku("app/api/ogrenme-araclari/[arac_id]/destek-yukleme-tamamla/route.ts");
const faz2Migration = oku("scripts/sql/ogrenme_araclari_faz2_ortak_omurga.sql");

test("talep formu Video ve Podcast arasında tek öğrenme aracı seçer", () => {
  assert.match(form, /\["video", "podcast", "gorsel", "flip_pdf"\]/);
  assert.match(hook, /setOgrenmeAraciTuru\(tur\)/);
});

test("öğrenme aracı türü talep sonrasında veritabanında değiştirilemez", () => {
  assert.match(faz2Migration, /BEFORE UPDATE OF ogrenme_araci_turu/);
  assert.match(faz2Migration, /IF NEW\.ogrenme_araci_turu IS DISTINCT FROM OLD\.ogrenme_araci_turu/);
});

test("hazır podcast dosyaları referans dosyalarından ayrı state ve alanlarda tutulur", () => {
  assert.match(hook, /bekleyenPodcastKapak/);
  assert.match(hook, /bekleyenPodcastTranskript/);
  assert.match(form, /PodcastTalepAlanlari/);
  assert.match(form, /EkDosyaYukleme/);
});

test("podcast ses, kapak, anlatım türü ve transkript alanlarını zorunlu kılar", () => {
  assert.match(hook, /"monolog" \| "diyalog"/);
  assert.match(hook, /Hazır podcast talebi için ses, kapak ve transkript dosyaları zorunludur/);
  assert.equal(podcastDestekDosyasiDogrula({ rol: "kapak", dosyaAdi: "kapak.png", mimeType: "image/png", dosyaBoyutu: 100 }).ok, true);
  assert.equal(podcastDestekDosyasiDogrula({ rol: "transkript", dosyaAdi: "metin.txt", mimeType: "text/plain", dosyaBoyutu: 100 }).ok, true);
});

test("Podcast V1 tam üretim varyantını korur", () => assert.equal(toastVaryant(false, false), "normal"));
test("Podcast V2 hazır araç varyantını korur", () => assert.equal(toastVaryant(true, false), "hazir_video"));
test("Podcast V3 hazır soru seti varyantını korur", () => assert.equal(toastVaryant(false, true), "hazir_set"));
test("Podcast V4 iki hazır içerik varyantını korur", () => assert.equal(toastVaryant(true, true), "hazir_ikisi"));

test("sunucu rol, araç, varyant, sahiplik ve dosya yetkisini yeniden doğrular", () => {
  assert.match(route, /ureticiYetenegi\(rol\)/);
  assert.match(route, /ogrenmeAraciTuruMu\(ogrenme_araci_turu\)/);
  assert.match(route, /typeof hazir_video !== "boolean"/);
  assert.match(destekBaslat, /uretimAraciYetkisiniDogrula/);
  assert.match(destekTamamla, /yuklemeYetkisiDogrula/);
});
