// TM raporu ve ortak toplama yardımcıları tarafından kullanılan veri sözleşmeleri.
export interface KullaniciOzetSatiri {
  kullanici_id: string;
  ad: string;
  soyad: string;
  izlenme_sayisi: number;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  eclub_puani?: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

interface DagilimSatiri extends KullaniciOzetSatiri {
  teknik_dagilimi: Array<{ teknik_adi: string; izlenme_sayisi: number }>;
}

export interface KullaniciUrunDagilimi extends DagilimSatiri {
  urun_id: string;
  urun_adi: string;
}

export interface KullaniciKategoriDagilimi extends DagilimSatiri {
  icerik_turu: string;
}
