import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const panelNav = readFileSync("components/panel/panelNav.config.ts", "utf8");
const bekleyenSayfa = readFileSync("app/(panel)/oneriler/page.tsx", "utf8");
const tamamlananSayfa = readFileSync("app/(panel)/oneriler/tamamlanan/page.tsx", "utf8");
const gorunumBileseni = readFileSync("app/(panel)/oneriler/_components/UyeOnerilerGorunumu.tsx", "utf8");

test("mutlu: Önerilen Yayınlar tek menü bağlantısı ve stat kartlarıyla durum seçimi kullanır", () => {
  // 1. Tek sidebar bağlantısı
  assert.match(panelNav, /etiket:\s*"Önerilen Yayınlar"[\s\S]*path:\s*"\/oneriler"[\s\S]*tamEslesme:\s*true[\s\S]*badgeKey:\s*"oneri"/);
  assert.doesNotMatch(panelNav, /etiket:\s*"Bekleyen Öneriler"/);
  assert.doesNotMatch(panelNav, /etiket:\s*"Tamamlanan Öneriler"/);

  // 2. Sayfalar ve ortak bileşen
  assert.ok(existsSync("app/(panel)/oneriler/page.tsx"));
  assert.ok(existsSync("app/(panel)/oneriler/tamamlanan/page.tsx"));
  assert.match(bekleyenSayfa, /<UyeOnerilerGorunumu[\s\S]*varsayilanSekme="bekleyen"/);
  assert.match(tamamlananSayfa, /<UyeOnerilerGorunumu[\s\S]*varsayilanSekme="tamamlanan"/);

  // 3. Durum seçimi stat kartlarında; yayın türü seçicisi ayrı kalır.
  assert.doesNotMatch(gorunumBileseni, /PeriyotButonlari|DURUM_SECENEKLERI|Öneri durumuna göre filtrele/);
  assert.match(gorunumBileseni, /<UttYayinTuruToggle/);
  assert.match(gorunumBileseni, /onClick=\{\(\) => setAktifFiltre\(kart\.id\)\}/);
  assert.match(gorunumBileseni, /useState<YayinTuruFiltreDegeri>\("tumu"\)/);
  assert.doesNotMatch(gorunumBileseni, /<IcerikFiltreBari/);
  assert.doesNotMatch(gorunumBileseni, /useListe\(/);
  assert.match(gorunumBileseni, /label:\s*"Bekleyen"/);
  assert.match(gorunumBileseni, /label:\s*"Tamamlanan"/);
  assert.match(gorunumBileseni, /label:\s*"Süresi Dolan"/);
});

test("red: Tamamlanan Öneriler rotası yetkisiz erişimi engeller", () => {
  assert.match(tamamlananSayfa, /Bu sayfaya yalnız UTT ve KD_UTT rolleri erişebilir/);
});
