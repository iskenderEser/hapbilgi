import test from "node:test";
import assert from "node:assert/strict";
import { kursuYerlesimi } from "@/components/hbligi/league/kursuYerlesimi";
import type { SiraliSatir } from "@/components/hbligi/league/types";

function mockSatir(id: string, ad: string, puan: number, rank: number): SiraliSatir {
  return {
    kullanici_id: id,
    ad,
    bolge: "Marmara",
    takim: "Takım A",
    toplam_puan: puan,
    rank,
    degisim: null,
    liderlikSkoru: 80,
    izleme_puani: puan,
    cevaplama_puani: 0,
    oneri_puani: 0,
    extra_puani: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
  };
}

test("kursuYerlesimi: Normal durumda ilk 3 benzersiz şekilde kürsüye yerleşir", () => {
  const satirlar = [
    mockSatir("u1", "Ali Yılmaz", 500, 1),
    mockSatir("u2", "Burak Demir", 400, 2),
    mockSatir("u3", "Cem Kaya", 300, 3),
  ];

  const { lider, ikinci, ucuncu } = kursuYerlesimi(satirlar);

  assert.equal(lider?.kullanici_id, "u1");
  assert.equal(ikinci?.kullanici_id, "u2");
  assert.equal(ucuncu?.kullanici_id, "u3");
  assert.equal(lider?.rank, 1);
  assert.equal(ikinci?.rank, 2);
  assert.equal(ucuncu?.rank, 3);
});

test("kursuYerlesimi: 1.likte eşitlik olduğunda (1, 1, 2) aynı kullanıcı iki basamakta görünmez", () => {
  // Eski kodda find(r => r.rank === 2) 3. satırdaki u3'ü bulup 2. sıraya koyuyor,
  // sonra find(r => r.rank === 3) ?? top3[2] yine u3'ü 3. sıraya koyarak u3'ü iki basamakta gösteriyordu!
  const satirlar = [
    mockSatir("u1", "Ali Yılmaz", 500, 1),
    mockSatir("u2", "Berk Çelik", 500, 1),
    mockSatir("u3", "Can Özkan", 400, 2),
  ];

  const { lider, ikinci, ucuncu } = kursuYerlesimi(satirlar);

  assert.equal(lider?.kullanici_id, "u1");
  assert.equal(ikinci?.kullanici_id, "u2");
  assert.equal(ucuncu?.kullanici_id, "u3");

  // Hiçbir basamak aynı kullanıcıyı içermemeli
  const idler = [lider?.kullanici_id, ikinci?.kullanici_id, ucuncu?.kullanici_id];
  const tekilIdler = new Set(idler);
  assert.equal(tekilIdler.size, 3, "Tüm kürsü basamakları benzersiz yarışmacılardan oluşmalı");

  // Kullanıcıların orijinal eşit rank değerleri korunmalı
  assert.equal(lider?.rank, 1);
  assert.equal(ikinci?.rank, 1);
  assert.equal(ucuncu?.rank, 2);
});

test("kursuYerlesimi: 1.likte üçlü eşitlik olduğunda (1, 1, 1) üç farklı kişi basamaklara yerleşir", () => {
  const satirlar = [
    mockSatir("u1", "Ahmet Ak", 600, 1),
    mockSatir("u2", "Barış Bal", 600, 1),
    mockSatir("u3", "Caner Can", 600, 1),
  ];

  const { lider, ikinci, ucuncu } = kursuYerlesimi(satirlar);

  assert.equal(lider?.kullanici_id, "u1");
  assert.equal(ikinci?.kullanici_id, "u2");
  assert.equal(ucuncu?.kullanici_id, "u3");

  const idler = new Set([lider?.kullanici_id, ikinci?.kullanici_id, ucuncu?.kullanici_id]);
  assert.equal(idler.size, 3);
});

test("kursuYerlesimi: 2.likte eşitlik olduğunda (1, 2, 2) 2. ve 3. basamaklara farklı kişiler atanır", () => {
  const satirlar = [
    mockSatir("u1", "Lider Kişi", 800, 1),
    mockSatir("u2", "İkinci A", 500, 2),
    mockSatir("u3", "İkinci B", 500, 2),
  ];

  const { lider, ikinci, ucuncu } = kursuYerlesimi(satirlar);

  assert.equal(lider?.kullanici_id, "u1");
  assert.equal(ikinci?.kullanici_id, "u2");
  assert.equal(ucuncu?.kullanici_id, "u3");
  assert.notEqual(ikinci?.kullanici_id, ucuncu?.kullanici_id);
});

test("kursuYerlesimi: Eşit puan ve sırada Türkçe alfabetik sıralama deterministik çalışır", () => {
  const satirlar = [
    mockSatir("u2", "Zeynep Arslan", 500, 1),
    mockSatir("u1", "Ahmet Yılmaz", 500, 1),
  ];

  const { lider, ikinci, ucuncu } = kursuYerlesimi(satirlar);

  // Ahmet alfabetik olarak Zeynep'ten önce gelir
  assert.equal(lider?.kullanici_id, "u1");
  assert.equal(ikinci?.kullanici_id, "u2");
  assert.equal(ucuncu, null);
});

test("kursuYerlesimi: Eksik veri (0, 1, 2 kişi) durumunda basamaklar güvenli ve null döner", () => {
  assert.deepEqual(kursuYerlesimi([]), { lider: null, ikinci: null, ucuncu: null });
  assert.deepEqual(kursuYerlesimi(null), { lider: null, ikinci: null, ucuncu: null });

  const birKisi = [mockSatir("u1", "Tek Yarışmacı", 100, 1)];
  const sonuc1 = kursuYerlesimi(birKisi);
  assert.equal(sonuc1.lider?.kullanici_id, "u1");
  assert.equal(sonuc1.ikinci, null);
  assert.equal(sonuc1.ucuncu, null);

  const ikiKisi = [
    mockSatir("u1", "Birinci", 200, 1),
    mockSatir("u2", "İkinci", 100, 2),
  ];
  const sonuc2 = kursuYerlesimi(ikiKisi);
  assert.equal(sonuc2.lider?.kullanici_id, "u1");
  assert.equal(sonuc2.ikinci?.kullanici_id, "u2");
  assert.equal(sonuc2.ucuncu, null);
});

test("kursuYerlesimi: Girdide mükerrer kullanici_id gelirse kesin olarak tekilleştirilir", () => {
  const mukerrer = [
    mockSatir("u1", "Ali Yılmaz", 500, 1),
    mockSatir("u1", "Ali Yılmaz", 500, 1),
    mockSatir("u2", "Burak Demir", 400, 2),
  ];

  const { lider, ikinci, ucuncu } = kursuYerlesimi(mukerrer);

  assert.equal(lider?.kullanici_id, "u1");
  assert.equal(ikinci?.kullanici_id, "u2");
  assert.equal(ucuncu, null);
});
