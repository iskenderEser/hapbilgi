import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  eclubRaporunuTopla,
  eclubLiginiOlustur,
  eclubTakimlarLiginiOlustur,
  type EclubRaporHamSatir,
  type EclubTakimGirdi,
} from "@/lib/eclub/rapor";

const oku = (yol: string) => readFileSync(yol, "utf8");

const migrationSql = oku("scripts/sql/eclub_lig_cekli_ceksiz_puan.sql");
const getUttRaporSql = oku("scripts/sql/get_eclub_utt_rapor.sql");

const satir = (degisiklik: Partial<EclubRaporHamSatir>): EclubRaporHamSatir => ({
  eczane_id: "eczane-1",
  gln: "1234567890123",
  eczane_adi: "Örnek Eczanesi",
  kisi_id: "kisi-1",
  kisi_ad: "Ahmet",
  kisi_soyad: "Yılmaz",
  kisi_rol: "eczaci",
  icerik_anahtari: "icerik-1",
  icerik_adi: "İçerik 1",
  gonderilen_sayisi: 1,
  tamamlanan_izleme: 1,
  dogru_cevap: 1,
  yanlis_cevap: 0,
  izleme_puani: 10,
  cevaplama_puani: 5,
  cekli_puan: 15,
  ceksiz_puan: 0,
  ...degisiklik,
});

test("Faz 5 Migration Sözleşmesi: get_eclub_utt_rapor fonksiyonu ve sütunları", () => {
  for (const sql of [migrationSql, getUttRaporSql]) {
    assert.match(sql, /DROP FUNCTION IF EXISTS public\.get_eclub_utt_rapor/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_eclub_utt_rapor/);
    assert.match(sql, /cekli_puan bigint/);
    assert.match(sql, /ceksiz_puan bigint/);
    assert.match(sql, /FILTER \(WHERE COALESCE\(kp\.cek_karsiligi_var_mi, true\) = true\)/);
    assert.match(sql, /FILTER \(WHERE kp\.cek_karsiligi_var_mi = false\)/);
    assert.match(sql, /COALESCE\(p\.cekli_puan, 0\)::bigint/);
    assert.match(sql, /COALESCE\(p\.ceksiz_puan, 0\)::bigint/);
  }
});

test("Hedef Test 1: Yalnız Çekli Puanı olan takımın toplamı doğru hesaplanır", () => {
  const takimGirdisi: EclubTakimGirdi = {
    utt_id: "utt-1",
    utt_adi: "Temsilci 1",
    takim_adi: "Çekli Takım",
    bolge_adi: "Marmara",
    satirlar: [
      satir({
        kisi_id: "kisi-1",
        izleme_puani: 50,
        cevaplama_puani: 20,
        cekli_puan: 70,
        ceksiz_puan: 0,
      }),
      satir({
        kisi_id: "kisi-2",
        izleme_puani: 30,
        cevaplama_puani: 0,
        cekli_puan: 30,
        ceksiz_puan: 0,
      }),
    ],
  };

  const lig = eclubTakimlarLiginiOlustur([takimGirdisi]);
  assert.equal(lig.length, 1);
  const t = lig[0];
  assert.equal(t.cekli_puan, 100);
  assert.equal(t.ceksiz_puan, 0);
  assert.equal(t.toplam_puan, 100);
  assert.equal(t.izleme_puani, 80);
  assert.equal(t.cevaplama_puani, 20);
});

test("Hedef Test 2: Yalnız Çeksiz Puanı olan takımın toplamı doğru hesaplanır", () => {
  const takimGirdisi: EclubTakimGirdi = {
    utt_id: "utt-2",
    utt_adi: "Temsilci 2",
    takim_adi: "Çeksiz Takım",
    bolge_adi: "Ege",
    satirlar: [
      satir({
        kisi_id: "kisi-3",
        izleme_puani: 40,
        cevaplama_puani: 10,
        cekli_puan: 0,
        ceksiz_puan: 50,
      }),
      satir({
        kisi_id: "kisi-4",
        izleme_puani: 30,
        cevaplama_puani: 0,
        cekli_puan: 0,
        ceksiz_puan: 30,
      }),
    ],
  };

  const lig = eclubTakimlarLiginiOlustur([takimGirdisi]);
  assert.equal(lig.length, 1);
  const t = lig[0];
  assert.equal(t.cekli_puan, 0);
  assert.equal(t.ceksiz_puan, 80);
  assert.equal(t.toplam_puan, 80);
  assert.equal(t.izleme_puani, 70);
  assert.equal(t.cevaplama_puani, 10);
});

