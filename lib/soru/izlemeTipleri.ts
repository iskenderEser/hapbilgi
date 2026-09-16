export interface IzlemeSorusu {
  soru_index: number;
  soru_metni: string;
  secenekler: Array<{
    harf: string;
    metin: string;
  }>;
}

export interface IzlemeCevapSonucu {
  soru_index: number;
  dogru_mu: boolean;
}

export type IzlemeCevaplari = Record<number, string>;
