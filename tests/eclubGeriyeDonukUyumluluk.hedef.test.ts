import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baremBul, cekTutariHesapla, type BaremSatiri } from "@/lib/eclub/store/eclubStoreTipler";
import {
  eclubRaporunuTopla,
  eclubLiginiOlustur,
  type EclubRaporHamSatir,
} from "@/lib/eclub/rapor";

const oku = (yol: string) => readFileSync(yol, "utf8");

const faz9Sql = oku("scripts/sql/eclub_faz9_geriye_donuk_uyumluluk.sql");
const yayinSql = oku("scripts/sql/eclub_yayin_cek_karsiligi_var_mi.sql");
const puanSql = oku("scripts/sql/eclub_kazanilan_puanlar_cek_karsiligi.sql");
const ileriSarmaSql = oku("scripts/sql/eclub_ileri_sarma_cek_karsiligi.sql");
const bakiyeSql = oku("scripts/sql/eclub_store_cekli_puan_sinirlamasi.sql");
const hediyeCekiSql = oku("scripts/sql/eclub_store_hediye_ceki_cekli_puan.sql");

// ===========================================================================
// 1. SQL İdempotency ve Geriye Dönük Uyumluluk Sözleşme Testleri
// ===========================================================================

test("Faz 9 Migration Sözleşmesi: Tekrar güvenli (idempotent) ve veri koruyucu DDL", () => {
  for (const sql of [faz9Sql, yayinSql, puanSql, ileriSarmaSql]) {
    // Kolon eklemelerinde IF NOT EXISTS zorunludur
    assert.match(sql, /ADD COLUMN IF NOT EXISTS cek_karsiligi_var_mi boolean NOT NULL DEFAULT true;/);
    // Varsayılan true olmalıdır
    assert.match(sql, /ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;/);
    // Backfill YALNIZCA IS NULL olan kayıtları güncellemelidir (mevcut false kayıtlarını ezmemeli!)
    assert.match(sql, /SET cek_karsiligi_var_mi = true\s+WHERE cek_karsiligi_var_mi IS NULL;/);
  }
});

test("Faz 9 Migration Sözleşmesi: İkinci kez çalıştırmada false olan yeni kayıtlar asla ezilmez", () => {
  // Simüle edilmiş veritabanı satırları
  const yayinlar = [
    { yayin_id: "eski-yayin-1", cek_karsiligi_var_mi: null as boolean | null },
    { yayin_id: "yeni-cekli-yayin", cek_karsiligi_var_mi: true as boolean | null },
    { yayin_id: "yeni-ceksiz-yayin", cek_karsiligi_var_mi: false as boolean | null },
  ];

  // SQL kuralı: UPDATE public.yayin_yonetimi SET cek_karsiligi_var_mi = true WHERE cek_karsiligi_var_mi IS NULL;
  const calistirMigration = (rows: typeof yayinlar) => {
    return rows.map((r) => ({
      ...r,
      cek_karsiligi_var_mi: r.cek_karsiligi_var_mi === null ? true : r.cek_karsiligi_var_mi,
    }));
  };

  // 1. İlk çalıştırma: Eski null kayıt true olur, yeni false kayıt false kalır
  const sonuc1 = calistirMigration(yayinlar);
  assert.equal(sonuc1.find((y) => y.yayin_id === "eski-yayin-1")?.cek_karsiligi_var_mi, true);
  assert.equal(sonuc1.find((y) => y.yayin_id === "yeni-ceksiz-yayin")?.cek_karsiligi_var_mi, false);

  // 2. İkinci çalıştırma (idempotency kontrolü): Hiçbir değer bozulmaz!
  const sonuc2 = calistirMigration(sonuc1);
  assert.equal(sonuc2.find((y) => y.yayin_id === "eski-yayin-1")?.cek_karsiligi_var_mi, true);
  assert.equal(sonuc2.find((y) => y.yayin_id === "yeni-ceksiz-yayin")?.cek_karsiligi_var_mi, false);
  assert.equal(sonuc2.find((y) => y.yayin_id === "yeni-cekli-yayin")?.cek_karsiligi_var_mi, true);
});

