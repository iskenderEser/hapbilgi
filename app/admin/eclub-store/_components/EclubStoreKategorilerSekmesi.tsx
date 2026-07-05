// app/admin/eclub-store/_components/EclubStoreKategorilerSekmesi.tsx
"use client";

import type { EclubStoreKategoriDetay } from "@/lib/eclub/store/eclubStoreTipler";
import EclubStoreKategoriModal from "./EclubStoreKategoriModal";

interface Props {
  kategoriler: EclubStoreKategoriDetay[];
  yukleniyor: boolean;
  kategorileriYukle: () => void;
  modalAcik: boolean;
  duzenlenecek: EclubStoreKategoriDetay | null;
  handleYeniEkle: () => void;
  handleDuzenle: (k: EclubStoreKategoriDetay) => void;
  handleModalKapat: () => void;
  silinecek: EclubStoreKategoriDetay | null;
  setSilinecek: (k: EclubStoreKategoriDetay | null) => void;
  silmeIslemi: boolean;
  handleSilOnayla: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubStoreKategorilerSekmesi(props: Props) {
  const { kategoriler, yukleniyor, kategorileriYukle, modalAcik, duzenlenecek,
    handleYeniEkle, handleDuzenle, handleModalKapat,
    silinecek, setSilinecek, silmeIslemi, handleSilOnayla, hata, basari } = props;

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <span style={{ fontSize: "14px", color: "#6b7280" }}>{kategoriler.length} kategori</span>
        <button onClick={handleYeniEkle} style={{ padding: "8px 14px", background: "#56aeff", border: "none", borderRadius: "6px", fontSize: "13px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>+ Yeni Kategori</button>
      </div>

      {yukleniyor ? (
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Yükleniyor...</p>
      ) : kategoriler.length === 0 ? (
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Henüz kategori yok.</p>
      ) : (
        <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
          {kategoriler.map((k) => (
            <div key={k.kategori_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #f3f4f6" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#111" }}>
                  {k.ad}
                  {!k.aktif_mi && <span style={{ fontSize: "11px", marginLeft: "8px", padding: "2px 6px", background: "#f3f4f6", color: "#9ca3af", borderRadius: "4px" }}>Pasif</span>}
                </span>
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>Sıra: {k.sira} · {k.urun_sayisi} ürün</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => handleDuzenle(k)} style={{ padding: "5px 12px", background: "transparent", border: "0.5px solid #d1d5db", borderRadius: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" }}>Düzenle</button>
                <button onClick={() => setSilinecek(k)} style={{ padding: "5px 12px", background: "transparent", border: "0.5px solid #fecaca", borderRadius: "6px", fontSize: "12px", color: "#bc2d0d", cursor: "pointer" }}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAcik && (
        <EclubStoreKategoriModal
          duzenlenecek={duzenlenecek}
          onKapat={handleModalKapat}
          onKaydedildi={kategorileriYukle}
          hata={hata}
          basari={basari}
        />
      )}

      {silinecek && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "360px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <span style={{ fontSize: "14px", color: "#111" }}><b>{silinecek.ad}</b> kategorisini silmek istediğinize emin misiniz?</span>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={() => setSilinecek(null)} style={{ padding: "8px 14px", background: "transparent", border: "0.5px solid #d1d5db", borderRadius: "6px", fontSize: "13px", color: "#6b7280", cursor: "pointer" }}>Vazgeç</button>
              <button onClick={handleSilOnayla} disabled={silmeIslemi} style={{ padding: "8px 16px", background: "#bc2d0d", border: "none", borderRadius: "6px", fontSize: "13px", color: "#fff", cursor: "pointer" }}>{silmeIslemi ? "..." : "Evet, Sil"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}