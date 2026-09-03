import type { OgrenmeAraciTuru } from "./tipler";

export interface OgrenmeAraciMetinleri {
  ad: string;
  adKucuk: string;
  hazir: string;
  belirtme: string;
  belirtmeKucuk: string;
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
    adKucuk: "video",
    hazir: "Hazır Video",
    belirtme: "Videoyu",
    belirtmeKucuk: "videoyu",
    iyelikBelirtme: "Videonuzu",
  },
  podcast: {
    ad: "Podcast",
    adKucuk: "podcast",
    hazir: "Hazır Podcast",
    belirtme: "Podcasti",
    belirtmeKucuk: "podcasti",
    iyelikBelirtme: "Podcastinizi",
  },
  gorsel: {
    ad: "Dijital Broşür",
    adKucuk: "dijital broşür",
    hazir: "Hazır Dijital Broşür",
    belirtme: "Dijital Broşürü",
    belirtmeKucuk: "dijital broşürü",
    iyelikBelirtme: "Dijital Broşürünüzü",
  },
  flip_pdf: {
    ad: "Literatür",
    adKucuk: "literatür",
    hazir: "Hazır Literatür",
    belirtme: "Literatürü",
    belirtmeKucuk: "literatürü",
    iyelikBelirtme: "Literatürünüzü",
  },
};

/** Eski veya eksik kayıtlarda mevcut davranış korunur: araç Video kabul edilir. */
export function ogrenmeAraciMetinleri(tur?: OgrenmeAraciTuru | null): OgrenmeAraciMetinleri {
  return OGRENME_ARACI_METINLERI[tur ?? "video"];
}
