// app/admin/_components/SekmeBari.tsx
//
// Kullanıcılar sekmesinin alt-sekme bar'ı: Tekil / Toplu giriş arası geçiş.

"use client";

import type { GirisSecimi } from "../_types";
import { RENK_BORDO } from "../_constants";

interface SekmeBariProps {
  girisSecimi: GirisSecimi;
  setGirisSecimi: (v: GirisSecimi) => void;
}

const SEKMELER: { id: GirisSecimi; etiket: string }[] = [
  { id: "tekil", etiket: "Tekil Giriş" },
  { id: "toplu", etiket: "Toplu Giriş" },
];

export default function SekmeBari({ girisSecimi, setGirisSecimi }: SekmeBariProps) {
  return (
    <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "0.5px solid #e5e7eb" }}>
      {SEKMELER.map(s => (
        <button
          key={s.id}
          onClick={() => setGirisSecimi(s.id)}
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: girisSecimi === s.id ? `2px solid ${RENK_BORDO}` : "2px solid transparent",
            color: girisSecimi === s.id ? RENK_BORDO : "#737373",
            fontSize: "13px",
            fontWeight: girisSecimi === s.id ? 700 : 500,
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
            transition: "border-color 0.15s",
          }}
        >
          {s.etiket}
        </button>
      ))}
    </div>
  );
}