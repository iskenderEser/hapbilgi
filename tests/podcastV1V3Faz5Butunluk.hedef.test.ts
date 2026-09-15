import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podcastAiSesHazirMi } from "../lib/ogrenmeAraci/sozlesme.ts";

test("AI yalnız dosyası, pozitif süresi ve teknik doğrulaması bulunan ses için başlar", () => {
  assert.equal(podcastAiSesHazirMi({ dosyaYolu: "podcast/ses.mp3", metadataDogrulandi: true, sureSaniye: 90 }), true);
  assert.equal(podcastAiSesHazirMi({ dosyaYolu: "podcast/ses.mp3", metadataDogrulandi: false, sureSaniye: 90 }), false);
  assert.equal(podcastAiSesHazirMi({ dosyaYolu: null, metadataDogrulandi: true, sureSaniye: 90 }), false);
  assert.equal(podcastAiSesHazirMi({ dosyaYolu: "podcast/ses.mp3", metadataDogrulandi: true, sureSaniye: 0 }), false);
});

test("AI route ortak ses kapısını ve görev sahipliği kapısını birlikte kullanır", () => {
  const route = readFileSync("app/api/ogrenme-araclari/[arac_id]/transkript-ai-baslat/route.ts", "utf8");
  assert.match(route, /podcastTranskriptYetkisiDogrula/);
  assert.match(route, /podcastAiSesHazirMi/);
  assert.match(route, /gorevId/);
});

test("Faz 5 SQL gerçek araç checksumunu transkripte bağlar ve doğrulanmamış sesi reddeder", () => {
  const sql = readFileSync("scripts/sql/ogrenme_araclari_faz5_podcast_v1_v3_ai_guvenlik.sql", "utf8");
  assert.match(sql, /v_arac\.metadata_dogrulandi IS NOT TRUE/);
  assert.match(sql, /COALESCE\(v_arac\.sure_saniye, 0\) <= 0/);
  assert.match(sql, /'bagli_ses_checksum', COALESCE\(v_arac\.checksum_sha256/);
  assert.match(sql, /p_gorev_id uuid/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.podcast_transkript_ai_baslat_atomik\(uuid,uuid,uuid,text,uuid\)/);
});

test("Faz 2-4 SQL zincirinin tamamı tekrar çalıştırılabilir transaction ve servis yetkisi taşır", () => {
  for (const yol of [
    "scripts/sql/ogrenme_araclari_faz3_podcast_v1_v3_iu_ai.sql",
    "scripts/sql/ogrenme_araclari_faz3_podcast_v1_v3_teslim.sql",
    "scripts/sql/ogrenme_araclari_faz3_podcast_v1_v3_revizyonda_transkript.sql",
    "scripts/sql/ogrenme_araclari_faz5_podcast_v1_v3_ai_guvenlik.sql",
  ]) {
    const sql = readFileSync(yol, "utf8");
    assert.match(sql, /BEGIN;/);
    assert.match(sql, /COMMIT;/);
    assert.match(sql, /TO service_role/);
  }
});
