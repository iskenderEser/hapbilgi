import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const panelNav = readFileSync("components/panel/panelNav.config.ts", "utf8");
const bekleyenSayfa = readFileSync("app/(panel)/oneriler/page.tsx", "utf8");
const tamamlananSayfa = readFileSync("app/(panel)/oneriler/tamamlanan/page.tsx", "utf8");
const gorunumBileseni = readFileSync("app/(panel)/oneriler/_components/UyeOnerilerGorunumu.tsx", "utf8");

test("mutlu: Önerilen Yayınlar ana menüsü ve alt sekmeleri doğru rozet ve rotalara sahiptir", () => {
  // 1. Ana sekme ve alt sekmeler
  assert.match(panelNav, /etiket:\s*"Önerilen Yayınlar"[\s\S]*badgeKey:\s*"oneri"/);
  assert.match(panelNav, /etiket:\s*"Bekleyen Öneriler"[\s\S]*path:\s*"\/oneriler"[\s\S]*tamEslesme:\s*true[\s\S]*badgeKey:\s*"oneri"/);
  assert.match(panelNav, /etiket:\s*"Tamamlanan Öneriler"[\s\S]*path:\s*"\/oneriler\/tamamlanan"/);

  // 2. Sayfalar ve ortak bileşen
  assert.ok(existsSync("app/(panel)/oneriler/page.tsx"));
  assert.ok(existsSync("app/(panel)/oneriler/tamamlanan/page.tsx"));
  assert.match(bekleyenSayfa, /<UyeOnerilerGorunumu[\s\S]*varsayilanSekme="bekleyen"/);
  assert.match(tamamlananSayfa, /<UyeOnerilerGorunumu[\s\S]*varsayilanSekme="tamamlanan"/);

  // 3. Stat kartları, IcerikFiltreBari ve useListe standardı
  assert.match(gorunumBileseni, /<IcerikFiltreBari/);
  assert.match(gorunumBileseni, /useListe\(/);
  assert.match(gorunumBileseni, /İzleme Bekleyen/);
  assert.match(gorunumBileseni, /Tamamlananlar/);
});

test("red: Tamamlanan Öneriler rotası yetkisiz erişimi engeller", () => {
  assert.match(tamamlananSayfa, /Bu sayfaya yalnız UTT ve KD_UTT rolleri erişebilir/);
});
