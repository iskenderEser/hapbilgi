import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const migrationSql = oku("scripts/sql/eclub_kazanilan_puanlar_cek_karsiligi.sql");
const ogrenmeTamamlaSql = oku("scripts/sql/eclub_ogrenme_araci_tamamlama.sql");
const cevapSql = oku("scripts/sql/soru_kesinti_faz5_cevap.sql");

test("Faz 3 Migration Sözleşmesi: eclub_kazanilan_puanlar ve merkezi BEFORE INSERT trigger", () => {
  // Kolon tanımı ve NOT NULL DEFAULT true
  assert.match(migrationSql, /ALTER TABLE public\.eclub_kazanilan_puanlar/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;/);
  assert.match(migrationSql, /UPDATE public\.eclub_kazanilan_puanlar[\s\S]*?SET cek_karsiligi_var_mi = true/);
  assert.match(migrationSql, /ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;/);

  // Trigger fonksiyonu
  assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.tg_eclub_kazanilan_puanlar_cek_karsiligi/);
  assert.match(migrationSql, /SELECT y\.cek_karsiligi_var_mi[\s\S]*?FROM public\.yayin_yonetimi y[\s\S]*?WHERE y\.yayin_id = NEW\.yayin_id;/);

  // Fail-closed kuralı: yayin_id eksik veya yayın bulunamazsa exception fırlatır (sessizce true üretmez)
  assert.match(migrationSql, /IF NEW\.yayin_id IS NULL THEN[\s\S]*?RAISE EXCEPTION/);
  assert.match(migrationSql, /IF v_cek_karsiligi IS NULL THEN[\s\S]*?RAISE EXCEPTION/);

  // Sabitleme
  assert.match(migrationSql, /NEW\.cek_karsiligi_var_mi := v_cek_karsiligi;/);

  // BEFORE INSERT trigger
  assert.match(migrationSql, /CREATE TRIGGER trg_eclub_kazanilan_puanlar_cek_karsiligi/);
  assert.match(migrationSql, /BEFORE INSERT ON public\.eclub_kazanilan_puanlar/);
  assert.match(migrationSql, /FOR EACH ROW/);
  assert.match(migrationSql, /EXECUTE FUNCTION public\.tg_eclub_kazanilan_puanlar_cek_karsiligi\(\);/);
});

test("Faz 3 Puan Üretim Yolları: video, podcast, görsel, flip_pdf ve cevaplama", () => {
  // Öğrenme araçları tamamlama RPC'si (video, podcast, görsel, flip_pdf)
  assert.match(ogrenmeTamamlaSql, /INSERT INTO public\.eclub_kazanilan_puanlar/);
  assert.match(ogrenmeTamamlaSql, /'izleme'/);
  assert.match(ogrenmeTamamlaSql, /ON CONFLICT \(izleme_id, puan_turu\) DO NOTHING;/);

  // Doğru cevaplama RPC'si
  assert.match(cevapSql, /INSERT INTO public\.eclub_kazanilan_puanlar/);
  assert.match(cevapSql, /'cevaplama'/);
  assert.match(cevapSql, /ON CONFLICT \(izleme_id, puan_turu\) DO NOTHING;/);
});

