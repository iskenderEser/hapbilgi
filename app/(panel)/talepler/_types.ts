// app/talepler/_types.ts
//
// Talepler sayfasının paylaşılan tip sözleşmeleri, sabitler ve helper'lar.
// Bu dosyaya tüm bileşenler ve hook'lar import eder — bu sayfanın kontrat dosyasıdır.

import { TALEP_TURU_SIRA, type TalepTuru } from "@/lib/uretici/yetenekler";
import type { HedefRol, HedefRoller } from "@/lib/utils/roller";
import type { ZincirAsama } from "@/lib/utils/uretimZinciri";
import type { DurumKodu } from "@/lib/utils/durum/mesaj";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

// ============================================================================
// Tipler
// ============================================================================

// Hedef rol tipinin tek kaynağı lib/utils/roller.ts'tir (U0 — Eczanem zemini).
// Bu re-export, sayfa-içi bileşenlerin mevcut import yolunu korur.
export type { HedefRol, HedefRoller };

export interface Talep {
  talep_id: string;
  talep_no: number;
  firma_adi: string;
  uretici_id: string;
  urun_id: string | null;
  teknik_id: string | null;
  urun_adi: string;
  teknik_adi: string;
  egitim_turu: TalepTuru;
  ogrenme_araci_turu: OgrenmeAraciTuru;
  hedef_roller: HedefRoller;
  aciklama: string;
  created_at: string;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  soru_seti_buyuklugu: number;
  video_basi_soru_sayisi: number;
  // ── Zincir durumu (27.07): /talepler/api ekler, v_uretici_icerik_takip'ten türer.
  // Sayfa bu alanlarla "devam eden / iptal edilen" ayrımını yapar; üretimi bitmiş
  // talepler hiç gösterilmez — onlar ana sayfadaki Yayın Listesi'ne aittir.
  asama: ZincirAsama;
  durum_kodu: DurumKodu;
  uretim_bitti: boolean;
  iptal_edildi: boolean;
  /** İşi o an üstlenen içerik üreticisinin adı — iptal tablosunda gösterilir. */
  iu_ad_soyad: string | null;
}

export interface Urun {
  urun_id: string;
  urun_adi: string;
}

export interface Teknik {
  teknik_id: string;
  teknik_adi: string;
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
export const PODCAST_FORMATLAR = ".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/aac,audio/x-m4a";
export const GORSEL_FORMATLAR = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const PODCAST_KAPAK_FORMATLARI = ".png,.jpg,.jpeg,image/png,image/jpeg";
export const TRANSKRIPT_FORMATLARI = ".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const VIDEO_FORMATLAR = ".mp4,.mov,.avi,.mkv,.webm";
export const EK_DOSYA_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg";
export const SORU_SETI_BUYUKLUGU_SECENEKLERI = [10, 15, 20, 25];

// Tab altındaki kısa açıklama metinleri.
export const TALEP_TURU_ALT_ACIKLAMA: Record<TalepTuru, string> = {
  urun_egitimi: "Ürün + teknik bilgisi videosu",
  satis_teknikleri: "Satış becerisi (ürün tercihli)",
  yonetim_egitimi: "Yönetim eğitimleri",
  medikal_egitim: "Genel medikal içerik",
  urun_medikal_egitim: "Ürünün medikal yönü",
  ik_egitimi: "İK bilgilendirme, KVKK, etik",
};

// Tüm geçerli talep türlerinin sırası — üretim ve raporların ortak sözleşmesi.
export const TUM_TURLER = [...TALEP_TURU_SIRA];

// Liste tablosunda gösterilen tür rozeti (renk + etiket).
export const TUR_ROZET: Record<TalepTuru, { bg: string; renk: string; border: string; etiket: string }> = {
  urun_egitimi: { bg: "transparent", renk: "transparent", border: "transparent", etiket: "" }, // ürün adı zaten gösteriliyor, rozet yok
  satis_teknikleri: { bg: "#eff6ff", renk: "#1d4ed8", border: "#bfdbfe", etiket: "Satış Teknikleri" },
  yonetim_egitimi: { bg: "#f5f3ff", renk: "#6d28d9", border: "#ddd6fe", etiket: "Yönetim Eğitimleri" },
  medikal_egitim: { bg: "#fef2f2", renk: "#bc2d0d", border: "#fecaca", etiket: "Medikal Eğitim" },
  urun_medikal_egitim: { bg: "#fdf4ff", renk: "#7e22ce", border: "#e9d5ff", etiket: "Ürün-Medikal" },
  ik_egitimi: { bg: "#f0fdf4", renk: "#15803d", border: "#bbf7d0", etiket: "İK Eğitimi" },
};

// Hedef rol görsel tasarımı (bant + pill için ortak renk/etiket sözlüğü).
// UTT: mavi tonu (sistemin ana mavisi). BM: bordo (Challenge Club rengi).
// Eczacı: Türk eczane kırmızısı (#e30a17). Eczane Teknisyeni: konfederasyon
// laciverti (#10304a) + yeşil (#7ed957). (E-Club akışı — ikisi ayrı hedef.)
// Eczanem: amber (eczanenin kendi müşterisi — üçüncü katman).
export const HEDEF_ROL_TASARIM: Record<HedefRol, { bg: string; renk: string; border: string; tamEtiket: string; kisaEtiket: string }> = {
  utt: {
    bg: "#eff6ff",
    renk: "#1d4ed8",
    border: "#bfdbfe",
    tamEtiket: "Ürün Tanıtım Temsilcileri",
    kisaEtiket: "UTT",
  },
  bm: {
    bg: "#fef2f2",
    renk: "#bc2d0d",
    border: "#fecaca",
    tamEtiket: "Bölge Müdürleri",
    kisaEtiket: "BM",
  },
  eczaci: {
    bg: "#fff5f5",
    renk: "#e30a17",
    border: "#e30a17",
    tamEtiket: "Eczacılar",
    kisaEtiket: "Eczacı",
  },
  eczane_teknisyeni: {
    bg: "#eaf7e4",
    renk: "#10304a",
    border: "#7ed957",
    tamEtiket: "Eczane Teknisyenleri",
    kisaEtiket: "Ecz. Tek.",
  },
  eczanem: {
    bg: "#fffbeb",
    renk: "#b45309",
    border: "#fde68a",
    tamEtiket: "Eczane Müşterileri",
    kisaEtiket: "Eczanem",
  },
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
