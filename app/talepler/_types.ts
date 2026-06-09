// app/talepler/_types.ts
//
// Talepler sayfasının paylaşılan tip sözleşmeleri, sabitler ve helper'lar.
// Bu dosyaya tüm bileşenler ve hook'lar import eder — bu sayfanın kontrat dosyasıdır.

import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";

// ============================================================================
// Tipler
// ============================================================================

export interface Talep {
  talep_id: string;
  uretici_id: string;
  urun_id: string | null;
  teknik_id: string | null;
  kategori_id: string | null;
  urun_adi: string;
  teknik_adi: string;
  kategori_adi: string | null;
  egitim_turu: TalepTuru;
  aciklama: string;
  created_at: string;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  soru_seti_buyuklugu: number;
  video_basi_soru_sayisi: number;
}

export interface Urun {
  urun_id: string;
  urun_adi: string;
}

export interface Teknik {
  teknik_id: string;
  teknik_adi: string;
}

export interface Kategori {
  kategori_id: string;
  kategori_adi: string;
  aktif_mi: boolean;
}

// Madde 4 Aşama 2B için — UrunTeknikSecici (Adım 9) içinde takım dropdown'una beslenecek.
export interface Takim {
  takim_id: string;
  takim_adi: string;
}

export interface DosyaItem {
  dosya_adi: string;
  url: string;
  boyut: number;
  yuklenme_tarihi: string;
}

export interface Soru {
  soru_metni: string;
  secenekler: { harf: string; metin: string; dogru: boolean }[];
}

export interface KullaniciBilgi {
  firma_id: string;
  takim_id: string | null;
}

// page.tsx'te inline `{ dosya: File; preview: DosyaItem }` olarak kullanılıyordu — adlandırıldı.
export interface BekleyenDosya {
  dosya: File;
  preview: DosyaItem;
}

// ============================================================================
// Sabitler
// ============================================================================

export const DESTEKLENEN_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4,.mov,.avi,.mkv,.webm";
export const VIDEO_FORMATLAR = ".mp4,.mov,.avi,.mkv,.webm";
export const EK_DOSYA_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg";
export const SORU_SETI_BUYUKLUGU_SECENEKLERI = [10, 15, 20, 25];

// Tab altındaki kısa açıklama metinleri.
export const TALEP_TURU_ALT_ACIKLAMA: Record<TalepTuru, string> = {
  urun_egitimi: "Ürün + teknik bilgisi videosu",
  satis_teknikleri: "Satış becerisi (ürün tercihli)",
  medikal_egitim: "Genel medikal içerik",
  urun_medikal_egitim: "Ürünün medikal yönü",
  ik_egitimi: "İK bilgilendirme, KVKK, etik",
};

// Tüm geçerli talep türlerinin sırası — TALEP_TURU_KURALLARI anahtarlarından.
export const TUM_TURLER = Object.keys(TALEP_TURU_KURALLARI) as TalepTuru[];

// Liste tablosunda gösterilen tür rozeti (renk + etiket).
export const TUR_ROZET: Record<TalepTuru, { bg: string; renk: string; border: string; etiket: string }> = {
  urun_egitimi: { bg: "transparent", renk: "transparent", border: "transparent", etiket: "" }, // ürün adı zaten gösteriliyor, rozet yok
  satis_teknikleri: { bg: "#eff6ff", renk: "#1d4ed8", border: "#bfdbfe", etiket: "Satış Teknikleri" },
  medikal_egitim: { bg: "#fef2f2", renk: "#bc2d0d", border: "#fecaca", etiket: "Medikal Eğitim" },
  urun_medikal_egitim: { bg: "#fdf4ff", renk: "#7e22ce", border: "#e9d5ff", etiket: "Ürün-Medikal" },
  ik_egitimi: { bg: "#f0fdf4", renk: "#15803d", border: "#bbf7d0", etiket: "İK Eğitimi" },
};

// ============================================================================
// Helper
// ============================================================================

export const dosyaTipiRenk = (dosya_adi: string): { etiket: string; bg: string; renk: string } => {
  const ext = dosya_adi.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { etiket: "PDF", bg: "#fef2f2", renk: "#bc2d0d" };
  if (["docx", "doc"].includes(ext)) return { etiket: "DOC", bg: "#eff6ff", renk: "#1d4ed8" };
  if (["pptx", "ppt"].includes(ext)) return { etiket: "PPT", bg: "#fff7ed", renk: "#c2410c" };
  if (["xlsx", "xls"].includes(ext)) return { etiket: "XLS", bg: "#f0fdf4", renk: "#15803d" };
  if (ext === "txt") return { etiket: "TXT", bg: "#f9fafb", renk: "#374151" };
  if (["png", "jpg", "jpeg"].includes(ext)) return { etiket: "IMG", bg: "#fdf4ff", renk: "#7e22ce" };
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return { etiket: "VID", bg: "#f0fdf4", renk: "#16a34a" };
  return { etiket: ext.toUpperCase(), bg: "#f9fafb", renk: "#737373" };
};