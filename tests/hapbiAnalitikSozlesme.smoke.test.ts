import assert from "node:assert/strict";
import test from "node:test";
import {
  HAPBI_ANALITIK_SURUMU,
  hapbiAnalitikSorguyuDogrula,
  type HapbiAnalitikSorgu,
} from "@/lib/hapbi/analitik/sozlesme";
import {
  hapbiKanonikSorguyuDogrula,
  type HapbiKanonikSorgu,
} from "@/lib/hapbi/niyet/sozlesme";

function temelSorgu(): HapbiAnalitikSorgu {
  return {
    surum: HAPBI_ANALITIK_SURUMU,
    veri_alani: "tclub",
    kapsam: {
      tur: "takim",
      kaynak_rol: "pm",
      kullanici_id: "pm-1",
      firma_id: "firma-1",
      takim_id: "takim-1",
    },
    donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
    olcutler: ["net_puan"],
    boyutlar: ["urun"],
    filtreler: [],
    islem: "siralama",
    siralama: { olcut: "net_puan", yon: "azalan" },
    limit: 1,
  };
}

test("kanonik analitik sözleşme: ürün yöneticisinin takım içi ürün sıralamasını taşır", () => {
  assert.deepEqual(hapbiAnalitikSorguyuDogrula(temelSorgu()), temelSorgu());
});

test("kanonik analitik sözleşme: firma yöneticisinin takım, ürün ve kullanıcı kırılımını birlikte taşır", () => {
  const sorgu: HapbiAnalitikSorgu = {
    ...temelSorgu(),
    kapsam: {
      tur: "firma",
      kaynak_rol: "gm",
      kullanici_id: "gm-1",
      firma_id: "firma-1",
    },
    olcutler: ["net_puan", "ileri_sarma_kaybi"],
    boyutlar: ["takim", "urun", "kullanici"],
    islem: "dagilim",
    siralama: { olcut: "ileri_sarma_kaybi", yon: "azalan" },
    limit: 20,
  };
  assert.deepEqual(hapbiAnalitikSorguyuDogrula(sorgu), sorgu);
});

test("kanonik analitik sözleşme: eksik, yinelenen veya uyumsuz alanları reddeder", () => {
  assert.throws(() => hapbiAnalitikSorguyuDogrula({ ...temelSorgu(), olcutler: [] }), /en az bir ölçüt/);
  assert.throws(() => hapbiAnalitikSorguyuDogrula({ ...temelSorgu(), boyutlar: ["urun", "urun"] }), /yinelenen boyut/);
  assert.throws(() => hapbiAnalitikSorguyuDogrula({ ...temelSorgu(), limit: 101 }), /1 ile 100/);
  assert.throws(() => hapbiAnalitikSorguyuDogrula({ ...temelSorgu(), siralama: { olcut: "ileri_sarma_kaybi", yon: "azalan" } }), /ölçütleri arasında/);
  assert.throws(() => hapbiAnalitikSorguyuDogrula({ ...temelSorgu(), islem: "karsilastirma" }), /Karşılaştırma dönemi/);
});

function temelKanonikSorgu(): HapbiKanonikSorgu {
  return {
    veriAlani: "tclub",
    donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
    olcutler: ["net_puan"],
    boyutlar: ["urun"],
    filtreler: [],
    islem: "siralama",
    cevapTuru: "sayisal",
  };
}

test("Faz 1 kanonik sözleşme: geçersiz dönemi reddeder", () => {
  assert.throws(
    () => hapbiKanonikSorguyuDogrula({ ...temelKanonikSorgu(), donem: { tur: "ceyrek", yil: 2026, ceyrek: 5 } }),
    /Geçersiz dönem/,
  );
});

test("Faz 1 kanonik sözleşme: yinelenen ölçüt ve boyutu reddeder", () => {
  assert.throws(
    () => hapbiKanonikSorguyuDogrula({ ...temelKanonikSorgu(), olcutler: ["net_puan", "net_puan"] }),
    /Yinelenen ölçüt/,
  );
  assert.throws(
    () => hapbiKanonikSorguyuDogrula({ ...temelKanonikSorgu(), boyutlar: ["urun", "urun"] }),
    /Yinelenen boyut/,
  );
});

test("Faz 1 kanonik sözleşme: desteklenmeyen veri alanı–ölçüt birleşimini reddeder", () => {
  assert.throws(
    () => hapbiKanonikSorguyuDogrula({ ...temelKanonikSorgu(), veriAlani: "uretim", olcutler: ["net_puan"] }),
    /Desteklenmeyen veri alanı–ölçüt birleşimi/,
  );
});

test("Faz 1 kanonik sözleşme: eksik zorunlu alanı netleştirmeye dönüştürür", () => {
  assert.deepEqual(
    hapbiKanonikSorguyuDogrula({ ...temelKanonikSorgu(), donem: undefined }),
    {
      tur: "netlestirme",
      eksikAlanlar: ["donem"],
      soru: "Lütfen donem bilgisini belirtin.",
    },
  );
});
