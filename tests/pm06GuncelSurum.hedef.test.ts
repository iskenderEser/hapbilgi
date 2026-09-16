import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const sayfa = oku("app/(panel)/uretim/gorevler/[gorev_id]/page.tsx");
const talepMerkezi = oku("app/(panel)/talepler/_hooks/useTalepMerkezi.ts");
const ureticiRolApi = oku("app/(panel)/talepler/api/uretici-rol/route.ts");
const talepDetayi = oku("app/(panel)/talepler/_components/TalepDetayi.tsx");
const api = oku("app/(panel)/uretim/api/karar/route.ts");
const sql = oku("scripts/sql/uretim_karar_surum_kapisi.sql");

test("PM-06: karar isteği ekranda incelenen görev sürümünü taşır", () => {
  assert.match(sayfa, /beklenen_surum:\s*gorev\.surum/);
  assert.match(ureticiRolApi, /durum, surum/);
  assert.match(ureticiRolApi, /aktif_gorev_surum:\s*gorev\?\.surum/);
  assert.match(talepDetayi, /surum:\s*talep\.aktif_gorev_surum/);
  assert.match(talepMerkezi, /beklenen_surum:\s*hedef\.surum/);
  assert.match(api, /p_beklenen_surum:\s*beklenen_surum/);
});

test("PM-06: bütün öğrenme aracı kararları aynı sürüm kapısından geçer", () => {
  for (const islemTuru of ["uretici_karari", "podcast_uretici_karari", "gorsel_uretici_karari", "flip_pdf_uretici_karari"]) {
    assert.match(sql, new RegExp(`uretim_karar_surum_kapisi\\(p_gorev_id, p_beklenen_surum, p_islem_anahtari, '${islemTuru}'\\)`));
  }
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /v_mevcut_surum IS DISTINCT FROM p_beklenen_surum/);
});

test("PM-06: eksik veya eski ekran kararı kullanıcıya anlaşılır yenileme mesajı verir", () => {
  assert.equal((api.match(/İşleminizi güncellemek için sayfanızı yenileyin/g) ?? []).length, 2);
});
