import assert from "node:assert/strict";
import test from "node:test";
import { anaYuklemeBaginiDogrula, iuOgrenmeAraciGorevYetkisiniDogrula } from "../lib/ogrenmeAraci/yetki.ts";
import { readFileSync } from "node:fs";

type Gorev = {
  gorev_id: string;
  talep_id: string;
  asama: string;
  durum: string;
  atanan_iu_id: string;
  arac_id: string | null;
};

function dbOlustur(gorev: Gorev | null) {
  const zincir = {
    select: () => zincir,
    eq: () => zincir,
    maybeSingle: async () => ({ data: gorev, error: null }),
  };
  return { from: () => zincir } as never;
}

const temelGorev: Gorev = {
  gorev_id: "gorev-1",
  talep_id: "talep-1",
  asama: "video",
  durum: "hazirlaniyor",
  atanan_iu_id: "iu-1",
  arac_id: null,
};

test("İÜ görevi kullanıcı, talep, aşama ve aktif durumla birlikte doğrulanır", async () => {
  const sonuc = await iuOgrenmeAraciGorevYetkisiniDogrula({
    db: dbOlustur(temelGorev), gorevId: "gorev-1", talepId: "talep-1", kullaniciId: "iu-1",
  });
  assert.equal(sonuc.ok, true);

  for (const degisiklik of [
    { atanan_iu_id: "iu-baska" },
    { talep_id: "talep-baska" },
    { asama: "soru" },
    { durum: "inceleme_bekliyor" },
  ]) {
    const hatali = await iuOgrenmeAraciGorevYetkisiniDogrula({
      db: dbOlustur({ ...temelGorev, ...degisiklik }),
      gorevId: "gorev-1", talepId: "talep-1", kullaniciId: "iu-1",
    });
    assert.equal(hatali.ok, false);
  }
});

test("mevcut araca bağlı görev farklı araçla kullanılamaz", async () => {
  const dogru = await iuOgrenmeAraciGorevYetkisiniDogrula({
    db: dbOlustur({ ...temelGorev, durum: "revizyon_bekliyor", arac_id: "arac-1" }),
    gorevId: "gorev-1", talepId: "talep-1", kullaniciId: "iu-1", aracId: "arac-1",
  });
  assert.equal(dogru.ok, true);

  const yanlis = await iuOgrenmeAraciGorevYetkisiniDogrula({
    db: dbOlustur({ ...temelGorev, durum: "revizyon_bekliyor", arac_id: "arac-1" }),
    gorevId: "gorev-1", talepId: "talep-1", kullaniciId: "iu-1", aracId: "arac-2",
  });
  assert.equal(yanlis.ok, false);
});

test("görev kimliği bulunmayan İÜ yüklemesi reddedilir", async () => {
  const sonuc = await iuOgrenmeAraciGorevYetkisiniDogrula({
    db: dbOlustur(temelGorev), gorevId: null, talepId: "talep-1", kullaniciId: "iu-1",
  });
  assert.deepEqual(sonuc, {
    ok: false,
    status: 422,
    hata: "İçerik üreticisi yüklemesi için görev kimliği zorunludur.",
  });
});

test("ana yükleme göreve ve benzersiz girişime bağlanır", () => {
  const baslat = readFileSync(new URL("../app/api/ogrenme-araclari/yukleme-baslat/route.ts", import.meta.url), "utf8");
  const tamamla = readFileSync(new URL("../app/api/ogrenme-araclari/yukleme-tamamla/route.ts", import.meta.url), "utf8");
  const istemci = readFileSync(new URL("../lib/ogrenmeAraci/bunnyYuklemeIstemci.ts", import.meta.url), "utf8");
  assert.match(baslat, /iuOgrenmeAraciGorevYetkisiniDogrula/);
  assert.match(baslat, /yukleme_girisimi_id: yuklemeGirisimiId/);
  assert.match(tamamla, /anaYuklemeBaginiDogrula/);
  assert.match(istemci, /gorev_id: girdi\.gorevId \?\? null/);
  assert.match(istemci, /yukleme_girisimi_id: baslangic\.yukleme_girisimi_id/);
});

test("gecikmiş girişim ve yanlış görev bağı davranışsal olarak reddedilir", () => {
  assert.deepEqual(anaYuklemeBaginiDogrula({
    kaynak: "iu", beyanGorevId: "gorev-1", istekGorevId: "gorev-2",
    beyanGirisimId: "girisim-1", istekGirisimId: "girisim-1",
  }), { ok: false, status: 409, hata: "Yükleme girişimi ile görev eşleşmiyor." });
  assert.deepEqual(anaYuklemeBaginiDogrula({
    kaynak: "iu", beyanGorevId: "gorev-1", istekGorevId: "gorev-1",
    beyanGirisimId: "girisim-yeni", istekGirisimId: "girisim-eski",
  }), { ok: false, status: 409, hata: "Yükleme girişimi güncel değil." });
  assert.deepEqual(anaYuklemeBaginiDogrula({
    kaynak: "iu", beyanGorevId: "gorev-1", istekGorevId: "gorev-1",
    beyanGirisimId: "girisim-1", istekGirisimId: "girisim-1",
  }), { ok: true });
});