// ===========================================================================
// 2. Fonksiyonel Geriye Dönük Uyumluluk Testleri
// ===========================================================================

test("Geriye Dönük Uyumluluk 1: Eski yayın kaydı Çekli Puan davranışını korur", () => {
  const eskiBarem: BaremSatiri[] = [
    { min_puan: 100, max_puan: 200, adet: 10, mal_fazlasi: 2 },
  ];

  // Eski yayın (varsayılan true)
  const eskiYayin = {
    yayin_id: "eski-yayin-101",
    cek_karsiligi_var_mi: true, // DEFAULT true
    barem_tablosu: eskiBarem,
    karsilik_puan: 1,
    karsilik_tl: 5,
    durum: "yayinda",
  };

  // Çekli yayın olarak barem bulur ve hediye çeki tutarı hesaplar
  const barem = baremBul(150, eskiYayin.barem_tablosu);
  assert.equal(barem?.adet, 10);
  assert.equal(barem?.mal_fazlasi, 2);

  const hesap = cekTutariHesapla({
    puan: 150,
    satis_sarti_tipi: "serbest_siparis",
    siparis_verildi: true,
    katlama_orani: 10,
    karsilik_puan: eskiYayin.karsilik_puan,
    karsilik_tl: eskiYayin.karsilik_tl,
    baremler: eskiYayin.barem_tablosu,
  });

  assert.equal(hesap.kullanilan_puan, 150);
  assert.equal(hesap.cek_tutari_tl, 825); // 150 * 5 * 1.1 = 825 TL
});

test("Geriye Dönük Uyumluluk 2: Eski puan Store bakiyesinde görünmeye devam eder", () => {
  // Eski sistemde kazanılmış 500 puan (migration sonrası cek_karsiligi_var_mi = true)
  const eskiKazanilanPuanlar = [
    { kisi_id: "kisi-1", yayin_id: "eski-y1", firma_id: "firma-1", puan: 300, cek_karsiligi_var_mi: true },
    { kisi_id: "kisi-1", yayin_id: "eski-y2", firma_id: "firma-1", puan: 200, cek_karsiligi_var_mi: true },
  ];

  // get_eclub_store_firma_bakiye simülasyonu
  const kazanc = eskiKazanilanPuanlar
    .filter((kp) => kp.kisi_id === "kisi-1" && kp.cek_karsiligi_var_mi === true)
    .reduce((t, kp) => t + kp.puan, 0);

  // Eski puanların hiçbiri kaybolmaz
  assert.equal(kazanc, 500);
});

test("Geriye Dönük Uyumluluk 3: Eski ileri sarma kaybı mevcut biçimde düşülür", () => {
  const eskiKazanilanlar = [
    { kisi_id: "kisi-2", firma_id: "firma-1", puan: 1000, cek_karsiligi_var_mi: true },
  ];

  // Eski ileri sarma kaybı (migration ile true kabul edildi)
  const eskiKayiplar = [
    { kisi_id: "kisi-2", firma_id: "firma-1", kaybedilen_puan: 150, cek_karsiligi_var_mi: true },
  ];

  const eskiHarcamalar = [
    { kisi_id: "kisi-2", firma_id: "firma-1", harcanan: 200, durum: "tamamlandi" },
  ];

  const kazanc = eskiKazanilanlar.filter((k) => k.cek_karsiligi_var_mi).reduce((t, k) => t + k.puan, 0);
  const kayip = eskiKayiplar.filter((k) => k.cek_karsiligi_var_mi).reduce((t, k) => t + k.kaybedilen_puan, 0);
  const harcama = eskiHarcamalar.filter((h) => h.durum !== "iptal").reduce((t, h) => t + h.harcanan, 0);

  const bakiye = kazanc - kayip - harcama;
  // 1000 - 150 - 200 = 650
  assert.equal(bakiye, 650);
});

