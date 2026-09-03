import type { OgrenmeAraciTuru } from "./tipler";

export interface OgrenmeAraciMetinleri {
  ad: string;
  hazir: string;
  belirtme: string;
  iyelikBelirtme: string;
}

/**
 * Öğrenme aracının kullanıcıya görünen adı tek yerde tutulur. Veritabanındaki
 * eski `hazir_video` ve üretim görevlerindeki `video` alanları yeni araçlarda da
 * ortak akış anahtarı olarak kullanılabilir; ekrana hiçbir zaman bu teknik adlar
 * doğrudan basılmaz.
 */
export const OGRENME_ARACI_METINLERI: Record<OgrenmeAraciTuru, OgrenmeAraciMetinleri> = {
  video: {
    ad: "Video",
    hazir: "Hazır Video",
    belirtme: "Videoyu",
    iyelikBelirtme: "Videonuzu",
  },
  podcast: {
    ad: "Podcast",
    hazir: "Hazır Podcast",
    belirtme: "Podcasti",
    iyelikBelirtme: "Podcastinizi",
  },
  gorsel: {
    ad: "Dijital Broşür",
    hazir: "Hazır Dijital Broşür",
    belirtme: "Dijital Broşürü",
    iyelikBelirtme: "Dijital Broşürünüzü",
  },
  flip_pdf: {
    ad: "Literatür",
    hazir: "Hazır Literatür",
    belirtme: "Literatürü",
    iyelikBelirtme: "Literatürünüzü",
  },
};

/** Eski veya eksik kayıtlarda mevcut davranış korunur: araç Video kabul edilir. */
export function ogrenmeAraciMetinleri(tur?: OgrenmeAraciTuru | null): OgrenmeAraciMetinleri {
  return OGRENME_ARACI_METINLERI[tur ?? "video"];
}
