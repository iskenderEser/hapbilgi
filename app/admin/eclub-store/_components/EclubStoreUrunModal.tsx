// app/admin/eclub-store/_components/EclubStoreUrunModal.tsx
"use client";

import { useState, useEffect } from "react";
import type { EclubStoreUrunDetay, EclubStoreKategori } from "@/lib/eclub/store/eclubStoreTipler";

interface Props {
  duzenlenecek: EclubStoreUrunDetay | null;
  kategoriler: EclubStoreKategori[];
  onKapat: () => void;
  onKaydedildi: () => void;
  gorselYukle: (dosya: File) => Promise<string | null>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function EclubStoreUrunModal({ duzenlenecek, kategoriler, onKapat, onKaydedildi, gorselYukle, hata, basari }: Props) {
  const [kategoriId, setKategoriId] = useState<string>("");
  const [ad, setAd] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [gorselUrl, setGorselUrl] = useState<string | null>(null);
  const [puanFiyat, setPuanFiyat] = useState(0);
  const [stok, setStok] = useState(0);
  const [aktifMi, setAktifMi] = useState(true);
  const [loading, setLoading] = useState(false);
  const [gorselYukleniyor, setGorselYukleniyor] = useState(false);

  useEffect(() => {
    if (duzenlenecek) {
      setKategoriId(duzenlenecek.kategori_id ?? "");
      setAd(duzenlenecek.ad);
      setAciklama(duzenlenecek.aciklama ?? "");
      setGorselUrl(duzenlenecek.gorsel_url);
      setPuanFiyat(duzenlenecek.puan_fiyat);
      setStok(duzenlenecek.stok);
      setAktifMi(duzenlenecek.aktif_mi);
    } else {
      setKategoriId(""); setAd(""); setAciklama(""); setGorselUrl(null);
      setPuanFiyat(0); setStok(0); setAktifMi(true);
    }
  }, [duzenlenecek]);

  const dosyaSecildi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setGorselYukleniyor(true);
    const url = await gorselYukle(dosya);
    setGorselYukleniyor(false);
    if (url) setGorselUrl(url);
  };

  const kaydet = async () => {
    if (!ad.trim()) { hata("Ürün adı zorunludur.", "validasyon"); return; }
    if (puanFiyat <= 0) { hata("Puan fiyatı pozitif olmalı.", "validasyon"); return; }
    setLoading(true);
    const metod = duzenlenecek ? "PUT" : "POST";
    const body: Record<string, unknown> = {
      kategori_id: kategoriId || null, ad, aciklama, gorsel_url: gorselUrl,
      puan_fiyat: puanFiyat, stok, aktif_mi: aktifMi,
    };
    if (duzenlenecek) body.urun_id = duzenlenecek.urun_id;
    const res = await fetch("/admin/eclub-store/api/urun", {
      method: metod, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { hata(data.hata ?? "Ürün kaydedilemedi.", data.adim, data.detay); return; }
    basari(duzenlenecek ? "Ürün güncellendi." : "Ürün eklendi.");
    onKaydedildi();
    onKapat();
  };

  const inputCls: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: "14px", border: "0.5px solid #e5e7eb", borderRadius: "6px", outline: "none", fontFamily: "'Nunito', sans-serif" };
  const label: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(0,0,0,0.4)", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: "12px", width: "100%", maxWidth: "480px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", fontFamily: "'Nunito', sans-serif", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#111" }}>{duzenlenecek ? "Ürün Düzenle" : "Yeni Ürün"}</h3>
          <button onClick={onKapat} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "18px", color: "#9ca3af" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={label}>Kategori</label>
          <select style={inputCls} value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
            <option value="">— Kategorisiz —</option>
            {kategoriler.map((k) => <option key={k.kategori_id} value={k.kategori_id}>{k.ad}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={label}>Ad</label>
          <input style={inputCls} value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ürün adı" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={label}>Açıklama</label>
          <textarea style={inputCls} rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={label}>Puan Fiyatı</label>
            <input style={inputCls} type="number" value={puanFiyat} onChange={(e) => setPuanFiyat(Number(e.target.value))} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={label}>Stok</label>
            <input style={inputCls} type="number" value={stok} onChange={(e) => setStok(Number(e.target.value))} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={label}>Görsel</label>
          {gorselUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gorselUrl} alt="önizleme" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px", border: "0.5px solid #e5e7eb" }} />
          )}
          {/* Native input gizli; görünen buton modalın kendi buton stilinde
              (tarayıcının ham "Dosya Seç" kontrolü yerine — UX düzenlemesi). */}
          <input
            id="eclub-store-gorsel-input"
            type="file"
            accept="image/*"
            onChange={dosyaSecildi}
            disabled={gorselYukleniyor}
            style={{ display: "none" }}
          />
          <label
            htmlFor="eclub-store-gorsel-input"
            style={{
              alignSelf: "flex-start",
              padding: "8px 14px",
              background: "transparent",
              border: "0.5px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "13px",
              color: gorselYukleniyor ? "#9ca3af" : "#374151",
              cursor: gorselYukleniyor ? "not-allowed" : "pointer",
              pointerEvents: gorselYukleniyor ? "none" : "auto",
            }}
          >
            {gorselUrl ? "Görseli Değiştir" : "Görsel Seç"}
          </label>
          {gorselYukleniyor && <span style={{ fontSize: "12px", color: "#9ca3af" }}>Yükleniyor...</span>}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#374151" }}>
          <input type="checkbox" checked={aktifMi} onChange={(e) => setAktifMi(e.target.checked)} />
          Aktif (satışta)
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onKapat} style={{ padding: "8px 14px", background: "transparent", border: "0.5px solid #d1d5db", borderRadius: "6px", fontSize: "13px", color: "#6b7280", cursor: "pointer" }}>Vazgeç</button>
          <button onClick={kaydet} disabled={loading || gorselYukleniyor} style={{ padding: "8px 16px", background: "#56aeff", border: "none", borderRadius: "6px", fontSize: "13px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{loading ? "..." : "Kaydet"}</button>
        </div>
      </div>
    </div>
  );
}