import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podcastIuTeslimKapisiDogrula } from "../lib/ogrenmeAraci/sozlesme.ts";

const temel = {
  dosyaYolu: "podcastler/ses.mp3",
  sureSaniye: 120,
  kapakYolu: null,
  metadataDogrulandi: true,
  sesChecksum: "a".repeat(64),
};

test("İÜ teslimi: transkript istenmediyse doğrulanmış ses tek başına yeterlidir", () => {
  assert.deepEqual(podcastIuTeslimKapisiDogrula({ ...temel, transkriptIstendi: false, metadata: {} }), { ok: true });
});

test("İÜ teslimi: istenen transkript yalnız onaylı AI kaydıyla geçer", () => {
  const metadata = {
    transkript_metni_dogrulandi: true,
    transkript: {
      durum: "onaylandi", kaynak: "ai", onaylanan_metin: "Konuşmacı 1: Merhaba",
      bagli_ses_checksum: "a".repeat(64),
    },
  };
  assert.deepEqual(podcastIuTeslimKapisiDogrula({ ...temel, transkriptIstendi: true, metadata }), { ok: true });
  assert.equal(podcastIuTeslimKapisiDogrula({ ...temel, transkriptIstendi: true, metadata: { ...metadata, transkript: { ...metadata.transkript, kaynak: "manuel" } } }).ok, false);
  assert.equal(podcastIuTeslimKapisiDogrula({ ...temel, transkriptIstendi: true, metadata: { ...metadata, transkript: { ...metadata.transkript, durum: "ai_taslak" } } }).ok, false);
});

test("İÜ teslimi: yarım AI işi, doğrulanmamış kapak ve değişen ses engellenir", () => {
  assert.equal(podcastIuTeslimKapisiDogrula({ ...temel, transkriptIstendi: false, metadata: { transkript: { durum: "ai_isleniyor" } } }).ok, false);
  assert.equal(podcastIuTeslimKapisiDogrula({ ...temel, transkriptIstendi: false, kapakYolu: "kapak.webp", metadata: {} }).ok, false);
  assert.equal(podcastIuTeslimKapisiDogrula({ ...temel, transkriptIstendi: true, metadata: { transkript_metni_dogrulandi: true, transkript: { durum: "onaylandi", kaynak: "ai", onaylanan_metin: "Metin", bagli_ses_checksum: "b".repeat(64) } } }).ok, false);
});

test("teslim rotası istemci transkript beyanını güven kaynağı olarak kullanmaz", () => {
  const kod = readFileSync("app/api/ogrenme-araclari/[arac_id]/podcast-dogrula/route.ts", "utf8");
  assert.doesNotMatch(kod, /body\.transkript_metni/);
  assert.match(kod, /podcastIuTeslimKapisiDogrula/);
  assert.match(kod, /podcastTranskriptYetkisiDogrula/);
});

test("üretici incelemesi yalnız onaylı metni gösterir ve transkriptsiz talebi açıklar", () => {
  const api = readFileSync("app/(panel)/uretim/api/gorevler/route.ts", "utf8");
  const sayfa = readFileSync("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx", "utf8");
  assert.match(api, /transkriptOnayli[\s\S]*onaylananMetin/);
  assert.match(api, /taslak_metin: iuKendiGorevi/);
  assert.match(sayfa, /Bu talepte transkript istenmedi\./);
  assert.match(sayfa, /Onaylı transkript/);
});

test("SQL, V1/V3 tercihini ve onaylı AI teslim kapısını atomik uygular", () => {
  const sql = readFileSync("scripts/sql/ogrenme_araclari_faz3_podcast_v1_v3_teslim.sql", "utf8");
  assert.match(sql, /jsonb_typeof\(v_talep\.ogrenme_araci_tercihleri->'transkript_istendi'\)/);
  assert.match(sql, /v_transkript_durumu <> 'onaylandi'/);
  assert.match(sql, /COALESCE\(v_transkript->>'kaynak', ''\) <> 'ai'/);
  assert.match(sql, /v_gorev\.atanan_iu_id IS DISTINCT FROM p_kullanici_id/);
  assert.doesNotMatch(sql, /v_arac\.transkript_yolu IS NULL/);
  assert.match(sql, /uretim_podcast_soru_zinciri_ac/);
});
