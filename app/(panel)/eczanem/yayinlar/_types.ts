import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

// Eczanem Yayınları UTT dağıtım yüzeyinin istemci sözleşmeleri.

export interface UttEczanemYayin {
  yayin_id: string;
  talep_no: number | null;
  firma_adi: string | null;
  urun_adi: string;
  teknik_adi: string;
  video_puani: number | null;
  icerik_turu: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  yayin_tarihi: string | null;
  arac_id: string;
  arac_turu: OgrenmeAraciTuru;
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
  aylikIstatistikler: {
    uttGonderimSayisi: number;
    eczaneGonderimSayisi: number;
    sonrakiAyBaslangici: string;
  };
}
