// app/admin/_components/TakimBolgeFormu.tsx
//
// Takım/Bölge toplu oluşturma formu. Birden fazla takım bloğu, her blokta
// takım adı + bölge satırları. useTakimBolgeForm hook'unun return değerlerini
// prop alır.

"use client";

import { rowStyle, labelStyle, inputStyle, btnBase, RENK_BORDO } from "../_constants";
import type { TakimBlok } from "../_types";

interface TakimBolgeFormuProps {
  bloklar: TakimBlok[];
  kaydetLoading: boolean;
  handleTakimAdiDegis: (id: number, deger: string) => void;
  handleBolgeAdiDegis: (blok_id: number, bolgeIndex: number, deger: string) => void;
  handleYeniBlokEkle: () => void;
  handleBlokSil: (id: number) => void;
  handleKaydet: () => void;
  formGecerliMi: () => boolean;
}

export default function TakimBolgeFormu(p: TakimBolgeFormuProps) {
  const gecerli = p.formGecerliMi();

  return (
    <div style={{ maxWidth: "600px" }}>
      {p.bloklar.map((blok, idx) => (
        <div
          key={blok.id}
          style={{
            marginBottom: "20px",
            padding: "12px",
            background: "#fafafa",
            border: "0.5px solid #e5e7eb",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, color: "#737373", margin: 0, fontFamily: "'Nunito', sans-serif" }}>
              Takım #{idx + 1}
            </p>
            {p.bloklar.length > 1 && (
              <button
                onClick={() => p.handleBlokSil(blok.id)}
                title="Bu takımı kaldır"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#dc2626",
                  fontSize: "18px",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "0 6px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Takım Adı</span>
            <input
              type="text"
              value={blok.takim_adi}
              onChange={(e) => p.handleTakimAdiDegis(blok.id, e.target.value)}
              placeholder="Takım adı (en az 3 harf)..."
              style={inputStyle}
            />
          </div>

          {blok.bolgeler.map((bolge, bIdx) => (
            <div key={bIdx} style={rowStyle}>
              <span style={labelStyle}>Bölge {bIdx + 1}</span>
              <input
                type="text"
                value={bolge}
                onChange={(e) => p.handleBolgeAdiDegis(blok.id, bIdx, e.target.value)}
                placeholder="Bölge adı..."
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      ))}

      <button
        onClick={p.handleYeniBlokEkle}
        style={{ ...btnBase, background: "white", color: RENK_BORDO, marginBottom: "16px" }}
      >
        + Yeni Takım Ekle
      </button>

      <div>
        <button
          onClick={p.handleKaydet}
          disabled={!gecerli || p.kaydetLoading}
          style={{
            ...btnBase,
            background: !gecerli || p.kaydetLoading ? "#d1d5db" : RENK_BORDO,
            color: "white",
            border: "none",
            cursor: !gecerli || p.kaydetLoading ? "not-allowed" : "pointer",
          }}
        >
          {p.kaydetLoading ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
