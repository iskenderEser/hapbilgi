// components/SenaryoMetniGoster.tsx
//
// Senaryo metnini gösterir — `onceki` verilmişse (G-2/G-3 —
// docs/senaryo_tek_metin_diff_gelistirme_is_plani.md) kelime bazlı farkı
// hesaplayıp çıkarılan kısmı üstü çizili (silinmez), eklenen kısmı kırmızı
// vurgulu render eder. `onceki` yoksa (ilk gönderim, onaylı/iptal metni) düz
// metin gösterir.

"use client";

import { senaryoDiffHesapla } from "@/lib/utils/senaryo/diffHesapla";

interface Props {
  mevcut: string;
  onceki?: string;
}

export function SenaryoMetniGoster({ mevcut, onceki }: Props) {
  if (!onceki) {
    return <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap m-0">{mevcut}</p>;
  }

  const parcalar = senaryoDiffHesapla(onceki, mevcut);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap m-0">
      {parcalar.map((parca, i) => {
        if (parca.tur === "ekle") {
          return (
            <span key={i} style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 3, padding: "0 2px" }}>
              {parca.metin}
            </span>
          );
        }
        if (parca.tur === "cikar") {
          return (
            <span key={i} style={{ textDecoration: "line-through", color: "#9ca3af" }}>
              {parca.metin}
            </span>
          );
        }
        return <span key={i} className="text-gray-700">{parca.metin}</span>;
      })}
    </p>
  );
}
