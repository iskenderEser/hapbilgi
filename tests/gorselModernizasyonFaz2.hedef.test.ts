import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gorselOlculeriniBaytlardanOku } from "../lib/ogrenmeAraci/gorselMetadata.ts";

test("PNG ve JPEG ölçüleri dosya baytlarından okunur", () => {
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47], 0);
  png.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(png.buffer).setUint32(16, 1200, false);
  new DataView(png.buffer).setUint32(20, 800, false);
  assert.deepEqual(gorselOlculeriniBaytlardanOku(png), { genislik: 1200, yukseklik: 800 });

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00]);
  assert.deepEqual(gorselOlculeriniBaytlardanOku(jpeg), { genislik: 800, yukseklik: 600 });
});

test("WEBP VP8X ölçüleri dosya baytlarından okunur", () => {
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode("RIFF"), 0);
  webp.set(new TextEncoder().encode("WEBP"), 8);
  webp.set(new TextEncoder().encode("VP8X"), 12);
  const genislikEksiBir = 639;
  const yukseklikEksiBir = 359;
  webp.set([genislikEksiBir & 0xff, (genislikEksiBir >> 8) & 0xff, (genislikEksiBir >> 16) & 0xff], 24);
  webp.set([yukseklikEksiBir & 0xff, (yukseklikEksiBir >> 8) & 0xff, (yukseklikEksiBir >> 16) & 0xff], 27);
  assert.deepEqual(gorselOlculeriniBaytlardanOku(webp), { genislik: 640, yukseklik: 360 });
});

test("bozuk veya ölçüsüz görsel reddedilir", () => {
  assert.equal(gorselOlculeriniBaytlardanOku(new Uint8Array([1, 2, 3])), null);
});

test("route istemci ölçülerini kullanmaz ve SQL doğrulanmış Storage kaydını zorunlu tutar", () => {
  const route = readFileSync(new URL("../app/api/ogrenme-araclari/[arac_id]/gorsel-dogrula/route.ts", import.meta.url), "utf8");
  const sql = readFileSync(new URL("../scripts/sql/ogrenme_araclari_modernizasyon_faz2_gorsel_teslim.sql", import.meta.url), "utf8");
  assert.match(route, /bunnyStorageNesneIndir\(arac\.dosya_yolu\)/);
  assert.match(route, /gorselOlculeriniBaytlardanOku\(gorselBaytlari\)/);
  assert.doesNotMatch(route, /p_genislik: body\.genislik|p_yukseklik: body\.yukseklik/);
  assert.match(sql, /metadata_dogrulandi IS TRUE/);
  assert.match(sql, /depolama_dogrulamasi,checksum,edge_makbuzu_dogrulandi/);
  assert.match(sql, /v_gorev\.arac_id IS NOT NULL AND v_gorev\.arac_id <> p_arac_id/);
  assert.match(sql, /ogrenme_araci_depolama_temizleme_kuyrugu/);
});

test("revizyon ana görseli benzersiz yola taşır ve eski yolu teslim sonrasına saklar", () => {
  const baslat = readFileSync(new URL("../app/api/ogrenme-araclari/yukleme-baslat/route.ts", import.meta.url), "utf8");
  const storage = readFileSync(new URL("../lib/ogrenmeAraci/bunnyStorage.ts", import.meta.url), "utf8");
  assert.match(baslat, /girisimId: \["gorsel", "flip_pdf"\]\.includes\(arac_turu\) \? yuklemeGirisimiId : undefined/);
  assert.match(baslat, /onceki_ana_dosya_yolu/);
  assert.match(storage, /`ana-\$\{girdi\.girisimId\}\.\$\{girdi\.uzanti\}`/);
});