test("Hedef Test 3: Karışık puanlı takımda toplam doğru hesaplanır", () => {
  const takimGirdisi: EclubTakimGirdi = {
    utt_id: "utt-3",
    utt_adi: "Temsilci 3",
    takim_adi: "Karışık Takım",
    bolge_adi: "İç Anadolu",
    satirlar: [
      // Çekli içerikten gelen puan
      satir({
        kisi_id: "kisi-5",
        icerik_anahtari: "icerik-cekli",
        izleme_puani: 50,
        cevaplama_puani: 10,
        cekli_puan: 60,
        ceksiz_puan: 0,
      }),
      // Çeksiz içerikten gelen puan
      satir({
        kisi_id: "kisi-5",
        icerik_anahtari: "icerik-ceksiz",
        izleme_puani: 30,
        cevaplama_puani: 10,
        cekli_puan: 0,
        ceksiz_puan: 40,
      }),
    ],
  };

  const lig = eclubTakimlarLiginiOlustur([takimGirdisi]);
  assert.equal(lig.length, 1);
  const t = lig[0];
  assert.equal(t.cekli_puan, 60);
  assert.equal(t.ceksiz_puan, 40);
  assert.equal(t.toplam_puan, 100);
  assert.equal(t.izleme_puani, 80);
  assert.equal(t.cevaplama_puani, 20);
});

test("Hedef Test 4: Çeksiz Puan lig sıralamasını etkiler", () => {
  // Takım A: Yalnız Çekli Puan kazanmış (Toplam: 50)
  const takimA: EclubTakimGirdi = {
    utt_id: "utt-a",
    utt_adi: "Temsilci A",
    takim_adi: "Takım A",
    bolge_adi: "Akdeniz",
    satirlar: [
      satir({
        kisi_id: "kisi-a",
        izleme_puani: 50,
        cevaplama_puani: 0,
        cekli_puan: 50,
        ceksiz_puan: 0,
        tamamlanan_izleme: 1,
      }),
    ],
  };

  // Takım B: Çekli 30 + Çeksiz 40 puan kazanmış (Toplam: 70)
  // Çeksiz puan sayesinde Takım B, Takım A'nın önüne geçmelidir!
  const takimB: EclubTakimGirdi = {
    utt_id: "utt-b",
    utt_adi: "Temsilci B",
    takim_adi: "Takım B",
    bolge_adi: "Karadeniz",
    satirlar: [
      satir({
        kisi_id: "kisi-b",
        izleme_puani: 60,
        cevaplama_puani: 10,
        cekli_puan: 30,
        ceksiz_puan: 40,
        tamamlanan_izleme: 1,
      }),
    ],
  };

  const lig = eclubTakimlarLiginiOlustur([takimA, takimB]);
  assert.equal(lig.length, 2);

  // 1. sırada Takım B olmalı
  assert.equal(lig[0].takim_adi, "Takım B");
  assert.equal(lig[0].toplam_puan, 70);
  assert.equal(lig[0].sira, 1);

  // 2. sırada Takım A olmalı
  assert.equal(lig[1].takim_adi, "Takım A");
  assert.equal(lig[1].toplam_puan, 50);
  assert.equal(lig[1].sira, 2);
});

