import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FIRMA_KOLONLARI } from "@/lib/firma/kolonlar";
import { VARSAYILAN_FLAGS } from "@/lib/panel/panelCache";

test("FIRMA_KOLONLARI logo_url ve ogrenme_platformu_aktif alanlarını içerir", () => {
  assert.ok(FIRMA_KOLONLARI.includes("logo_url"));
  assert.ok(FIRMA_KOLONLARI.includes("ogrenme_platformu_aktif"));
});

test("VARSAYILAN_FLAGS güvenli varsayılanlarla başlar", () => {
  assert.equal(VARSAYILAN_FLAGS.firmaLogoUrl, null);
  assert.equal(VARSAYILAN_FLAGS.ogrenmePlatformuAktif, false);
});

test("PanelNavbar 3 kesin tasarım kuralını ve co-branding sözleşmesini uygular", () => {
  const dosyaYolu = path.join(process.cwd(), "components/panel/PanelNavbar.tsx");
  const kaynak = fs.readFileSync(dosyaYolu, "utf-8");

  // Co-branding koşulu
  assert.ok(kaynak.includes("ogrenmePlatformuAktif && firmaLogoUrl"));

  // Kural 1: Firma logosu HapBilgi logosundan daha büyük olamaz (Hapbilgi: h-12/14/62, Firma: height 30)
  assert.ok(kaynak.includes("height: 30"));

  // Kural 2: Alt yazı bold değil light (font-weight: 300)
  assert.ok(kaynak.includes("fontWeight: 300"));

  // Kural 3: Alt yazı firma logosundan sağa sola taşamaz (kilitli genişlik, ellipsis, nowrap)
  assert.ok(kaynak.includes("resmi öğrenme platformu"));
  assert.ok(kaynak.includes('textOverflow: "ellipsis"'));
  assert.ok(kaynak.includes('whiteSpace: "nowrap"'));
  assert.ok(kaynak.includes('fontSize: "6.8px"'));
});

test("layout.tsx eclub_kisi için co-branding'i kapatır ve firma bilgilerini aktarır", () => {
  const dosyaYolu = path.join(process.cwd(), "app/(panel)/layout.tsx");
  const kaynak = fs.readFileSync(dosyaYolu, "utf-8");

  // eclub_kisi için engelleme güvencesi
  assert.ok(kaynak.includes("!isEclubKisi && Boolean(etkinFlags.ogrenmePlatformuAktif)"));
  assert.ok(kaynak.includes("firmaLogoUrl={!isEclubKisi ? etkinFlags.firmaLogoUrl : null}"));
  assert.ok(kaynak.includes("firmaAdi={firmaAdi}"));
});
