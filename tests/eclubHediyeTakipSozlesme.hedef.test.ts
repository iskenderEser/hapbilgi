import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CEK_TAKIP_ISLEMLERI,
  CEK_TAKIP_SAYFA_LIMITI,
  CEK_TAKIP_TESLIMAT_DURUMLARI,
  type CekTakipApiYaniti,
} from "@/lib/eclub/hediyeTakip/cekTakip";

const kaynak = readFileSync("lib/eclub/hediyeTakip/cekTakip.ts", "utf8");

test("Çek Takip yanıtı stat, filtre, talep ve sayfalama bölümlerini zorunlu tutar", () => {
  const ornek: CekTakipApiYaniti = {
    statlar: { toplam: 0, onay_surecinde: 0, teslimat_surecinde: 0, tamamlanan: 0 },
    filtre_secenekleri: { eczaneler: [], uyeler: [], urunler: [] },
    talepler: [],
    sayfalama: { toplam: 0, offset: 0, limit: CEK_TAKIP_SAYFA_LIMITI, sonraki_kayit_var_mi: false },
  };

  assert.equal(ornek.sayfalama.limit, 30);
  assert.deepEqual(Object.keys(ornek.statlar), ["toplam", "onay_surecinde", "teslimat_surecinde", "tamamlanan"]);
});

test("Çek Takip işlemleri mevcut UTT, BM ve TM onay zincirini tanımlar", () => {
  assert.deepEqual(CEK_TAKIP_ISLEMLERI, ["bm_onayina_gonder", "bm_onayla", "tm_onayla"]);
});

test("teslimat sözleşmesi çoklu push sonucunu ve kanal sayaçlarını kayıpsız taşır", () => {
  assert.deepEqual(CEK_TAKIP_TESLIMAT_DURUMLARI, [
    "yok", "bekliyor", "isleniyor", "kismen_tamamlandi", "tamamlandi", "basarisiz",
  ]);
  assert.match(kaynak, /eposta: CekTakipTeslimatKanali/);
  assert.match(kaynak, /push: CekTakipTeslimatKanali/);
  for (const alan of ["toplam", "bekliyor", "isleniyor", "tamamlanan", "basarisiz"]) {
    assert.match(kaynak, new RegExp(`${alan}: number`));
  }
});

test("talep satırı kimlik, ödül koşulu, onay, çek ve izinli işlem alanlarını birlikte taşır", () => {
  for (const alan of ["eczane", "uye", "urun", "odul_kosulu", "puan", "cek", "onay", "teslimat", "izin_verilen_islemler"]) {
    assert.match(kaynak, new RegExp(`${alan}:`));
  }
});
