// lib/store/sabitler.ts
// HBStore sabitleri ve durum/etiket eşlemeleri.
//
// Kod sabitleri: deploy gerektirir değişimi.

import type { SiparisDurum } from "@/lib/store/tipler";

// ─── KOD SABİTLERİ ───────────────────────────────────────────────────────────

/** Kullanıcının kendi siparişini iptal edebileceği süre (saat cinsinden). */
export const IPTAL_SURE_SAATI = 12;

/** Stok azlığı uyarısı için eşik (UI üstünde "son N tane" göstermek için). */
export const STOK_AZ_ESIK = 5;

// ─── DURUM ETİKETLERİ (UI için Türkçe karşılıklar) ───────────────────────────

export const DURUM_ETIKETLERI: Record<SiparisDurum, string> = {
  beklemede: "Beklemede",
  kargoda: "Kargoda",
  teslim_edildi: "Teslim Edildi",
  iptal: "İptal Edildi",
};

/**
 * Durum bazlı renk kodları (Tailwind/inline style için).
 * UI tutarlılığı için tek yerde tanımlı.
 */
export const DURUM_RENKLERI: Record<SiparisDurum, { metin: string; arka: string; kenar: string }> = {
  beklemede: { metin: "#854d0e", arka: "#fefce8", kenar: "#fde68a" },
  kargoda: { metin: "#1d4ed8", arka: "#e6f1fb", kenar: "#bfdbfe" },
  teslim_edildi: { metin: "#16a34a", arka: "#f0fdf4", kenar: "#bbf7d0" },
  iptal: { metin: "#bc2d0d", arka: "#fef2f2", kenar: "#fecaca" },
};