// app/admin/eclub-store/_components/EclubStoreUrunlerSekmesi.tsx
"use client";

import type { EclubStoreUrunDetay, EclubStoreKategori } from "@/lib/eclub/store/eclubStoreTipler";
import EclubStoreUrunModal from "./EclubStoreUrunModal";
import { RENK_BORDO } from "../../_constants";

interface Props {
  urunler: EclubStoreUrunDetay[];
  kategoriler: EclubStoreKategori[];
  yukleniyor: boolean;
  urunleriYukle: () => void;
  modalAcik: boolean;
  duzenlenecek: EclubStoreUrunDetay | null;
  handleYeniEkle: () => void;
  handleDuzenle: (u: EclubStoreUrunDetay) => void;
  handleModalKapat: () => void;
  silinecek: EclubStoreUrunDetay | null;
  setSilinecek: (u: EclubStoreUrunDetay | null) => void;
  silmeIslemi: boolean;
  handleSilOnayla: () => void;
  gorselYukle: (dosya: File) => Promise<string | null>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubStoreUrunlerSekmesi(props: Props) {
  const { urunler, kategoriler, yukleniyor, urunleriYukle, modalAcik, duzenlenecek,
    handleYeniEkle, handleDuzenle, handleModalKapat,
    silinecek, setSilinecek, silmeIslemi, handleSilOnayla, gorselYukle, hata, basari } = props;

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <span style={{ fontSize: "14px", color: "#6b7280" }}>{urunler.length} ürün</span>
        <button onClick={handleYeniEkle} style={{ padding: "8px 14px", background: RENK_BORDO, border: "none", borderRadius: "6px", fontSize: "13px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>+ Yeni Ürün</button>
      </div>

      {yukleniyor ? (
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Yükleniyor...</p>
      ) : urunler.length === 0 ? (
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px", padding: "24px" }}>Henüz ürün yok.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
          {urunler.map((u) => (
            <div key={u.urun_id} style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: "120px", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {u.gorsel_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.gorsel_url} alt={u.ad} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>Görsel yok</span>
                )}
              </div>
              <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#111" }}>
                  {u.ad}
                  {!u.aktif_mi && <span style={{ fontSize: "10px", marginLeft: "6px", padding: "1px 5px", background: "#f3f4f6", color: "#9ca3af", borderRadius: "4px" }}>Pasif</span>}
                </span>
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>{u.kategori_adi ?? "Kategorisiz"}</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#16a34a" }}>{u.puan_fiyat} puan · Stok: {u.stok}</span>
                <div style={{ display: "flex", gap: "6px", marginTop: "auto", paddingTop: "6px" }}>
                  <button onClick={() => handleDuzenle(u)} style={{ flex: 1, padding: "5px", background: "transparent", border: "0.5px solid #d1d5db", borderRadius: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" }}>Düzenle</button>
                  <button onClick={() => setSilinecek(u)} style={{ flex: 1, padding: "5px", background: "transparent", border: "0.5px solid #fecaca", borderRadius: "6px", fontSize: "12px", color: "#bc2d0d", cursor: "pointer" }}>Sil</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAcik && (
        <EclubStoreUrunModal
          duzenlenecek={duzenlenecek}
          kategoriler={kategoriler}
          onKapat={handleModalKapat}
          onKaydedildi={urunleriYukle}
          gorselYukle={gorselYukle}
          hata={hata}
          basari={basari}
        />
      )}

      {silinecek && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "360px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <span style={{ fontSize: "14px", color: "#111" }}><b>{silinecek.ad}</b> ürününü silmek istediğinize emin misiniz? (Siparişi varsa pasife alınır.)</span>
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