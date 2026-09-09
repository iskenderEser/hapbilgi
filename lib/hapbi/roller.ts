import {
  TUKETICI_ROLLER,
  URETICI_ROLLER,
  YONETICI_ROLLER,
  YONLENDIRICI_ROLLER,
} from "../utils/roller";

export type HapbiRol =
  | "utt" | "kd_utt" | "bm" | "tm"
  | "pm" | "jr_pm" | "kd_pm" | "med_md"
  | "egt_md" | "egt_yrd_md" | "egt_yon" | "egt_uz"
  | "ik_drk" | "ik_md" | "ik_yrd_md" | "ik_uz" | "ik_per"
  | "gm" | "gm_yrd" | "drk" | "paz_md" | "blm_md" | "grp_pm" | "sm";

export const HAPBI_SAHA_TUKETICI_ROLLERI = [...TUKETICI_ROLLER] as HapbiRol[];
export const HAPBI_URETICI_ROLLERI = [...URETICI_ROLLER] as HapbiRol[];

export const HAPBI_DESTEKLENEN_ROLLER = [
  ...TUKETICI_ROLLER,
  ...YONLENDIRICI_ROLLER,
  ...URETICI_ROLLER,
  ...YONETICI_ROLLER,
] as HapbiRol[];

export type HapbiVeriAlani = "tclub" | "cclub" | "uretim";
export type HapbiKapsamDuzeyi = "yok" | "kisisel" | "bolge" | "takim" | "firma";

export type HapbiRolKurali = Readonly<{
  organizasyon: Exclude<HapbiKapsamDuzeyi, "yok">;
  veriAlanlari: Readonly<Record<HapbiVeriAlani, HapbiKapsamDuzeyi>>;
}>;

const KISISEL_SAHA: HapbiRolKurali = {
  organizasyon: "kisisel",
  veriAlanlari: { tclub: "kisisel", cclub: "yok", uretim: "yok" },
};

const BOLGE_YONETIMI: HapbiRolKurali = {
  organizasyon: "bolge",
  veriAlanlari: { tclub: "bolge", cclub: "kisisel", uretim: "yok" },
};

const TAKIM_YONETIMI: HapbiRolKurali = {
  organizasyon: "takim",
  veriAlanlari: { tclub: "takim", cclub: "takim", uretim: "yok" },
};

const URUN_AILESI: HapbiRolKurali = {
  organizasyon: "takim",
  veriAlanlari: { tclub: "takim", cclub: "takim", uretim: "takim" },
};

const FIRMA_URETICISI: HapbiRolKurali = {
  organizasyon: "firma",
  veriAlanlari: { tclub: "firma", cclub: "firma", uretim: "firma" },
};

const FIRMA_YONETICISI: HapbiRolKurali = {
  organizasyon: "firma",
  veriAlanlari: { tclub: "firma", cclub: "firma", uretim: "firma" },
};

export const HAPBI_ROL_KURALLARI: Readonly<Record<HapbiRol, HapbiRolKurali>> = {
  utt: KISISEL_SAHA,
  kd_utt: KISISEL_SAHA,
  bm: BOLGE_YONETIMI,
  tm: TAKIM_YONETIMI,
  pm: URUN_AILESI,
  jr_pm: URUN_AILESI,
  kd_pm: URUN_AILESI,
  med_md: FIRMA_URETICISI,
  egt_md: FIRMA_URETICISI,
  egt_yrd_md: FIRMA_URETICISI,
  egt_yon: FIRMA_URETICISI,
  egt_uz: FIRMA_URETICISI,
  ik_drk: FIRMA_URETICISI,
  ik_md: FIRMA_URETICISI,
  ik_yrd_md: FIRMA_URETICISI,
  ik_uz: FIRMA_URETICISI,
  ik_per: FIRMA_URETICISI,
  gm: FIRMA_YONETICISI,
  gm_yrd: FIRMA_YONETICISI,
  drk: FIRMA_YONETICISI,
  paz_md: FIRMA_YONETICISI,
  blm_md: FIRMA_YONETICISI,
  grp_pm: FIRMA_YONETICISI,
  sm: FIRMA_YONETICISI,
};

export function hapbiRoluMu(rol: string): rol is HapbiRol {
  return HAPBI_DESTEKLENEN_ROLLER.includes(rol as HapbiRol);
}

export function hapbiRolKurali(rol: string): HapbiRolKurali | null {
  const temizRol = rol.trim().toLowerCase();
  return hapbiRoluMu(temizRol) ? HAPBI_ROL_KURALLARI[temizRol] : null;
}

export function hapbiKullanabilirMi(kimlikTuru: string, rol: string): rol is HapbiRol {
  return kimlikTuru === "kullanici" && hapbiRoluMu(rol.trim().toLowerCase());
}
