// components/hbligi/league/types.ts
// HBLigi "Liderlik Perspektifi" dashboard ortak tipleri.

export interface LigSatiri {
  kullanici_id: string;
  ad: string;
  bolge: string;
  takim?: string;
  takim_id?: string | null;
  bolge_id?: string | null;
  fotograf_url?: string | null;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  eclub_puani?: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
  toplam_kazanc?: number;
  toplam_kayip?: number;
  detay_gorulebilir?: boolean;
  benim?: boolean;
  genel_sira?: number;
  etkilesim_sayisi?: number;
  etkilesilen_yayin_sayisi?: number;
}

export interface KursuSatiri extends LigSatiri {
  sira: number;
  degisim: number | null;
}

export interface AylikKursu {
  ay: number;
  yil: number;
  ay_adi: string;
  bolge_top3: KursuSatiri[];
  takim_top3: KursuSatiri[];
  sirket_top3: KursuSatiri[];
}

export interface SiraliSatir extends LigSatiri {
  rank: number;
  /** Bir önceki haftaya göre sıra değişimi. */
  degisim: number | null;
}

// Net Puanın Bileşimi (donut) kalemi. Toplam GERÇEK; yorum/yüzde türetilir.
export interface KirilimKalemi {
  etiket: string;
  deger: number;
  yuzde: number;
  tip: "izleme" | "cevaplama" | "oneri" | "eclub" | "negatif";
}

// Güçlü yön / gelişim alanı. STUB (motor — Faz 2).
export interface ProfilKalemi {
  baslik: string;
  aciklama: string;
  tip: "guclu" | "gelisim";
}

// Liderliğe giden yol — hedef. STUB (motor — Faz 2).
export interface LiderlikHedefi {
  baslik: string;
  etki: number; // +puan tahmini
  oncelik: "Öncelikli" | "Odaklan" | "İyileştir";
}
