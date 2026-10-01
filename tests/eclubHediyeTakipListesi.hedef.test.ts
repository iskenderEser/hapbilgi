import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cekTakipTeslimatKanaliniOzetle } from "@/lib/eclub/hediyeTakip/cekTakipListesi";

const liste = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipListesi.tsx", "utf8");
const kart = readFileSync("app/(panel)/eclub/hediye-takip/_components/CekTakipKarti.tsx", "utf8");
const istemci = readFileSync("app/(panel)/eclub/hediye-takip/_components/HediyeTakipIstemcisi.tsx", "utf8");
const api = readFileSync("app/(panel)/eclub/hediye-takip/api/cek-takip/route.ts", "utf8");
const okuyucu = readFileSync("lib/eclub/hediyeTakip/cekTakipListesi.ts", "utf8");

test("masaüstü liste kararlaştırılan sekiz başlığı taşır", () => {
  for (const baslik of ["Talep Tarihi", "Ürün / Koşul", "Eczane / Üye", "Kullanılan Puan", "Çek Tutarı", "Durum", "Teslimat", "İşlem"]) {
    assert.match(liste, new RegExp(`"${baslik}"`));
  }
  assert.match(liste, /hidden overflow-x-auto lg:block/);
});

test("mobil kart masaüstündeki teslimat ve çek ayrıntılarını kayıpsız gösterir", () => {
  assert.match(liste, /lg:hidden/);
  for (const alan of ["Talep Tarihi", "Çek Tutarı", "Eczane \/ Üye", "Kullanılan Puan", "İşlem", "Teslimat"]) {
    assert.match(kart, new RegExp(alan));
  }
  assert.match(kart, /E-posta:/);
  assert.match(kart, /Push:/);
  assert.match(kart, /Gönderim:/);
  assert.match(kart, /Kod:/);
});

test("ilk sayfa 30 kayıt ister ve daha fazla sonuç aynı listeye eklenir", () => {
  assert.match(istemci, /CEK_TAKIP_SAYFA_LIMITI/);
  assert.match(istemci, /sorguOlustur\(cekVerisi\.talepler\.length\)/);
  assert.match(istemci, /talepler: \[\.\.\.onceki\.talepler, \.\.\.sonraki\.talepler\]/);
  assert.match(liste, /Daha Fazla Göster/);
  assert.match(api, /cekTakipTalepleriniGetir/);
});

test("filtre değişimi sıfır ofsetli yeni istek açar ve eski isteğin sonucu uygulanmaz", () => {
  assert.match(istemci, /useCallback\(\(offset: number\)/);
  assert.match(istemci, /sorguOlustur\(0\)/);
  assert.match(istemci, /aktifIstek\.current\?\.abort\(\)/);
  assert.match(istemci, /sira !== istekSirasi\.current/);
});

test("liste sorgusu kapsamı, filtreleri, sıralamayı ve sayfalamayı uygular", () => {
  assert.match(okuyucu, /match\(cekTakipTalepKapsami\(kapsam\)\)/);
  assert.match(okuyucu, /filtreler\.eczane_id/);
  assert.match(okuyucu, /filtreler\.kisi_id/);
  assert.match(okuyucu, /filtreler\.urun_id/);
  assert.match(okuyucu, /filtreler\.durum/);
  assert.match(okuyucu, /filtreler\.baslangic/);
  assert.match(okuyucu, /filtreler\.bitis/);
  assert.match(okuyucu, /slice\(filtreler\.offset, filtreler\.offset \+ filtreler\.limit\)/);
  assert.match(okuyucu, /order\("created_at", \{ ascending: false \}\)/);
});

test("teslimat özeti çoklu push sonuçlarını korur", () => {
  assert.equal(cekTakipTeslimatKanaliniOzetle([]).durum, "yok");
  assert.equal(cekTakipTeslimatKanaliniOzetle(["tamamlandi", "tamamlandi"]).durum, "tamamlandi");
  const karma = cekTakipTeslimatKanaliniOzetle(["tamamlandi", "bekliyor", "basarisiz"]);
  assert.equal(karma.durum, "kismen_tamamlandi");
  assert.deepEqual({ toplam: karma.toplam, tamamlanan: karma.tamamlanan, bekliyor: karma.bekliyor, basarisiz: karma.basarisiz }, {
    toplam: 3,
    tamamlanan: 1,
    bekliyor: 1,
    basarisiz: 1,
  });
});
