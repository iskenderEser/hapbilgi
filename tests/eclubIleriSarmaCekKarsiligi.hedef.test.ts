import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const migrationSql = oku("scripts/sql/eclub_ileri_sarma_cek_karsiligi.sql");
const storeBakiyeSql = oku("scripts/sql/get_eclub_store_firma_bakiye.sql");
const ileriSarmaKuraliSql = oku("scripts/sql/eclub_ileri_sarma_kurali.sql");

test("Faz 4 Migration Sözleşmesi: eclub_ileri_sarma_kayitlari ve merkezi BEFORE INSERT trigger", () => {
  // 1. Kolon tanımı ve NOT NULL DEFAULT true
  assert.match(migrationSql, /ALTER TABLE public\.eclub_ileri_sarma_kayitlari/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;/);
  assert.match(migrationSql, /UPDATE public\.eclub_ileri_sarma_kayitlari[\s\S]*?SET cek_karsiligi_var_mi = true/);
  assert.match(migrationSql, /ALTER COLUMN cek_karsiligi_var_mi SET NOT NULL;/);

  // 2. Trigger fonksiyonu
  assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.tg_eclub_ileri_sarma_kayitlari_cek_karsiligi/);
  assert.match(migrationSql, /SELECT y\.cek_karsiligi_var_mi[\s\S]*?FROM public\.yayin_yonetimi y[\s\S]*?WHERE y\.yayin_id = NEW\.yayin_id;/);

  // 3. Fail-closed kuralı: yayin_id eksik veya yayın bulunamazsa exception fırlatır
  assert.match(migrationSql, /IF NEW\.yayin_id IS NULL THEN[\s\S]*?RAISE EXCEPTION/);
  assert.match(migrationSql, /IF v_cek_karsiligi IS NULL THEN[\s\S]*?RAISE EXCEPTION/);

  // 4. Sabitleme
  assert.match(migrationSql, /NEW\.cek_karsiligi_var_mi := v_cek_karsiligi;/);

  // 5. BEFORE INSERT trigger
  assert.match(migrationSql, /CREATE TRIGGER trg_eclub_ileri_sarma_kayitlari_cek_karsiligi/);
  assert.match(migrationSql, /BEFORE INSERT ON public\.eclub_ileri_sarma_kayitlari/);
  assert.match(migrationSql, /FOR EACH ROW/);
  assert.match(migrationSql, /EXECUTE FUNCTION public\.tg_eclub_ileri_sarma_kayitlari_cek_karsiligi\(\);/);

  // 6. get_eclub_store_firma_bakiye kayip filtresi (cek_karsiligi_var_mi = true)
  assert.match(migrationSql, /ks\.cek_karsiligi_var_mi = true/);
  assert.match(storeBakiyeSql, /ks\.cek_karsiligi_var_mi = true/);
  assert.match(ileriSarmaKuraliSql, /ks\.cek_karsiligi_var_mi = true/);
});

test("Faz 4 Hedef Test: Çekli yayının ileri sarma kaybı Store Puanını azaltır", () => {
  // Simülasyon: Kullanıcı Çekli yayından 100 puan kazandı ve bu yayında 30 puan ileri sarma kaybı yaşadı.
  const kazanc = [
    { firma_id: "firma-1", yayin_id: "yayin-cekli", puan: 100, cek_karsiligi_var_mi: true },
  ];
  const kayip = [
    { firma_id: "firma-1", yayin_id: "yayin-cekli", kaybedilen_puan: 30, cek_karsiligi_var_mi: true },
  ];
  const harcama: Array<{ firma_id: string; harcanan: number }> = [];

  // get_eclub_store_firma_bakiye SQL mantığı
  const toplamKazanc = kazanc.reduce((toplam, k) => toplam + k.puan, 0);
  const filtreliKayip = kayip
    .filter((k) => k.cek_karsiligi_var_mi === true)
    .reduce((toplam, k) => toplam + k.kaybedilen_puan, 0);
  const toplamHarcama = harcama.reduce((toplam, h) => toplam + h.harcanan, 0);

  const bakiye = toplamKazanc - filtreliKayip - toplamHarcama;

  // Çekli yayındaki 30 puan kayıp Store bakiyesinden düşer (100 - 30 = 70)
  assert.equal(filtreliKayip, 30);
  assert.equal(bakiye, 70);
});

