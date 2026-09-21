// components/hbligi/league/types.ts
// HBLigi "Liderlik Perspektifi" dashboard ortak tipleri.

export interface LigSatiri {
  kullanici_id: string;
  ad: string;
  bolge: string;
  takim?: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  eclub_puani?: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
  benim?: boolean;
}

export interface HaftalikKonumSatiri extends LigSatiri {
  sira: number;
  /** Önceki haftaya göre sıra değişimi; karşılaştırılabilir hafta yoksa null. */
  degisim: number | null;
}

export interface HaftalikKonumOzeti {
  sira: number | null;
  toplam: number;
  degisim: number | null;
}

export interface HaftalikKonum {
  bolge: HaftalikKonumOzeti;
  takim: HaftalikKonumOzeti;
  sirket: HaftalikKonumOzeti;
  bolge_ligi: HaftalikKonumSatiri[];
}

export interface SiraliSatir extends LigSatiri {
  rank: number;
  /** Bir önceki haftaya göre sıra değişimi. */
  degisim: number | null;
  /** Liderlik skoru 0-100. STUB (motor — Faz 2). */
  liderlikSkoru: number;
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
