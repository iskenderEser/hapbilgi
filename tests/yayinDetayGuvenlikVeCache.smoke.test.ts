// tests/yayinDetayGuvenlikVeCache.smoke.test.ts
//
// Yayın detay API'si multi-tenant firma izolasyonu ve panel cache mahremiyet sözleşmesini korur.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("güvenlik: yayin-detay API'si firma_id ve aktiflik kapsamını zorunlu tutar", () => {
  const routeContent = readFileSync("app/api/raporlar/yayin-detay/[yayin_id]/route.ts", "utf8");

  // Kullanıcı ve firma_id kontrolü
  assert.match(routeContent, /\.from\("kullanicilar"\)/);
  assert.match(routeContent, /kullanici\.firma_id/);
  assert.match(routeContent, /kullanici\.aktif_mi/);

  // Yayın firma_id eşleşmesi ve multi-tenant izolasyonu
  assert.match(routeContent, /yayin\.firma_id !== kullanici\.firma_id/);
  assert.match(routeContent, /ADMIN_ROLLER\.includes\(rol\)/);

  // Firma aktiflik kontrolü
  assert.match(routeContent, /firma\?\.aktif !== true/);
});

test("mahremiyet: panel önbelleği sessionStorage üzerinde userId'ye izoledir", () => {
  const cacheContent = readFileSync("lib/panel/panelCache.ts", "utf8");
  const layoutContent = readFileSync("app/(panel)/layout.tsx", "utf8");

  // sessionStorage izolasyonu ve userId zorunluluğu
  assert.match(cacheContent, /sessionStorage/);
  assert.match(cacheContent, /hb_panel_cache_/);
  assert.match(cacheContent, /!userId \|\| typeof userId !== "string"/);

  // Layout başlangıcında anonim önbellek yüklenmez (kimliksiz veri sızamaz)
  assert.match(layoutContent, /const \[flags, setFlags\] = useState<PanelFlags>\(VARSAYILAN_FLAGS\)/);
  assert.match(layoutContent, /const userCache = getPanelCache\(kullanici\.id\)/);
});
