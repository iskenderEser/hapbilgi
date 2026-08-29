import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oku = (yol: string) => readFileSync(yol, "utf8");
const migration = oku("scripts/sql/pm09_eczanem_yayin_durdurma_kapisi.sql");
const utt = oku("scripts/sql/eczanem_utt_gonderim_atomik.sql");
const eczane = oku("scripts/sql/eczanem_eczane_yonetim_paketi.sql");
const gecis = oku("scripts/sql/eczanem_eclub_kontrollu_gecis.sql");

test("iki Eczanem gönderim RPC'si yayın satırını kilitleyip aktifliği doğrular", () => {
  assert.match(migration, /eczanem_utt_eczaneye_gonder[\s\S]*?FROM public\.yayin_yonetimi[\s\S]*?FOR UPDATE[\s\S]*?v_yayin_durum IS DISTINCT FROM 'yayinda'/);
  assert.match(migration, /eczanem_musterilere_video_gonder[\s\S]*?FROM public\.yayin_yonetimi[\s\S]*?FOR UPDATE[\s\S]*?v_yayin_durum IS DISTINCT FROM 'yayinda'/);
});

test("kalıcı kaynak paketleri PM09 yayın kapısını korur", () => {
  for (const kaynak of [utt, eczane, gecis]) {
    assert.match(kaynak, /FROM public\.yayin_yonetimi/);
    assert.match(kaynak, /FOR UPDATE/);
  }
});
