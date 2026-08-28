import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

export type OgrenmeAraciUretimVaryanti = "V1" | "V2" | "V3" | "V4";

export interface OgrenmeAraciUretimAkisi {
  aracTuru: OgrenmeAraciTuru;
  varyant: OgrenmeAraciUretimVaryanti;
  hazirArac: boolean;
  hazirSoruSeti: boolean;
  ilkAdim: "senaryo" | "hazir_arac_yukleme";
  aracOnayiSonrasi: "soru_seti" | "yayin_yonetimi";
}

/** DB'deki `hazir_video`, yeni türlerde "hazır öğrenme aracı" anlamındadır. */
export function ogrenmeAraciUretimAkisi(
  aracTuru: OgrenmeAraciTuru,
  hazirArac: boolean,
  hazirSoruSeti: boolean,
): OgrenmeAraciUretimAkisi {
  const varyant: OgrenmeAraciUretimVaryanti = hazirArac
    ? (hazirSoruSeti ? "V4" : "V2")
    : (hazirSoruSeti ? "V3" : "V1");
  return {
    aracTuru,
    varyant,
    hazirArac,
    hazirSoruSeti,
    ilkAdim: hazirArac ? "hazir_arac_yukleme" : "senaryo",
    aracOnayiSonrasi: hazirSoruSeti ? "yayin_yonetimi" : "soru_seti",
  };
}
