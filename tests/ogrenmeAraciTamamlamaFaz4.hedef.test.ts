import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ogrenmeAraciUretimAkisi } from "../lib/ogrenmeAraci/uretimAkisi.ts";
import type { OgrenmeAraciTuru } from "../lib/ogrenmeAraci/tipler.ts";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const ortakSql = oku("scripts/sql/ogrenme_araclari_tamamlama_faz4_uretim_hatti.sql");
const kararRoute = oku("app/(panel)/uretim/api/karar/route.ts");
const yayinRoute = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
const kararSurumSql = oku("scripts/sql/uretim_karar_surum_kapisi.sql");
const gorselV3TerminolojiSql = oku("scripts/sql/dijital_brosur_v3_karar_terminolojisi.sql");
const migrationlar = {
  podcast: oku("scripts/sql/ogrenme_araclari_faz3_podcast_uretim.sql"),
  gorsel: oku("scripts/sql/ogrenme_araclari_faz4_gorsel_uretim.sql"),
  flip_pdf: oku("scripts/sql/ogrenme_araclari_faz5_flip_pdf_uretim.sql"),
} as const;

const araclar = ["podcast", "gorsel", "flip_pdf"] as const satisfies readonly OgrenmeAraciTuru[];
const varyantlar = [
  { varyant: "V1", hazirArac: false, hazirSoru: false, ilk: "senaryo", sonraki: "soru_seti" },
  { varyant: "V2", hazirArac: true, hazirSoru: false, ilk: "hazir_arac_yukleme", sonraki: "soru_seti" },
  { varyant: "V3", hazirArac: false, hazirSoru: true, ilk: "senaryo", sonraki: "yayin_yonetimi" },
  { varyant: "V4", hazirArac: true, hazirSoru: true, ilk: "hazir_arac_yukleme", sonraki: "yayin_yonetimi" },
] as const;

for (const arac of araclar) {
  for (const beklenen of varyantlar) {
    test(`${arac} ${beklenen.varyant} üretim akışı doğrudur`, () => {
      const akis = ogrenmeAraciUretimAkisi(arac, beklenen.hazirArac, beklenen.hazirSoru);
      assert.equal(akis.varyant, beklenen.varyant);
      assert.equal(akis.ilkAdim, beklenen.ilk);
      assert.equal(akis.aracOnayiSonrasi, beklenen.sonraki);
    });
  }
}

test("hazir_video alanı korunur ve ilk görev hazır araç kararına göre ayrılır", () => {
  assert.match(ortakSql, /COMMENT ON COLUMN public\.talepler\.hazir_video/);
  assert.match(ortakSql, /IF v_talep\.hazir_video IS TRUE THEN/);
  assert.match(ortakSql, /'beklenen', 'hazir_arac_yukleme'/);
  assert.match(ortakSql, /p_talep_id, 'senaryo'/);
});

test("görev, talep ve araç kimlikleri DB katmanında birlikte doğrulanır", () => {
  assert.match(ortakSql, /v_arac_talep_id IS DISTINCT FROM NEW\.talep_id/);
  assert.match(ortakSql, /v_arac_turu IS DISTINCT FROM v_talep_arac_turu/);
  for (const sql of Object.values(migrationlar)) {
    assert.match(sql, /v_gorev\.talep_id <> v_arac\.talep_id/);
  }
});

test("üç araç aynı revizyon sınırını ve araç türüne özgü karar RPC'sini kullanır", () => {
  for (const [arac, sql] of Object.entries(migrationlar)) {
    assert.match(sql, /v_revizyon >= 2/);
    assert.match(sql, new RegExp(`uretim_${arac}_uretici_karar_ver`));
  }
  for (const rpc of [
    "uretim_podcast_uretici_karar_ver",
    "uretim_gorsel_uretici_karar_ver",
    "uretim_flip_pdf_uretici_karar_ver",
  ]) assert.match(kararRoute, new RegExp(rpc));
});

test("Dijital Broşür V3 karar RPC'si doğru kullanıcı terminolojisini korur", () => {
  assert.match(gorselV3TerminolojiSql, /Dijital Broşür karar yetkisi yok/);
  assert.match(gorselV3TerminolojiSql, /Doğrulanmış Dijital Broşür bulunamadı/);
  assert.match(gorselV3TerminolojiSql, /yalnız Dijital Broşür senaryo ve üretim aşamasını işler/);
  assert.doesNotMatch(gorselV3TerminolojiSql, /Görsel karar yetkisi yok|Doğrulanmış görsel bulunamadı/);
  assert.match(gorselV3TerminolojiSql, /REVOKE ALL ON FUNCTION/);
  assert.match(gorselV3TerminolojiSql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/);
});

test("sonraki görev açılmadan önce mevcut aktif görev kapanır", () => {
  for (const [arac, sql] of Object.entries(migrationlar)) {
    const kararGovdesi = sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.uretim_${arac}_uretici_karar_ver`));
    const goreviKapat = kararGovdesi.indexOf("UPDATE public.uretim_gorevleri SET");
    const sonrakiGoreviAc = kararGovdesi.indexOf("v_sonraki := public.uretim_gorev_ac");
    assert.ok(goreviKapat >= 0 && sonrakiGoreviAc > goreviKapat, `${arac} aktif görevi geç kapatıyor`);
  }

  const pdfSurumGovdesi = kararSurumSql.slice(
    kararSurumSql.indexOf("CREATE OR REPLACE FUNCTION public.uretim_flip_pdf_uretici_karar_ver"),
  );
  assert.ok(
    pdfSurumGovdesi.indexOf("UPDATE public.uretim_gorevleri")
      < pdfSurumGovdesi.indexOf("v_sonraki := public.uretim_gorev_ac"),
    "sürüm kapılı PDF kararı aktif görevi geç kapatıyor",
  );
});

test("onaylı araç doğru soru bağı ve araç puanı kapısıyla Yayın Yönetimine ulaşır", () => {
  assert.match(ortakSql, /d\.durum = 'onaylandi'/);
  assert.match(ortakSql, /a\.metadata_dogrulandi IS TRUE/);
  assert.match(ortakSql, /talep_id = p_talep_id AND arac_durum_id = p_arac_durum_id/);
  assert.match(ortakSql, /'sonraki', 'yayin_yonetimi'/);
  assert.match(yayinRoute, /ogrenme_araci_puanlari/);
  assert.match(yayinRoute, /Öğrenme aracı puanı tanımlanmadan yayına alınamaz/);
});