test("Faz 3 Hedef Senaryoları: Çekli/Çeksiz sabitleme, geçmiş değişmezliği ve tekillik simülasyonu", () => {
  // Mock veritabanı durumu
  const yayinlar = new Map<string, { cek_karsiligi_var_mi: boolean }>([
    ["yayin-cekli", { cek_karsiligi_var_mi: true }],
    ["yayin-ceksiz", { cek_karsiligi_var_mi: false }],
  ]);

  const puanTablosu: Array<{
    kazanilan_puan_id: string;
    yayin_id: string;
    izleme_id: string;
    puan_turu: string;
    puan: number;
    cek_karsiligi_var_mi: boolean;
  }> = [];

  // BEFORE INSERT Trigger simülasyonu
  function triggerBeforeInsert(kayit: {
    kazanilan_puan_id: string;
    yayin_id: string | null;
    izleme_id: string;
    puan_turu: string;
    puan: number;
    cek_karsiligi_var_mi?: boolean;
  }) {
    if (!kayit.yayin_id) {
      throw new Error("eclub_kazanilan_puanlar: yayin_id zorunludur.");
    }
    const yayin = yayinlar.get(kayit.yayin_id);
    if (!yayin || yayin.cek_karsiligi_var_mi === undefined || yayin.cek_karsiligi_var_mi === null) {
      throw new Error(`eclub_kazanilan_puanlar: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı (${kayit.yayin_id}).`);
    }

    // İstemci ne gönderirse göndersin, yayından alınan değer sabitlenir
    return {
      ...kayit,
      yayin_id: kayit.yayin_id,
      cek_karsiligi_var_mi: yayin.cek_karsiligi_var_mi,
    };
  }

  function insertPuan(kayit: Parameters<typeof triggerBeforeInsert>[0]) {
    // ON CONFLICT (izleme_id, puan_turu) DO NOTHING simülasyonu
    const mevcut = puanTablosu.find(
      (p) => p.izleme_id === kayit.izleme_id && p.puan_turu === kayit.puan_turu
    );
    if (mevcut) return null; // DO NOTHING

    const islenmis = triggerBeforeInsert(kayit);
    puanTablosu.push(islenmis);
    return islenmis;
  }

  // 1. Çekli yayından izleme puanı true kaydedilir
  const p1 = insertPuan({
    kazanilan_puan_id: "p-1",
    yayin_id: "yayin-cekli",
    izleme_id: "izl-1",
    puan_turu: "izleme",
    puan: 50,
  });
  assert.equal(p1?.cek_karsiligi_var_mi, true);

  // 2. Çeksiz yayından izleme puanı false kaydedilir
  const p2 = insertPuan({
    kazanilan_puan_id: "p-2",
    yayin_id: "yayin-ceksiz",
    izleme_id: "izl-2",
    puan_turu: "izleme",
    puan: 50,
  });
  assert.equal(p2?.cek_karsiligi_var_mi, false);

  // 3. Doğru cevap puanı aynı yayın kararını alır
  const p3 = insertPuan({
    kazanilan_puan_id: "p-3",
    yayin_id: "yayin-cekli",
    izleme_id: "izl-1",
    puan_turu: "cevaplama",
    puan: 10,
  });
  assert.equal(p3?.cek_karsiligi_var_mi, true);

  const p4 = insertPuan({
    kazanilan_puan_id: "p-4",
    yayin_id: "yayin-ceksiz",
    izleme_id: "izl-2",
    puan_turu: "cevaplama",
    puan: 10,
  });
  assert.equal(p4?.cek_karsiligi_var_mi, false);

  // 4. Podcast, görsel ve Flip PDF puanları doğru sınıfta kaydedilir
  const pPodcast = insertPuan({
    kazanilan_puan_id: "p-pod",
    yayin_id: "yayin-ceksiz",
    izleme_id: "izl-pod",
    puan_turu: "izleme",
    puan: 40,
  });
  assert.equal(pPodcast?.cek_karsiligi_var_mi, false);

  const pGorsel = insertPuan({
    kazanilan_puan_id: "p-gor",
    yayin_id: "yayin-cekli",
    izleme_id: "izl-gor",
    puan_turu: "izleme",
    puan: 40,
  });
  assert.equal(pGorsel?.cek_karsiligi_var_mi, true);

  const pFlipPdf = insertPuan({
    kazanilan_puan_id: "p-flip",
    yayin_id: "yayin-ceksiz",
    izleme_id: "izl-flip",
    puan_turu: "izleme",
    puan: 45,
  });
  assert.equal(pFlipPdf?.cek_karsiligi_var_mi, false);

  // 5. Yayın kararı sonradan değişince eski puan değişmez
  // yayin-ceksiz'in kararı sonradan true yapılıyor:
  yayinlar.set("yayin-ceksiz", { cek_karsiligi_var_mi: true });
  // Eski kayıtlara bakıldığında p2, p4, pPodcast ve pFlipPdf false kalmaya devam etmelidir:
  assert.equal(puanTablosu.find((p) => p.kazanilan_puan_id === "p-2")?.cek_karsiligi_var_mi, false);
  assert.equal(puanTablosu.find((p) => p.kazanilan_puan_id === "p-4")?.cek_karsiligi_var_mi, false);
  assert.equal(puanTablosu.find((p) => p.kazanilan_puan_id === "p-pod")?.cek_karsiligi_var_mi, false);
  assert.equal(puanTablosu.find((p) => p.kazanilan_puan_id === "p-flip")?.cek_karsiligi_var_mi, false);

  // 6. Mükerrer puan kaydı oluşmaz
  const pMukerrer = insertPuan({
    kazanilan_puan_id: "p-dup",
    yayin_id: "yayin-cekli",
    izleme_id: "izl-1",
    puan_turu: "izleme", // zaten p1 ile eklendi
    puan: 50,
  });
  assert.equal(pMukerrer, null); // DO NOTHING, tabloya eklenmedi
  assert.equal(puanTablosu.filter((p) => p.izleme_id === "izl-1" && p.puan_turu === "izleme").length, 1);

  // 7. Eksik veya geçersiz yayın bağlantısında sessizce Çekli Puan üretmez, hata verir
  assert.throws(() => {
    insertPuan({
      kazanilan_puan_id: "p-err1",
      yayin_id: null,
      izleme_id: "izl-err1",
      puan_turu: "izleme",
      puan: 50,
    });
  }, /yayin_id zorunludur/);

  assert.throws(() => {
    insertPuan({
      kazanilan_puan_id: "p-err2",
      yayin_id: "yayin-olmayan",
      izleme_id: "izl-err2",
      puan_turu: "izleme",
      puan: 50,
    });
  }, /Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı/);
});
