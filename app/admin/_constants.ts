// app/admin/_constants.ts

import type { CSSProperties } from "react";

export const ROLLER = [
  "pm", "jr_pm", "kd_pm", "iu", "tm", "bm", "utt", "kd_utt",
  "gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm",
  "egt_md", "egt_yrd_md", "egt_yon", "egt_uz",
  "ik_drk", "ik_md", "ik_yrd_md", "ik_uz", "ik_per",
];

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
  background: "#eff6ff",
  color: "#1d4ed8",
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
// Tasarım dili login neslinden: baykuş grisi + bordo vurgu + Nunito.
// firmaAdminGorur: ileride "firma admini" rolü (K-A1) için görünürlük bayrağı —
// sekme/bölüm kapatma tek yerden yapılır, dağınık if'lerle değil.
// ─────────────────────────────────────────────────────────────────────────

export const RENK_GRI = "#737373";
export const RENK_BORDO = "#bc2d0d";
export const RENK_CIZGI = "#e5e7eb";

export type ModulSekmeId = "kullanicilar" | "yapi" | "tclub" | "cclub" | "eclub" | "eczanem";

export interface ModulSekme {
  id: ModulSekmeId;
  etiket: string;
  firmaAdminGorur: boolean;
}

export const MODUL_SEKMELERI: ModulSekme[] = [
  { id: "kullanicilar", etiket: "Kullanıcılar", firmaAdminGorur: true },
  { id: "yapi", etiket: "Yapı", firmaAdminGorur: true },
  { id: "tclub", etiket: "T-Club", firmaAdminGorur: true },
  { id: "cclub", etiket: "C-Club", firmaAdminGorur: true },
  { id: "eclub", etiket: "E-Club", firmaAdminGorur: true },
  { id: "eczanem", etiket: "Eczanem", firmaAdminGorur: true },
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
