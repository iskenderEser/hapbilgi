import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cekTakipIzinVerilenIslemler } from "@/lib/eclub/hediyeTakip/cekTakipListesi";
import type { CekTakipKapsami } from "@/lib/eclub/hediyeTakip/cekTakipErisim";

const kapsam: CekTakipKapsami = {
  kullanici_id: "utt-1",
  utt_id: "utt-1",
  firma_id: "firma-1",
  rol: "utt",
};
const okuyucu = readFileSync("lib/eclub/hediyeTakip/cekTakipListesi.ts", "utf8");
const islemRotasi = readFileSync("app/(panel)/eclub/hediye-takip/api/cek-takip/[talepId]/route.ts", "utf8");
const kart = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipKarti.tsx", "utf8");
const istemci = readFileSync("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx", "utf8");

test("yalnız oturumdaki UTT'nin bekleyen talebi BM onayına gönderilebilir", () => {
  assert.deepEqual(cekTakipIzinVerilenIslemler(kapsam, { durum: "beklemede", utt_id: "utt-1" }), ["bm_onayina_gonder"]);
  assert.deepEqual(cekTakipIzinVerilenIslemler(kapsam, { durum: "bm_onayinda", utt_id: "utt-1" }), []);
  assert.deepEqual(cekTakipIzinVerilenIslemler(kapsam, { durum: "beklemede", utt_id: "utt-2" }), []);
  assert.match(okuyucu, /izin_verilen_islemler: cekTakipIzinVerilenIslemler\(kapsam, talep\)/);
});

test("arayüz işlemi yalnız API'nin izin listesinde olduğunda gösterir", () => {
  assert.match(kart, /izin_verilen_islemler\.includes\("bm_onayina_gonder"\)/);
  assert.match(kart, /BM Onayına Gönder/);
  assert.match(kart, /disabled=\{islemde\}/);
  assert.match(kart, /Gönderiliyor\.\.\./);
});

test("tekil işlem rotası oturumu, firma ve UTT kapsamını ve güncel durumu yeniden doğrular", () => {
  assert.match(islemRotasi, /auth\.getUser\(\)/);
  assert.match(islemRotasi, /cekTakipKapsaminiCoz/);
  assert.match(islemRotasi, /match\(cekTakipTalepKapsami\(erisim\.kapsam\)\)/);
  assert.match(islemRotasi, /talep\.durum !== "beklemede"/);
  assert.match(islemRotasi, /body\?\.islem !== "bm_onayina_gonder"/);
});

test("RPC yalnız tek talep kimliği ve oturumdaki UTT kimliğiyle çağrılır", () => {
  assert.match(islemRotasi, /rpc\("eclub_store_bm_onayina_gonder"/);
  assert.match(islemRotasi, /p_utt_id: erisim\.kapsam\.utt_id/);
  assert.match(islemRotasi, /p_talep_idler: \[talepId\]/);
  assert.match(islemRotasi, /guncellenenAdet !== 1/);
});

test("başarılı işlemden sonra liste sunucudan yeniden yüklenir", () => {
  assert.match(istemci, /method: "POST"/);
  assert.match(istemci, /body: JSON\.stringify\(\{ islem \}\)/);
  assert.match(istemci, /setYenilemeAnahtari\(\(deger\) => deger \+ 1\)/);
  assert.match(istemci, /setIslemdekiTalepId\(null\)/);
});
