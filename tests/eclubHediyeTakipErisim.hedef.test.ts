import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CEK_TAKIP_ROLLERI,
  cekTakipRoluneIzinVarMi,
  cekTakipTalepKapsami,
  type CekTakipKapsami,
} from "@/lib/eclub/hediyeTakip/cekTakipErisim";

const kaynak = readFileSync("lib/eclub/hediyeTakip/cekTakipErisim.ts", "utf8");

test("Çek Takip yalnız UTT ve KD_UTT rollerine açıktır", () => {
  assert.deepEqual(CEK_TAKIP_ROLLERI, ["utt", "kd_utt"]);
  assert.equal(cekTakipRoluneIzinVarMi("UTT"), true);
  assert.equal(cekTakipRoluneIzinVarMi("kd_utt"), true);
  assert.equal(cekTakipRoluneIzinVarMi("bm"), false);
  assert.equal(cekTakipRoluneIzinVarMi("eczaci"), false);
});

test("talep kapsamı firma ve oturumdaki UTT kimliğini birlikte zorunlu tutar", () => {
  const kapsam: CekTakipKapsami = {
    kullanici_id: "kullanici-1",
    utt_id: "kullanici-1",
    firma_id: "firma-1",
    rol: "utt",
  };

  assert.deepEqual(cekTakipTalepKapsami(kapsam), {
    firma_id: "firma-1",
    utt_id: "kullanici-1",
  });
});

test("sunucu kapsamı kullanıcı ve firma durumlarını güvenli kaynaktan doğrular", () => {
  assert.match(kaynak, /from\("kullanicilar"\)/);
  assert.match(kaynak, /eq\("kullanici_id", authUserId\)/);
  assert.match(kaynak, /kullanici\.aktif_mi !== true/);
  assert.match(kaynak, /from\("firmalar"\)/);
  assert.match(kaynak, /firma\.aktif !== true/);
  assert.match(kaynak, /firma\.eclub_aktif !== true/);
  assert.match(kaynak, /firma\.eclub_store_aktif !== true/);
});

test("UTT kapsam kimliği istemci girdisinden değil oturum kullanıcısından türetilir", () => {
  assert.match(kaynak, /utt_id: kullanici\.kullanici_id/);
  assert.doesNotMatch(kaynak, /searchParams/);
  assert.doesNotMatch(kaynak, /request\.json/);
});
