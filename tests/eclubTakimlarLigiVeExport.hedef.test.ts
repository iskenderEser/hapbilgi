import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  eclubTakimlarLiginiOlustur,
  type EclubRaporHamSatir,
  type EclubTakimGirdi,
} from "@/lib/eclub/rapor";

const oku = (yol: string) => readFileSync(yol, "utf8");

const pageContent = oku("app/(panel)/eclub/ligi/page.tsx");
const cssContent = oku("app/(panel)/eclub/ligi/eclub-league.module.css");

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

test("Hedef Test 1: Takım tablosu çekli, çeksiz ve lig puanını ayrı gösterir", () => {
  assert.match(pageContent, /<th[^>]*>Çekli Puan<\/th>/);
  assert.match(pageContent, /<th[^>]*>Çeksiz Puan<\/th>/);
  assert.match(pageContent, /<th[^>]*>Lig Puanı<\/th>/);

  assert.match(pageContent, /takim\.cekli_puan\.toLocaleString\("tr-TR"\)\} p/);
  assert.match(pageContent, /takim\.ceksiz_puan\.toLocaleString\("tr-TR"\)\} p/);
  assert.match(pageContent, /takim\.toplam_puan\.toLocaleString\("tr-TR"\)\} p/);

  // "Benim Takımım" vurgusunun korunduğu doğrulanır
  assert.match(pageContent, /Benim Takımım/);
  assert.match(pageContent, /styles\.rankBadge/);
});

test("Hedef Test 2: Toplam takım puanı değişmez (Çekli + Çeksiz toplamı)", () => {
  const takimGirdi: EclubTakimGirdi = {
    utt_id: "utt-1",
    utt_adi: "Temsilci",
    takim_adi: "Takım 1",
    bolge_adi: "Bölge 1",
    satirlar: [
      satir({ kisi_id: "k-1", cekli_puan: 70, ceksiz_puan: 30 }),
      satir({ kisi_id: "k-2", cekli_puan: 50, ceksiz_puan: 20 }),
    ],
  };

  const lig = eclubTakimlarLiginiOlustur([takimGirdi]);
  assert.equal(lig.length, 1);
  const takim = lig[0];

  assert.equal(takim.cekli_puan, 120);
  assert.equal(takim.ceksiz_puan, 50);
  assert.equal(takim.toplam_puan, 170);
  assert.equal(takim.toplam_puan, takim.cekli_puan + takim.ceksiz_puan);
});

test("Hedef Test 3: Çeksiz Puan lig sıralamasına dahildir", () => {
  // Takım 1: 100 Çekli + 0 Çeksiz = 100 Toplam
  const takim1: EclubTakimGirdi = {
    utt_id: "utt-1",
    utt_adi: "Temsilci 1",
    takim_adi: "Takım 1",
    bolge_adi: "Bölge 1",
    satirlar: [satir({ kisi_id: "k-1", cekli_puan: 100, ceksiz_puan: 0 })],
  };

  // Takım 2: 70 Çekli + 50 Çeksiz = 120 Toplam
  const takim2: EclubTakimGirdi = {
    utt_id: "utt-2",
    utt_adi: "Temsilci 2",
    takim_adi: "Takım 2",
    bolge_adi: "Bölge 2",
    satirlar: [satir({ kisi_id: "k-2", cekli_puan: 70, ceksiz_puan: 50 })],
  };

  const lig = eclubTakimlarLiginiOlustur([takim1, takim2]);
  assert.equal(lig.length, 2);

  // Takım 2, Çeksiz puan sayesinde (120 > 100) 1. sıraya yerleşmelidir
  assert.equal(lig[0].takim_adi, "Takım 2");
  assert.equal(lig[0].sira, 1);
  assert.equal(lig[0].toplam_puan, 120);
  assert.equal(lig[0].ceksiz_puan, 50);

  assert.equal(lig[1].takim_adi, "Takım 1");
  assert.equal(lig[1].sira, 2);
  assert.equal(lig[1].toplam_puan, 100);
  assert.equal(lig[1].ceksiz_puan, 0);
});



test("Hedef Test 5: Mobil ve masaüstü render hatası oluşmaz", () => {
  // CSS dosyasında overflow ve responsive kuralları tanımlı olmalı
  assert.match(cssContent, /\.tableWrap\s*\{[\s\S]*?overflow-x:\s*auto;/);
  assert.match(cssContent, /@media\s*\(max-width:\s*900px\)/);
  assert.match(cssContent, /@media\s*\(max-width:\s*560px\)/);

  // JSX içinde tablo sarmalayıcısı doğru kullanılmış mı?
  assert.match(pageContent, /<div className=\{styles\.tableWrap\}>/);
  assert.match(pageContent, /<table className=\{styles\.table\}>/);
});
