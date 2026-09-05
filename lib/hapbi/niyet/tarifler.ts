import type {
  HapbiBoyut,
  HapbiCevapTuru,
  HapbiIslem,
  HapbiOlcut,
  HapbiVeriAlani,
} from "@/lib/hapbi/niyet/sozlesme";

export const HAPBI_TARIFLERI = [
  "lig_lideri",
  "ilk_iki_ve_fark",
  "kisisel_puan_ve_sira",
  "en_yuksek_urun",
  "urun_utt_katkisi",
  "en_iyi_urun_ve_utt_katkisi",
  "kisi_urun_dagilimi",
  "takim_urun_dagilimi",
  "firma_takim_dagilimi",
  "takim_bm_kapsami_dagilimi",
  "kayip_kisi_dagilimi",
  "kayip_urun_dagilimi",
  "donem_karsilastirmasi",
  "uretim_dagilimi",
] as const;

export type HapbiTarif = (typeof HAPBI_TARIFLERI)[number];

export interface HapbiTarifKosulu {
  tarif: HapbiTarif;
  veriAlanlari: readonly HapbiVeriAlani[];
  olcutler: readonly HapbiOlcut[];
  boyutlar: readonly HapbiBoyut[];
  zorunluFiltreBoyutlari?: readonly Exclude<HapbiBoyut, "zaman">[];
  yasakFiltreBoyutlari?: readonly Exclude<HapbiBoyut, "zaman">[];
  islem: HapbiIslem;
  cevapTuru: HapbiCevapTuru;
}

const PUAN_VERI_ALANLARI = ["tclub", "cclub", "eclub"] as const;
const PUAN_KAYIP_OLCUTLERI = [
  "kaybedilen_puan",
  "ileri_sarma_kaybi",
  "yanlis_cevap_kaybi",
  "oneri_kaybi",
  "challenge_kaybi",
] as const;

export const HAPBI_TARIF_KOSULLARI: Readonly<Record<HapbiTarif, HapbiTarifKosulu>> = {
  lig_lideri: {
    tarif: "lig_lideri",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: ["net_puan"],
    boyutlar: ["kullanici", "takim"],
    islem: "siralama",
    cevapTuru: "sayisal",
  },
  ilk_iki_ve_fark: {
    tarif: "ilk_iki_ve_fark",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: ["net_puan"],
    boyutlar: ["kullanici", "takim"],
    islem: "fark",
    cevapTuru: "sayisal",
  },
  kisisel_puan_ve_sira: {
    tarif: "kisisel_puan_ve_sira",
    veriAlanlari: ["tclub", "cclub"],
    olcutler: ["net_puan"],
    boyutlar: ["kullanici"],
    islem: "detay",
    cevapTuru: "sayisal",
  },
  en_yuksek_urun: {
    tarif: "en_yuksek_urun",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: ["net_puan"],
    boyutlar: ["urun"],
    islem: "siralama",
    cevapTuru: "sayisal",
  },
  urun_utt_katkisi: {
    tarif: "urun_utt_katkisi",
    veriAlanlari: ["tclub"],
    olcutler: ["net_puan"],
    boyutlar: ["urun", "kullanici"],
    zorunluFiltreBoyutlari: ["urun"],
    islem: "katki",
    cevapTuru: "sayisal",
  },
  en_iyi_urun_ve_utt_katkisi: {
    tarif: "en_iyi_urun_ve_utt_katkisi",
    veriAlanlari: ["tclub"],
    olcutler: ["net_puan"],
    boyutlar: ["urun", "kullanici"],
    yasakFiltreBoyutlari: ["urun"],
    islem: "katki",
    cevapTuru: "sayisal",
  },
  kisi_urun_dagilimi: {
    tarif: "kisi_urun_dagilimi",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: ["net_puan"],
    boyutlar: ["kullanici", "urun"],
    islem: "dagilim",
    cevapTuru: "sayisal",
  },
  takim_urun_dagilimi: {
    tarif: "takim_urun_dagilimi",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: ["net_puan"],
    boyutlar: ["takim", "urun"],
    islem: "dagilim",
    cevapTuru: "sayisal",
  },
  firma_takim_dagilimi: {
    tarif: "firma_takim_dagilimi",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: ["net_puan"],
    boyutlar: ["firma", "takim"],
    islem: "dagilim",
    cevapTuru: "sayisal",
  },
  takim_bm_kapsami_dagilimi: {
    tarif: "takim_bm_kapsami_dagilimi",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: ["net_puan"],
    boyutlar: ["takim", "bm_kapsami"],
    islem: "dagilim",
    cevapTuru: "sayisal",
  },
  kayip_kisi_dagilimi: {
    tarif: "kayip_kisi_dagilimi",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: PUAN_KAYIP_OLCUTLERI,
    boyutlar: ["kullanici"],
    islem: "dagilim",
    cevapTuru: "sayisal",
  },
  kayip_urun_dagilimi: {
    tarif: "kayip_urun_dagilimi",
    veriAlanlari: PUAN_VERI_ALANLARI,
    olcutler: PUAN_KAYIP_OLCUTLERI,
    boyutlar: ["urun"],
    islem: "dagilim",
    cevapTuru: "sayisal",
  },
  donem_karsilastirmasi: {
    tarif: "donem_karsilastirmasi",
    veriAlanlari: ["tclub", "cclub", "eclub", "uretim"],
    olcutler: [
      "net_puan",
      "kazanilan_puan",
      "kaybedilen_puan",
      "tamamlama_sayisi",
      "yayin_sayisi",
      "gorev_sayisi",
      "talep_sayisi",
    ],
    boyutlar: ["zaman"],
    islem: "karsilastirma",
    cevapTuru: "sayisal",
  },
  uretim_dagilimi: {
    tarif: "uretim_dagilimi",
    veriAlanlari: ["uretim"],
    olcutler: ["talep_sayisi", "gorev_sayisi", "yayin_sayisi"],
    boyutlar: [
      "firma",
      "takim",
      "kullanici",
      "urun",
      "icerik",
      "kategori",
      "arac_turu",
      "yayin",
      "durum",
      "uretim_varyanti",
      "zaman",
    ],
    islem: "dagilim",
    cevapTuru: "sayisal",
  },
};
