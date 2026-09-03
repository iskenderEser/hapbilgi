import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const girisRoute = readFileSync("app/eczanem/api/giris/sifre/route.ts", "utf8");
const loginSayfasi = readFileSync("app/login/page.tsx", "utf8");

test("mutlu: aktif iç müşteri kayıtlı cep telefonuyla aynı Auth hesabına giriş yapar", () => {
  assert.match(girisRoute, /from\("kullanicilar"\)[\s\S]*select\("kullanici_id, aktif_mi"\)[\s\S]*eq\("telefon", telefon\)/);
  assert.match(girisRoute, /authId: icKullanici\.kullanici_id/);
  assert.match(girisRoute, /aktifMi: icKullanici\.aktif_mi === true/);
  assert.match(girisRoute, /getUserById\(kimlik\.authId\)/);
  assert.match(girisRoute, /signInWithPassword\([\s\S]*email: authData\.user\.email/);
  assert.match(girisRoute, /kimlik\.kimlikTuru === "ic_kullanici"[\s\S]*"\/login"/);
  assert.match(loginSayfasi, /window\.location\.href = data\.yonlendir \?\? "\/login"/);
});

test("red: bulunmayan, pasif veya birden fazla düzlemde bulunan telefon giriş açamaz", () => {
  assert.match(girisRoute, /const adaylar = \[/);
  assert.match(girisRoute, /adaylar\.length !== 1 \|\| !adaylar\[0\]\.aktifMi/);
  assert.match(girisRoute, /Telefon veya şifre hatalı\./);
  assert.doesNotMatch(girisRoute, /return NextResponse\.json\([^\n]*authData\.user\.email/);
});
