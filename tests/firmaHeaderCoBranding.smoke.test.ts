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

test("PanelNavbar co-branding ve sabit bounding box sözleşmesini uygular", () => {
  const dosyaYolu = path.join(process.cwd(), "components/panel/PanelNavbar.tsx");
  const kaynak = fs.readFileSync(dosyaYolu, "utf-8");

  // Co-branding koşulu
  assert.ok(kaynak.includes("ogrenmePlatformuAktif && firmaLogoUrl"));

  // Sabit Bounding Box kontrolü
  assert.ok(kaynak.includes("w-[68px]"));
  assert.ok(kaynak.includes("object-contain"));

  // İfade: "resmi öğrenme platformu"
  assert.ok(kaynak.includes("resmi öğrenme platformu"));

  // Font boyutları
  assert.ok(kaynak.includes("text-[8px]"));
  assert.ok(kaynak.includes("sm:text-[11.5px]"));

  // Mobil araçların kesilmemesi için flex-shrink-0 koruması
  assert.ok(kaynak.includes("flex-shrink-0"));
});

test("layout.tsx eclub_kisi için co-branding'i kapatır ve firma bilgilerini aktarır", () => {
  const dosyaYolu = path.join(process.cwd(), "app/(panel)/layout.tsx");
  const kaynak = fs.readFileSync(dosyaYolu, "utf-8");

  // eclub_kisi için engelleme güvencesi
  assert.ok(kaynak.includes("!isEclubKisi && Boolean(etkinFlags.ogrenmePlatformuAktif)"));
  assert.ok(kaynak.includes("firmaLogoUrl={!isEclubKisi ? etkinFlags.firmaLogoUrl : null}"));
  assert.ok(kaynak.includes("firmaAdi={firmaAdi}"));
});
