// C-Club işlemlerinin doğrulanmış oturum ve kapalı DB yüzeyi sözleşmesini korur.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baslatRoute = readFileSync("app/(panel)/challenge-club/izle/api/baslat/route.ts", "utf8");
const guvenlikSql = readFileSync("scripts/sql/cc_yetkilendirme_guvenligi.sql", "utf8");

test("mutlu: CC izleme kimliği oturumdan alınır ve firma erişimi doğrulanır", () => {
  assert.match(baslatRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(baslatRoute, /\.eq\("kullanici_id", user\.id\)/);
  assert.match(baslatRoute, /!bmFirma\.aktif \|\| !bmFirma\.cc_aktif/);
  assert.match(baslatRoute, /yayin\.firma_id !== bmKullanici\.firma_id/);
  assert.match(baslatRoute, /bm_id: user\.id/);
});

test("ret: tarayıcı C-Club tablolarına ve yazma RPC'lerine doğrudan erişemez", () => {
  assert.match(guvenlikSql, /ALTER TABLE public\.cc_izleme_kayitlari ENABLE ROW LEVEL SECURITY/);
  assert.match(guvenlikSql, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(guvenlikSql, /REVOKE ALL ON FUNCTION public\.cc_challenge_gonder[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(guvenlikSql, /REVOKE ALL ON FUNCTION public\.cc_izleme_tamamla[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(guvenlikSql, /REVOKE ALL ON FUNCTION public\.cc_cevaplari_kaydet[\s\S]*FROM PUBLIC, anon, authenticated/);
});
