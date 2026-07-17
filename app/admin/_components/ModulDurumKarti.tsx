// app/admin/_components/ModulDurumKarti.tsx
//
// M2 — Modül sekmelerinin durum kartı: modülün bu firmadaki açık/kapalı
// durumu + aç/kapa aksiyonu (FirmaSidebar toggle'larının sekme içi karşılığı).
// İçerik yönetimi (görünürlük + müdahale katmanları) M4'te bu kartın altına
// gelecek; kart o güne kadar sekmenin "boş ama dürüst" durumunu anlatır.
//
// acik === null → modülün firma bayrağı yok (T-Club ana modüldür, hep açık;
// Eczanem bayrağı admin PATCH kapsamına M4'te eklenecek).

"use client";

import { RENK_BORDO, RENK_CIZGI } from "../_constants";

interface ModulDurumKartiProps {
  baslik: string;
  aciklama: string;
  acik: boolean | null;
  toggleLoading?: boolean;
  onToggle?: () => void;
}

export default function ModulDurumKarti(p: ModulDurumKartiProps) {
  return (
    <div
      style={{
        border: `0.5px solid ${RENK_CIZGI}`,
        borderRadius: "12px",
        padding: "20px",
        maxWidth: "640px",
        fontFamily: "'Nunito', sans-serif",
        background: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "#111" }}>{p.baslik}</span>
          {p.acik !== null && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 10px",
                borderRadius: "999px",
                background: p.acik ? "#f0fdf4" : "#fef2f2",
                color: p.acik ? "#166534" : RENK_BORDO,
                border: `1px solid ${p.acik ? "#bbf7d0" : "#fecaca"}`,
              }}
            >
              {p.acik ? "Açık" : "Kapalı"}
            </span>
          )}
        </div>

        {p.acik !== null && p.onToggle && (
          <button
            onClick={p.onToggle}
            disabled={p.toggleLoading}
            style={{
              padding: "6px 14px",
              background: p.acik ? "transparent" : RENK_BORDO,
              border: p.acik ? `0.5px solid ${RENK_CIZGI}` : "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              color: p.acik ? "#737373" : "white",
              cursor: p.toggleLoading ? "not-allowed" : "pointer",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {p.acik ? "Modülü Kapat" : "Modülü Aç"}
          </button>
        )}
      </div>

      <p style={{ fontSize: "13px", color: "#737373", margin: "10px 0 0 0", lineHeight: 1.6 }}>
        {p.aciklama}
      </p>

      <p style={{ fontSize: "12px", color: "#9ca3af", margin: "12px 0 0 0" }}>
        Bu modülün içerik görünümü ve müdahale araçları M4 fazında bu sekmeye eklenecek
        (admin_modernizasyon_is_plani.md — B.3).
      </p>
    </div>
  );
}
