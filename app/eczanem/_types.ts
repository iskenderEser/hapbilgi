export type EczanemAracTuru = "video" | "podcast" | "gorsel" | "flip_pdf";

export interface EczanemSidebarArac {
  arac_id: string;
  arac_turu: EczanemAracTuru;
}

export interface EczanemSidebarYayin {
  yayin_id: string;
  yayin_basligi: string;
  araclar: EczanemSidebarArac[];
}

export interface EczanemSidebarUrun {
  urun_id: string | null;
  urun_adi: string | null;
  yayinlar: EczanemSidebarYayin[];
}

export interface EczanemSidebarFirma {
  firma_id: string;
  firma_adi: string;
  urunler: EczanemSidebarUrun[];
}

export interface EczanemSidebarEczane {
  eczane_id: string;
  eczane_adi: string;
  firmalar: EczanemSidebarFirma[];
}

export type EczanemSidebarAgaci = EczanemSidebarEczane[];

export type EczanemSidebarSecim =
  | { tip: "tum" }
  | { tip: "eczane"; eczane_id: string }
  | { tip: "firma"; eczane_id: string; firma_id: string }
  | { tip: "urun"; eczane_id: string; firma_id: string; urun_id: string | null }
  | { tip: "arac"; eczane_id: string; firma_id: string; urun_id: string | null; yayin_id: string; arac_id: string };

export interface EczanemMusteriVideo {
  gonderim_id: string;
  yayin_id: string;
  eczane_id: string;
  eczane_adi: string;
  talep_no?: number | null;
  firma_id: string;
  firma_adi?: string | null;
  urun_id: string | null;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
  arac_id: string;
  arac_turu: EczanemAracTuru;
  thumbnail_url: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  soru_sayisi: number | null;
  gelis_tarihi: string;
  izleme_basladi: boolean;
  izlendi: boolean;
  cevaplandi: boolean;
  izleme_baslangic: string | null;
  izleme_bitis: string | null;
  son_konum_saniye: number;
  begeni_sayisi: number;
  favori_sayisi: number;
  izlenme_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
}

export interface EczanemVideoRaflari {
  yeni_videolarim: EczanemMusteriVideo[];
  yarim_biraktiklarim: EczanemMusteriVideo[];
  en_son_izlediklerim: EczanemMusteriVideo[];
  en_cok_begenilenler: EczanemMusteriVideo[];
  en_cok_favorilenenler: EczanemMusteriVideo[];
  en_cok_izlenenler: EczanemMusteriVideo[];
}

export interface EczanemVideolarYaniti {
  videolar: EczanemMusteriVideo[];
  agac: EczanemSidebarAgaci;
}
