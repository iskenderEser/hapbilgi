import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const oku = (yol: string) => readFileSync(join(process.cwd(), yol), "utf8");
const sql = oku("scripts/sql/yayin_oncesi_silme.sql");
const route = oku("app/(panel)/yayin-yonetimi/api/bekleyenler/sil/route.ts");
const yayinRoute = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");
const modallar = oku("app/(panel)/yayin-yonetimi/_components/Modallar.tsx");

test("mutlu: yayın adayı kilitlenir, Bunny ve varyanta uygun DB silmesi tamamlanır", () => {
  assert.match(sql, /yayin_oncesi_silme_durumu = 'isleniyor'/);
  const bunnySirasi = route.indexOf("bunnyVideoSil(guid)");
  const tamamlaSirasi = route.indexOf('rpc("yayin_oncesi_silme_tamamla"');
  assert.ok(bunnySirasi > -1 && tamamlaSirasi > bunnySirasi);
  assert.match(sql, /yayin_oncesi_silme_durumu = 'tamamlandi'/);
  assert.match(sql, /v_tam_silme := v_talep\.hazir_video IS TRUE AND v_talep\.hazir_soru_seti IS TRUE/);
  assert.match(sql, /IF v_tam_silme THEN[\s\S]*DELETE FROM public\.soru_setleri[\s\S]*DELETE FROM public\.videolar/);
  assert.match(modallar, /Bu yayın onayınızla kalıcı olarak silinecektir\. Onaylıyor musunuz\?/);
});

test("red: yayına alınmış veya silinmekte olan içerik karşı işlemden korunur", () => {
  assert.match(sql, /FROM public\.yayin_yonetimi[\s\S]*Yayına alınmış içerik bu işlemle silinemez/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF soru_seti_durum_id ON public\.yayin_yonetimi/);
  assert.match(sql, /FOR UPDATE OF t[\s\S]*Silme işlemi başlatılmış yayın adayı yayına alınamaz/);
  assert.match(yayinRoute, /yayin_oncesi_silme_durumu[\s\S]*yayına alınamaz/);
});
