import type { OgrenmeAraciTuru } from "./tipler";

export const YAYIN_TURU_SUNUMU: Record<OgrenmeAraciTuru, {
  etiket: string;
  cogulEtiket: string;
  renk: string;
  zemin: string;
}> = {
  video: { etiket: "Video", cogulEtiket: "Videolar", renk: "#1d4ed8", zemin: "#dbeafe" },
  podcast: { etiket: "Podcast", cogulEtiket: "Podcastler", renk: "#7e22ce", zemin: "#f3e8ff" },
  gorsel: { etiket: "Dijital Broşür", cogulEtiket: "Dijital Broşürler", renk: "#047857", zemin: "#d1fae5" },
  flip_pdf: { etiket: "Literatür", cogulEtiket: "Literatürler", renk: "#b45309", zemin: "#fef3c7" },
};

export const YAYIN_TURLERI = Object.keys(YAYIN_TURU_SUNUMU) as OgrenmeAraciTuru[];

