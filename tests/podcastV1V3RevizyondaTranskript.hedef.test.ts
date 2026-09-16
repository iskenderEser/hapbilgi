import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podcastRevizyondaTranskriptTalebiDogrula } from "../lib/ogrenmeAraci/sozlesme.ts";

const uygun = {
  aracTuru: "podcast",
  asama: "video",
  karar: "revizyon bekleniyor",
  hazirPodcast: false,
  mevcutTranskriptIstendi: false,
  revizyondaTranskriptIstendi: true,
};

test("V1/V3 podcast revizyonunda false tercih true yapılabilir", () => {
  assert.deepEqual(podcastRevizyondaTranskriptTalebiDogrula(uygun), { ok: true });
});

test("onay, senaryo, hazır podcast ve zaten istenen transkript reddedilir", () => {
  assert.equal(podcastRevizyondaTranskriptTalebiDogrula({ ...uygun, karar: "onaylandi" }).ok, false);
  assert.equal(podcastRevizyondaTranskriptTalebiDogrula({ ...uygun, asama: "senaryo" }).ok, false);
  assert.equal(podcastRevizyondaTranskriptTalebiDogrula({ ...uygun, hazirPodcast: true }).ok, false);
  assert.equal(podcastRevizyondaTranskriptTalebiDogrula({ ...uygun, mevcutTranskriptIstendi: true }).ok, false);
});

test("transkript istenmeyen normal revizyon mevcut davranışı korur", () => {
  assert.deepEqual(podcastRevizyondaTranskriptTalebiDogrula({ ...uygun, revizyondaTranskriptIstendi: false }), { ok: true });
});

test("üretici ekranı yalnız uygun podcast revizyonunda sonradan transkript seçeneği sunar", () => {
  const sayfa = readFileSync("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx", "utf8");
  assert.match(sayfa, /gorev\.asama === "video"/);
  assert.match(sayfa, /gorev\.talep\?\.ogrenme_araci_turu === "podcast"/);
  assert.match(sayfa, /gorev\.talep\.podcast_transkript_istendi === false/);
  assert.match(sayfa, /Bu revizyonda transkript de istiyorum/);
  assert.match(sayfa, /revizyonda_transkript_istendi:/);
});

test("karar API'si tercihi yalnız podcast video RPC'sine geçirir", () => {
  const route = readFileSync("app/(panel)/uretim/api/karar/route.ts", "utf8");
  assert.match(route, /podcastRevizyondaTranskriptTalebiDogrula/);
  assert.match(route, /p_revizyonda_transkript_istendi/);
  assert.match(route, /aracTuru === "podcast" && gorevBilgisi\?\.asama === "video"/);
});

test("SQL tercih, transkript temizliği ve revizyon kararını tek transactionda uygular", () => {
  const sql = readFileSync("scripts/sql/ogrenme_araclari_faz3_podcast_v1_v3_revizyonda_transkript.sql", "utf8");
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /'transkript_istendi', true/);
  assert.match(sql, /- 'transkript_metni' - 'transkript_metni_dogrulandi' - 'transkript_dogrulandi'/);
  assert.match(sql, /'durum', 'yok'/);
  assert.match(sql, /public\.uretim_podcast_uretici_karar_ver\([\s\S]*p_beklenen_surum[\s\S]*\)/);
  assert.match(sql, /p_revizyonda_transkript_istendi boolean/);
  assert.match(
    sql,
    /IF FOUND THEN[\s\S]*RETURN v_onceki \|\| jsonb_build_object\([\s\S]*'revizyonda_transkript_istendi'/,
  );
  assert.match(sql, /COMMIT;/);
});
