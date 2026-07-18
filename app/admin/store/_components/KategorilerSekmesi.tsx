// app/admin/store/_components/KategorilerSekmesi.tsx
//
// HBStore admin panel kategoriler sekmesi: tablo + ekle/düzenle modal + inline silme onayı.
// useKategoriYonetimi hook'unun return değerlerini prop alır.

"use client";

import { useState } from "react";
import KategoriModal from "./KategoriModal";
import type { Kategori } from "@/lib/store/tipler";
import { RENK_BORDO } from "../../_constants";

interface KategorilerSekmesiProps {
  // Veri
  kategoriler: Kategori[];
  yukleniyor: boolean;
  kategorileriYukle: () => void;

  // Modal state
  modalAcik: boolean;
  duzenlenecek: Kategori | null;
  handleYeniEkle: () => void;
  handleDuzenle: (kategori: Kategori) => void;
  handleModalKapat: () => void;

  // Silme state
  silinecek: Kategori | null;
  setSilinecek: (v: Kategori | null) => void;
  silmeIslemi: boolean;
  handleSilOnayla: () => void;

  // Ortak mesaj sistemi
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left",
  borderBottom: "0.5px solid #e5e7eb", fontWeight: 700,
  color: "#374151", fontSize: "11px", whiteSpace: "nowrap",
  background: "#f9fafb", fontFamily: "'Nunito', sans-serif",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px", borderBottom: "0.5px solid #f3f4f6",
  color: "#111", fontSize: "12px", fontFamily: "'Nunito', sans-serif",
};

const silBtnStyle = (renk: string, loading: boolean): React.CSSProperties => ({
  padding: "3px 8px",
  background: loading ? "#d1d5db" : renk,
  color: "white", border: "none", borderRadius: "4px",
  fontSize: "10px", fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
  fontFamily: "'Nunito', sans-serif",
});

const duzenleBtnStyle: React.CSSProperties = {
  padding: "3px 8px",
  background: "white",
  border: "0.5px solid #e5e7eb",
  borderRadius: "4px",
  fontSize: "10px", fontWeight: 600,
  color: "#374151",
  cursor: "pointer",
  fontFamily: "'Nunito', sans-serif",
};

export default function KategorilerSekmesi(p: KategorilerSekmesiProps) {
  return (
    <div style={{ marginTop: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0, fontFamily: "'Nunito', sans-serif" }}>
          Kategoriler ({p.kategoriler.length})
        </h3>
        <button
          onClick={p.handleYeniEkle}
          style={{
            padding: "6px 12px",
            background: RENK_BORDO,
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          + Yeni Kategori
        </button>
      </div>

      {p.yukleniyor ? (
        <p style={{ fontSize: "13px", color: "#737373", padding: "20px", textAlign: "center", fontFamily: "'Nunito', sans-serif" }}>
          Yükleniyor...
        </p>
      ) : p.kategoriler.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#737373", padding: "20px", textAlign: "center", fontFamily: "'Nunito', sans-serif" }}>
          Henüz kategori yok.
        </p>
      ) : (
        <div style={{ overflow: "auto", border: "0.5px solid #e5e7eb", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Sıra</th>
                <th style={thStyle}>Ad</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {p.kategoriler.map(k => (
                <tr key={k.kategori_id}>
                  <td style={tdStyle}>{k.sira}</td>
                  <td style={tdStyle}>{k.ad}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px",
                      background: k.aktif_mi ? "#dcfce7" : "#fee2e2",
                      color: k.aktif_mi ? "#16a34a" : "#dc2626",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      fontFamily: "'Nunito', sans-serif",
                    }}>
                      {k.aktif_mi ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => p.handleDuzenle(k)} style={duzenleBtnStyle}>
                      Düzenle
                    </button>
                    {p.silinecek?.kategori_id === k.kategori_id ? (
                      <>
                        <button
                          onClick={p.handleSilOnayla}
                          disabled={p.silmeIslemi}
                          style={{ ...silBtnStyle("#dc2626", p.silmeIslemi), marginLeft: "4px" }}
                        >
                          {p.silmeIslemi ? "..." : "Eminim"}
                        </button>
                        <button
                          onClick={() => p.setSilinecek(null)}
                          style={{ ...silBtnStyle("#737373", false), marginLeft: "4px" }}
                        >
                          İptal
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => p.setSilinecek(k)}
                        style={{ ...silBtnStyle("#dc2626", false), marginLeft: "4px" }}
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <KategoriModal
        acik={p.modalAcik}
        mevcutKategori={p.duzenlenecek}
        onKapat={p.handleModalKapat}
        onKaydedildi={p.kategorileriYukle}
        hata={p.hata}
        basari={p.basari}
      />
    </div>
  );
}