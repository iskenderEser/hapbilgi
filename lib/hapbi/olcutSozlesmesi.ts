import type { HapbiRol, HapbiVeriAlani } from "./roller";

export const HAPBI_OLCUTLERI = [
  "atanmis_izleme_puani",
  "kazanilan_izleme_puani",
  "net_puan",
  "kazanilan_puan",
  "kaybedilen_puan",
  "izleme_sayisi",
  "tamamlanan_izleme_sayisi",
  "begeni_sayisi",
  "favori_sayisi",
  "dogru_cevap_sayisi",
  "yanlis_cevap_sayisi",
  "ileri_sarilan_sure",
] as const;

export type HapbiOlcut = (typeof HAPBI_OLCUTLERI)[number];

export const HAPBI_OLCUT_KIRILIMLARI = [
  "kullanici",
  "utt",
  "urun",
  "yayin",
  "takim",
  "bolge",
  "firma",
] as const;

export type HapbiOlcutKirilimi = (typeof HAPBI_OLCUT_KIRILIMLARI)[number];

export type HapbiOlcutBirimi = "puan" | "adet" | "saniye";
export type HapbiOlcutUretimBicimi = "dogrudan" | "hesaplanmis";
export type HapbiOlcutZamanGereksinimi = "olay_donemi" | "zamansiz";
export type HapbiOlcutHesaplamaYontemi =
  | "topla"
  | "kayit_say"
  | "kosullu_kayit_say"
  | "kazanim_eksi_kayip";
export type HapbiOlcutSiralamaYonu = "artan" | "azalan";
export type HapbiOlcutKaynakRolu = "toplanan" | "cikarilan" | "sayilan";

export type HapbiOlcutFiltresi = Readonly<{
  alan: string;
  islem: "esittir";
  deger: string | number | boolean;
}>;

export type HapbiOlcutKaynagi = Readonly<{
  veriAlani: HapbiVeriAlani;
  tablo: string;
  degerAlani: string;
  zamanAlani: string | null;
  hesaplama: Exclude<HapbiOlcutHesaplamaYontemi, "kazanim_eksi_kayip">;
  hesaplamadakiRolu: HapbiOlcutKaynakRolu;
  filtreler: readonly HapbiOlcutFiltresi[];
  iliskiAlanlari: readonly string[];
  kullanilabilenRoller: readonly HapbiRol[];
}>;

export type HapbiOlcutTanimi = Readonly<{
  olcut: HapbiOlcut;
  ortakAd: string;
  esAnlamliIfadeler: readonly string[];
  birim: HapbiOlcutBirimi;
  uretimBicimi: HapbiOlcutUretimBicimi;
  hesaplama: HapbiOlcutHesaplamaYontemi;
  hesaplamaAciklamasi: string;
  zamanGereksinimi: HapbiOlcutZamanGereksinimi;
  kaynaklar: readonly HapbiOlcutKaynagi[];
  kullanilabilenKirilimlar: readonly HapbiOlcutKirilimi[];
  kullanilabilenRoller: readonly HapbiRol[];
  bosDegerAnlami: string;
  sifirDegerAnlami: string;
  siralamaYonu: HapbiOlcutSiralamaYonu;
  sonucaDahilEdilmeyenKayitlar: readonly string[];
}>;
