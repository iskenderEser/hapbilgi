export const HAPBI_ZAMAN_TURLERI = ["hafta", "ay", "donem", "yil"] as const;

export type HapbiZamanTuru = (typeof HAPBI_ZAMAN_TURLERI)[number];

export const HAPBI_ZAMAN_YONELIMLERI = ["bu", "son"] as const;

export type HapbiZamanYonelimi = (typeof HAPBI_ZAMAN_YONELIMLERI)[number];

export type HapbiZamanSecimi = Readonly<{
  tur: HapbiZamanTuru;
  yonelim: HapbiZamanYonelimi;
}>;

export type HapbiZamanAraligi = Readonly<{
  tur: HapbiZamanTuru;
  yonelim: HapbiZamanYonelimi;
  baslangic: string;
  bitis: string;
  baslangicDahil: true;
  bitisHaric: true;
  saatDilimi: "Europe/Istanbul";
}>;
