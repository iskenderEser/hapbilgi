export interface EczanemMusteriVideo {
  gonderim_id: string;
  yayin_id: string;
  eczane_id: string;
  eczane_adi: string;
  talep_no?: number | null;
  firma_adi?: string | null;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
  arac_id: string | null;
  arac_turu: "video" | "podcast" | "gorsel" | "flip_pdf";
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
