// lib/puan/tipler.ts
// Puan kayıt katmanının ortak tipleri.
// kazanilan_puanlar + 3 kayıp tablosu için parametre yapıları burada tanımlanır.

export type PuanTuru = 'izleme' | 'extra' | 'oneri' | 'cevaplama';

export interface KazanilanPuanParams {
  kullanici_id: string;
  yayin_id: string;
  izleme_id?: string | null;
  puan_turu: PuanTuru;
  puan: number;
}

export interface YanlisCevapKayipParams {
  kullanici_id: string;
  yayin_id: string;
  izleme_id: string;
  soru_index: number;
  kaybedilen_puan: number;
}

export interface IleriSarmaKayipParams {
  kullanici_id: string;
  yayin_id: string;
  izleme_id: string;
  atlama_baslangic: number; // saniye
  atlama_bitis: number;     // saniye
  atlanan_sure: number;     // saniye
  kaybedilen_puan: number;
}

export interface OneriKayipParams {
  kullanici_id: string;
  yayin_id: string;
  oneri_id: string;
  kaybedilen_puan: number;
}

export interface KayitSonuc {
  ok: boolean;
  error?: string;
}