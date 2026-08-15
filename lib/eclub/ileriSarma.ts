import { ileriSarmaKaybiHesapla } from "@/lib/izleme/karar";

export interface EclubIleriSarmaKonumu {
  baslangic: number;
  bitis: number;
  atlananSure: number;
}

/** İstemciden gelen oynatma konumlarını tam saniyeye indirger ve sınırlarını doğrular. */
export function eclubIleriSarmaKonumuDogrula(
  atlamaBaslangic: unknown,
  atlamaBitis: unknown,
  videoSuresi: number,
): EclubIleriSarmaKonumu | null {
  if (
    typeof atlamaBaslangic !== "number"
    || typeof atlamaBitis !== "number"
    || !Number.isFinite(atlamaBaslangic)
    || !Number.isFinite(atlamaBitis)
    || !Number.isFinite(videoSuresi)
  ) return null;

  const baslangic = Math.round(atlamaBaslangic);
  const bitis = Math.round(atlamaBitis);
  if (videoSuresi <= 0 || baslangic < 0 || bitis <= baslangic || bitis > Math.ceil(videoSuresi)) {
    return null;
  }

  return { baslangic, bitis, atlananSure: bitis - baslangic };
}

/** E-Club ileri sarma kaybı, atlanan sürenin video puanı içindeki oransal karşılığıdır. */
export function eclubIleriSarmaKaybiHesapla(girdi: {
  videoPuani: number;
  videoSuresi: number;
  atlananSure: number;
  puanli: boolean;
}): number {
  return ileriSarmaKaybiHesapla({
    videoPuani: girdi.videoPuani,
    videoSuresi: girdi.videoSuresi,
    atlananSure: girdi.atlananSure,
    puanliZaman: girdi.puanli,
  });
}
