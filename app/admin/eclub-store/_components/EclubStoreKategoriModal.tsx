// app/admin/eclub-store/_components/EclubStoreKategoriModal.tsx
"use client";

import { useState, useEffect } from "react";
import type { EclubStoreKategoriDetay } from "@/lib/eclub/store/eclubStoreTipler";

interface Props {
  duzenlenecek: EclubStoreKategoriDetay | null;
  onKapat: () => void;
  onKaydedildi: () => void;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubStoreKategoriModal({ duzenlenecek, onKapat, onKaydedildi, hata, basari }: Props) {
  const [ad, setAd] = useState("");
  const [sira, setSira] = useState(0);
  const [aktifMi, setAktifMi] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (duzenlenecek) {
      setAd(duzenlenecek.ad);
      setSira(duzenlenecek.sira);
      setAktifMi(duzenlenecek.aktif_mi);
    } else {
      setAd(""); setSira(0); setAktifMi(true);
    }
  }, [duzenlenecek]);

  const kaydet = async () => {
    if (!ad.trim()) { hata("Kategori adı zorunludur.", "validasyon"); return; }
    setLoading(true);
    const metod = duzenlenecek ? "PUT" : "POST";
    const body = duzenlenecek
      ? { kategori_id: duzenlenecek.kategori_id, ad, sira, aktif_mi: aktifMi }
      : { ad, sira, aktif_mi: aktifMi };
    const res = await fetch("/admin/eclub-store/api/kategori", {
      method: metod, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { hata(data.hata ?? "Kategori kaydedilemedi.", data.adim, data.detay); return; }
    basari(duzenlenecek ? "Kategori güncellendi." : "Kategori eklendi.");
    onKaydedildi();
    onKapat();
  };

  const inputCls: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: "14px", border: "0.5px solid #e5e7eb", borderRadius: "6px", outline: "none", fontFamily: "'Nunito', sans-serif" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.4)" }}>
      <div style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "420px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#111" }}>{duzenlenecek ? "Kategori Düzenle" : "Yeni Kategori"}</h3>
          <button onClick={onKapat} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "18px", color: "#9ca3af" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#6b7280" }}>Ad</label>
          <input style={inputCls} value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Kategori adı" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "#6b7280" }}>Sıra</label>
          <input style={inputCls} type="number" value={sira} onChange={(e) => setSira(Number(e.target.value))} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#374151" }}>
          <input type="checkbox" checked={aktifMi} onChange={(e) => setAktifMi(e.target.checked)} />
          Aktif
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onKapat} style={{ padding: "8px 14px", background: "transparent", border: "0.5px solid #d1d5db", borderRadius: "6px", fontSize: "13px", color: "#6b7280", cursor: "pointer" }}>Vazgeç</button>
          <button onClick={kaydet} disabled={loading} style={{ padding: "8px 16px", background: "#56aeff", border: "none", borderRadius: "6px", fontSize: "13px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{loading ? "..." : "Kaydet"}</button>
        </div>
      </div>
    </div>
  );
}