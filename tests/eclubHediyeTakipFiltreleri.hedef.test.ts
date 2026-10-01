import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cekTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/cekTakipFiltreleri";

const secenekKaynagi = readFileSync("lib/eclub/hediyeTakip/cekTakipFiltreSecenekleri.ts", "utf8");
const filtreArayuzu = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipFiltreleri.tsx", "utf8");
const apiKaynagi = readFileSync("app/(panel)/eclub/hediye-takip/api/cek-takip/route.ts", "utf8");

test("boş sorgu güvenli varsayılan filtreleri ve 30 kayıt sınırını üretir", () => {
  const sonuc = cekTakipFiltreleriniParseEt(new URLSearchParams());
  assert.equal(sonuc.ok, true);
  if (!sonuc.ok) return;
  assert.deepEqual(sonuc.filtreler, {
    eczane_id: null,
    kisi_id: null,
    urun_id: null,
    durum: null,
    baslangic: null,
    bitis: null,
    offset: 0,
    limit: 30,
  });
});

test("geçerli filtreler kayıpsız ayrıştırılır", () => {
  const sorgu = new URLSearchParams({
    eczane_id: "123e4567-e89b-42d3-a456-426614174000",
    kisi_id: "223e4567-e89b-42d3-a456-426614174000",
    urun_id: "323e4567-e89b-42d3-a456-426614174000",
    durum: "bm_onayinda",
    baslangic: "2026-09-01",
    bitis: "2026-09-30",
    offset: "30",
    limit: "30",
  });
  const sonuc = cekTakipFiltreleriniParseEt(sorgu);
  assert.equal(sonuc.ok, true);
  if (!sonuc.ok) return;
  assert.equal(sonuc.filtreler.durum, "bm_onayinda");
  assert.equal(sonuc.filtreler.baslangic, "2026-09-01");
  assert.equal(sonuc.filtreler.offset, 30);
});

test("geçersiz kimlik, durum, tarih sırası ve sayfalama reddedilir", () => {
  for (const sorgu of [
    "eczane_id=yanlis",
    "durum=bilinmeyen",
    "baslangic=2026-10-02&bitis=2026-10-01",
    "offset=-1",
    "limit=101",
  ]) {
    assert.equal(cekTakipFiltreleriniParseEt(new URLSearchParams(sorgu)).ok, false, sorgu);
  }
});

test("filtre seçenekleri 5. adımdaki firma ve UTT kapsamından çıkarılır", () => {
  assert.match(secenekKaynagi, /from\("eclub_store_cek_talepleri"\)/);
  assert.match(secenekKaynagi, /match\(cekTakipTalepKapsami\(kapsam\)\)/);
  assert.doesNotMatch(secenekKaynagi, /searchParams/);
});

test("Çek Takibi arayüzü altı kararlaştırılmış filtreyi gösterir", () => {
  for (const etiket of ["Eczane", "Üye", "Ürün", "Durum", "Başlangıç", "Bitiş"]) {
    assert.match(filtreArayuzu, new RegExp(`>\\s*${etiket}\\s*<`));
  }
  assert.match(filtreArayuzu, /Filtreleri temizle/);
});

test("Çek Takibi API'si rol kapsamı, statlar ve filtre seçeneklerini birlikte kurar", () => {
  assert.match(apiKaynagi, /cekTakipKapsaminiCoz/);
  assert.match(apiKaynagi, /cekTakipStatlariniGetir/);
  assert.match(apiKaynagi, /cekTakipFiltreSecenekleriniGetir/);
  assert.match(apiKaynagi, /cekTakipFiltreleriniParseEt/);
});
