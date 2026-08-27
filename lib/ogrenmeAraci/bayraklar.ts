import "server-only";

import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

function acikMi(deger: string | undefined, varsayilan: boolean): boolean {
  if (deger === undefined) return varsayilan;
  return deger.trim().toLowerCase() === "true";
}

export function ogrenmeAraciAcikMi(aracTuru: OgrenmeAraciTuru): boolean {
  if (aracTuru === "video") return acikMi(process.env.OGRENME_ARACI_VIDEO_AKTIF, true);
  if (aracTuru === "podcast") return acikMi(process.env.OGRENME_ARACI_PODCAST_AKTIF, false);
  if (aracTuru === "gorsel") return acikMi(process.env.OGRENME_ARACI_GORSEL_AKTIF, false);
  return acikMi(process.env.OGRENME_ARACI_FLIP_PDF_AKTIF, false);
}

export function ogrenmeAraciBayraklari(): Record<OgrenmeAraciTuru, boolean> {
  return {
    video: ogrenmeAraciAcikMi("video"),
    podcast: ogrenmeAraciAcikMi("podcast"),
    gorsel: ogrenmeAraciAcikMi("gorsel"),
    flip_pdf: ogrenmeAraciAcikMi("flip_pdf"),
  };
}
