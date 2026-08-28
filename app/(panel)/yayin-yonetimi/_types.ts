// app/yayin-yonetimi/_types.ts
//
// Yayın yönetimi sayfasının paylaşılan tip sözleşmeleri ve sabitleri.
// page.tsx, hook ve alt bileşenler buradan import eder.

import type { HedefRoller, Soru } from "@/app/(panel)/talepler/_types";
import { ECLUB_ORTAK_YAYIN_GRUBU, YAYIN_HEDEF_GRUP_SIRASI, type YayinHedefGrubu } from "@/lib/utils/roller";

// ============================================================================
// Tipler
// ============================================================================

// Bekleyen: onaylanmış, henüz yayınlanmamış soru seti + video (puanlama bekliyor).
export interface Bekleyen {
  soru_seti_durum_id: string;
  soru_seti_id: string;
  video_durum_id: string;
  arac_durum_id?: string | null;
  arac_turu?: "video" | "podcast" | "gorsel" | "flip_pdf";
  sorular: Soru[];
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
  hedef_roller: HedefRoller;
  soru_seti_buyuklugu: number | null;
  video_basi_soru_sayisi: number | null;
  onay_tarihi: string;
  yayin_oncesi_silme_durumu: "isleniyor" | "hata" | null;
  yayin_oncesi_silme_tarihi: string | null;
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
  sorular: Soru[];
  hedef_roller: HedefRoller;
}

// Alt sekme (durum filtresi) tipi.
export type AltSekme = "bekleyen" | "yayinda" | "durdurulan";

// Yayına hazır içeriklerin hedef kitle bazındaki canlı dağılımı.
// Sidebar toplam sayıyı, Yayın Merkezi ise bu dağılımı gösterir.
export type BekleyenHedefSayilari = Record<YayinHedefGrubu, number>;

// ============================================================================
// Sabitler
// ============================================================================

export const VIDEO_PUAN_SECENEKLERI = [40, 45, 50, 55, 60, 65, 70];
// Eczanem yayınları için ayrı video puanı skalası (50–500, 25'er artan).
export const VIDEO_PUAN_SECENEKLERI_ECZANEM = [50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500];
export const SORU_PUAN_SECENEKLERI = [3, 4, 5, 6, 7];
// Eczanem yayınları için ayrı soru puanı skalası (10–100, 10'ar artan).
export const SORU_PUAN_SECENEKLERI_ECZANEM = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const EXTRA_PUAN_SECENEKLERI = [5, 6, 7, 8, 9, 10];

// Ana sekme (hedef rol) etiketleri. Renkler HEDEF_ROL_TASARIM'dan gelir;
// etiketler bu sayfaya özgü tam isimlerdir (kisaEtiket'ten türetilemez —
// örn. teknisyen için "Ecz. Tek." değil "Eczane Teknisyeni" istenir).
export const ANA_SEKME_ETIKETLERI: Record<YayinHedefGrubu, string> = {
  utt: "UTT Yayınları",
  bm: "BM Yayınları",
  eczaci: "Eczacı Yayınları",
  eczane_teknisyeni: "Eczane Teknisyeni Yayınları",
  [ECLUB_ORTAK_YAYIN_GRUBU]: "Eczacı ve Eczane Teknisyeni Ortak Yayınları",
  eczanem: "Eczanem Yayınları",
};

// Ana sekmelerin gösterim sırası. Sıra tek kaynakta (roller.ts) tutulur.
// Eczanem sekmesi U5'te açıldı — PM eczanem bekleyen videolarını buradan yayına
// alır (barkod + Karşılık formu satır içinde).
export const ANA_SEKMELER: YayinHedefGrubu[] = YAYIN_HEDEF_GRUP_SIRASI;
