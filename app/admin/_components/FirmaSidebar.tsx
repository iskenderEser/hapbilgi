// app/admin/_components/FirmaSidebar.tsx
//
// Admin panel sol paneli: firma listesi + yeni firma ekleme formu.
// Her firma satırında HBStore mağaza aç/kapa anahtarı bulunur.

"use client";

import type { Firma } from "../_types";

interface FirmaSidebarProps {
  firmalar: Firma[];
  seciliFirma: Firma | null;
  yeniFirmaAdi: string;
  setYeniFirmaAdi: (v: string) => void;
  handleFirmaEkle: (e: React.FormEvent) => void | Promise<void>;
  handleFirmaSecildi: (f: Firma) => void;
  handleStoreToggle: (f: Firma) => void | Promise<void>;
  loading: boolean;
}

export default function FirmaSidebar({
  firmalar,
  seciliFirma,
  yeniFirmaAdi,
  setYeniFirmaAdi,
  handleFirmaEkle,
  handleFirmaSecildi,
  handleStoreToggle,
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
          {firmalar.map(f => {
            const secili = seciliFirma?.firma_id === f.firma_id;
            return (
              <div
                key={f.firma_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: secili ? "#eff6ff" : "transparent",
                  border: secili ? "0.5px solid #93c5fd" : "0.5px solid transparent",
                  borderRadius: "6px",
                }}
              >
                {/* Firma adı — seçim butonu */}
                <button
                  onClick={() => handleFirmaSecildi(f)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    fontSize: "13px",
                    fontWeight: secili ? 600 : 500,
                    color: secili ? "#1d4ed8" : "#111",
                    cursor: "pointer",
                    fontFamily: "'Nunito', sans-serif",
                  }}
                >
                  {f.firma_adi}
                </button>

                {/* HBStore aç/kapa anahtarı */}
                <button
                  onClick={() => handleStoreToggle(f)}
                  title={f.hbstore_aktif ? "HBStore açık — kapatmak için tıkla" : "HBStore kapalı — açmak için tıkla"}
                  style={{
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 8px",
                    background: f.hbstore_aktif ? "#ecfdf5" : "#f3f4f6",
                    border: `0.5px solid ${f.hbstore_aktif ? "#a7f3d0" : "#e5e7eb"}`,
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: f.hbstore_aktif ? "#047857" : "#9ca3af",
                    cursor: "pointer",
                    fontFamily: "'Nunito', sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "999px",
                      background: f.hbstore_aktif ? "#10b981" : "#d1d5db",
                      display: "inline-block",
                    }}
                  />
                  Mağaza
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}