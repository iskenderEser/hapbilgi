// app/admin/_components/TopluGirisFormu.tsx
//
// Toplu kullanıcı ekleme: CSV/XLSX dosya yükleme + önizleme tablosu + kaydet.
// useTopluForm hook'unun return değerlerini prop alır.

"use client";

import { btnBase } from "../_constants";
import type { OnizlemeSatir } from "../_types";

interface TopluGirisFormuProps {
  topluDosya: File | null;
  onizlemesatirlari: OnizlemeSatir[] | null;
  onizlemeLoading: boolean;
  topluKaydetLoading: boolean;
  hazirSayisi: number;
  hataliSayisi: number;
  handleDosyaSec: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTopluKaydet: () => void;
}

const tarz_th: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "0.5px solid #e5e7eb",
  fontWeight: 700,
  color: "#374151",
  whiteSpace: "nowrap",
};

const tarz_td: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "0.5px solid #f3f4f6",
  color: "#111",
};

export default function TopluGirisFormu(p: TopluGirisFormuProps) {
  return (
    <div style={{ maxWidth: "1000px" }}>
      {/* Dosya seçme */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "8px", fontFamily: "'Nunito', sans-serif" }}>
          Dosya seç (CSV veya XLSX):
        </label>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={p.handleDosyaSec}
          style={{ fontSize: "13px", fontFamily: "'Nunito', sans-serif", color: "#111" }}
        />
        {p.topluDosya && (
          <p style={{ fontSize: "12px", color: "#737373", marginTop: "6px", fontFamily: "'Nunito', sans-serif" }}>
            Seçili: {p.topluDosya.name}
          </p>
        )}
      </div>

      {/* Yüklenme durumu */}
      {p.onizlemeLoading && (
        <p style={{ fontSize: "13px", color: "#737373", fontFamily: "'Nunito', sans-serif" }}>
          Dosya okunuyor...
        </p>
      )}

      {/* Önizleme tablosu */}
      {p.onizlemesatirlari && p.onizlemesatirlari.length > 0 && (
        <>
          <div style={{ marginBottom: "12px", display: "flex", gap: "12px", fontSize: "13px", fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>
            <span style={{ color: "#1d4ed8" }}>Hazır: {p.hazirSayisi}</span>
            <span style={{ color: "#dc2626" }}>Hatalı: {p.hataliSayisi}</span>
          </div>

          <div style={{ overflow: "auto", border: "0.5px solid #e5e7eb", borderRadius: "8px", marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "'Nunito', sans-serif" }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={tarz_th}>#</th>
                  <th style={tarz_th}>Ad</th>
                  <th style={tarz_th}>Soyad</th>
                  <th style={tarz_th}>Rol</th>
                  <th style={tarz_th}>E-posta</th>
                  <th style={tarz_th}>Takım</th>
                  <th style={tarz_th}>Bölge</th>
                  <th style={tarz_th}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {p.onizlemesatirlari.map((s) => (
                  <tr key={s.index} style={{ background: s.durum === "hatali" ? "#fef2f2" : "white" }}>
                    <td style={tarz_td}>{s.index}</td>
                    <td style={tarz_td}>{s.ad}</td>
                    <td style={tarz_td}>{s.soyad}</td>
                    <td style={tarz_td}>{s.rol}</td>
                    <td style={tarz_td}>{s.eposta}</td>
                    <td style={tarz_td}>{s.takim_adi}</td>
                    <td style={tarz_td}>{s.bolge_adi}</td>
                    <td style={tarz_td}>
                      {s.durum === "hazir" ? (
                        <span style={{ color: "#1d4ed8", fontWeight: 600 }}>Hazır</span>
                      ) : (
                        <span style={{ color: "#dc2626", fontWeight: 600 }} title={s.hata_mesaji}>
                          Hatalı
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Toplu kaydet butonu — sadece hazır satır varsa aktif */}
          <button
            onClick={p.handleTopluKaydet}
            disabled={p.hazirSayisi === 0 || p.topluKaydetLoading}
            style={{
              ...btnBase,
              background: p.hazirSayisi === 0 || p.topluKaydetLoading ? "#d1d5db" : "#1d4ed8",
              color: "white",
              border: "none",
              cursor: p.hazirSayisi === 0 || p.topluKaydetLoading ? "not-allowed" : "pointer",
            }}
          >
            {p.topluKaydetLoading ? "Kaydediliyor..." : `${p.hazirSayisi} kullanıcıyı kaydet`}
          </button>
        </>
      )}

      {p.onizlemesatirlari && p.onizlemesatirlari.length === 0 && (
        <p style={{ fontSize: "13px", color: "#737373", fontFamily: "'Nunito', sans-serif" }}>
          Dosyada geçerli satır bulunamadı.
        </p>
      )}
    </div>
  );
}