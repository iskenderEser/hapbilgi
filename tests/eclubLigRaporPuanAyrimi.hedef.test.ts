import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eclubRaporunuTopla, type EclubRaporHamSatir } from "@/lib/eclub/rapor";

const oku = (yol: string) => readFileSync(yol, "utf8");

const satir = (degisiklik: Partial<EclubRaporHamSatir> = {}): EclubRaporHamSatir => ({
  eczane_id: "eczane-1",
  gln: "1234567890123",
  eczane_adi: "Örnek Eczanesi",
  kisi_id: "kisi-1",
  kisi_ad: "Ayşe",
  kisi_soyad: "Yılmaz",
  kisi_rol: "eczaci",
  icerik_anahtari: "icerik-1",
  icerik_adi: "İçerik 1",
  gonderilen_sayisi: 1,
  tamamlanan_izleme: 1,
  dogru_cevap: 1,
  yanlis_cevap: 0,
  izleme_puani: 100,
  cevaplama_puani: 20,
  cekli_puan: 70,
  ceksiz_puan: 50,
  ...degisiklik,
});

test("lig puanı çekli ve çeksiz performans puanlarının toplamıdır", () => {
  const rapor = eclubRaporunuTopla([satir()]);
  assert.equal(rapor.ozet.cekli_puan, 70);
  assert.equal(rapor.ozet.ceksiz_puan, 50);
  assert.equal(rapor.ozet.toplam_puan, 120);
});

test("çekli/çeksiz ayrımı eksikse geçmiş veri varsayımı yapılmaz", () => {
  assert.throws(
    () => eclubRaporunuTopla([satir({ cekli_puan: null as never })]),
    /E-Club rapor sözleşmesi eksik: cekli_puan/,
  );
  assert.throws(
    () => eclubRaporunuTopla([satir({ ceksiz_puan: null as never })]),
    /E-Club rapor sözleşmesi eksik: ceksiz_puan/,
  );
});

test("lig ve Excel çıktısı üç puan değerini açıkça adlandırır", () => {
  const lig = oku("app/(panel)/eclub/ligi/page.tsx");
  const excel = oku("app/(panel)/eclub/ligi/api/export/route.ts");

  for (const etiket of ["Çekli Puan", "Çeksiz Puan", "Lig Puanı"]) {
    assert.match(lig, new RegExp(etiket));
    assert.match(excel, new RegExp(etiket));
  }
});
