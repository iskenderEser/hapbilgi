export interface UttEczanemYayin {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  yayin_tarihi: string | null;
}

export interface UttEczanemEczane {
  eczane_id: string;
  eczane_adi: string;
  aktif_uye_sayisi: number;
  esik_uygun: boolean;
}

export interface UttEczanemGonderim {
  yayin_id: string;
  eczane_id: string;
  created_at: string;
}

export interface UttEczanemVeri {
  esik: number;
  yayinlar: UttEczanemYayin[];
  eczaneler: UttEczanemEczane[];
  gonderimler: UttEczanemGonderim[];
}

export interface UttEczanemOnayHedefi {
  yayin: UttEczanemYayin;
  eczane: UttEczanemEczane;
}
