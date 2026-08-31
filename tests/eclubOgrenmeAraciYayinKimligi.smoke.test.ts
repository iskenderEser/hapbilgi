import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const katalog = oku("app/(panel)/eclub/oneriler/api/yayinlar/route.ts");
const oneriApi = oku("app/(panel)/eclub/oneriler/api/route.ts");
const oneriTipleri = oku("app/(panel)/eclub/oneriler/_types.ts");
const baslat = oku("app/(panel)/eclub/panel/api/baslat/route.ts");
const ileriSarma = oku("app/(panel)/eclub/panel/api/ileri-sarma/route.ts");
const kimlikMigration = oku("scripts/sql/eclub_ogrenme_araci_yayin_kimligi.sql");
const tamamlamaMigration = oku("scripts/sql/eclub_ogrenme_araci_tamamlama.sql");
const aracErisimi = oku("app/api/ogrenme-araclari/[arac_id]/erisim/route.ts");

test("E-Club öneri kataloğu legacy video zinciri olmadan ortak araç kimliğini döndürür", () => {
  assert.match(katalog, /arac_id: yayin\.arac_id!/);
  assert.match(katalog, /arac_turu: yayin\.arac_turu!/);
  assert.doesNotMatch(katalog, /\.from\("video_durumu"\)|video_durum_id|video_id/);
  assert.match(oneriTipleri, /arac_id: string/);
  assert.match(oneriTipleri, /arac_turu: OgrenmeAraciTuru/);
});

test("E-Club atomik öneri akışı tekrar kuralını arac_id ekseninde uygular", () => {
  assert.match(oneriApi, /oneri_id, yayin_id, arac_id, arac_turu/);
  assert.match(oneriApi, /p_arac_id: yayin\.arac_id/);
  assert.doesNotMatch(oneriApi, /p_video_id|\.from\("video_durumu"\)/);
  assert.match(kimlikMigration, /ADD COLUMN IF NOT EXISTS arac_id uuid/);
  assert.match(kimlikMigration, /ALTER COLUMN video_id DROP NOT NULL/);
  assert.match(kimlikMigration, /AND o\.arac_id = p_arac_id/);
  assert.match(kimlikMigration, /FOREIGN KEY \(arac_id\)[\s\S]*REFERENCES public\.ogrenme_araclari\(arac_id\)/);
});

test("E-Club izleme ve tamamlama dört araç türünü ortak kanıtla doğrular", () => {
  assert.match(baslat, /arac_turu: yayin\.arac_turu/);
  assert.doesNotMatch(ileriSarma, /\.from\("video_durumu"\)|\.from\("videolar"\)/);
  for (const tur of ["video", "podcast", "gorsel", "flip_pdf"]) {
    assert.match(tamamlamaMigration, new RegExp(`v_arac_turu = '${tur}'`));
  }
  assert.match(tamamlamaMigration, /v_izleme\.tamamlama_kaniti/);
  assert.match(tamamlamaMigration, /vyd\.ogrenme_araci_puani/);
  assert.match(tamamlamaMigration, /soru_erisimi_acik_mi = v_pencere_acik/);
  const rpcGovdesi = tamamlamaMigration.split("CREATE OR REPLACE FUNCTION public.eclub_izleme_tamamla")[1]?.split("REVOKE ALL ON FUNCTION")[0] ?? "";
  assert.doesNotMatch(rpcGovdesi, /JOIN public\.video_durumu|JOIN public\.videolar/i);
});

test("UTT ve KD_UTT kendi kapsamındaki E-Club öğrenme aracını salt önizleyebilir", () => {
  assert.match(aracErisimi, /const eclubSaltOnizleme = TUKETICI_ROLLER\.includes\(rol\)/);
  assert.match(aracErisimi, /ECLUB_HEDEF_ROLLER\.some/);
  assert.match(aracErisimi, /detay\.firma_id === kullanici\.firma_id/);
  assert.match(aracErisimi, /detay\.takim_id === null \|\| detay\.takim_id === kullanici\.takim_id/);
});