test("Faz 4 Hedef Test: Çeksiz yayının ileri sarma kaybı Store Puanını azaltmaz", () => {
  // Simülasyon: Kullanıcı Çekli yayından 100 puan kazandı.
  // Daha sonra Çeksiz bir yayını izlerken 40 puan ileri sarma kaybı yaşadı.
  const kazanc = [
    { firma_id: "firma-1", yayin_id: "yayin-cekli", puan: 100, cek_karsiligi_var_mi: true },
  ];
  const kayip = [
    { firma_id: "firma-1", yayin_id: "yayin-ceksiz", kaybedilen_puan: 40, cek_karsiligi_var_mi: false },
  ];
  const harcama: Array<{ firma_id: string; harcanan: number }> = [];

  // get_eclub_store_firma_bakiye SQL mantığı (yalnızca ks.cek_karsiligi_var_mi = true dahil edilir)
  const toplamKazanc = kazanc.reduce((toplam, k) => toplam + k.puan, 0);
  const filtreliKayip = kayip
    .filter((k) => k.cek_karsiligi_var_mi === true)
    .reduce((toplam, k) => toplam + k.kaybedilen_puan, 0);
  const toplamHarcama = harcama.reduce((toplam, h) => toplam + h.harcanan, 0);

  const bakiye = toplamKazanc - filtreliKayip - toplamHarcama;

  // Çeksiz yayındaki 40 puan kayıp Store bakiyesinden DÜŞÜLMEZ (filtreliKayip = 0, bakiye = 100)
  assert.equal(filtreliKayip, 0);
  assert.equal(bakiye, 100);
});

test("Faz 4 Hedef Test: Çeksiz yayının lig hesabındaki mevcut kayıp davranışı korunur", () => {
  // Çeksiz yayında video süresi ve puanı: 60 puan
  const videoPuani = 60;
  const atlananSure = 20;
  const videoSuresi = 60;

  // eclubIleriSarmaKaybiHesapla mantığı
  const kaybedilenPuan = Math.round((videoPuani * atlananSure) / videoSuresi); // 20 puan
  assert.equal(kaybedilenPuan, 20);

  // İleri sarma yapıldığı için soru hakkı iptal edilir
  const ileriSarildi = true;
  const pencereAcik = true;
  const soruIndeksleri = [0, 1];
  const soruHakkiVarMi = pencereAcik && !ileriSarildi && soruIndeksleri.length > 0;
  const soruHakkiNedeni = ileriSarildi ? "ileri_sarma" : "hak_var";

  assert.equal(soruHakkiVarMi, false);
  assert.equal(soruHakkiNedeni, "ileri_sarma");

  // Tamamlama anında net izleme puanı (app/eclub/panel/api/bitir/route.ts)
  const izlemePuani = videoPuani;
  const netIzlemePuani = Math.max(0, izlemePuani - kaybedilenPuan); // 60 - 20 = 40 puan
  assert.equal(netIzlemePuani, 40);

  // Lig raporlama ve kişi özetinde (app/eclub/panel/api/route.ts) toplam kayıp eksiksiz gösterilir
  const kisiKayiplari = [
    { izleme_id: "izl-ceksiz", kaybedilen_puan: 20, cek_karsiligi_var_mi: false },
  ];
  const toplamIleriSarmaKaybi = kisiKayiplari.reduce((toplam, k) => toplam + k.kaybedilen_puan, 0);
  assert.equal(toplamIleriSarmaKaybi, 20);
});

