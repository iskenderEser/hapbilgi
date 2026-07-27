// components/pill/Pill.tsx
//
// PILL'İN ŞEKLİNİN TEK SAHİBİ (27.07.2026).
//
// Neden: tarama 118 pill ve 32 farklı ölçü imzası buldu (docs/pill_envanteri.md).
// Yazı boyu 3 yol, kalınlık 4 değer, yatay dolgu 5, dikey dolgu 4, kenar 3, satır
// yüksekliği 4 yoldan geliyordu; aynı satırdaki dört rozet dört ayrı yükseklikteydi.
// Ölçü bundan sonra YALNIZ burada yaşar.
//
// SINIR — bu dosya ŞEKLİ sahiplenir, ANLAMI değil:
//   - "bu kutu şu ölçüdedir"  → burada
//   - "bu durum şu renktir"   → lib/utils/durum/mesaj.ts (durum sözlüğü)
//   - "bu rol şu renktir"     → app/talepler/_types (HEDEF_ROL_TASARIM)
// Anlam sarmalayıcıları (AsamaPill, DurumPill…) rengi o kaynaklardan alır,
// ölçüye hiç karışmaz. Renk sözlüklerini buraya taşımak tek kaynağı bozar.
//
// Kararlar (İskender, 27.07 — docs/pill_envanteri.md §E):
//   1. Standart ölçü: 10px yazı, px-2 py-0.5 dolgu (118 pill'in 57'si zaten böyleydi)
//   2. Tek boy — her ek boy yeni bir dağılma eksenidir
//   3. Kalınlık 600, kenar HER ZAMAN 0.5px, satır yüksekliği tight
//      (leading sabitlenmezse pill yüksekliği metne göre oynar — dağınıklığın asıl sebebi)
//   6. Buton pill'i etiketten ayrışır: zeminsiz + 1px kenar

"use client";

import type { ReactNode } from "react";

/** Bir pill'in üç rengi. Kaynağı anlam sözlükleridir, burada üretilmez. */
export interface PillRenk {
  bg: string;
  metin: string;
  kenar: string;
}

/**
 * Anlam taşımayan pill'ler için nötr gri (aşama pill'i gibi).
 * Karar 5: aşama sıralı bir konum bilgisidir, uyarı değil — renk yalnız durumda
 * anlam taşısın diye aşama nötre alındı. Böylece aynı renk iki şey demiyor.
 */
export const NOTR_RENK: PillRenk = { bg: "#f3f4f6", metin: "#4b5563", kenar: "#e5e7eb" };

// Ölçünün tek satırı. Değişirse tüm pill'ler birlikte değişir — amaç budur.
const OLCU = "inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 leading-tight";

interface PillProps {
  renk: PillRenk;
  children: ReactNode;
  /** true → uzun metin sarar (durum metinleri). false → tek satırda kalır. */
  sarabilir?: boolean;
  /** Yalnız yerleşim sınıfları (w-fit, mt-1…). Ölçü sınıfı geçirilmez. */
  className?: string;
}

export function Pill({ renk, children, sarabilir = false, className = "" }: PillProps) {
  return (
    <span
      className={`${OLCU} ${sarabilir ? "" : "whitespace-nowrap"} ${className}`}
      style={{ background: renk.bg, color: renk.metin, border: `0.5px solid ${renk.kenar}` }}
    >
      {children}
    </span>
  );
}

interface PillButonProps {
  children: ReactNode;
  onClick: () => void;
  /** Seçili sekme/filtre — zemin dolar. Seçili değilken zeminsizdir. */
  secili?: boolean;
  /** Seçiliyken kullanılacak renk; verilmezse nötr. */
  renk?: PillRenk;
  className?: string;
}

/**
 * Tıklanabilir pill (filtre sekmesi, "Filtreyi Kaldır", periyot seçici).
 * Etiketten kenar kalınlığıyla ayrışır: buton 1px, etiket 0.5px. Böylece
 * kullanıcı neyin tıklanabilir olduğunu görebilir (envanter bulgusu P-8).
 */
export function PillButon({ children, onClick, secili = false, renk = NOTR_RENK, className = "" }: PillButonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${OLCU} whitespace-nowrap cursor-pointer transition-colors ${className}`}
      style={
        secili
          ? { background: renk.bg, color: renk.metin, border: `1px solid ${renk.kenar}` }
          : { background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb" }
      }
    >
      {children}
    </button>
  );
}
