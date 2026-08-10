export type SoruHakkiNedeni =
  | "uygun"
  | "tamamlanmadi"
  | "puan_disinda"
  | "yarim_deneme"
  | "tekrar_izleme"
  | "ileri_sarma";

export interface SoruHakkiGirdisi {
  tamamlandi: boolean;
  puanliZaman: boolean;
  oncekiGercekDenemeVar: boolean;
  oncekiTamamlanmisDenemeVar: boolean;
  mevcutDenemedeIleriSarmaVar: boolean;
}

export interface IzlemeKazanimGirdisi {
  tamamlandi: boolean;
  puanliZaman: boolean;
  dahaOnceIzlemePuaniVar: boolean;
  videoPuani: number;
}

export interface IleriSarmaKaybiGirdisi {
  videoPuani: number;
  videoSuresi: number;
  atlananSure: number;
  puanliZaman: boolean;
}

export interface TamamlamaGirdisi {
  videoSuresi: number;
  gecenSure: number;
  onayliAtlananSure: number;
  toleransSaniye?: number;
}
