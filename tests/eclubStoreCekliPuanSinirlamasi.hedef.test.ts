import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const migrationSql = oku("scripts/sql/eclub_store_cekli_puan_sinirlamasi.sql");
const storeBakiyeSql = oku("scripts/sql/get_eclub_store_firma_bakiye.sql");

// Kanonik Store Bakiye Hesaplama Mantığı (get_eclub_store_firma_bakiye simülasyonu)
interface KazanilanPuan {
  kisi_id: string;
  firma_id: string;
  yayin_id: string;
  puan: number;
  cek_karsiligi_var_mi: boolean;
}

interface IleriSarmaKaybi {
  kisi_id: string;
  firma_id: string;
  yayin_id: string;
  kaybedilen_puan: number;
  cek_karsiligi_var_mi: boolean;
}

interface SiparisHarcama {
  siparis_id: string;
  kisi_id: string;
  firma_id: string;
  kullanilan_puan: number;
  durum: "beklemede" | "tamamlandi" | "iptal";
}

function hesaplaStoreFirmaBakiye(
  kisiId: string,
  kazanilanlar: KazanilanPuan[],
  kayiplar: IleriSarmaKaybi[],
  harcamalar: SiparisHarcama[],
  firmaAktifMap: Map<string, boolean> = new Map([["firma-1", true]])
): Array<{ firma_id: string; kazanilan: number; harcanan: number; bakiye: number }> {
  // 1. kazanc CTE: Yalnız kp.cek_karsiligi_var_mi = true
  const kazancMap = new Map<string, number>();
  for (const kp of kazanilanlar) {
    if (kp.kisi_id !== kisiId) continue;
    if (kp.cek_karsiligi_var_mi !== true) continue;
    kazancMap.set(kp.firma_id, (kazancMap.get(kp.firma_id) ?? 0) + kp.puan);
  }

  // 2. kayip CTE: Yalnız ks.cek_karsiligi_var_mi = true
  const kayipMap = new Map<string, number>();
  for (const ks of kayiplar) {
    if (ks.kisi_id !== kisiId) continue;
    if (ks.cek_karsiligi_var_mi !== true) continue;
    kayipMap.set(ks.firma_id, (kayipMap.get(ks.firma_id) ?? 0) + ks.kaybedilen_puan);
  }

  // 3. harcama CTE: durum <> 'iptal'
  const harcamaMap = new Map<string, number>();
  for (const h of harcamalar) {
    if (h.kisi_id !== kisiId) continue;
    if (h.durum === "iptal") continue;
    harcamaMap.set(h.firma_id, (harcamaMap.get(h.firma_id) ?? 0) + h.kullanilan_puan);
  }

  const sonuclar: Array<{ firma_id: string; kazanilan: number; harcanan: number; bakiye: number }> = [];
  for (const [firmaId, kazanilan] of kazancMap.entries()) {
    if (!firmaAktifMap.get(firmaId)) continue;
    const kaybedilen = kayipMap.get(firmaId) ?? 0;
    const harcanan = harcamaMap.get(firmaId) ?? 0;
    const bakiye = kazanilan - kaybedilen - harcanan;
    if (bakiye > 0) {
      sonuclar.push({ firma_id: firmaId, kazanilan, harcanan, bakiye });
    }
  }

  return sonuclar.sort((a, b) => b.bakiye - a.bakiye);
}

function hesaplaStoreToplamBakiye(
  kisiId: string,
  kazanilanlar: KazanilanPuan[],
  kayiplar: IleriSarmaKaybi[],
  harcamalar: SiparisHarcama[],
  firmaAktifMap?: Map<string, boolean>
): number {
  const firmalar = hesaplaStoreFirmaBakiye(kisiId, kazanilanlar, kayiplar, harcamalar, firmaAktifMap);
  return firmalar.reduce((toplam, f) => toplam + f.bakiye, 0);
}

