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

  // HapBilgi logo 40px (h-10)
  assert.ok(kaynak.includes("h-10"));

  // Sabit Bounding Box 72px kontrolü
  assert.ok(kaynak.includes("w-[72px]"));
  assert.ok(kaynak.includes("object-contain"));

  // İfade: "resmi öğrenme platformu"
  assert.ok(kaynak.includes("resmi öğrenme platformu"));

  // Metin 8.5px
  assert.ok(kaynak.includes("text-[8.5px]"));

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

test("Admin paneli Ürün ve Teknik ve Logo ve Kimlik sekmelerini ve yönetim bileşenini içerir", async () => {
  const { MODUL_SEKMELERI } = await import("@/app/admin/_constants");
  const urunTeknik = MODUL_SEKMELERI.find((s) => s.id === "urunteknik");
  const logoKimlik = MODUL_SEKMELERI.find((s) => s.id === "logokimlik");

  assert.ok(urunTeknik);
  assert.equal(urunTeknik.etiket, "Ürün ve Teknik");

  assert.ok(logoKimlik);
  assert.equal(logoKimlik.etiket, "Logo ve Kimlik");
  assert.equal(logoKimlik.grup, "firma");

  const bilesenYolu = path.join(process.cwd(), "app/admin/_components/LogoKimlikYonetimi.tsx");
  assert.ok(fs.existsSync(bilesenYolu));
  const kaynak = fs.readFileSync(bilesenYolu, "utf-8");

  // 3 Buton aksiyonları
  assert.ok(kaynak.includes("handleKaydet"));
  assert.ok(kaynak.includes("handleDurdurToggle"));
  assert.ok(kaynak.includes("handleKaldir"));
});

test("Firma logo storage 5 MB limit ve SVG formatını destekler", async () => {
  const dosyaYolu = path.join(process.cwd(), "lib/firma/logoStorage.ts");
  assert.ok(fs.existsSync(dosyaYolu));
  const kaynak = fs.readFileSync(dosyaYolu, "utf-8");

  // 5 MB limit
  assert.ok(kaynak.includes("5 * 1024 * 1024"));

  // SVG desteği
  assert.ok(kaynak.includes("image/svg+xml"));
});
