// app/admin/store/_components/UrunlerSekmesi.tsx
//
// HBStore admin panel ürünler sekmesi: tablo + ekle/düzenle modal + inline silme onayı.
// useUrunYonetimi hook'unun return değerlerini prop alır.
// Modal'a kategoriler prop'u geçer (dropdown için).

"use client";

import UrunModal from "./UrunModal";
import type { Kategori } from "@/lib/store/tipler";
import type { UrunGosterim } from "../_types";

interface UrunlerSekmesiProps {
  // Veri
  urunler: UrunGosterim[];
  kategoriler: Kategori[];
  yukleniyor: boolean;
  urunleriYukle: () => void;

  // Modal state
  modalAcik: boolean;
  duzenlenecek: UrunGosterim | null;
  handleYeniEkle: () => void;
  handleDuzenle: (urun: UrunGosterim) => void;
  handleModalKapat: () => void;

  // Silme state
  silinecek: UrunGosterim | null;
  setSilinecek: (v: UrunGosterim | null) => void;
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

export default function UrunlerSekmesi(p: UrunlerSekmesiProps) {
  return (
    <div style={{ marginTop: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: 0, fontFamily: "'Nunito', sans-serif" }}>
          Ürünler ({p.urunler.length})
        </h3>
        <button
          onClick={p.handleYeniEkle}
          style={{
            padding: "6px 12px",
            background: "#1d4ed8",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          + Yeni Ürün
        </button>
      </div>

      {p.yukleniyor ? (
        <p style={{ fontSize: "13px", color: "#737373", padding: "20px", textAlign: "center", fontFamily: "'Nunito', sans-serif" }}>
          Yükleniyor...
        </p>
      ) : p.urunler.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#737373", padding: "20px", textAlign: "center", fontFamily: "'Nunito', sans-serif" }}>
          Henüz ürün yok.
        </p>
      ) : (
        <div style={{ overflow: "auto", border: "0.5px solid #e5e7eb", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Görsel</th>
                <th style={thStyle}>Ad</th>
                <th style={thStyle}>Kategori</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Fiyat</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Stok</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {p.urunler.map(u => (
                <tr key={u.urun_id}>
                  <td style={tdStyle}>
                    <div style={{
                      width: "44px", height: "44px",
                      borderRadius: "6px", overflow: "hidden",
                      background: "#f9fafb",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {u.gorsel_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.gorsel_url} alt={u.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: "10px", color: "#737373" }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>{u.ad}</td>
                  <td style={{ ...tdStyle, color: "#737373" }}>{u.store_kategoriler?.ad ?? "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#bc2d0d", fontWeight: 600 }}>{u.puan_fiyati}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{u.stok}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px",
                      background: u.aktif_mi ? "#dcfce7" : "#fee2e2",
                      color: u.aktif_mi ? "#16a34a" : "#dc2626",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      fontFamily: "'Nunito', sans-serif",
                    }}>
                      {u.aktif_mi ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => p.handleDuzenle(u)} style={duzenleBtnStyle}>
                      Düzenle
                    </button>
                    {p.silinecek?.urun_id === u.urun_id ? (
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
                        onClick={() => p.setSilinecek(u)}
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

      <UrunModal
        acik={p.modalAcik}
        mevcutUrun={p.duzenlenecek}
        kategoriler={p.kategoriler}
        onKapat={p.handleModalKapat}
        onKaydedildi={p.urunleriYukle}
        hata={p.hata}
        basari={p.basari}
      />
    </div>
  );
}