test("Faz 7 Migration Sözleşmesi: get_eclub_store_firma_bakiye içinde Çekli Puan filtreleri", () => {
  for (const sql of [migrationSql, storeBakiyeSql]) {
    // kazanc CTE'sinde yalnız Çekli Puan filtrelenmeli
    assert.match(sql, /FROM (?:public\.)?eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.kisi_id = p_kisi_id\s+AND kp\.cek_karsiligi_var_mi = true/);
    // kayip CTE'sinde yalnız Çekli Puan kaybı filtrelenmeli
    assert.match(sql, /FROM (?:public\.)?eclub_ileri_sarma_kayitlari ks[\s\S]*?WHERE ks\.kisi_id = p_kisi_id\s+AND ks\.cek_karsiligi_var_mi = true/);
    // harcama CTE'sinde iptal edilmeyen siparişler sayılmalı
    assert.match(sql, /s\.durum <> 'iptal'/);
  }
});

test("Hedef Test 1: 40 Çekli Puan Store'da 40 puan görünür", () => {
  const kazanilan: KazanilanPuan[] = [
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-cekli", puan: 40, cek_karsiligi_var_mi: true },
  ];
  const bakiye = hesaplaStoreToplamBakiye("kisi-1", kazanilan, [], []);
  assert.equal(bakiye, 40);

  const firmaBakiyeleri = hesaplaStoreFirmaBakiye("kisi-1", kazanilan, [], []);
  assert.equal(firmaBakiyeleri.length, 1);
  assert.equal(firmaBakiyeleri[0].bakiye, 40);
});

test("Hedef Test 2: 40 Çeksiz Puan Store'da 0 puan görünür", () => {
  const kazanilan: KazanilanPuan[] = [
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-ceksiz", puan: 40, cek_karsiligi_var_mi: false },
  ];
  const bakiye = hesaplaStoreToplamBakiye("kisi-1", kazanilan, [], []);
  assert.equal(bakiye, 0);

  const firmaBakiyeleri = hesaplaStoreFirmaBakiye("kisi-1", kazanilan, [], []);
  assert.equal(firmaBakiyeleri.length, 0);
});

test("Hedef Test 3 & 4: 40 Çekli ve 30 Çeksiz Puan bulunan kişide Store Puanı 40, Lig toplamı 70 kalır", () => {
  const kazanilan: KazanilanPuan[] = [
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-cekli", puan: 40, cek_karsiligi_var_mi: true },
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-ceksiz", puan: 30, cek_karsiligi_var_mi: false },
  ];

  // Store Puanı hesabı (Yalnız Çekli Puan)
  const storePuani = hesaplaStoreToplamBakiye("kisi-1", kazanilan, [], []);
  assert.equal(storePuani, 40);

  // Lig toplamı hesabı (Çekli + Çeksiz Puan)
  const ligToplamPuani = kazanilan.reduce((toplam, kp) => toplam + kp.puan, 0);
  assert.equal(ligToplamPuani, 70);
});

test("Hedef Test 5: Çeksiz Puanla Store siparişi verilemez (Yetersiz Bakiye)", () => {
  // Kişinin yalnızca 100 Çeksiz Puanı var
  const kazanilan: KazanilanPuan[] = [
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-ceksiz", puan: 100, cek_karsiligi_var_mi: false },
  ];

  // Ürün fiyatı: 50 puan, adet: 1
  const urunFiyat = 50;
  const adet = 1;
  const toplamGerekenPuan = urunFiyat * adet;

  // eclub_store_siparis_olustur RPC mantığı:
  // SELECT COALESCE(SUM(b.bakiye), 0) INTO v_uygun_bakiye FROM public.get_eclub_store_firma_bakiye(p_kisi_id) b
  const uygunBakiye = hesaplaStoreToplamBakiye("kisi-1", kazanilan, [], []);

  const siparisVerilebilirMi = uygunBakiye >= toplamGerekenPuan;
  assert.equal(uygunBakiye, 0);
  assert.equal(siparisVerilebilirMi, false);
});

