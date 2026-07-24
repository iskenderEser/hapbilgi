// app/yayin-yonetimi/_types.ts
//
// Yayın yönetimi sayfasının paylaşılan tip sözleşmeleri ve sabitleri.
// page.tsx, hook ve alt bileşenler buradan import eder.

import type { HedefRol } from "@/app/talepler/_types";

// ============================================================================
// Tipler
// ============================================================================

// Bekleyen: onaylanmış, henüz yayınlanmamış soru seti + video (puanlama bekliyor).
export interface Bekleyen {
  soru_seti_durum_id: string;
  soru_seti_id: string;
  video_durum_id: string;
  sorular: any[];
  video_url: string | null;
  thumbnail_url: string | null;
  video_puan_id: string | null;
  video_puani: number | null;
  soru_puan_map: Record<number, { soru_seti_puan_id: string; soru_puani: number }>;
  talep_no: number;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  turu_adi: string | null; // içerik/eğitim türü etiketi ("Medikal Eğitim" vb.)
  hedef_rol: HedefRol;
  soru_seti_buyuklugu: number | null;
  video_basi_soru_sayisi: number | null;
  onay_tarihi: string;
}

// Yayin: yayınlanmış (yayında veya durdurulmuş) içerik.
export interface Yayin {
  yayin_id: string;
  soru_seti_durum_id: string;
  durum: string;
  yayin_tarihi: string;
  durdurma_tarihi: string | null;
  talep_no: number;
  firma_adi: string;
  urun_adi: string;
  teknik_adi: string;
  turu_adi: string | null; // içerik/eğitim türü etiketi ("Medikal Eğitim" vb.)
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  sorular: any[];
  ileri_sarma_acik: boolean;
  hedef_rol: HedefRol;
}

// Alt sekme (durum filtresi) tipi.
export type AltSekme = "bekleyen" | "yayinda" | "durdurulan";

// ============================================================================
// Sabitler
// ============================================================================

export const VIDEO_PUAN_SECENEKLERI = [40, 45, 50, 55, 60, 65, 70];
export const SORU_PUAN_SECENEKLERI = [3, 4, 5, 6, 7];
export const EXTRA_PUAN_SECENEKLERI = [5, 6, 7, 8, 9, 10];

// Ana sekme (hedef rol) etiketleri. Renkler HEDEF_ROL_TASARIM'dan gelir;
// etiketler bu sayfaya özgü tam isimlerdir (kisaEtiket'ten türetilemez —
// örn. teknisyen için "Ecz. Tek." değil "Eczane Teknisyeni" istenir).
export const ANA_SEKME_ETIKETLERI: Record<HedefRol, string> = {
  utt: "UTT Yayınları",
  bm: "BM Yayınları",
  eczaci: "Eczacı Yayınları",
  eczane_teknisyeni: "Eczane Teknisyeni Yayınları",
  eczanem: "Eczanem Yayınları",
};

// Ana sekmelerin gösterim sırası. Eczanem sekmesi U5'te açıldı — PM eczanem
// bekleyen videolarını buradan yayına alır (barkod + Karşılık formu satır içinde).
export const ANA_SEKMELER: HedefRol[] = ["utt", "bm", "eczaci", "eczane_teknisyeni", "eczanem"];