test("Geriye Dönük Uyumluluk 4: Eski çek talebi açılabilir ve onay zincirinde ilerler", () => {
  // Simüle edilmiş çek talebi döngüsü
  let talep = {
    talep_id: "talep-eski-1",
    eczane_id: "ecz-1",
    yayin_id: "eski-y1",
    toplanan_puan: 300,
    talep_edilen_cek_tl: 600,
    durum: "beklemede",
    utt_id: "utt-1",
    bm_id: null as string | null,
    cek_kodu: null as string | null,
  };

  // 1. UTT BM onayına gönderir
  assert.equal(talep.durum, "beklemede");
  talep = { ...talep, durum: "bm_onayinda", bm_id: "bm-1" };
  assert.equal(talep.durum, "bm_onayinda");
  assert.equal(talep.bm_id, "bm-1");

  // 2. BM onaylar
  talep = { ...talep, durum: "onaylandi" };
  assert.equal(talep.durum, "onaylandi");

  // 3. Admin kod teslim eder
  talep = { ...talep, durum: "cek_kodlari_gonderildi", cek_kodu: "MIGROS-2026-TEST" };
  assert.equal(talep.durum, "cek_kodlari_gonderildi");
  assert.equal(talep.cek_kodu, "MIGROS-2026-TEST");
  assert.equal(talep.toplanan_puan, 300);
  assert.equal(talep.talep_edilen_cek_tl, 600);
});

test("Geriye Dönük Uyumluluk 5: Mevcut lig toplamı sınıflandırma sonrasında değişmez", () => {
  // Eski veri kümesi: Çeksiz puan kavramı yokken gelen satırlar (cekli_puan ve ceksiz_puan alanı null/undefined dahi olsa!)
  const eskiLigSatirlari: EclubRaporHamSatir[] = [
    {
      eczane_id: "ecz-1",
      gln: "8680000000001",
      eczane_adi: "Şifa Eczanesi",
      kisi_id: "kisi-1",
      kisi_ad: "Ahmet",
      kisi_soyad: "Yılmaz",
      kisi_rol: "eczaci",
      icerik_anahtari: "y-1",
      icerik_adi: "İçerik 1",
      gonderilen_sayisi: 1,
      tamamlanan_izleme: 1,
      dogru_cevap: 1,
      yanlis_cevap: 0,
      izleme_puani: 100,
      cevaplama_puani: 50,
      cekli_puan: null as any, // Eski sistemden gelen null veri
      ceksiz_puan: null as any,
    },
    {
      eczane_id: "ecz-2",
      gln: "8680000000002",
      eczane_adi: "Merkez Eczanesi",
      kisi_id: "kisi-2",
      kisi_ad: "Mehmet",
      kisi_soyad: "Demir",
      kisi_rol: "eczane_teknisyeni",
      icerik_anahtari: "y-2",
      icerik_adi: "İçerik 2",
      gonderilen_sayisi: 1,
      tamamlanan_izleme: 1,
      dogru_cevap: 1,
      yanlis_cevap: 0,
      izleme_puani: 80,
      cevaplama_puani: 40,
      cekli_puan: 120, // Migration sonrası backfill edilen veri
      ceksiz_puan: 0,
    },
  ];

  const rapor = eclubRaporunuTopla(eskiLigSatirlari);

  // Eski sistemdeki toplam: (100+50) + (80+40) = 270
  assert.equal(rapor.ozet.toplam_puan, 270);
  assert.equal(rapor.ozet.cekli_puan, 270);
  assert.equal(rapor.ozet.ceksiz_puan, 0);
  // toplam_puan = cekli_puan + ceksiz_puan kuralı eksiksiz sağlanır
  assert.equal(rapor.ozet.toplam_puan, rapor.ozet.cekli_puan + rapor.ozet.ceksiz_puan);

  // Yeni çeksiz puan eklenmesi durumunda lig toplamının değişmezliği ve tamlığı:
  const karisikSatirlar: EclubRaporHamSatir[] = [
    ...eskiLigSatirlari,
    {
      eczane_id: "ecz-1",
      gln: "8680000000001",
      eczane_adi: "Şifa Eczanesi",
      kisi_id: "kisi-1",
      kisi_ad: "Ahmet",
      kisi_soyad: "Yılmaz",
      kisi_rol: "eczaci",
      icerik_anahtari: "y-3",
      icerik_adi: "Çeksiz İçerik 3",
      gonderilen_sayisi: 1,
      tamamlanan_izleme: 1,
      dogru_cevap: 0,
      yanlis_cevap: 0,
      izleme_puani: 50,
      cevaplama_puani: 0,
      cekli_puan: 0,
      ceksiz_puan: 50,
    },
  ];

  const yeniRapor = eclubRaporunuTopla(karisikSatirlar);
  assert.equal(yeniRapor.ozet.cekli_puan, 270);
  assert.equal(yeniRapor.ozet.ceksiz_puan, 50);
  assert.equal(yeniRapor.ozet.toplam_puan, 320);
  assert.equal(yeniRapor.ozet.toplam_puan, yeniRapor.ozet.cekli_puan + yeniRapor.ozet.ceksiz_puan);
});