test("Hedef Test 5: Çekli ve Çeksiz Puan toplamı genel toplamla eşittir (Tüm seviyelerde)", () => {
  const satirlar: EclubRaporHamSatir[] = [
    satir({
      eczane_id: "ecz-1",
      kisi_id: "k-1",
      icerik_anahtari: "i-1",
      izleme_puani: 20,
      cevaplama_puani: 10,
      cekli_puan: 30,
      ceksiz_puan: 0,
    }),
    satir({
      eczane_id: "ecz-1",
      kisi_id: "k-1",
      icerik_anahtari: "i-2",
      izleme_puani: 15,
      cevaplama_puani: 5,
      cekli_puan: 0,
      ceksiz_puan: 20,
    }),
    satir({
      eczane_id: "ecz-2",
      kisi_id: "k-2",
      icerik_anahtari: "i-1",
      izleme_puani: 40,
      cevaplama_puani: 10,
      cekli_puan: 35,
      ceksiz_puan: 15,
    }),
  ];

  // 1. Rapor toplamları
  const rapor = eclubRaporunuTopla(satirlar);
  assert.equal(rapor.ozet.toplam_puan, rapor.ozet.cekli_puan + rapor.ozet.ceksiz_puan);

  for (const eczane of rapor.eczaneler) {
    assert.equal(eczane.toplam_puan, eczane.cekli_puan + eczane.ceksiz_puan);
    for (const kisi of eczane.kisiler) {
      assert.equal(kisi.toplam_puan, kisi.cekli_puan + kisi.ceksiz_puan);
    }
  }
  for (const icerik of rapor.icerikler) {
    assert.equal(icerik.toplam_puan, icerik.cekli_puan + icerik.ceksiz_puan);
  }

  // 2. Kişi Ligi toplamları
  const kisiLigi = eclubLiginiOlustur(satirlar);
  for (const kisi of kisiLigi) {
    assert.equal(kisi.toplam_puan, kisi.cekli_puan + kisi.ceksiz_puan);
    for (const icerik of kisi.icerikler) {
      assert.equal(icerik.toplam_puan, icerik.cekli_puan + icerik.ceksiz_puan);
    }
  }

  // 3. Takım Ligi toplamları
  const takimLigi = eclubTakimlarLiginiOlustur([
    { utt_id: "utt-1", utt_adi: "Temsilci 1", takim_adi: "Takım 1", bolge_adi: "Bölge 1", satirlar },
  ]);
  for (const takim of takimLigi) {
    assert.equal(takim.toplam_puan, takim.cekli_puan + takim.ceksiz_puan);
  }
});

test("Hedef Test 6: Eşit puanlı takımların mevcut sıralama davranışı bozulmaz", () => {
  // İki takımın da toplam puanı 100
  // Takım 1: 5 tamamlanan izleme
  // Takım 2: 3 tamamlanan izleme
  const takim1: EclubTakimGirdi = {
    utt_id: "utt-1",
    utt_adi: "Temsilci 1",
    takim_adi: "Takım 1",
    bolge_adi: "Bölge 1",
    satirlar: [
      satir({
        kisi_id: "k-1",
        izleme_puani: 80,
        cevaplama_puani: 20,
        cekli_puan: 60,
        ceksiz_puan: 40,
        tamamlanan_izleme: 5,
      }),
    ],
  };

  const takim2: EclubTakimGirdi = {
    utt_id: "utt-2",
    utt_adi: "Temsilci 2",
    takim_adi: "Takım 2",
    bolge_adi: "Bölge 2",
    satirlar: [
      satir({
        kisi_id: "k-2",
        izleme_puani: 70,
        cevaplama_puani: 30,
        cekli_puan: 100,
        ceksiz_puan: 0,
        tamamlanan_izleme: 3,
      }),
    ],
  };

  const lig = eclubTakimlarLiginiOlustur([takim2, takim1]); // Karışık sıra ile veriyoruz
  assert.equal(lig.length, 2);

  // Eşit puan (100) oldukları için ikisinin de sırası 1 olmalı
  assert.equal(lig[0].toplam_puan, 100);
  assert.equal(lig[1].toplam_puan, 100);
  assert.equal(lig[0].sira, 1);
  assert.equal(lig[1].sira, 1);

  // Tie-breaker: tamamlanan_izleme (5 > 3), dolayısıyla Takım 1 dizide ilk sırada yer almalıdır
  assert.equal(lig[0].takim_adi, "Takım 1");
  assert.equal(lig[0].tamamlanan_izleme, 5);
  assert.equal(lig[1].takim_adi, "Takım 2");
  assert.equal(lig[1].tamamlanan_izleme, 3);
});
