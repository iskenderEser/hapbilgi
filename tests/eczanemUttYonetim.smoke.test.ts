// UTT Eczanem yönetim yüzeyi ve atomik gönderim sözleşmesi.
// Tavan: 1 mutlu yol + 1 red senaryosu.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const pagePath = "app/(panel)/eczanem/utt/page.tsx";
const page = readFileSync(pagePath, "utf8");
const videoSatiri = readFileSync("app/(panel)/eczanem/utt/_components/UttVideoGonderimSatiri.tsx", "utf8");
const videoOnizleme = readFileSync("components/video/VideoOnizleme.tsx", "utf8");
const videoCercevesi = readFileSync("components/video/VideoCercevesi.tsx", "utf8");
const videoEtkilesimKatmani = readFileSync("components/video/useVideoEtkilesimKatmani.ts", "utf8");
const dokum = readFileSync("app/(panel)/eczanem/utt/_components/UttEczanemDokum.tsx", "utf8");
const mutabakatPage = readFileSync("app/(panel)/eczanem/utt/mutabakat/page.tsx", "utf8");
const nav = readFileSync("components/panel/panelNav.config.ts", "utf8");
const route = readFileSync("app/eczanem/utt/api/route.ts", "utf8");
const gonderim = readFileSync("lib/eczanem/gonderim.ts", "utf8");
const sql = readFileSync("scripts/sql/eczanem_utt_gonderim_atomik.sql", "utf8");

test("mutlu: UTT yüzeyi panel kabuğunda, shadcn deseninde ve atomik gönderimle çalışır", () => {
  assert.equal(existsSync("app/eczanem/utt/page.tsx"), false);
  assert.match(page, /components\/ui\/(?:card|table|badge|button)/);
  assert.match(page, /AlertDialog/);
  assert.match(page, /<VideoOnizleme/);
  assert.match(page, /yalnizPlayButonu/);
  assert.match(page, /onBitti=\{\(\) => setAktifVideo\(null\)\}/);
  assert.match(page, /bitisGecikmesiMs=\{1500\}/);
  assert.doesNotMatch(page, /UttEczanemDokum/);
  assert.match(videoSatiri, /Collapsible/);
  assert.match(videoSatiri, /thumbnailUrlUret/);
  assert.match(videoSatiri, /onVideoAc\(yayin\)/);
  assert.match(videoSatiri, /videosunu sayfaya yerleştir/);
  assert.doesNotMatch(videoSatiri, /<Play/);
  assert.match(videoCercevesi, /etkilesimKatmani\?\.yalnizPlayButonu/);
  assert.match(videoCercevesi, /<Play/);
  assert.match(videoEtkilesimKatmani, /ilkOynatmaZorunlu && !oynatmaIstendiRef\.current/);
  assert.match(videoEtkilesimKatmani, /player\.pause\(\)/);
  assert.match(videoOnizleme, /player\.onEnded\(tamamla\)/);
  assert.match(videoOnizleme, /seconds >= duration - 0\.5/);
  assert.match(videoOnizleme, /Video tamamlandı/);
  assert.doesNotMatch(videoOnizleme, /fetch\(|\/izle\/api\//);
  assert.match(videoSatiri, /gonderim\.created_at/);
  assert.match(dokum, /AbortController/);
  assert.match(mutabakatPage, /<UttEczanemDokum hata=\{hata\}/);
  assert.match(nav, /Video Dağıtımı[\s\S]*?\/eczanem\/utt[\s\S]*?Mutabakat Dökümü[\s\S]*?\/eczanem\/utt\/mutabakat/);
  assert.match(route, /uttEczanemVerisi\(adminSupabase, user\.id, firmaId, erisim\.takimId/);
  assert.match(gonderim, /rpc\("eczanem_utt_eczaneye_gonder"/);
  assert.match(gonderim, /yayin_id, urun_adi, teknik_adi, video_url, thumbnail_url, yayin_tarihi/);
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
