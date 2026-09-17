import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const kok = process.cwd();

function kaynakDosyalari(dizin: string): string[] {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad);
    if (["node_modules", ".next"].includes(ad)) return [];
    return statSync(yol).isDirectory() ? kaynakDosyalari(yol) : /\.(ts|tsx)$/.test(ad) ? [yol] : [];
  });
}

test("uygulama Video için eski fiziksel tablolara doğrudan erişmez", () => {
  const eskiTabloErisimi = /\.from\(["'](?:videolar|video_durumu|video_puanlari)["']\)/;
  const ihlaller = ["app", "lib", "components"]
    .flatMap((dizin) => kaynakDosyalari(join(kok, dizin)))
    .filter((dosya) => eskiTabloErisimi.test(readFileSync(dosya, "utf8")));
  assert.deepEqual(ihlaller, []);
});

test("Video geçişi ortak yazma, takip, yayın, puan ve silme zincirini kurar", () => {
  const hazirlik = readFileSync(join(kok, "scripts/sql/video_ortak_model_hazirlik.sql"), "utf8");
  const sonlandirma = readFileSync(join(kok, "scripts/sql/video_ortak_model_sonlandir.sql"), "utf8");

  assert.match(hazirlik, /v_uretici_ogrenme_araci_takip/);
  assert.match(hazirlik, /CREATE OR REPLACE VIEW public\.v_yayin_detay/);
  assert.match(hazirlik, /uretim_video_teslim_et[\s\S]*ogrenme_araci_durumu/);
  assert.match(hazirlik, /uretim_video_uretici_karar_ver[\s\S]*uretim_podcast_soru_zinciri_ac/);
  assert.match(sonlandirma, /yayin_oncesi_silme_tamamla[\s\S]*DELETE FROM public\.ogrenme_araclari/);
  assert.match(sonlandirma, /trg_legacy_videolar_yazma_engeli/);
  assert.match(sonlandirma, /trg_legacy_video_durumu_yazma_engeli/);
  assert.match(sonlandirma, /trg_legacy_video_puanlari_yazma_engeli/);
});
