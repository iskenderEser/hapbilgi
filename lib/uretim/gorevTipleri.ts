import type { Soru } from "@/lib/soru/parse";
import type { HedefRoller } from "@/lib/utils/roller";

export type UretimGorevAsamasi = "senaryo" | "video" | "soru_seti";
export type UretimGorevDurumu =
  | "atama_bekliyor"
  | "hazirlaniyor"
  | "inceleme_bekliyor"
  | "revizyon_bekliyor"
  | "tamamlandi"
  | "iptal";

export interface UretimGorevTalebi {
  talep_id: string;
  talep_no: number;
  uretici_id: string;
  uretici_rol_adi: string | null;
  firma_id: string;
  firma_adi: string;
  urun_id: string | null;
  urun_adi: string;
  teknik_id: string | null;
  teknik_adi: string;
  egitim_turu: string;
  hedef_roller: HedefRoller;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  soru_seti_buyuklugu: number;
  secenek_sayisi: number;
  video_basi_soru_sayisi: number;
  ogrenme_araci_turu: "video" | "podcast" | "gorsel" | "flip_pdf";
  ogrenme_araci_tercihleri: Record<string, unknown>;
  created_at: string;
}

export interface UretimDurumGecmisi {
  durum: string;
  notlar: string | null;
  created_at: string;
}

export type UretimGorevIcerigi =
  | { asama: "senaryo"; senaryo_metni: string }
  | { asama: "video"; video_url: string | null; thumbnail_url: string | null }
  | { asama: "podcast"; ses_url: string; kapak_url: string; transkript_url: string; sure_saniye: number }
  | { asama: "gorsel"; gorsel_url: string; genislik: number; yukseklik: number }
  | { asama: "flip_pdf"; pdf_url: string; sayfa_sayisi: number }
  | { asama: "soru_seti"; sorular: Soru[] };

export interface UretimGorevi {
  gorev_id: string;
  talep_id: string;
  asama: UretimGorevAsamasi;
  senaryo_id: string | null;
  video_id: string | null;
  arac_id: string | null;
  soru_seti_id: string | null;
  atanan_iu_id: string | null;
  durum: UretimGorevDurumu;
  atama_kaynagi: string | null;
  atama_tarihi: string | null;
  baslama_tarihi: string | null;
  inceleme_tarihi: string | null;
  tamamlanma_tarihi: string | null;
  iptal_tarihi: string | null;
  surum: number;
  created_at: string;
  updated_at: string;
  soru_sayisi: number;
  revizyon_sayisi: number;
  talep: UretimGorevTalebi | null;
  atanan_iu: { kullanici_id: string; ad: string; soyad: string; ad_soyad: string; aktif_mi: boolean } | null;
  icerik?: UretimGorevIcerigi | null;
  durum_gecmisi?: UretimDurumGecmisi[];
}
