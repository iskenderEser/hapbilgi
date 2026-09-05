import type { HapbiVeriAlani } from "@/lib/hapbi/niyet/sozlesme";
import { URETICI_YETENEKLERI } from "@/lib/uretici/yetenekler";
import {
  ECLUB_TUKETICI_ROLLERI,
  URETICI_ROLLER,
  YONETICI_ROLLER,
} from "@/lib/utils/roller";

export type HapbiRolGrubu =
  | "tuketici"
  | "yonlendirici"
  | "uretici"
  | "yonetici"
  | "eclub";

export type HapbiKapsamTuru =
  | "kisisel"
  | "bm_sorumlulugu"
  | "takim"
  | "firma"
  | "yalniz_acikca_tanimlanan_araclar";

export type HapbiKapsamVeriAlani = HapbiVeriAlani | "yetkili_veri_alanlari";

export interface HapbiRolKapsamKurali {
  veriAlani: HapbiKapsamVeriAlani;
  kapsam: HapbiKapsamTuru;
  urunKapsami?: "takim_urunleri";
}

export interface HapbiRolKapsami {
  rolGrubu: HapbiRolGrubu;
  hapbiErisimi: boolean;
  kurallar: readonly HapbiRolKapsamKurali[];
}

function ureticiRolKapsami(rol: string): HapbiRolKapsami {
  const yetenek = URETICI_YETENEKLERI[rol];
  if (!yetenek) {
    throw new Error(`Üretici yetenek profili bulunamadı: ${rol}`);
  }

  return {
    rolGrubu: "uretici",
    hapbiErisimi: true,
    kurallar: [
      {
        veriAlani: "yetkili_veri_alanlari",
        kapsam: yetenek.raporScope,
        ...(yetenek.raporScope === "takim" ? { urunKapsami: "takim_urunleri" as const } : {}),
      },
    ],
  };
}

const ureticiMatrisi = Object.fromEntries(
  URETICI_ROLLER.map((rol) => [rol, ureticiRolKapsami(rol)]),
);

const yoneticiMatrisi = Object.fromEntries(
  YONETICI_ROLLER.map((rol) => [
    rol,
    {
      rolGrubu: "yonetici",
      hapbiErisimi: true,
      kurallar: [{ veriAlani: "yetkili_veri_alanlari", kapsam: "firma" }],
    } satisfies HapbiRolKapsami,
  ]),
);

const eclubMatrisi = Object.fromEntries(
  ECLUB_TUKETICI_ROLLERI.map((rol) => [
    rol,
    {
      rolGrubu: "eclub",
      hapbiErisimi: true,
      kurallar: [{ veriAlani: "eclub", kapsam: "kisisel" }],
    } satisfies HapbiRolKapsami,
  ]),
);

export const HAPBI_ROL_MATRISI: Readonly<Record<string, HapbiRolKapsami>> = {
  utt: {
    rolGrubu: "tuketici",
    hapbiErisimi: true,
    kurallar: [{ veriAlani: "tclub", kapsam: "kisisel" }],
  },
  kd_utt: {
    rolGrubu: "tuketici",
    hapbiErisimi: true,
    kurallar: [{ veriAlani: "tclub", kapsam: "kisisel" }],
  },
  bm: {
    rolGrubu: "yonlendirici",
    hapbiErisimi: true,
    kurallar: [
      { veriAlani: "cclub", kapsam: "kisisel" },
      { veriAlani: "tclub", kapsam: "bm_sorumlulugu" },
    ],
  },
  tm: {
    rolGrubu: "yonlendirici",
    hapbiErisimi: true,
    kurallar: [{ veriAlani: "yetkili_veri_alanlari", kapsam: "takim" }],
  },
  ...ureticiMatrisi,
  ...yoneticiMatrisi,
  ...eclubMatrisi,
};
