import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("scripts/sql/eczanem_eclub_kontrollu_gecis.sql", "utf8");
const uttRoute = readFileSync("app/(panel)/eclub/listem/api/kisiler/route.ts", "utf8");
const musteriRoute = readFileSync("app/eczanem/api/eclub-gecisi/route.ts", "utf8");
const kart = readFileSync("app/eczanem/_components/EclubGecisKarti.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const girisRoute = readFileSync("app/eczanem/api/giris/sifre/route.ts", "utf8");

test("mutlu: müşteri kararı ve aynı Auth hesabıyla atomik E-Club geçişi birlikte kurulur", () => {
  assert.match(uttRoute, /rpc\("eczanem_eclub_gecis_talebi_olustur"/);
  assert.match(musteriRoute, /signInWithPassword/);
  assert.match(musteriRoute, /rpc\("eczanem_eclub_gecis_karar_ver"/);
  assert.match(kart, /Puanlarımı kullanacağım/);
  assert.match(kart, /Puanlarımdan vazgeçeceğim/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.eczanem_eclub_gecis_talepleri/);
  assert.match(sql, /DELETE FROM public\.eczanem_musteriler[\s\S]*INSERT INTO public\.eclub_kisiler/);
  assert.match(sql, /v_gecis\.auth_user_id\)/);
  assert.match(proxy, /pathname\.startsWith\("\/eczanem\/api\/eclub-gecisi"\)/);
  assert.match(girisRoute, /from\("eclub_kisiler"\)/);
  assert.match(girisRoute, /yonlendir: eclubAuthId \? "\/eclub\/panel" : "\/eczanem"/);
});

test("red: açık talep yeni kazanç/bağ üretmez, çift kimlik ve sessiz puan kaybı oluşamaz", () => {
  assert.match(sql, /trg_eczanem_eclub_gecis_puan_dondur/);
  assert.match(sql, /trg_eczanem_eclub_gecis_gonderim_dondur/);
  assert.match(sql, /trg_eczanem_eclub_gecis_uyelik_dondur/);
  assert.match(sql, /E-Club üyelik geçişiniz sürerken yeni puan kazanamazsınız/);
  assert.match(sql, /eczanem_eclub_puan_kapanislari/);
  assert.match(sql, /IF v_aktif_puan > 0/);
  assert.match(sql, /IF v_bekleyen > 0/);
  assert.match(musteriRoute, /vazgecme_onayi !== true/);
  const musteriDali = uttRoute.indexOf("if (musteriKontrol.musteri)");
  const authOlusturma = uttRoute.indexOf("auth.admin.createUser", musteriDali);
  assert.ok(musteriDali >= 0 && authOlusturma > musteriDali);
  assert.match(uttRoute.slice(musteriDali, authOlusturma), /return NextResponse\.json/);
});
