import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const sayfa = oku("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx");
const api = oku("app/(panel)/uretim/api/karar/route.ts");
const sql = oku("scripts/sql/uretim_karar_surum_kapisi.sql");

test("PM-06: karar isteği ekranda incelenen görev sürümünü taşır", () => {
  assert.match(sayfa, /beklenen_surum:\s*gorev\.surum/);
  assert.match(api, /p_beklenen_surum:\s*beklenen_surum/);
});

test("PM-06: bütün öğrenme aracı kararları aynı sürüm kapısından geçer", () => {
  for (const islemTuru of ["uretici_karari", "podcast_uretici_karari", "gorsel_uretici_karari", "flip_pdf_uretici_karari"]) {
    assert.match(sql, new RegExp(`uretim_karar_surum_kapisi\\(p_gorev_id, p_beklenen_surum, p_islem_anahtari, '${islemTuru}'\\)`));
  }
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /v_mevcut_surum IS DISTINCT FROM p_beklenen_surum/);
});

test("PM-06: eski ekran kararı kullanıcıya güncel sürüm yönlendirmesi verir", () => {
  assert.match(api, /İncelediğiniz teslim güncelliğini yitirdi/);
  assert.match(api, /sayfayı yenileyerek güncel sürümü yeniden inceleyin/);
});
