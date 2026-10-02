import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const incelemeApi = readFileSync("app/(panel)/eclub/oneriler/api/inceleme/route.ts", "utf8");
const incelemeIstemcisi = readFileSync("components/eclub/UttGonderimIncelemesi.tsx", "utf8");
const eczanemSql = readFileSync("scripts/sql/eczanem_utt_gonderim_oncesi_inceleme.sql", "utf8");

test("Eczanem incelemesi firma/takım/hedef kapsamını ve E-Club ile aynı dört tamamlama koşulunu kullanır", () => {
  assert.match(incelemeApi, /body\.kanal === "eczanem"/);
  assert.match(incelemeApi, /uttEczanemErisimi\(db, user\.id\)/);
  assert.match(incelemeApi, /erisim\.firmaIdler\.includes\(detay\.firma_id\)/);
  assert.match(incelemeApi, /detay\.takim_id !== erisim\.takimId/);
  assert.match(incelemeApi, /detay\.hedef_roller\?\.includes\("eczanem"\)/);
  assert.match(incelemeApi, /dogrulanan >= sure \* 0\.9/);
  assert.match(incelemeApi, /dogrulanan >= 3/);
  assert.match(incelemeApi, /Number\(sureler\[String\(i \+ 1\)\] \?\? 0\) >= 2/);
  assert.match(incelemeApi, /body\.sekme_aktif !== true/);
  assert.match(incelemeIstemcisi, /Soru ve puan yoktur/);
});

test("Eczanem gönderim kaydı doğrudan yazılsa da geçerli tur incelemesi gerekir", () => {
  assert.match(eczanemSql, /BEFORE INSERT ON public\.eczanem_eczane_gonderimleri/);
  assert.match(eczanemSql, /i\.utt_id = NEW\.gonderen_utt_id/);
  assert.match(eczanemSql, /i\.arac_id = v_arac_id/);
  assert.match(eczanemSql, /i\.tamamlandi_at >= v_tur/);
});