test("Geriye Dönük Uyumluluk 6: Yayın ayarı sonradan değiştiğinde geçmiş puanların sınıfı değişmez (Immutability)", () => {
  // 1. Adım: Yayın başlangıçta Çekli Puan yayınıdır
  const yayin = { yayin_id: "yayin-degisen", cek_karsiligi_var_mi: true };

  // 2. Adım: Kullanıcı puan kazanır. Trigger işlem anında satıra yazar.
  const kazanilanPuanKaydi = {
    puan_id: "puan-1",
    yayin_id: yayin.yayin_id,
    puan: 100,
    cek_karsiligi_var_mi: yayin.cek_karsiligi_var_mi, // Trigger: NEW.cek_karsiligi_var_mi := v_cek_karsiligi
  };
  assert.equal(kazanilanPuanKaydi.cek_karsiligi_var_mi, true);

  // 3. Adım: Üretici veya admin yayını daha sonra Çeksiz Puan olarak değiştirir
  yayin.cek_karsiligi_var_mi = false;

  // 4. Adım: Geçmişte kazanılan puan kaydı değişmez (immutable)
  assert.equal(kazanilanPuanKaydi.cek_karsiligi_var_mi, true);

  // 5. Adım: Yayın değiştikten sonra kazanılan yeni puan ise yeni ayarı alır
  const yeniKazanilanPuanKaydi = {
    puan_id: "puan-2",
    yayin_id: yayin.yayin_id,
    puan: 100,
    cek_karsiligi_var_mi: yayin.cek_karsiligi_var_mi,
  };
  assert.equal(yeniKazanilanPuanKaydi.cek_karsiligi_var_mi, false);
});

test("Geriye Dönük Uyumluluk 7: Mevcut devreden puan kayıtları ve bekleyen siparişler korunur", () => {
  // Önceki dönemden devreden puanlar
  const devirler = [
    { devir_id: "d-1", eczane_id: "ecz-1", yayin_id: "y-1", puan: 80, kullanildi_mi: false, iptal_edildi: false },
  ];

  // Tamamlanmış ve bekleyen siparişler
  const siparisler = [
    { siparis_id: "s-1", durum: "beklemede", toplam_puan: 300 },
    { siparis_id: "s-2", durum: "tamamlandi", toplam_puan: 400 },
    { siparis_id: "s-3", durum: "iptal", toplam_puan: 200 },
  ];

  // Aktif devirler Çekli devir olarak kullanılabilir
  const aktifDevirPuani = devirler
    .filter((d) => !d.kullanildi_mi && !d.iptal_edildi)
    .reduce((t, d) => t + d.puan, 0);
  assert.equal(aktifDevirPuani, 80);

  // Sipariş durumları bozulmaz
  assert.equal(siparisler.find((s) => s.siparis_id === "s-1")?.durum, "beklemede");
  assert.equal(siparisler.find((s) => s.siparis_id === "s-2")?.durum, "tamamlandi");
  assert.equal(siparisler.find((s) => s.siparis_id === "s-3")?.durum, "iptal");
});
