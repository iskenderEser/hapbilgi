import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { svgMi } from "@/lib/firma/logoOptimizasyonIstemci";

test("svgMi helper'ı dosya adı ve mime tipe göre doğru tespit eder", () => {
  const svgDosya1 = new File(["<svg></svg>"], "logo.svg", { type: "image/svg+xml" });
  const svgDosya2 = new File(["<svg></svg>"], "logo.SVG", { type: "application/octet-stream" });
  const pngDosya = new File(["dummy"], "logo.png", { type: "image/png" });
  const jpgDosya = new File(["dummy"], "logo.jpg", { type: "image/jpeg" });

  assert.equal(svgMi(svgDosya1), true);
  assert.equal(svgMi(svgDosya2), true);
  assert.equal(svgMi(pngDosya), false);
  assert.equal(svgMi(jpgDosya), false);
});

test("LogoKimlikYonetimi bileşeni logoGorseliniOptimizeEt fonksiyonunu kullanır", () => {
  const dosyaYolu = path.join(process.cwd(), "app/admin/_components/LogoKimlikYonetimi.tsx");
  const icerik = fs.readFileSync(dosyaYolu, "utf8");

  assert.match(icerik, /import.*logoGorseliniOptimizeEt.*from ["']@\/lib\/firma\/logoOptimizasyonIstemci["']/);
  assert.match(icerik, /const yuklenecekDosya = await logoGorseliniOptimizeEt\(dosya\)/);
  assert.match(icerik, /formData\.append\("dosya", yuklenecekDosya\)/);
});

test("logoStorage 5MB tavan limitine ve izinli MIME tiplerine sahiptir", () => {
  const dosyaYolu = path.join(process.cwd(), "lib/firma/logoStorage.ts");
  const icerik = fs.readFileSync(dosyaYolu, "utf8");

  assert.match(icerik, /5 \* 1024 \* 1024/);
  assert.match(icerik, /image\/svg\+xml/);
  assert.match(icerik, /image\/png/);
  assert.match(icerik, /image\/webp/);
});
