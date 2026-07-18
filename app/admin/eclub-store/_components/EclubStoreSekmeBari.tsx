// app/admin/eclub-store/_components/EclubStoreSekmeBari.tsx
"use client";

import type { EclubStoreSekme } from "../_types";
import { RENK_BORDO } from "../../_constants";

interface Props {
  aktifSekme: EclubStoreSekme;
  setAktifSekme: (s: EclubStoreSekme) => void;
}

const SEKMELER: { id: EclubStoreSekme; ad: string }[] = [
  { id: "urunler", ad: "Ürünler" },
  { id: "kategoriler", ad: "Kategoriler" },
  { id: "siparisler", ad: "Siparişler" },
];

export default function EclubStoreSekmeBari({ aktifSekme, setAktifSekme }: Props) {
  return (
    <div style={{ display: "flex", gap: "4px", borderBottom: "0.5px solid #e5e7eb", marginBottom: "20px" }}>
      {SEKMELER.map((s) => {
        const aktif = aktifSekme === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setAktifSekme(s.id)}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: aktif ? `2px solid ${RENK_BORDO}` : "2px solid transparent",
              color: aktif ? RENK_BORDO : "#6b7280",
              fontWeight: aktif ? 600 : 400,
              fontSize: "14px",
              cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {s.ad}
          </button>
        );
      })}
    </div>
  );
}