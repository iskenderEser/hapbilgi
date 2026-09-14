import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baremBul, cekTutariHesapla, type BaremSatiri } from "@/lib/eclub/store/eclubStoreTipler";

const oku = (yol: string) => readFileSync(yol, "utf8");

const migrationSql = oku("scripts/sql/eclub_store_hediye_ceki_cekli_puan.sql");
const anaSql = oku("scripts/sql/eclub_store_yeni_donem_satis_sartli_cek.sql");

// ---------------------------------------------------------------------------
// 1. SQL Sözleşme Testleri (Migration & Ana SQL)
// ---------------------------------------------------------------------------

test("Faz 8 SQL Sözleşmesi: eclub_store_onceki_deviri_hazirla yalnız Çekli Puanı işler ve devreder", () => {
  for (const sql of [migrationSql, anaSql]) {
    // Çeksiz yayın kontrolü ve erken çıkış
    assert.match(sql, /SELECT y\.cek_karsiligi_var_mi INTO v_cekli FROM public\.yayin_yonetimi y WHERE y\.yayin_id=p_yayin_id/);
    assert.match(sql, /IF coalesce\(v_cekli, true\) = false THEN RETURN; END IF;/);

    // Kazanç toplarken yalnız çekli puanlar
    assert.match(sql, /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.yayin_id=p_yayin_id[\s\S]*?AND kp\.cek_karsiligi_var_mi = true;/);
  }
});

