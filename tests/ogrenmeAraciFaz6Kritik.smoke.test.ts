import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");

test("dört tüketici kanalında sahiplik ve bağ kimliği sunucuda doğrulanır", () => {
  const erisim = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
  assert.match(erisim, /oneri\.kullanici_id === user\.id/);
  assert.match(erisim, /challenge\.alan_id === user\.id/);
  assert.match(erisim, /oneri\.kisi_id === kisi\.kisi_id/);
  assert.match(erisim, /gonderim\.musteri_id === kimlik\.musteriId/);
});

test("tamamlama ve puan kapıları yayın durumu, araç bayrağı ve kanıtı korur", () => {
  for (const yol of ["app/izle/api/bitir/route.ts", "app/(panel)/challenge-club/izle/api/bitir/route.ts", "app/(panel)/eclub/panel/api/bitir/route.ts", "app/eczanem/api/izleme/bitir/route.ts"]) {
    const kaynak = oku(yol);
    assert.match(kaynak, /yayinAraciKullanimaAcikMi/);
    assert.match(kaynak, /tamamlamaKanitiDogrula/);
    assert.match(kaynak, /tamamla/);
  }
});

test("bildirimler rolün doğru öğrenme oynatıcısına yönlenir", () => {
  const kaynak = oku("lib/push/icerik.ts");
  assert.match(kaynak, /\/ana-sayfa\?yayin_id=/);
  assert.match(kaynak, /\/challenge-club\/izle\//);
  assert.match(kaynak, /\/eclub\/panel\?oneri_id=/);
  assert.match(kaynak, /\/eczanem\?yayin_id=/);
});

test("Hapbi araç türü, cevap başarısı ve çalışan yayın bağlantısını taşır", () => {
  const egitim = oku("lib/hapbi/egitim.ts");
  const eclub = oku("lib/hapbi/eclubKisi.ts");
  for (const kaynak of [egitim, eclub]) {
    assert.match(kaynak, /arac_turu/);
    assert.match(kaynak, /dogru_cevap_yuzdesi/);
  }
  assert.match(egitim, /yayin_id=/);
  assert.match(eclub, /eclub\/panel\?oneri_id=/);
});
