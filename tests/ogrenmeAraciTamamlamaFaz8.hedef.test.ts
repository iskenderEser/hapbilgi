import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(new URL(`../${yol}`, import.meta.url), "utf8");
const hapbi = oku("lib/hapbi/egitim.ts");
const eclub = oku("lib/hapbi/eclubKisi.ts");
const push = oku("lib/push/icerik.ts");
const eczanem = oku("app/eczanem/page.tsx");
const etkilesim = oku("lib/etkilesim/yayinYetkisi.ts");

test("Hapbi yayın kimliği, araç türü, başlık ve tamamlama durumunu taşır", () => {
  for (const alan of ["yayin_id", "arac_turu", "baslik", "durum"]) assert.match(hapbi, new RegExp(alan));
});

test("Hapbi yalnız doğrulanmış araç metadatasını öncelikli kaynak yapar", () => {
  assert.match(hapbi, /arac_metadata_dogrulandi/);
  assert.match(hapbi, /transkript_metni_dogrulandi/);
  assert.match(hapbi, /arama_metni_dogrulandi/);
  assert.match(hapbi, /egitim_metni/);
  assert.match(hapbi, /aciklama/);
});

test("E-Club cevapları tekrar önerilerinde izleme üzerinden öneriye bağlanır", () => {
  assert.match(eclub, /eclub_izleme_kayitlari/);
  assert.match(eclub, /izlemeOnerisi/);
  assert.match(eclub, /dogruSayilari\.get\(oneri\.oneri_id\)/);
  assert.match(eclub, /yanlisSayilari\.get\(oneri\.oneri_id\)/);
});

test("Hapbi yetkili rol bağlantıları kesin yayın, challenge ve öneri kimliğini taşır", () => {
  assert.match(hapbi, /yayin_id=/);
  assert.match(hapbi, /challenge_id=/);
  assert.match(eclub, /oneri_id=/);
});

test("bildirimler doğru UTT öneri, BM challenge ve E-Club öneri kimliklerini açar", () => {
  assert.match(push, /oneri_id=/);
  assert.match(push, /challenge_id=/);
  assert.match(push, /eclub\/panel\?oneri_id=/);
});

test("Eczanem bildirimi kesin gönderimi açar", () => {
  assert.match(push, /eczanem\?gonderim_id=/);
  assert.match(eczanem, /searchParams\.get\("gonderim_id"\)/);
  assert.match(eczanem, /video\.gonderim_id === gonderimId/);
});

test("ortak beğeni ve favori yetkisi dört öğrenme aracını kabul eder", () => {
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"]) assert.match(etkilesim, new RegExp(tur));
  assert.match(oku("app/izle/api/begeni/route.ts"), /etkilesimYayinYetkisi/);
  assert.match(oku("app/izle/api/favori/route.ts"), /etkilesimYayinYetkisi/);
});

test("tüketici ekranlarında çok araçlı alanlar öğrenme içeriği dilini kullanır", () => {
  for (const yol of [
    "components/ana-sayfa/UttAnaSayfa.tsx",
    "app/(panel)/eclub/panel/page.tsx",
    "app/eczanem/page.tsx",
  ]) assert.match(oku(yol), /[Öö]ğrenme [İi]çeri/);
});
