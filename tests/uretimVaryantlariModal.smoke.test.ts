import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VARYANT_ALT_MODAL, SAYFA_REHBERLERI } from "@/lib/rehber/sayfaRehberi";

test("VARYANT_ALT_MODAL V1-V4 tanımları ve pilleri sözleşmeye tam uygundur", () => {
  assert.equal(VARYANT_ALT_MODAL.kartlar.length, 4);

  const [v1, v2, v3, v4] = VARYANT_ALT_MODAL.kartlar;

  // V1
  assert.equal(v1.kod, "V1");
  assert.equal(v1.baslik, "V1");
  assert.equal(v1.aciklama, "İçerik akışı, seçilen öğrenme aracı ve soru seti HapBilgi içerik üreticisi aracılığıyla üretilir.");
  assert.equal(v1.rozet, "İçerik Üreticiyle");

  // V2
  assert.equal(v2.kod, "V2");
  assert.equal(v2.baslik, "V2");
  assert.equal(v2.aciklama, "Seçtiğiniz öğrenme aracı sizin tarafınızdan hazır yüklenir. Soru seti HapBilgi içerik üreticisi aracılığıyla üretilir. Tabloda seçilen araca özgü hazır rozetiyle görünür.");
  assert.equal(v2.rozet, "Hazır Öğrenme Aracı");

  // V3
  assert.equal(v3.kod, "V3");
  assert.equal(v3.baslik, "V3");
  assert.equal(v3.aciklama, "İçerik akışı ve seçilen öğrenme aracı HapBilgi içerik üreticisi aracılığıyla üretilir. Soru seti sizin tarafınızdan hazır yüklenir. Tabloda hazır soru seti rozetiyle görünür.");
  assert.equal(v3.rozet, "Hazır Soru Seti");

  // V4
  assert.equal(v4.kod, "V4");
  assert.equal(v4.baslik, "V4");
  assert.equal(v4.aciklama, "Seçtiğiniz öğrenme aracı ve soru seti sizin tarafınızdan hazır yüklenir. Doğrudan yayına hazır hale gelir.");
  assert.equal(v4.rozet, "Hazır Öğrenme Aracı + Hazır Soru Seti");
});

test("raporlar-uretim rehber tanımı VARYANT_ALT_MODAL ve linkKelime sözleşmesini korur", () => {
  const rehber = SAYFA_REHBERLERI["raporlar-uretim"];
  assert.ok(rehber);
  assert.equal(rehber.linkKelime, "üretim varyantları (V1-V4)");
  assert.ok(rehber.ozet.includes("üretim varyantları (V1-V4)"));
  assert.equal(rehber.altModal, VARYANT_ALT_MODAL);
});

test("Yayın Raporları sayfası başlık, alt açıklama ve (varyantları) modal bağlantısını içerir", () => {
  const sayfa = readFileSync("app/(panel)/raporlar/yayin-raporlari/page.tsx", "utf8");
  assert.match(sayfa, /Yayınların Üretim Yöntemleri ve Dağılımları/);
  assert.match(sayfa, /Yayınlarınızın üretim yöntemleri/);
  assert.match(sayfa, /\(varyantları\)/);
  assert.match(sayfa, /UretimVaryantlariModal/);
  assert.match(sayfa, /setVaryantModalAcik\(true\)/);
});
