// app/admin/_constants.ts

import type { CSSProperties } from "react";
import { TUM_ROLLER, ADMIN_ROLLER } from "@/lib/utils/roller";

// B-31: yerel rol kopyası kalktı — tek kaynaktan (roller.ts) türetilir;
// admin rolleri panelden atanamaz (bilinçli hariç).
export const ROLLER = TUM_ROLLER.filter((r) => !ADMIN_ROLLER.includes(r));

// Tasarım dili login neslinden (K-A3): baykuş grisi + bordo vurgu + Nunito.
// T-3: bordo ailesi TEK kaynak burasıdır — bileşenlerde mavi/yerel renk
// kopyası kalmadı. ANLAMSAL renkler bu dile dahil değildir (İskender kararı,
// 18.07.2026): sipariş durum etiketleri (mavi Hazırlanıyor, mor Kargoda...),
// modül switch renkleri, amber eksik dili ve kırmızı hata dili yerinde kalır.
export const RENK_GRI = "#737373";
export const RENK_BORDO = "#bc2d0d";
export const RENK_CIZGI = "#e5e7eb";
// Seçili/vurgulu zemin ve kenarlık — bordo ailesinin açık tonları.
export const RENK_BORDO_ZEMIN = "#fef2f2";
export const RENK_BORDO_KENAR = "#fecaca";

export const inputStyle: CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  padding: "8px 10px",
  fontSize: "13px",
  color: "#111",
  background: "white",
  fontFamily: "'Nunito', sans-serif",
  minWidth: 0,
};

export const readonlyInputStyle: CSSProperties = {
  ...inputStyle,
  background: "#f9fafb",
  color: "#737373",
  cursor: "default",
};

export const labelStyle: CSSProperties = {
  background: RENK_BORDO_ZEMIN,
  color: RENK_BORDO,
  fontSize: "12px",
  fontWeight: 600,
  padding: "8px 12px",
  minWidth: "110px",
  display: "flex",
  alignItems: "center",
  borderRight: "0.5px solid #e5e7eb",
  flexShrink: 0,
  fontFamily: "'Nunito', sans-serif",
};

export const rowStyle: CSSProperties = {
  display: "flex",
  border: "0.5px solid #e5e7eb",
  borderRadius: "8px",
  overflow: "hidden",
  marginBottom: "7px",
};

export const btnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Nunito', sans-serif",
  border: "0.5px solid #e5e7eb",
};

export const filterSelectStyle: CSSProperties = {
  border: "0.5px solid #e5e7eb",
  borderRadius: "6px",
  padding: "5px 8px",
  fontSize: "11px",
  fontFamily: "'Nunito', sans-serif",
  color: "#374151",
  background: "white",
  cursor: "pointer",
  outline: "none",
};
// ─────────────────────────────────────────────────────────────────────────
// M2 — Yönetim kabuğu tek kaynağı (admin modernizasyon planı B.2, K-A3/K-A4).
// firmaAdminGorur: ileride "firma admini" rolü (K-A1) için görünürlük bayrağı —
// sekme/bölüm kapatma tek yerden yapılır, dağınık if'lerle değil.
// ─────────────────────────────────────────────────────────────────────────

export type ModulSekmeId =
  | "kullanicilar"
  | "organizasyon"
  | "urunteknik"
  | "tclub"
  | "cclub"
  | "eclub"
  | "eczanem";

// Sekme grupları (İskender kararı, 17.07.2026): takım/bölge ve ürün/teknik
// MODÜL değil, firmanın KURULUŞ TANIMLARIDIR (organizasyon şeması firmanın
// altındadır). Sekme çubuğu iki grup halinde çizilir: "Firma" | "Modüller".
export type SekmeGrubu = "firma" | "modul";

export interface ModulSekme {
  id: ModulSekmeId;
  etiket: string;
  grup: SekmeGrubu;
  firmaAdminGorur: boolean;
}

export const MODUL_SEKMELERI: ModulSekme[] = [
  { id: "kullanicilar", etiket: "Kullanıcılar", grup: "firma", firmaAdminGorur: true },
  { id: "organizasyon", etiket: "Organizasyon", grup: "firma", firmaAdminGorur: true },
  { id: "urunteknik", etiket: "Ürün & Teknik", grup: "firma", firmaAdminGorur: true },
  { id: "tclub", etiket: "T-Club", grup: "modul", firmaAdminGorur: true },
  { id: "cclub", etiket: "C-Club", grup: "modul", firmaAdminGorur: true },
  { id: "eclub", etiket: "E-Club", grup: "modul", firmaAdminGorur: true },
  { id: "eczanem", etiket: "Eczanem", grup: "modul", firmaAdminGorur: true },
];

export type GlobalBolumId = "hbstore" | "eclubstore" | "sistem";

export interface GlobalBolum {
  id: GlobalBolumId;
  etiket: string;
  firmaAdminGorur: boolean; // global işler firma adminine KAPALI doğar (K-A1)
}

export const GLOBAL_BOLUMLER: GlobalBolum[] = [
  { id: "hbstore", etiket: "HBStore", firmaAdminGorur: false },
  { id: "eclubstore", etiket: "E-Club Store", firmaAdminGorur: false },
  { id: "sistem", etiket: "Sistem Ayarları", firmaAdminGorur: false },
];
