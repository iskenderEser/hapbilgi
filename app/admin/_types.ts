// app/admin/_types.ts

export interface Firma {
  firma_id: string;
  firma_adi: string;
  hbstore_aktif: boolean;
  aktif: boolean;
  cc_aktif: boolean;
  eclub_aktif: boolean;
  eclub_store_aktif: boolean;
  son_export_at: string | null;
  created_at: string;
}

export interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  eposta: string;
  rol: string;
  aktif_mi: boolean;
  yetki_kullanici_yonetim: boolean;
  yetki_aktif_pasif: boolean;
  takim_id?: string | null;
  bolge_id?: string | null;
  takim_adi?: string;
  bolge_adi?: string;
}

export interface OnizlemeSatir {
  index: number;
  ad: string;
  soyad: string;
  rol: string;
  eposta: string;
  takim_adi: string;
  bolge_adi: string;
  // K-A6: "eksik" = kimlik çekirdeği tam, takım/bölge çözülemedi — YÜKLENİR.
  durum: "hazir" | "eksik" | "hatali";
  hata_mesaji?: string;
  uyari_mesaji?: string;
}

export interface TakimBlok {
  id: number;
  takim_adi: string;
  bolgeler: string[];
}

export interface Bolge {
  bolge_id: string;
  bolge_adi: string;
}

export interface Takim {
  takim_id: string;
  takim_adi: string;
  bolgeler: Bolge[];
}

export interface Urun {
  urun_id: string;
  urun_adi: string;
  takim_id: string;
}

export interface Teknik {
  teknik_id: string;
  teknik_adi: string;
}

export type GirisSecimi = "tekil" | "toplu";

// Sistem Ayarları (sistem_ayarlari tablosu — admin ekranı)
export interface SistemAyari {
  anahtar: string;
  deger: number | number[];
  aciklama: string | null;
  updated_at: string;
}