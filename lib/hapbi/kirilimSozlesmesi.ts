import type { HapbiOlcut } from "./olcutSozlesmesi";
import type { HapbiRol, HapbiVeriAlani } from "./roller";

export const HAPBI_KIRILIMLARI = [
  "kullanici",
  "utt",
  "urun",
  "yayin",
  "takim",
  "bolge",
  "firma",
] as const;

export type HapbiKirilim = (typeof HAPBI_KIRILIMLARI)[number];

export type HapbiKirilimBaglantiTuru = "bire_bir" | "coktan_bire" | "bire_cok";

export type HapbiKirilimFiltresi = Readonly<{
  alan: string;
  islem: "esittir" | "icinde";
  deger: string | boolean | readonly string[];
}>;

export type HapbiKirilimBaglantisi = Readonly<{
  hedefKirilim: HapbiKirilim;
  yerelKaynak: string;
  yerelAlan: string;
  hedefKaynak: string;
  hedefAlan: string;
  tur: HapbiKirilimBaglantiTuru;
}>;

export type HapbiKirilimTanimi = Readonly<{
  kirilim: HapbiKirilim;
  ortakAd: string;
  kimlikKaynagi: string;
  kimlikAlani: string;
  adKaynagi: string;
  adAlanlari: readonly string[];
  adBirlestirici: string | null;
  sabitFiltreler: readonly HapbiKirilimFiltresi[];
  baglantilar: readonly HapbiKirilimBaglantisi[];
  kullanilabildigiVeriAlanlari: readonly HapbiVeriAlani[];
  kullanilabilenRoller: readonly HapbiRol[];
  kullanilabilenOlcutler: readonly HapbiOlcut[];
}>;

export type HapbiKirilimDogrulamaNedeni =
  | "desteklenmeyen_rol"
  | "veri_alani_kapsam_disinda"
  | "kirilim_veri_alaninda_kullanilamaz"
  | "kirilim_olcutle_kullanilamaz"
  | "yinelenen_kirilim"
  | "kullanici_utt_birlikte_kullanilamaz";

export type HapbiKirilimDogrulamaSonucu =
  | Readonly<{ gecerli: true }>
  | Readonly<{
    gecerli: false;
    neden: HapbiKirilimDogrulamaNedeni;
    kirilim?: HapbiKirilim;
  }>;

export type HapbiKirilimDogrulamaGirdisi = Readonly<{
  rol: string;
  veriAlani: HapbiVeriAlani;
  olcut: HapbiOlcut;
  kirilimlar: readonly HapbiKirilim[];
}>;
