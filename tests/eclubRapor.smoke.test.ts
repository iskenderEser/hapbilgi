import test from "node:test";
import assert from "node:assert/strict";

import { eclubLiginiOlustur, eclubRaporunuTopla, type EclubRaporHamSatir } from "@/lib/eclub/rapor";

const satir = (degisiklik: Partial<EclubRaporHamSatir>): EclubRaporHamSatir => ({
  eczane_id: "eczane-1",
  gln: "1234567890123",
  eczane_adi: "Örnek Eczanesi",
  kisi_id: "kisi-1",
  kisi_ad: "Ayşe",
  kisi_soyad: "Yılmaz",
  kisi_rol: "eczaci",
  icerik_anahtari: "urun-1",
  icerik_adi: "Ürün A",
  gonderilen_sayisi: 1,
  tamamlanan_izleme: 1,
  dogru_cevap: 2,
  yanlis_cevap: 1,
  izleme_puani: 10,
  cevaplama_puani: 4,
  ...degisiklik,
});

test("mutlu: içerik satırlarını eczane ve kişi düzeyinde kayıpsız toplar", () => {
  const sonuc = eclubRaporunuTopla([
    satir({}),
    satir({ icerik_anahtari: "urun-2", icerik_adi: "Ürün B", gonderilen_sayisi: "2", tamamlanan_izleme: "1" }),
  ]);

  assert.equal(sonuc.ozet.aktif_eczane, 1);
  assert.equal(sonuc.ozet.aktif_kisi, 1);
  assert.equal(sonuc.ozet.gonderilen_sayisi, 3);
  assert.equal(sonuc.eczaneler[0].kisiler[0].tamamlanan_izleme, 2);
  assert.equal(sonuc.icerikler.length, 2);
});

test("sınır: kişisiz eczaneyi gösterir ve oranlarda sıfıra bölmez", () => {
  const sonuc = eclubRaporunuTopla([satir({
    kisi_id: null,
    kisi_ad: null,
    kisi_soyad: null,
    kisi_rol: null,
    icerik_anahtari: null,
    icerik_adi: null,
    gonderilen_sayisi: 0,
    tamamlanan_izleme: 0,
    dogru_cevap: 0,
    yanlis_cevap: 0,
    izleme_puani: 0,
    cevaplama_puani: 0,
  })]);

  assert.equal(sonuc.eczaneler.length, 1);
  assert.equal(sonuc.eczaneler[0].kisiler.length, 0);
  assert.equal(sonuc.ozet.katilim_orani, 0);
  assert.equal(sonuc.ozet.dogru_cevap_orani, 0);
});

test("lig: aynı eczanedeki teknisyenleri gerçek kişi kimlikleriyle ayrı sıralar", () => {
  const lig = eclubLiginiOlustur([
    satir({ kisi_id: "tek-1", kisi_ad: "Deniz", kisi_soyad: "A", kisi_rol: "eczane_teknisyeni", izleme_puani: 10, cevaplama_puani: 0 }),
    satir({ kisi_id: "tek-2", kisi_ad: "Ece", kisi_soyad: "B", kisi_rol: "eczane_teknisyeni", izleme_puani: 20, cevaplama_puani: 5 }),
  ]);

  assert.equal(lig.length, 2);
  assert.equal(lig[0].kisi_id, "tek-2");
  assert.equal(lig[0].sira, 1);
  assert.equal(lig[1].kisi_id, "tek-1");
  assert.equal(lig[1].sira, 2);
});

test("lig sınırı: puan kazanmayan üyeye yapay sıra vermez", () => {
  const lig = eclubLiginiOlustur([satir({
    izleme_puani: 0,
    cevaplama_puani: 0,
    tamamlanan_izleme: 0,
    dogru_cevap: 0,
    yanlis_cevap: 0,
  })]);

  assert.equal(lig[0].sira, 0);
});
