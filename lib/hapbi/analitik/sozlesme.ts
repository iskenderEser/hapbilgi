import { HapbiHata, type HapbiKaynak } from "@/lib/hapbi/sozlesme";

export const HAPBI_ANALITIK_SURUMU = "hapbi-analitik-v1" as const;

export const HAPBI_VERI_ALANLARI = ["tclub", "cclub", "eclub", "uretim"] as const;
export type HapbiVeriAlani = (typeof HAPBI_VERI_ALANLARI)[number];

export const HAPBI_ANALITIK_BOYUTLARI = [
  "firma",
  "takim",
  "bm_kapsami",
  "kullanici",
  "eczane",
  "urun",
  "icerik",
  "kategori",
  "arac_turu",
  "yayin",
  "durum",
  "uretim_varyanti",
  "zaman",
] as const;
export type HapbiAnalitikBoyut = (typeof HAPBI_ANALITIK_BOYUTLARI)[number];

export const HAPBI_ANALITIK_OLCUTLERI = [
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
  "izleme_sayisi",
  "gonderim_sayisi",
  "cevap_sayisi",
  "dogru_cevap_sayisi",
  "yanlis_cevap_sayisi",
  "yayin_sayisi",
  "gorev_sayisi",
  "talep_sayisi",
] as const;
export type HapbiAnalitikOlcut = (typeof HAPBI_ANALITIK_OLCUTLERI)[number];

export const HAPBI_ANALITIK_ISLEMLERI = [
  "toplam",
  "liste",
  "siralama",
  "fark",
  "dagilim",
  "katki",
  "karsilastirma",
  "egilim",
  "detay",
  "oneri",
] as const;
export type HapbiAnalitikIslem = (typeof HAPBI_ANALITIK_ISLEMLERI)[number];

export type HapbiAnalitikDonem =
  | { tur: "hafta"; yil: number; hafta: number }
  | { tur: "ay"; yil: number; ay: number }
  | { tur: "ceyrek"; yil: number; ceyrek: number }
  | { tur: "yil"; yil: number }
  | { tur: "ozel"; baslangic: string; bitis: string };

export type HapbiAnalitikKapsamTuru =
  | "kisisel"
  | "bm_sorumluluk"
  | "takim"
  | "firma"
  | "eclub_kisisel"
  | "eclub_organizasyon";

export interface HapbiAnalitikKapsam {
  tur: HapbiAnalitikKapsamTuru;
  kaynak_rol: string;
  kullanici_id: string;
  firma_id?: string;
  takim_id?: string;
  bolge_id?: string;
}

export interface HapbiAnalitikVarlikFiltresi {
  boyut: Exclude<HapbiAnalitikBoyut, "zaman">;
  kimlikler: string[];
}

export interface HapbiAnalitikSiralama {
  olcut: HapbiAnalitikOlcut;
  yon: "artan" | "azalan";
}

export interface HapbiAnalitikSorgu {
  surum: typeof HAPBI_ANALITIK_SURUMU;
  veri_alani: HapbiVeriAlani;
  kapsam: HapbiAnalitikKapsam;
  donem: HapbiAnalitikDonem;
  olcutler: HapbiAnalitikOlcut[];
  boyutlar: HapbiAnalitikBoyut[];
  filtreler: HapbiAnalitikVarlikFiltresi[];
  islem: HapbiAnalitikIslem;
  siralama?: HapbiAnalitikSiralama;
  limit?: number;
  karsilastirma_donemi?: HapbiAnalitikDonem;
}

export interface HapbiAnalitikVarlik {
  tur: Exclude<HapbiAnalitikBoyut, "zaman">;
  id: string;
  ad: string;
  ust_varlik_id?: string | null;
  bolge_adi?: string | null;
}

export interface HapbiAnalitikSatir {
  boyutlar: Partial<Record<HapbiAnalitikBoyut, HapbiAnalitikVarlik | string>>;
  olcumler: Partial<Record<HapbiAnalitikOlcut, number | null>>;
}

export interface HapbiAnalitikOlgu {
  ozne: HapbiAnalitikVarlik;
  iliski: HapbiAnalitikOlcut;
  deger: number;
  baglam: Partial<Record<HapbiAnalitikBoyut, HapbiAnalitikVarlik | string>>;
}

