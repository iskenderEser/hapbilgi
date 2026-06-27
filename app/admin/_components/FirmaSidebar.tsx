// app/admin/_components/FirmaSidebar.tsx
//
// Admin panel sol paneli: firma listesi + yeni firma ekleme formu.

"use client";

import type { Firma } from "../_types";

interface FirmaSidebarProps {
  firmalar: Firma[];
  seciliFirma: Firma | null;
  yeniFirmaAdi: string;
  setYeniFirmaAdi: (v: string) => void;
  handleFirmaEkle: (e: React.FormEvent) => void | Promise<void>;
  handleFirmaSecildi: (f: Firma) => void;
  loading: boolean;
}

export default function FirmaSidebar({
  firmalar,
  seciliFirma,
  yeniFirmaAdi,
  setYeniFirmaAdi,
  handleFirmaEkle,
  handleFirmaSecildi,
  loading,
}: FirmaSidebarProps) {
  return (
    <div style={{ width: "280px", borderRight: "0.5px solid #e5e7eb", padding: "20px", flexShrink: 0 }}>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "16px", fontFamily: "'Nunito', sans-serif" }}>
        Firmalar
      </h2>

      <form onSubmit={handleFirmaEkle} style={{ marginBottom: "20px", display: "flex", gap: "6px" }}>
        <input
          type="text"
          value={yeniFirmaAdi}
          onChange={(e) => setYeniFirmaAdi(e.target.value)}
          placeholder="Yeni firma adı..."
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "0.5px solid #e5e7eb",
            borderRadius: "6px",
            fontSize: "13px",
            outline: "none",
            fontFamily: "'Nunito', sans-serif",
            color: "#111",
          }}
        />
        <button
          type="submit"
          disabled={!yeniFirmaAdi.trim()}
          style={{
            padding: "8px 14px",
            background: yeniFirmaAdi.trim() ? "#1d4ed8" : "#d1d5db",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: yeniFirmaAdi.trim() ? "pointer" : "not-allowed",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          Ekle
        </button>
      </form>

      {loading ? (
        <p style={{ fontSize: "13px", color: "#737373" }}>Yükleniyor...</p>
      ) : firmalar.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#737373" }}>Henüz firma yok.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {firmalar.map(f => (
            <button
              key={f.firma_id}
              onClick={() => handleFirmaSecildi(f)}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                background: seciliFirma?.firma_id === f.firma_id ? "#eff6ff" : "transparent",
                border: seciliFirma?.firma_id === f.firma_id ? "0.5px solid #93c5fd" : "0.5px solid transparent",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: seciliFirma?.firma_id === f.firma_id ? 600 : 500,
                color: seciliFirma?.firma_id === f.firma_id ? "#1d4ed8" : "#111",
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {f.firma_adi}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}