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

test("PanelNavbar co-branding ve sağa çekilmiş navigasyon sözleşmesini uygular", () => {
  const dosyaYolu = path.join(process.cwd(), "components/panel/PanelNavbar.tsx");
  const kaynak = fs.readFileSync(dosyaYolu, "utf-8");

  // Co-branding koşulu
  assert.ok(kaynak.includes("ogrenmePlatformuAktif && firmaLogoUrl"));

  // Firma logosu HapBilgi logosundan daha büyük olamaz (Hapbilgi: h-12/14/62, Firma: height 30)
  assert.ok(kaynak.includes("height: 30"));

  // İfade logonun sağında: "resmi öğrenme sponsoru"
  assert.ok(kaynak.includes("resmi öğrenme sponsoru"));

  // İfade font boyutu 11.5px
  assert.ok(kaynak.includes('fontSize: "11.5px"'));
});

test("layout.tsx eclub_kisi için co-branding'i kapatır ve firma bilgilerini aktarır", () => {
  const dosyaYolu = path.join(process.cwd(), "app/(panel)/layout.tsx");
  const kaynak = fs.readFileSync(dosyaYolu, "utf-8");

  // eclub_kisi için engelleme güvencesi
  assert.ok(kaynak.includes("!isEclubKisi && Boolean(etkinFlags.ogrenmePlatformuAktif)"));
  assert.ok(kaynak.includes("firmaLogoUrl={!isEclubKisi ? etkinFlags.firmaLogoUrl : null}"));
  assert.ok(kaynak.includes("firmaAdi={firmaAdi}"));
});
