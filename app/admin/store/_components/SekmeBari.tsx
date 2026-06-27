// app/admin/store/_components/SekmeBari.tsx
//
// HBStore admin panel sekme bar'ı: Ürünler / Kategoriler / Siparişler arası geçiş.
"use client";
import type { Sekme } from "../_types";
interface SekmeBariProps {
  aktifSekme: Sekme;
  setAktifSekme: (v: Sekme) => void;
}
const SEKMELER: { id: Sekme; etiket: string }[] = [
  { id: "urunler", etiket: "Ürünler" },
  { id: "kategoriler", etiket: "Kategoriler" },
  { id: "siparisler", etiket: "Siparişler" },
];
export default function SekmeBari({ aktifSekme, setAktifSekme }: SekmeBariProps) {
  return (
    <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "0.5px solid #e5e7eb" }}>
      {SEKMELER.map(s => (
        <button
          key={s.id}
          onClick={() => setAktifSekme(s.id)}
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: aktifSekme === s.id ? "2px solid #1d4ed8" : "2px solid transparent",
            color: aktifSekme === s.id ? "#1d4ed8" : "#737373",
            fontSize: "13px",
            fontWeight: aktifSekme === s.id ? 700 : 500,
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