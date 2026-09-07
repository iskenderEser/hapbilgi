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

export type HapbiZamanCozumlemeNedeni =
  | "zaman_bulunamadi"
  | "birden_fazla_zaman"
  | "uc_ay_donem_degildir";

export type HapbiZamanCozumlemeSonucu =
  | Readonly<{
    basarili: true;
    zaman: HapbiZamanAraligi;
    kaynak: "soru" | "devam_baglami";
  }>
  | Readonly<{
    basarili: false;
    neden: HapbiZamanCozumlemeNedeni;
  }>;

export type HapbiZamanCozumlemeSecenekleri = Readonly<{
  simdi?: Date;
  oncekiZaman?: HapbiZamanAraligi | null;
  kesinDevamSorusuMu?: boolean;
}>;

export const HAPBI_ZAMAN_ES_ANLAMLARI = {
  hafta: ["hafta"],
  ay: ["ay"],
  donem: ["dönem", "çeyrek", "kuartır", "quarter"],
  yil: ["yıl"],
} as const satisfies Readonly<Record<HapbiZamanTuru, readonly string[]>>;

export const HAPBI_DONEM_AYLARI = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
] as const;
