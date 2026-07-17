// app/admin/_components/SekmeBari.tsx
//
// Admin panel sekme bar'ı: Tekil / Toplu / Takım / Ürün arası geçiş.

"use client";

import type { GirisSecimi } from "../_types";

interface SekmeBariProps {
  girisSecimi: GirisSecimi;
  setGirisSecimi: (v: GirisSecimi) => void;
  // M2: üst modül sekmesi hangi alt-sekmeleri gösterecek?
  // (Kullanıcılar → tekil/toplu, Yapı → takim/urun). Verilmezse tümü.
  secenekler?: GirisSecimi[];
}

const SEKMELER: { id: GirisSecimi; etiket: string }[] = [
  { id: "tekil", etiket: "Tekil Giriş" },
  { id: "toplu", etiket: "Toplu Giriş" },
  { id: "takim", etiket: "Takım / Bölge" },
  { id: "urun", etiket: "Ürün / Teknik" },
];

export default function SekmeBari({ girisSecimi, setGirisSecimi, secenekler }: SekmeBariProps) {
  const gosterilecekler = secenekler ? SEKMELER.filter(s => secenekler.includes(s.id)) : SEKMELER;
  return (
    <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "0.5px solid #e5e7eb" }}>
      {gosterilecekler.map(s => (
        <button
          key={s.id}
          onClick={() => setGirisSecimi(s.id)}
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: girisSecimi === s.id ? "2px solid #1d4ed8" : "2px solid transparent",
            color: girisSecimi === s.id ? "#1d4ed8" : "#737373",
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