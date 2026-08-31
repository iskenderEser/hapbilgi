import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");
const gonderim = oku("lib/eczanem/gonderim.ts");
const musteriKatalogu = oku("app/eczanem/api/videolar/route.ts");
const baslat = oku("app/eczanem/api/izleme/baslat/route.ts");
const erisim = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");
const kimlikSql = oku("scripts/sql/eczanem_ogrenme_araci_yayin_kimligi.sql");
const tamamlamaSql = oku("scripts/sql/eczanem_ogrenme_araci_tamamlama.sql");

test("Eczanem iki dağıtım katmanında ortak araç kimliğini taşır ve doğrular", () => {
  assert.match(gonderim, /arac_id: string/);
  assert.match(gonderim, /arac_turu: OgrenmeAraciTuru/);
  for (const tablo of ["eczanem_eczane_gonderimleri", "eczanem_gonderimler"]) {
    assert.match(kimlikSql, new RegExp(`ALTER TABLE public\\.${tablo}[\\s\\S]*ADD COLUMN IF NOT EXISTS arac_id uuid`));
  }
  assert.match(kimlikSql, /eczanem_gonderim_arac_kimligi_dogrula/);
  assert.match(kimlikSql, /NEW\.arac_id := v_arac_id/);
});

test("Müşteri kataloğu ve başlangıç gönderim-yayın-araç bağını kayıpsız korur", () => {
  assert.match(musteriKatalogu, /g\.arac_id === yayin\.arac_id/);
  assert.match(musteriKatalogu, /g\.arac_turu === yayin\.arac_turu/);
  assert.match(baslat, /gonderim\.arac_id !== yayinDetay\.arac_id/);
  assert.match(baslat, /arac_turu: yayinDetay\.arac_turu/);
  assert.match(erisim, /gonderim\.arac_id === arac_id/);
});

test("Eczanem tamamlaması dört araç türünü ortak kanıt ve puanla doğrular", () => {
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"]) {
    assert.match(tamamlamaSql, new RegExp(`v_arac_turu = '${tur}'`));
  }
  assert.match(tamamlamaSql, /v_izleme\.tamamlama_kaniti/);
  assert.match(tamamlamaSql, /vyd\.ogrenme_araci_puani/);
  assert.match(tamamlamaSql, /soru_erisimi_acik_mi=/);
  assert.doesNotMatch(tamamlamaSql, /JOIN public\.video_durumu|JOIN public\.videolar/i);
});