test("Hedef Test 6: Navbar, Store sayfası ve firma bakiyesi aynı sonucu gösterir", () => {
  const kazanilan: KazanilanPuan[] = [
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-1", puan: 50, cek_karsiligi_var_mi: true },
    { kisi_id: "kisi-1", firma_id: "firma-2", yayin_id: "y-2", puan: 30, cek_karsiligi_var_mi: true },
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-3", puan: 20, cek_karsiligi_var_mi: false }, // Çeksiz
  ];
  const firmaAktifMap = new Map([
    ["firma-1", true],
    ["firma-2", true],
  ]);

  // 1. Firma Bakiyesi API çıktısı (app/(panel)/eclub/store/api/route.ts -> firmaBakiye)
  const firmaBakiyeleri = hesaplaStoreFirmaBakiye("kisi-1", kazanilan, [], [], firmaAktifMap);
  const firma1Bakiye = firmaBakiyeleri.find((f) => f.firma_id === "firma-1")?.bakiye ?? 0;
  const firma2Bakiye = firmaBakiyeleri.find((f) => f.firma_id === "firma-2")?.bakiye ?? 0;
  assert.equal(firma1Bakiye, 50); // 50 Çekli (20 Çeksiz eklenmedi)
  assert.equal(firma2Bakiye, 30);

  // 2. Store Sayfası Toplam Bakiye (app/(panel)/eclub/store/api/route.ts -> toplamBakiye)
  const storeSayfasiToplamBakiye = firmaBakiyeleri.reduce((acc, f) => acc + f.bakiye, 0);
  assert.equal(storeSayfasiToplamBakiye, 80);

  // 3. Navbar ve Profil API çıktısı (app/(panel)/profil/api/route.ts -> eclub_navbar_ozet.store_puani)
  const navbarStorePuani = hesaplaStoreToplamBakiye("kisi-1", kazanilan, [], [], firmaAktifMap);
  assert.equal(navbarStorePuani, 80);

  // Hepsi birbiriyle birebir tutarlı
  assert.equal(storeSayfasiToplamBakiye, navbarStorePuani);
  assert.equal(firma1Bakiye + firma2Bakiye, navbarStorePuani);
});

test("Hedef Test 7: Sipariş iptalinde yalnız gerçekten harcanan Çekli Puan iade edilir; Çeksiz kayıp Çekli bakiyeyi düşürmez", () => {
  const kazanilan: KazanilanPuan[] = [
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-cekli", puan: 100, cek_karsiligi_var_mi: true },
  ];
  // Çeksiz bir yayında 30 puan ileri sarma kaybı yaşandı
  const kayiplar: IleriSarmaKaybi[] = [
    { kisi_id: "kisi-1", firma_id: "firma-1", yayin_id: "y-ceksiz", kaybedilen_puan: 30, cek_karsiligi_var_mi: false },
  ];

  // 1. Çeksiz kayıp Çekli bakiyeden düşmez -> Bakiye: 100
  let bakiye = hesaplaStoreToplamBakiye("kisi-1", kazanilan, kayiplar, []);
  assert.equal(bakiye, 100);

  // 2. Kullanıcı 40 puanlık bir sipariş verir
  const harcamalar: SiparisHarcama[] = [
    { siparis_id: "sip-1", kisi_id: "kisi-1", firma_id: "firma-1", kullanilan_puan: 40, durum: "beklemede" },
  ];
  bakiye = hesaplaStoreToplamBakiye("kisi-1", kazanilan, kayiplar, harcamalar);
  assert.equal(bakiye, 60);

  // 3. Sipariş iptal edilir -> Harcanan 40 Çekli Puan aynen iade olur
  harcamalar[0].durum = "iptal";
  bakiye = hesaplaStoreToplamBakiye("kisi-1", kazanilan, kayiplar, harcamalar);
  assert.equal(bakiye, 100);
});
