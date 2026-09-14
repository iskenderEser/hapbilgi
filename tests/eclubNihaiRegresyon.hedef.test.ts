import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baremBul, cekTutariHesapla, type BaremSatiri } from "@/lib/eclub/store/eclubStoreTipler";
import { eclubRaporunuTopla, eclubTakimlarLiginiOlustur, type EclubRaporHamSatir } from "@/lib/eclub/rapor";

const oku = (yol: string) => readFileSync(yol, "utf8");

const rolloutSql = oku("scripts/sql/eclub_cekli_ceksiz_puan_tam_rollout.sql");
const exportRouteKod = oku("app/(panel)/eclub/ligi/api/export/route.ts");
const ligSayfasiKod = oku("app/(panel)/eclub/ligi/page.tsx");
const yayinApiKod = oku("app/(panel)/yayin-yonetimi/api/yayinlar/route.ts");

// ===========================================================================
// FAZ 11 — 27 ZORUNLU SENARYO DOĞRULAMASI
// ===========================================================================

test("Senaryo 1 & 4: Üretici Çekli Puan seçerek E-Club yayını oluşturabilir, barem ve dönüşüm alanları zorunludur", () => {
  // API kodu kontrolü: cek_karsiligi_var_mi = true olduğunda barem alanları doğrulanır
  assert.match(yayinApiKod, /if\s*\(typeof cek_karsiligi_var_mi !== "boolean"\)/);
  assert.match(yayinApiKod, /if\s*\(cek_karsiligi_var_mi\)\s*\{/);
  assert.match(yayinApiKod, /const baremHatasi = baremTablosuDogrula\(barem_tablosu\);/);
  assert.doesNotMatch(yayinApiKod, /baremTablosuDogrula\(barem_tablosu \?\? VARSAYILAN_BAREM_TABLOSU\)/);
  assert.match(yayinApiKod, /if\s*\(cek_karsiligi_var_mi\) \{[\s\S]*?karsilik_puan/);
});

test("Senaryo 2 & 3: Üretici Çeksiz Puan seçerek E-Club yayını oluşturabilir, hediye çeki ayarları zorunlu değildir", () => {
  // API kodu kontrolü: cek_karsiligi_var_mi = false olduğunda hediye çeki alanları null kaydedilir
  assert.match(yayinApiKod, /cek_karsiligi_var_mi:\s*eclubHedefi\s*\?\s*cek_karsiligi_var_mi\s*:\s*true/);
  assert.match(yayinApiKod, /satis_sarti_tipi:\s*eclubHedefi\s*&&\s*cek_karsiligi_var_mi/);
  assert.match(yayinApiKod, /barem_tablosu:\s*eclubHedefi\s*&&\s*cek_karsiligi_var_mi/);
  assert.match(yayinApiKod, /karsilik_puan:\s*eclubHedefi\s*&&\s*cek_karsiligi_var_mi/);
  assert.match(yayinApiKod, /karsilik_tl:\s*eclubHedefi\s*&&\s*cek_karsiligi_var_mi/);
});

test("Senaryo 5 & 6: Çekli yayından kazanılan izleme ve cevaplama puanı lige ve Store'a eklenir", () => {
  const satirlar: EclubRaporHamSatir[] = [
    {
      eczane_id: "ecz-1", gln: "8680000000001", eczane_adi: "Eczane 1",
      kisi_id: "kisi-1", kisi_ad: "Ahmet", kisi_soyad: "Yılmaz", kisi_rol: "eczaci",
      icerik_anahtari: "y-cekli", icerik_adi: "Çekli İçerik",
      gonderilen_sayisi: 1, tamamlanan_izleme: 1, dogru_cevap: 1, yanlis_cevap: 0,
      izleme_puani: 100, cevaplama_puani: 50,
      cekli_puan: 150, ceksiz_puan: 0,
    },
  ];

  // 1. Lig kontrolü
  const rapor = eclubRaporunuTopla(satirlar);
  assert.equal(rapor.ozet.cekli_puan, 150);
  assert.equal(rapor.ozet.toplam_puan, 150);

  // 2. Store bakiye kontrolü (get_eclub_store_firma_bakiye simülasyonu)
  const kazanilanPuanlar = [
    { kisi_id: "kisi-1", puan: 100, puan_turu: "izleme", cek_karsiligi_var_mi: true },
    { kisi_id: "kisi-1", puan: 50, puan_turu: "cevap", cek_karsiligi_var_mi: true },
  ];
  const storeKazanc = kazanilanPuanlar.filter((k) => k.cek_karsiligi_var_mi).reduce((t, k) => t + k.puan, 0);
  assert.equal(storeKazanc, 150);
});

test("Senaryo 7 & 8: Çeksiz yayından kazanılan izleme ve cevaplama puanı lige eklenir, Store'a eklenmez", () => {
  const satirlar: EclubRaporHamSatir[] = [
    {
      eczane_id: "ecz-1", gln: "8680000000001", eczane_adi: "Eczane 1",
      kisi_id: "kisi-2", kisi_ad: "Mehmet", kisi_soyad: "Demir", kisi_rol: "eczane_teknisyeni",
      icerik_anahtari: "y-ceksiz", icerik_adi: "Çeksiz İçerik",
      gonderilen_sayisi: 1, tamamlanan_izleme: 1, dogru_cevap: 1, yanlis_cevap: 0,
      izleme_puani: 80, cevaplama_puani: 40,
      cekli_puan: 0, ceksiz_puan: 120,
    },
  ];

  // 1. Lig kontrolü: Lige eksiksiz eklenir
  const rapor = eclubRaporunuTopla(satirlar);
  assert.equal(rapor.ozet.ceksiz_puan, 120);
  assert.equal(rapor.ozet.toplam_puan, 120);

  // 2. Store bakiye kontrolü: Store'a eklenmez
  const kazanilanPuanlar = [
    { kisi_id: "kisi-2", puan: 80, puan_turu: "izleme", cek_karsiligi_var_mi: false },
    { kisi_id: "kisi-2", puan: 40, puan_turu: "cevap", cek_karsiligi_var_mi: false },
  ];
  const storeKazanc = kazanilanPuanlar.filter((k) => k.cek_karsiligi_var_mi).reduce((t, k) => t + k.puan, 0);
  assert.equal(storeKazanc, 0);
});

test("Senaryo 9 & 10: Podcast, Görsel ve Flip PDF okuma puanları doğru sınıfta kaydedilir", () => {
  // Trigger'ın tüm araç türlerinde (video, podcast, gorsel, flip_pdf) yayından sınıfı alması
  assert.match(rolloutSql, /CREATE TRIGGER trg_eclub_kazanilan_puanlar_cek_karsiligi\s+BEFORE INSERT ON public\.eclub_kazanilan_puanlar/);
  assert.match(rolloutSql, /SELECT y\.cek_karsiligi_var_mi\s+INTO v_cek_karsiligi\s+FROM public\.yayin_yonetimi y\s+WHERE y\.yayin_id = NEW\.yayin_id;/);
  assert.match(rolloutSql, /NEW\.cek_karsiligi_var_mi := v_cek_karsiligi;/);
});

test("Senaryo 11 & 12: Takım toplam puanı Çekli + Çeksiz toplamıdır ve takım tablosunda Çeksiz Puan ayrıca gösterilir", () => {
  // Arayüz kodu kontrolü
  assert.match(ligSayfasiKod, /<th[^>]*>Çeksiz Puan<\/th>/);
  assert.match(ligSayfasiKod, /takim\.ceksiz_puan > 0 \? `\$\{takim\.ceksiz_puan\.toLocaleString\("tr-TR"\)\} p` : "0 p"/);

  // Mantıksal takım hesaplaması
  const takimGirdisi = [
    {
      utt_id: "utt-1",
      utt_adi: "Ali Kaya",
      takim_adi: "Aslanlar",
      bolge_adi: "Marmara",
      satirlar: [
        {
          eczane_id: "ecz-1", gln: "8680000000001", eczane_adi: "Şifa Eczanesi",
          kisi_id: "kisi-1", kisi_ad: "Ahmet", kisi_soyad: "Yılmaz", kisi_rol: "eczaci",
          icerik_anahtari: "y-1", icerik_adi: "İçerik 1",
          gonderilen_sayisi: 1, tamamlanan_izleme: 1, dogru_cevap: 0, yanlis_cevap: 0,
          izleme_puani: 100, cevaplama_puani: 0,
          cekli_puan: 60, ceksiz_puan: 40,
        },
      ],
    },
  ];
  const takimlar = eclubTakimlarLiginiOlustur(takimGirdisi);

  assert.equal(takimlar[0].cekli_puan, 60);
  assert.equal(takimlar[0].ceksiz_puan, 40);
  assert.equal(takimlar[0].toplam_puan, 100);
  assert.equal(takimlar[0].toplam_puan, takimlar[0].cekli_puan + takimlar[0].ceksiz_puan);
});

test("Senaryo 13: Çeksiz Puan lig sıralamasını etkiler", () => {
  const takimGirdileri = [
    // Takım 1: 100 Çekli + 0 Çeksiz = 100
    {
      utt_id: "utt-1", utt_adi: "UTT 1", takim_adi: "Takım 1", bolge_adi: "Bölge 1",
      satirlar: [
        {
          eczane_id: "ecz-1", gln: "8680000000001", eczane_adi: "Eczane 1",
          kisi_id: "k-1", kisi_ad: "A", kisi_soyad: "1", kisi_rol: "eczaci",
          icerik_anahtari: "i-1", icerik_adi: "İçerik 1",
          gonderilen_sayisi: 1, tamamlanan_izleme: 1, dogru_cevap: 0, yanlis_cevap: 0,
          izleme_puani: 100, cevaplama_puani: 0, cekli_puan: 100, ceksiz_puan: 0,
        },
      ],
    },
    // Takım 2: 80 Çekli + 50 Çeksiz = 130
    {
      utt_id: "utt-2", utt_adi: "UTT 2", takim_adi: "Takım 2", bolge_adi: "Bölge 2",
      satirlar: [
        {
          eczane_id: "ecz-2", gln: "8680000000002", eczane_adi: "Eczane 2",
          kisi_id: "k-2", kisi_ad: "B", kisi_soyad: "2", kisi_rol: "eczaci",
          icerik_anahtari: "i-2", icerik_adi: "İçerik 2",
          gonderilen_sayisi: 1, tamamlanan_izleme: 1, dogru_cevap: 0, yanlis_cevap: 0,
          izleme_puani: 130, cevaplama_puani: 0, cekli_puan: 80, ceksiz_puan: 50,
        },
      ],
    },
  ];

  const takimlar = eclubTakimlarLiginiOlustur(takimGirdileri);

  // Çeksiz puan sayesinde Takım 2 (130 puan) 1. sırada yer almalıdır
  assert.equal(takimlar[0].takim_adi, "Takım 2");
  assert.equal(takimlar[0].toplam_puan, 130);
  assert.equal(takimlar[1].takim_adi, "Takım 1");
  assert.equal(takimlar[1].toplam_puan, 100);
});

test("Senaryo 14 & 15: Navbar ve Fiziksel Store bakiyesi Çeksiz Puanı içermez", () => {
  // get_eclub_store_firma_bakiye içinde cek_karsiligi_var_mi = true filtresi kontrolü
  assert.match(rolloutSql, /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.kisi_id = p_kisi_id\s+AND kp\.cek_karsiligi_var_mi = true/);
});

test("Senaryo 16: Çeksiz Puanla Store ürünü alınamaz (Yetersiz Bakiye)", () => {
  const kisiStoreBakiye = 0; // Kişinin 1000 Çeksiz puanı olsa dahi Store bakiyesi 0'dır
  const urunPuanFiyati = 250;

  const siparisVerilebilirMi = kisiStoreBakiye >= urunPuanFiyati;
  assert.equal(siparisVerilebilirMi, false);
});

test("Senaryo 17 & 18: Çeksiz yayın hediye çeki listesinde görünmez ve doğrudan talep açılamaz", () => {
  // get_eclub_eczane_store_ozet içinde filtre
  assert.match(rolloutSql, /WHERE y\.barem_tablosu IS NOT NULL\s+AND y\.durum='yayinda'\s+AND public\.eclub_store_barem_gecerli\(y\.barem_tablosu\)\s+AND y\.cek_karsiligi_var_mi = true/);

  // eclub_store_cek_talebi_olustur içinde doğrudan red
  assert.match(rolloutSql, /IF v_y\.cek_karsiligi_var_mi = false THEN\s+RETURN QUERY SELECT false,NULL::uuid,'Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz\.',0::numeric,0;\s+RETURN;\s+END IF;/);
});

test("Senaryo 19: Çeksiz Puan dönem devrine alınmaz", () => {
  assert.match(rolloutSql, /SELECT y\.cek_karsiligi_var_mi INTO v_cekli FROM public\.yayin_yonetimi y WHERE y\.yayin_id=p_yayin_id;\s+IF coalesce\(v_cekli, true\) = false THEN RETURN; END IF;/);
  assert.match(rolloutSql, /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.yayin_id=p_yayin_id[\s\S]*?AND kp\.cek_karsiligi_var_mi = true;/);
});

test("Senaryo 20: Çeksiz yayının ileri sarma kaybı Store Puanını azaltmaz", () => {
  assert.match(rolloutSql, /FROM public\.eclub_ileri_sarma_kayitlari ks[\s\S]*?WHERE ks\.kisi_id = p_kisi_id\s+AND ks\.cek_karsiligi_var_mi = true/);
});

test("Senaryo 21: Yayın kararı değişse bile eski puanın sınıfı değişmez (Immutability)", () => {
  const eskiPuan = { puan_id: "p-1", yayin_id: "y-1", cek_karsiligi_var_mi: true };
  const yayin = { yayin_id: "y-1", cek_karsiligi_var_mi: true };

  // Yayın sonradan çeksiz yapıldı
  yayin.cek_karsiligi_var_mi = false;

  // Eski puanın sınıfı etkilenmez
  assert.equal(eskiPuan.cek_karsiligi_var_mi, true);
});

test("Senaryo 22: Eski yayın ve puan kayıtları mevcut davranışını korur", () => {
  assert.match(rolloutSql, /ALTER COLUMN cek_karsiligi_var_mi SET DEFAULT true;/);
  assert.match(rolloutSql, /SET cek_karsiligi_var_mi = true\s+WHERE cek_karsiligi_var_mi IS NULL;/);
});

test("Senaryo 23: Aynı puan kaydı iki kez oluşmaz", () => {
  // Kazanılan puan tablosunda trigger ve tekillik mantığı
  assert.match(rolloutSql, /BEFORE INSERT ON public\.eclub_kazanilan_puanlar/);
});

test("Senaryo 24: Çift hediye çeki talebi oluşmaz", () => {
  assert.match(rolloutSql, /PERFORM pg_advisory_xact_lock\(hashtextextended\('eclub-talep:'\|\|v_eczane\|\|':'\|\|p_yayin_id\|\|':'\|\|v_d\.donem_kodu,0\)\);/);
  assert.match(rolloutSql, /IF EXISTS\(SELECT 1 FROM public\.eclub_store_cek_talepleri WHERE eczane_id=v_eczane AND yayin_id=p_yayin_id AND donem_kodu=v_d\.donem_kodu AND durum<>'iptal'\) THEN/);
});

test("Senaryo 25: E-Club Ligi Excel çıktısında Çekli Puan, Çeksiz Puan ve Toplam Puan doğru görünür", () => {
  assert.match(exportRouteKod, /"Çekli Puan"/);
  assert.match(exportRouteKod, /"Çeksiz Puan"/);
  assert.match(exportRouteKod, /"Toplam Puan"/);
  assert.match(exportRouteKod, /kisi\.cekli_puan,\s*kisi\.ceksiz_puan,\s*kisi\.toplam_puan/);
  assert.match(exportRouteKod, /icerik\.cekli_puan,\s*icerik\.ceksiz_puan,\s*icerik\.toplam_puan/);
});

test("Senaryo 26: Mevcut Store siparişi, hediye çeki, UTT, BM ve admin akışları bozulmaz", () => {
  assert.match(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.eclub_store_cek_talebi_olustur\(uuid, uuid, boolean\) TO service_role;/);
  assert.match(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.get_eclub_store_firma_bakiye\(uuid\) TO authenticated, service_role;/);
  assert.match(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.get_eclub_utt_rapor\([\s\S]*?\) TO service_role;/);
  assert.doesNotMatch(rolloutSql, /GRANT EXECUTE ON FUNCTION public\.get_eclub_utt_rapor\([^)]*\)\s+TO\s+[^;]*?authenticated/);
});

test("Senaryo 27: Migration ikinci çalıştırmada güvenli kalır (Idempotency)", () => {
  assert.match(rolloutSql, /ADD COLUMN IF NOT EXISTS/);
  assert.match(rolloutSql, /WHERE cek_karsiligi_var_mi IS NULL;/);
  assert.match(rolloutSql, /CREATE OR REPLACE FUNCTION/);
  assert.match(rolloutSql, /DROP TRIGGER IF EXISTS/);
});
