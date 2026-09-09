export const HAPBI_ISLEM_TURLERI = [
  "dogrudan_deger",
  "toplam",
  "butunlesik",
  "karsilastirma",
  "siralama",
  "goreli_hesaplama",
  "fark",
  "katki",
  "egilim",
  "kosullu_secim",
] as const;

export type HapbiIslemTuru = (typeof HAPBI_ISLEM_TURLERI)[number];

export type HapbiIslemAlani =
  | "kapsam"
  | "veriAlani"
  | "zaman"
  | "olcut"
  | "sonucOlcutu"
  | "kirilim"
  | "filtreler"
  | "siralama"
  | "sonucSiniri"
  | "karsilastirma";

export type HapbiIslemTanimi = Readonly<{
  islem: HapbiIslemTuru;
  ortakAd: string;
  teknikKarsilik: string;
  zorunluAlanlar: readonly HapbiIslemAlani[];
  yasakAlanlar: readonly HapbiIslemAlani[];
}>;

const ORTAK_ALANLAR = [
  "kapsam",
  "veriAlani",
  "olcut",
  "kirilim",
] as const satisfies readonly HapbiIslemAlani[];

export const HAPBI_ISLEM_KATALOGU = {
  dogrudan_deger: {
    islem: "dogrudan_deger",
    ortakAd: "Doğrudan değer",
    teknikKarsilik: "Tek ölçütün seçilen kırılımdaki değerini getirir.",
    zorunluAlanlar: ORTAK_ALANLAR,
    yasakAlanlar: ["sonucOlcutu", "karsilastirma"],
  },
  toplam: {
    islem: "toplam",
    ortakAd: "Toplam",
    teknikKarsilik: "Seçilen kapsamdaki ölçüt değerlerini toplar.",
    zorunluAlanlar: ORTAK_ALANLAR,
    yasakAlanlar: ["sonucOlcutu", "karsilastirma"],
  },
  butunlesik: {
    islem: "butunlesik",
    ortakAd: "Bütünleşik",
    teknikKarsilik: "Bir ölçütle seçim yapıp seçilen varlığın başka ölçütteki değerini getirir.",
    zorunluAlanlar: [...ORTAK_ALANLAR, "sonucOlcutu", "siralama", "sonucSiniri"],
    yasakAlanlar: ["karsilastirma"],
  },
  karsilastirma: {
    islem: "karsilastirma",
    ortakAd: "Karşılaştırma",
    teknikKarsilik: "Kapsamı ve zamanı ayrı tanımlanan iki tarafı karşılaştırır.",
    zorunluAlanlar: [...ORTAK_ALANLAR, "karsilastirma"],
    yasakAlanlar: ["sonucOlcutu"],
  },
  siralama: {
    islem: "siralama",
    ortakAd: "Sıralama",
    teknikKarsilik: "Varlıkları seçilen ölçüte göre sıralar.",
    zorunluAlanlar: [...ORTAK_ALANLAR, "siralama"],
    yasakAlanlar: ["sonucOlcutu", "karsilastirma"],
  },
  goreli_hesaplama: {
    islem: "goreli_hesaplama",
    ortakAd: "Göreli hesaplama",
    teknikKarsilik: "Seçilen ölçütün oranını, payını veya dağılımını hesaplar.",
    zorunluAlanlar: ORTAK_ALANLAR,
    yasakAlanlar: ["sonucOlcutu", "karsilastirma"],
  },
  fark: {
    islem: "fark",
    ortakAd: "Fark",
    teknikKarsilik: "Kapsamı ve zamanı ayrı tanımlanan iki taraf arasındaki sayısal farkı hesaplar.",
    zorunluAlanlar: [...ORTAK_ALANLAR, "karsilastirma"],
    yasakAlanlar: ["sonucOlcutu"],
  },
  katki: {
    islem: "katki",
    ortakAd: "Katkı",
    teknikKarsilik: "Bir toplamı oluşturan kırılım kaynaklarının katkısını gösterir.",
    zorunluAlanlar: ORTAK_ALANLAR,
    yasakAlanlar: ["sonucOlcutu", "karsilastirma"],
  },
  egilim: {
    islem: "egilim",
    ortakAd: "Eğilim",
    teknikKarsilik: "Ayrı zamanları tanımlanan iki taraf arasında ölçütün yönünü hesaplar.",
    zorunluAlanlar: [...ORTAK_ALANLAR, "karsilastirma"],
    yasakAlanlar: ["sonucOlcutu"],
  },
  kosullu_secim: {
    islem: "kosullu_secim",
    ortakAd: "Koşullu seçim",
    teknikKarsilik: "Belirtilen süzme koşullarını sağlayan varlıkları getirir.",
    zorunluAlanlar: [...ORTAK_ALANLAR, "filtreler"],
    yasakAlanlar: ["sonucOlcutu", "karsilastirma"],
  },
} as const satisfies Readonly<Record<HapbiIslemTuru, HapbiIslemTanimi>>;

export function hapbiIslemTurunuBul(islem: string): HapbiIslemTanimi | null {
  return HAPBI_ISLEM_KATALOGU[islem as HapbiIslemTuru] ?? null;
}