test("Faz 8 SQL Sözleşmesi: get_eclub_eczane_store_ozet çeksiz yayınları listelemez ve yalnız çekli puanı hesaplar", () => {
  for (const sql of [migrationSql, anaSql]) {
    // Devir hazırlığı döngüsünde y.cek_karsiligi_var_mi = true filtresi
    assert.match(sql, /FOR r IN[\s\S]*?FROM public\.yayin_yonetimi y[\s\S]*?AND y\.cek_karsiligi_var_mi = true\s+LOOP\s+PERFORM public\.eclub_store_onceki_deviri_hazirla/);

    // Kazanç CTE'sinde kp.cek_karsiligi_var_mi = true
    assert.match(sql, /kazanc AS \([\s\S]*?FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?AND kp\.cek_karsiligi_var_mi = true\s+GROUP BY kp\.yayin_id/);

    // Ana WHERE bloğunda y.cek_karsiligi_var_mi = true (çeksiz yayınlar listelenmez)
    assert.match(sql, /WHERE y\.barem_tablosu IS NOT NULL\s+AND y\.durum='yayinda'\s+AND public\.eclub_store_barem_gecerli\(y\.barem_tablosu\)\s+AND y\.cek_karsiligi_var_mi = true/);
  }
});

test("Faz 8 SQL Sözleşmesi: eclub_store_cek_talebi_olustur çeksiz yayını reddeder ve yalnız çekli puanı toplar", () => {
  for (const sql of [migrationSql, anaSql]) {
    // Çeksiz yayın durumunda kesin hata mesajı
    assert.match(sql, /IF v_y\.cek_karsiligi_var_mi = false THEN\s+RETURN QUERY SELECT false,NULL::uuid,'Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz\.',0::numeric,0;\s+RETURN;\s+END IF;/);

    // Puan toplarken kp.cek_karsiligi_var_mi = true
    assert.match(sql, /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.yayin_id=p_yayin_id[\s\S]*?AND kp\.cek_karsiligi_var_mi = true;/);
  }
});

// ---------------------------------------------------------------------------
// 2. Mantıksal İş Kuralı Simülasyonu
// ---------------------------------------------------------------------------

const testBaremler: BaremSatiri[] = [
  { min_puan: 100, max_puan: 299, adet: 5, mal_fazlasi: 1 },
  { min_puan: 300, max_puan: 600, adet: 15, mal_fazlasi: 5 },
];

interface KazanilanPuanKaydi {
  yayin_id: string;
  puan: number;
  cek_karsiligi_var_mi: boolean;
}

interface DevirKaydi {
  yayin_id: string;
  puan: number;
  kullanildi: boolean;
}

interface YayinKaydi {
  yayin_id: string;
  cek_karsiligi_var_mi: boolean;
  barem_tablosu: BaremSatiri[];
  karsilik_puan: number;
  karsilik_tl: number;
}

// Simüle edilmiş Hediye Çeki Talep Fonksiyonu
function simuleStoreCekTalebi(params: {
  yayin: YayinKaydi;
  kazanilanlar: KazanilanPuanKaydi[];
  devirler: DevirKaydi[];
  siparisVerilsinMi: boolean;
}): { ok: boolean; hata?: string; cek_tutari?: number; devreden_puan?: number; adet?: number; mf?: number } {
  const { yayin, kazanilanlar, devirler, siparisVerilsinMi } = params;

  // 1. Çeksiz yayın kontrolü
  if (!yayin.cek_karsiligi_var_mi) {
    return { ok: false, hata: "Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz." };
  }

  // 2. Yalnız Çekli Puanları topla
  const kazanc = kazanilanlar
    .filter((k) => k.yayin_id === yayin.yayin_id && k.cek_karsiligi_var_mi === true)
    .reduce((toplam, k) => toplam + k.puan, 0);

  // 3. Gelen devirleri topla
  const gelenDevir = devirler
    .filter((d) => d.yayin_id === yayin.yayin_id && !d.kullanildi)
    .reduce((toplam, d) => toplam + d.puan, 0);

  const toplamPuan = kazanc + gelenDevir;

  const minPuan = Math.min(...yayin.barem_tablosu.map((b) => b.min_puan));
  const maxPuan = Math.max(...yayin.barem_tablosu.map((b) => b.max_puan));

  // Minimum barem kontrolü
  if (toplamPuan < minPuan) {
    return {
      ok: false,
      hata: `Minimum ${minPuan} puan gereklidir; bakiye sonraki döneme devreder.`,
      cek_tutari: 0,
      devreden_puan: toplamPuan,
    };
  }

  const kullanilan = Math.min(toplamPuan, maxPuan);
  const devir = Math.max(toplamPuan - maxPuan, 0);

  const barem = baremBul(kullanilan, yayin.barem_tablosu);
  const cekTutari = Math.round((kullanilan * yayin.karsilik_tl) / Math.max(yayin.karsilik_puan, 1) * 100) / 100;

  return {
    ok: true,
    cek_tutari: cekTutari,
    devreden_puan: devir,
    adet: barem?.adet ?? 0,
    mf: barem?.mal_fazlasi ?? 0,
  };
}

// Simüle edilmiş Önceki Dönem Devri Hazırlama Fonksiyonu
function simuleStoreOncekiDeviriHazirla(params: {
  yayin: YayinKaydi;
  kazanilanlar: KazanilanPuanKaydi[];
  oncekiDevirler: DevirKaydi[];
}): { devirUretildiMi: boolean; devirPuani: number } {
  const { yayin, kazanilanlar, oncekiDevirler } = params;

  // Çeksiz yayında devir hazırlanmaz
  if (!yayin.cek_karsiligi_var_mi) {
    return { devirUretildiMi: false, devirPuani: 0 };
  }

  // Yalnız çekli puanlar
  const kazanc = kazanilanlar
    .filter((k) => k.yayin_id === yayin.yayin_id && k.cek_karsiligi_var_mi === true)
    .reduce((toplam, k) => toplam + k.puan, 0);

  const gelen = oncekiDevirler
    .filter((d) => d.yayin_id === yayin.yayin_id && !d.kullanildi)
    .reduce((toplam, d) => toplam + d.puan, 0);

  const toplam = kazanc + gelen;
  const minPuan = Math.min(...yayin.barem_tablosu.map((b) => b.min_puan));
  const maxPuan = Math.max(...yayin.barem_tablosu.map((b) => b.max_puan));

  let devir = 0;
  if (toplam > 0 && toplam < minPuan) {
    devir = toplam;
  } else if (toplam > maxPuan) {
    devir = toplam - maxPuan;
  }

  return {
    devirUretildiMi: devir > 0,
    devirPuani: devir,
  };
}

// ---------------------------------------------------------------------------
// 3. Senaryo Testleri
// ---------------------------------------------------------------------------

test("Çekli Puan bareme dahil edilir ve doğru hediye çeki tutarı hesaplanır", () => {
  const yayin: YayinKaydi = {
    yayin_id: "yayin-cekli-1",
    cek_karsiligi_var_mi: true,
    barem_tablosu: testBaremler,
    karsilik_puan: 1,
    karsilik_tl: 2,
  };

  const sonuc = simuleStoreCekTalebi({
    yayin,
    kazanilanlar: [{ yayin_id: "yayin-cekli-1", puan: 200, cek_karsiligi_var_mi: true }],
    devirler: [],
    siparisVerilsinMi: false,
  });

  assert.equal(sonuc.ok, true);
  assert.equal(sonuc.cek_tutari, 400); // 200 * 2 = 400 TL
  assert.equal(sonuc.devreden_puan, 0);
  assert.equal(sonuc.adet, 5);
  assert.equal(sonuc.mf, 1);
});

test("Çeksiz Puan barem hesabına dahil edilmez ve tek başına baremi sağlayamaz", () => {
  const yayin: YayinKaydi = {
    yayin_id: "yayin-cekli-2",
    cek_karsiligi_var_mi: true,
    barem_tablosu: testBaremler, // min 100 puan
    karsilik_puan: 1,
    karsilik_tl: 2,
  };

  // 150 çeksiz puan kazanılmış, 50 çekli puan kazanılmış
  const sonuc = simuleStoreCekTalebi({
    yayin,
    kazanilanlar: [
      { yayin_id: "yayin-cekli-2", puan: 150, cek_karsiligi_var_mi: false },
      { yayin_id: "yayin-cekli-2", puan: 50, cek_karsiligi_var_mi: true },
    ],
    devirler: [],
    siparisVerilsinMi: false,
  });

  // Toplam puan 200 gibi görünse de Çekli puan 50 < 100 olduğundan minimum baremi karşılayamaz!
  assert.equal(sonuc.ok, false);
  assert.match(sonuc.hata ?? "", /Minimum 100 puan gereklidir/);
  assert.equal(sonuc.devreden_puan, 50); // Sonraki döneme sadece 50 çekli puan devreder
});

test("Karışık puan durumunda yalnız Çekli Puan hediye çekine dönüşür", () => {
  const yayin: YayinKaydi = {
    yayin_id: "yayin-cekli-3",
    cek_karsiligi_var_mi: true,
    barem_tablosu: testBaremler,
    karsilik_puan: 1,
    karsilik_tl: 2,
  };

  // 120 çekli puan, 800 çeksiz puan
  const sonuc = simuleStoreCekTalebi({
    yayin,
    kazanilanlar: [
      { yayin_id: "yayin-cekli-3", puan: 120, cek_karsiligi_var_mi: true },
      { yayin_id: "yayin-cekli-3", puan: 800, cek_karsiligi_var_mi: false },
    ],
    devirler: [],
    siparisVerilsinMi: false,
  });

  assert.equal(sonuc.ok, true);
  // Yalnız 120 çekli puan üzerinden hesaplanmalı
  assert.equal(sonuc.cek_tutari, 240); // 120 * 2 = 240 TL
  assert.equal(sonuc.devreden_puan, 0);
  assert.equal(sonuc.adet, 5);
});

test("Çeksiz yayın için doğrudan hediye çeki talebi reddedilir", () => {
  const yayin: YayinKaydi = {
    yayin_id: "yayin-ceksiz-1",
    cek_karsiligi_var_mi: false,
    barem_tablosu: testBaremler,
    karsilik_puan: 1,
    karsilik_tl: 2,
  };

  const sonuc = simuleStoreCekTalebi({
    yayin,
    kazanilanlar: [{ yayin_id: "yayin-ceksiz-1", puan: 500, cek_karsiligi_var_mi: false }],
    devirler: [],
    siparisVerilsinMi: false,
  });

  assert.equal(sonuc.ok, false);
  assert.equal(sonuc.hata, "Çeksiz puan yayınları için hediye çeki talebi oluşturulamaz.");
});

test("Çeksiz Puan sonraki döneme Store Puanı olarak devretmez", () => {
  const yayin: YayinKaydi = {
    yayin_id: "yayin-ceksiz-devir",
    cek_karsiligi_var_mi: false,
    barem_tablosu: testBaremler,
    karsilik_puan: 1,
    karsilik_tl: 2,
  };

  // Çeksiz yayında 50 puan (min barem altı) birikmiş olsa dahi devir üretilmemelidir
  const sonuc = simuleStoreOncekiDeviriHazirla({
    yayin,
    kazanilanlar: [{ yayin_id: "yayin-ceksiz-devir", puan: 50, cek_karsiligi_var_mi: false }],
    oncekiDevirler: [],
  });

  assert.equal(sonuc.devirUretildiMi, false);
  assert.equal(sonuc.devirPuani, 0);
});

test("Çekli yayında çeksiz kazanılan puan devir hesabına girmez", () => {
  const yayin: YayinKaydi = {
    yayin_id: "yayin-cekli-devir",
    cek_karsiligi_var_mi: true,
    barem_tablosu: testBaremler, // min: 100, max: 600
    karsilik_puan: 1,
    karsilik_tl: 2,
  };

  // 700 puanın 650'si çeksiz, 50'si çekli olsun.
  // Toplam puan 700 > max (600) gibi görünse de çekli puan sadece 50 < min (100) dir.
  // Dolayısıyla yalnız 50 çekli puan sonraki döneme devreder.
  const sonuc = simuleStoreOncekiDeviriHazirla({
    yayin,
    kazanilanlar: [
      { yayin_id: "yayin-cekli-devir", puan: 650, cek_karsiligi_var_mi: false },
      { yayin_id: "yayin-cekli-devir", puan: 50, cek_karsiligi_var_mi: true },
    ],
    oncekiDevirler: [],
  });

  assert.equal(sonuc.devirUretildiMi, true);
  assert.equal(sonuc.devirPuani, 50); // Sadece çekli 50 puan devreder
});

test("Çekli Puan maksimum baremi aşarsa artan çekli puan devreder", () => {
  const yayin: YayinKaydi = {
    yayin_id: "yayin-cekli-max",
    cek_karsiligi_var_mi: true,
    barem_tablosu: testBaremler, // max: 600
    karsilik_puan: 1,
    karsilik_tl: 2,
  };

  // 750 çekli puan, 200 çeksiz puan
  const talep = simuleStoreCekTalebi({
    yayin,
    kazanilanlar: [
      { yayin_id: "yayin-cekli-max", puan: 750, cek_karsiligi_var_mi: true },
      { yayin_id: "yayin-cekli-max", puan: 200, cek_karsiligi_var_mi: false },
    ],
    devirler: [],
    siparisVerilsinMi: false,
  });

  assert.equal(talep.ok, true);
  assert.equal(talep.cek_tutari, 1200); // 600 * 2 = 1200 TL
  assert.equal(talep.devreden_puan, 150); // 750 - 600 = 150 çekli puan devreder (çeksiz 200 puan yok sayılır)
});
