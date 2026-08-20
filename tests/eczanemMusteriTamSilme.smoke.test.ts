import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/eczanem/api/hesabimi-sil/route.ts", "utf8");
const silme = readFileSync("lib/eczanem/silme.ts", "utf8");
const sayfa = readFileSync("app/eczanem/page.tsx", "utf8");

test("mutlu: müşteri modal ve şifre teyidiyle bütün hesap zincirini siler", () => {
  assert.match(sayfa, /Hesabınızı silmek istediğinize emin misiniz\?/);
  assert.match(sayfa, /Evet, hesabımı sil/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /await musteriTamSil/);
  assert.match(silme, /rpc\("eczanem_musteri_kendini_tam_sil"/);
  assert.match(silme, /p_musteri_id: kimlik\.musteri_id/);
  assert.match(silme, /p_auth_user_id: kimlik\.auth_user_id/);
  const sql = readFileSync("scripts/sql/eczanem_musteri_kendini_atomik_sil.sql", "utf8");
  for (const tablo of [
    "eczanem_harcama_kayitlari",
    "eczanem_puan_kayitlari",
    "eczanem_izleme_kayitlari",
    "eczanem_siparisler",
    "eczanem_gonderimler",
    "eczanem_uyelikler",
    "eczanem_silinen_musteriler",
    "push_abonelikleri",
    "push_gonderim_kayitlari",
    "eczanem_musteriler",
  ]) assert.match(sql, new RegExp(`(?:public\.)?${tablo}`));
  assert.match(sql, /DELETE FROM auth\.users/);
});

test("red: kimlik istemciden alınmaz, şifresiz ve müşteri olmayan hesap silinmez", () => {
  assert.doesNotMatch(route, /body\?\.musteri_id/);
  assert.match(route, /if \(!sifre\) return validasyonHatasi/);
  assert.match(route, /if \(rol !== MUSTERI_ROLU\) return rolHatasi/);
  assert.doesNotMatch(silme, /\.from\([^)]*\)\.delete|auth\.admin\.deleteUser/);
  assert.doesNotMatch(silme, /eczanem_silinen_musteriler[\s\S]{0,120}insert/);
  assert.doesNotMatch(silme, /musteri_etiket/);
});
