// UTT Eczanem yönetim yüzeyi ve atomik gönderim sözleşmesi.
// Tavan: 1 mutlu yol + 1 red senaryosu.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pagePath = "app/(panel)/eczanem/yayinlar/page.tsx";
const page = readFileSync(pagePath, "utf8");
const yayinKarti = readFileSync("app/(panel)/eczanem/yayinlar/_components/EczanemYayinGonderimKarti.tsx", "utf8");
const videoOnizleme = readFileSync("components/video/VideoOnizleme.tsx", "utf8");
const ortakOnizleme = readFileSync("components/ogrenme-araci/OgrenmeAraciOnizleme.tsx", "utf8");
const videoCercevesi = readFileSync("components/video/VideoCercevesi.tsx", "utf8");
const videoEtkilesimKatmani = readFileSync("components/video/useVideoEtkilesimKatmani.ts", "utf8");
const nav = readFileSync("components/panel/panelNav.config.ts", "utf8");
const route = readFileSync("app/eczanem/yayinlar/api/route.ts", "utf8");
const gonderim = readFileSync("lib/eczanem/gonderim.ts", "utf8");
const sql = readFileSync("scripts/sql/eczanem_utt_gonderim_atomik.sql", "utf8");

test("mutlu: UTT yüzeyi panel kabuğunda, shadcn deseninde ve atomik gönderimle çalışır", () => {
  assert.equal(existsSync("app/(panel)/eczanem/utt/page.tsx"), false);
  assert.equal(existsSync("app/eczanem/utt/api/route.ts"), false);
  assert.match(page, /components\/ui\/(?:card|table|badge|button)/);
  assert.match(page, /seciliYayinIdleri/);
  assert.match(page, /seciliEczaneIdleri/);
  assert.match(page, /ortakUygunEczaneler/);
  assert.match(page, /<EczanemYayinGonderimKarti/);
  assert.match(page, /etiket="Gönderilebilen Eczane Sayısı" deger=\{hazirEczaneler\.length\}/);
  assert.match(page, /Eclub takımınızda olan toplam eczane sayısı/);
  assert.match(page, /etiket="Gönderilen Toplam Yayın" deger=\{veri\?\.aylikIstatistikler\.uttGonderimSayisi/);
  assert.match(page, /etiket="Eczanelerin Gönderdiği Toplam Yayın" deger=\{veri\?\.aylikIstatistikler\.eczaneGonderimSayisi/);
  assert.match(page, /api\?sayac=1/);
  assert.match(page, /uttGonderimSayisi: onceki\.aylikIstatistikler\.uttGonderimSayisi \+ 1/);
  assert.match(page, /Eczaneleri seçin/);
  assert.match(page, /topluGonderiliyor \? "Gönderiliyor…" : "Gönder"/);
  assert.match(yayinKarti, /Göndermek için seçin/);
  assert.equal(existsSync("app/(panel)/eczanem/yayinlar/_components/UttEczanemGonderimSatiri.tsx"), false);
  assert.doesNotMatch(page, /AlertDialog/);
  assert.match(page, /<OgrenmeAraciOnizleme/);
  assert.match(page, /onBitti=\{\(\) => setAktifVideo\(null\)\}/);
  assert.match(page, /<PeriyotButonlari<GonderimFiltresi>/);
  assert.match(page, /<UttYayinTuruToggle/);
  assert.match(yayinKarti, /<YayinKarti/);
  assert.match(page, /<MobilYayinAkisi/);
  assert.match(page, /grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5/);
  assert.match(page, /sifirlamaAnahtari=\{`\$\{gonderimFiltresi\}-\$\{aktifYayinTuru\}`\}/);
  assert.match(page, /<UttGonderimIncelemesi/);
  assert.match(page, /kanal="eczanem"/);
  assert.match(page, /gonderilebilirYayinlar\.filter\(\(yayin\) => yayin\.gonderim_incelemesi_tamamlandi\)/);
  assert.match(yayinKarti, /Göndermek için yayını tamamlayın/);
  assert.match(route, /uttGonderimIncelemesiTamamlandi\(adminSupabase, user\.id, yayinId\)/);
  assert.match(ortakOnizleme, /bitisGecikmesiMs=\{1500\}/);
  assert.match(yayinKarti, /onClick=\{onOnizle\}/);
  assert.match(yayinKarti, /gonderim\.created_at/);
  assert.match(videoCercevesi, /etkilesimKatmani\?\.yalnizPlayButonu/);
  assert.match(videoCercevesi, /<Play/);
  assert.match(videoEtkilesimKatmani, /ilkOynatmaZorunlu && !oynatmaIstendiRef\.current/);
  assert.match(videoEtkilesimKatmani, /player\.pause\(\)/);
  assert.match(videoOnizleme, /player\.onEnded\(tamamla\)/);
  assert.match(videoOnizleme, /seconds >= duration - 0\.5/);
  assert.match(videoOnizleme, /Video tamamlandı/);
  assert.doesNotMatch(videoOnizleme, /fetch\(|\/izle\/api\//);
  assert.match(nav, /Eczanem Yayınları[\s\S]*?\/eczanem\/yayinlar/);
  assert.match(route, /uttEczanemVerisi\(adminSupabase, user\.id, firmaId, erisim\.takimId/);
  assert.match(gonderim, /rpc\("eczanem_utt_eczaneye_gonder"/);
  assert.match(gonderim, /yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, yayin_tarihi, arac_id, arac_turu/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /ON CONFLICT \(yayin_id, eczane_id\) DO NOTHING/);
});

test("red: başka firma\/takım yayını, pasif sahiplik ve düşük üye sayısı gönderimi geçemez", () => {
  assert.match(gonderim, /\.eq\("firma_id", firmaId\)/);
  assert.match(gonderim, /takim_id\.is\.null,takim_id\.eq/);
  assert.match(sql, /v_yayin_firma_id IS DISTINCT FROM v_firma_id/);
  assert.match(sql, /v_yayin_takim_id IS NOT NULL AND v_yayin_takim_id IS DISTINCT FROM v_takim_id/);
  assert.match(sql, /ef\.aktif_mi = true/);
  assert.match(sql, /IF v_aktif_uye < v_esik/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
});