export interface HapbiAnalitikSonuc {
  surum: typeof HAPBI_ANALITIK_SURUMU;
  sorgu: HapbiAnalitikSorgu;
  veri_durumu: "var" | "bos" | "eksik" | "hata";
  satirlar: HapbiAnalitikSatir[];
  toplamlar: Partial<Record<HapbiAnalitikOlcut, number | null>>;
  olgular: HapbiAnalitikOlgu[];
  kaynaklar: HapbiKaynak[];
  tam_mi: boolean;
  sinir_aciklamasi?: string;
}

function tekilMi<T>(degerler: T[]): boolean {
  return new Set(degerler).size === degerler.length;
}

function donemiDogrula(donem: HapbiAnalitikDonem): void {
  if (donem.tur !== "ozel" && (!Number.isInteger(donem.yil) || donem.yil < 2000 || donem.yil > 2100)) {
    throw new HapbiHata("GECERSIZ_DONEM", 400, "Geçersiz analiz dönemi.");
  }
  if (donem.tur === "hafta" && (!Number.isInteger(donem.hafta) || donem.hafta < 1 || donem.hafta > 53)) {
    throw new HapbiHata("GECERSIZ_DONEM", 400, "Geçersiz hafta.");
  }
  if (donem.tur === "ay" && (!Number.isInteger(donem.ay) || donem.ay < 1 || donem.ay > 12)) {
    throw new HapbiHata("GECERSIZ_DONEM", 400, "Geçersiz ay.");
  }
  if (donem.tur === "ceyrek" && (!Number.isInteger(donem.ceyrek) || donem.ceyrek < 1 || donem.ceyrek > 4)) {
    throw new HapbiHata("GECERSIZ_DONEM", 400, "Geçersiz çeyrek.");
  }
  if (donem.tur === "ozel") {
    const baslangic = Date.parse(donem.baslangic);
    const bitis = Date.parse(donem.bitis);
    if (!Number.isFinite(baslangic) || !Number.isFinite(bitis) || baslangic > bitis) {
      throw new HapbiHata("GECERSIZ_DONEM", 400, "Geçersiz özel tarih aralığı.");
    }
  }
}

export function hapbiAnalitikSorguyuDogrula(sorgu: HapbiAnalitikSorgu): HapbiAnalitikSorgu {
  if (sorgu.surum !== HAPBI_ANALITIK_SURUMU) {
    throw new HapbiHata("GECERSIZ_ANALITIK_SURUM", 400, "Desteklenmeyen analitik sorgu sürümü.");
  }
  if (!HAPBI_VERI_ALANLARI.includes(sorgu.veri_alani)) {
    throw new HapbiHata("GECERSIZ_VERI_ALANI", 400, "Desteklenmeyen veri alanı.");
  }
  if (sorgu.olcutler.length === 0 || !tekilMi(sorgu.olcutler)) {
    throw new HapbiHata("GECERSIZ_OLCUT", 400, "Analitik sorgu tekil ve en az bir ölçüt içermelidir.");
  }
  if (!tekilMi(sorgu.boyutlar)) {
    throw new HapbiHata("GECERSIZ_BOYUT", 400, "Analitik sorgu yinelenen boyut içeremez.");
  }
  if (sorgu.filtreler.some((filtre) => filtre.kimlikler.length === 0 || !tekilMi(filtre.kimlikler))) {
    throw new HapbiHata("GECERSIZ_FILTRE", 400, "Analitik filtre tekil ve en az bir kimlik içermelidir.");
  }
  if (sorgu.limit !== undefined && (!Number.isInteger(sorgu.limit) || sorgu.limit < 1 || sorgu.limit > 100)) {
    throw new HapbiHata("GECERSIZ_LIMIT", 400, "Analitik sonuç sınırı 1 ile 100 arasında olmalıdır.");
  }
  if (sorgu.siralama && !sorgu.olcutler.includes(sorgu.siralama.olcut)) {
    throw new HapbiHata("GECERSIZ_SIRALAMA", 400, "Sıralama ölçütü sorgunun ölçütleri arasında bulunmalıdır.");
  }
  if (sorgu.islem === "karsilastirma" && !sorgu.karsilastirma_donemi) {
    throw new HapbiHata("EKSIK_KARSILASTIRMA_DONEMI", 400, "Karşılaştırma dönemi zorunludur.");
  }
  donemiDogrula(sorgu.donem);
  if (sorgu.karsilastirma_donemi) donemiDogrula(sorgu.karsilastirma_donemi);
  return sorgu;
}