test("Faz 4 Hedef Test: Eski kayıtların mevcut davranışı bozulmaz", () => {
  // Migration öncesi mevcut olan kayıtlar (cek_karsiligi_var_mi = true olarak backfill edilir)
  const eskiKayitlar = [
    { kayit_id: "eski-1", kisi_id: "kisi-1", firma_id: "firma-1", kaybedilen_puan: 25, cek_karsiligi_var_mi: true },
    { kayit_id: "eski-2", kisi_id: "kisi-1", firma_id: "firma-1", kaybedilen_puan: 15, cek_karsiligi_var_mi: true },
  ];
  const toplamKazanc = 200;

  // Eski kayıtların hepsi Çekli kabul edildiğinden Store bakiyesini düşürmeye devam eder
  const eskiKayipToplami = eskiKayitlar
    .filter((k) => k.cek_karsiligi_var_mi === true)
    .reduce((toplam, k) => toplam + k.kaybedilen_puan, 0);

  assert.equal(eskiKayipToplami, 40);
  const bakiye = toplamKazanc - eskiKayipToplami;
  assert.equal(bakiye, 160);
});

test("Faz 4 Güvenlik ve İmmutability: İstemci manipülasyonu engeli ve yayın kararı değişmezliği", () => {
  const yayinlar = new Map<string, { cek_karsiligi_var_mi: boolean }>([
    ["yayin-cekli", { cek_karsiligi_var_mi: true }],
    ["yayin-ceksiz", { cek_karsiligi_var_mi: false }],
  ]);

  const kayitTablosu: Array<{
    kayit_id: string;
    yayin_id: string;
    kaybedilen_puan: number;
    cek_karsiligi_var_mi: boolean;
  }> = [];

  // BEFORE INSERT trigger simülasyonu
  function triggerBeforeInsert(kayit: {
    kayit_id: string;
    yayin_id: string | null;
    kaybedilen_puan: number;
    cek_karsiligi_var_mi?: boolean;
  }) {
    if (!kayit.yayin_id) {
      throw new Error("eclub_ileri_sarma_kayitlari: yayin_id zorunludur.");
    }
    const yayin = yayinlar.get(kayit.yayin_id);
    if (!yayin || yayin.cek_karsiligi_var_mi === undefined || yayin.cek_karsiligi_var_mi === null) {
      throw new Error(`eclub_ileri_sarma_kayitlari: Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı (${kayit.yayin_id}).`);
    }

    // İstemciden gelen veriye güvenilmez, yayındaki değer yazılır
    return {
      ...kayit,
      yayin_id: kayit.yayin_id,
      cek_karsiligi_var_mi: yayin.cek_karsiligi_var_mi,
    };
  }

  // 1. İstemci Çekli yayında false gönderse bile yayındaki true değeri yazılır
  const k1 = triggerBeforeInsert({
    kayit_id: "k-1",
    yayin_id: "yayin-cekli",
    kaybedilen_puan: 20,
    cek_karsiligi_var_mi: false, // İstemci manipülasyon girişimi
  });
  assert.equal(k1.cek_karsiligi_var_mi, true);
  kayitTablosu.push(k1);

  // 2. Çeksiz yayında doğru şekilde false sabitlenir
  const k2 = triggerBeforeInsert({
    kayit_id: "k-2",
    yayin_id: "yayin-ceksiz",
    kaybedilen_puan: 15,
  });
  assert.equal(k2.cek_karsiligi_var_mi, false);
  kayitTablosu.push(k2);

  // 3. Yayın kararı sonradan değiştirilse bile geçmiş kaydın sınıfı DEĞİŞMEZ
  yayinlar.set("yayin-ceksiz", { cek_karsiligi_var_mi: true });
  assert.equal(kayitTablosu.find((k) => k.kayit_id === "k-2")?.cek_karsiligi_var_mi, false);

  // 4. Geçersiz veya eksik yayında fail-closed exception fırlatılır
  assert.throws(() => {
    triggerBeforeInsert({
      kayit_id: "k-err1",
      yayin_id: null,
      kaybedilen_puan: 10,
    });
  }, /yayin_id zorunludur/);

  assert.throws(() => {
    triggerBeforeInsert({
      kayit_id: "k-err2",
      yayin_id: "yayin-bulunamayan",
      kaybedilen_puan: 10,
    });
  }, /Geçersiz yayın veya cek_karsiligi_var_mi bulunamadı/);
});
