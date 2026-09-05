import { hapbiDonemiDogrula, type HapbiDonem } from "@/lib/hapbi/niyet/donem";

export type { HapbiDonem } from "@/lib/hapbi/niyet/donem";

export type HapbiVeriAlani = "tclub" | "cclub" | "eclub" | "uretim";

export type HapbiOlcut =
  | "net_puan"
  | "kazanilan_puan"
  | "kaybedilen_puan"
  | "izleme_puani"
  | "cevaplama_puani"
  | "oneri_puani"
  | "extra_puan"
  | "ileri_sarma_kaybi"
  | "yanlis_cevap_kaybi"
  | "oneri_kaybi"
  | "challenge_puani"
  | "challenge_kaybi"
  | "tamamlama_sayisi"
  | "benzersiz_yayin_sayisi"
  | "gonderim_sayisi"
  | "cevap_sayisi"
  | "dogru_cevap_sayisi"
  | "yanlis_cevap_sayisi"
  | "yayin_sayisi"
  | "gorev_sayisi"
  | "talep_sayisi";

export type HapbiBoyut =
  | "firma"
  | "takim"
  | "bm_kapsami"
  | "kullanici"
  | "eczane"
  | "urun"
  | "icerik"
  | "kategori"
  | "arac_turu"
  | "yayin"
  | "durum"
  | "uretim_varyanti"
  | "zaman";

export type HapbiIslem =
  | "toplam"
  | "liste"
  | "siralama"
  | "fark"
  | "dagilim"
  | "katki"
  | "karsilastirma"
  | "egilim"
  | "detay"
  | "oneri";

export interface HapbiFiltre {
  boyut: Exclude<HapbiBoyut, "zaman">;
  kimlikler: string[];
}

export type HapbiCevapTuru = "sayisal" | "yorum";

export interface HapbiNetlestirme {
  tur: "netlestirme";
  eksikAlanlar: Array<"veriAlani" | "donem" | "olcutler" | "boyutlar" | "filtreler" | "islem" | "cevapTuru">;
  soru: string;
}

export interface HapbiKanonikSorgu {
  veriAlani: HapbiVeriAlani;
  donem: HapbiDonem;
  olcutler: HapbiOlcut[];
  boyutlar: HapbiBoyut[];
  filtreler: HapbiFiltre[];
  islem: HapbiIslem;
  cevapTuru: HapbiCevapTuru;
}

const PUAN_OLCUTLERI: readonly HapbiOlcut[] = [
  "net_puan",
  "kazanilan_puan",
  "kaybedilen_puan",
  "izleme_puani",
  "cevaplama_puani",
  "oneri_puani",
  "extra_puan",
  "ileri_sarma_kaybi",
  "yanlis_cevap_kaybi",
  "oneri_kaybi",
  "challenge_puani",
  "challenge_kaybi",
  "tamamlama_sayisi",
  "benzersiz_yayin_sayisi",
  "gonderim_sayisi",
  "cevap_sayisi",
  "dogru_cevap_sayisi",
  "yanlis_cevap_sayisi",
  "yayin_sayisi",
];

const DESTEKLENEN_OLCUTLER: Record<HapbiVeriAlani, readonly HapbiOlcut[]> = {
  tclub: PUAN_OLCUTLERI.filter((olcut) => olcut !== "challenge_puani" && olcut !== "challenge_kaybi"),
  cclub: PUAN_OLCUTLERI.filter((olcut) => olcut !== "oneri_puani" && olcut !== "oneri_kaybi"),
  eclub: [
    "net_puan",
    "kazanilan_puan",
    "kaybedilen_puan",
    "izleme_puani",
    "cevaplama_puani",
    "ileri_sarma_kaybi",
    "tamamlama_sayisi",
    "gonderim_sayisi",
    "cevap_sayisi",
    "dogru_cevap_sayisi",
    "yanlis_cevap_sayisi",
  ],
  uretim: ["talep_sayisi", "gorev_sayisi", "yayin_sayisi"],
};

const ZORUNLU_ALANLAR = [
  "veriAlani",
  "donem",
  "olcutler",
  "boyutlar",
  "filtreler",
  "islem",
  "cevapTuru",
] as const;

function tekilMi<T>(degerler: T[]): boolean {
  return new Set(degerler).size === degerler.length;
}

export function hapbiKanonikSorguyuDogrula(
  girdi: Partial<HapbiKanonikSorgu>,
): HapbiKanonikSorgu | HapbiNetlestirme {
  const eksikAlanlar = ZORUNLU_ALANLAR.filter((alan) => girdi[alan] === undefined);
  if (eksikAlanlar.length > 0) {
    return {
      tur: "netlestirme",
      eksikAlanlar: [...eksikAlanlar],
      soru: `Lütfen ${eksikAlanlar.join(", ")} bilgisini belirtin.`,
    };
  }

  const sorgu = girdi as HapbiKanonikSorgu;
  hapbiDonemiDogrula(sorgu.donem);
  if (!tekilMi(sorgu.olcutler)) throw new Error("Yinelenen ölçüt kullanılamaz.");
  if (!tekilMi(sorgu.boyutlar)) throw new Error("Yinelenen boyut kullanılamaz.");
  if (sorgu.olcutler.some((olcut) => !DESTEKLENEN_OLCUTLER[sorgu.veriAlani].includes(olcut))) {
    throw new Error("Desteklenmeyen veri alanı–ölçüt birleşimi.");
  }
  return sorgu;
}
