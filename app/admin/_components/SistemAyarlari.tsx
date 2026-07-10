// app/admin/_components/SistemAyarlari.tsx
//
// Sistem Ayarları paneli — sistem_ayarlari tablosunun admin ekranı.
// Üst bardaki "Sistem Ayarları" butonuyla açılır (firma görünümünün alternatifi).
// Her satır: anahtar + açıklama + değer alanı + Kaydet.
// deger jsonb: sayı ya da sayı dizisi (dizi, virgülle ayrılmış metin olarak düzenlenir).

"use client";

import { useEffect, useState } from "react";
import type { SistemAyari } from "../_types";

interface SistemAyarlariProps {
  hata: (mesaj: string, adim?: string, detay?: string) => void;
  basari: (mesaj: string) => void;
}

export default function SistemAyarlari({ hata, basari }: SistemAyarlariProps) {
  const [ayarlar, setAyarlar] = useState<SistemAyari[]>([]);
  const [duzenlenen, setDuzenlenen] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [kaydeden, setKaydeden] = useState<string | null>(null);

  const degerMetni = (deger: number | number[]): string =>
    Array.isArray(deger) ? deger.join(", ") : String(deger);

  const veriCek = async () => {
    setLoading(true);
    const res = await fetch("/admin/api/sistem-ayarlari");
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Ayarlar yüklenemedi.", d.adim, d.detay);
    } else {
      const gelen: SistemAyari[] = d.ayarlar ?? [];
      setAyarlar(gelen);
      const metinler: Record<string, string> = {};
      for (const a of gelen) metinler[a.anahtar] = degerMetni(a.deger);
      setDuzenlenen(metinler);
    }
    setLoading(false);
  };

  useEffect(() => { veriCek(); }, []);

  // Metni deger'e çevirir: mevcut değer dizi ise virgüllü sayı dizisi, değilse tek sayı.
  const metniDegereCevir = (ayar: SistemAyari, metin: string): number | number[] | null => {
    if (Array.isArray(ayar.deger)) {
      const parcalar = metin.split(",").map((p) => Number(p.trim()));
      if (parcalar.length === 0 || parcalar.some((p) => !Number.isFinite(p) || p <= 0)) return null;
      return parcalar;
    }
    const sayi = Number(metin.trim());
    if (!Number.isFinite(sayi) || sayi <= 0) return null;
    return sayi;
  };

  const handleKaydet = async (ayar: SistemAyari) => {
    const metin = duzenlenen[ayar.anahtar] ?? "";
    const deger = metniDegereCevir(ayar, metin);
    if (deger === null) {
      hata(`${ayar.anahtar}: değer pozitif sayı${Array.isArray(ayar.deger) ? "lar (virgülle ayrılmış)" : ""} olmalıdır.`);
      return;
    }

    setKaydeden(ayar.anahtar);
    const res = await fetch("/admin/api/sistem-ayarlari", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anahtar: ayar.anahtar, deger }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Ayar güncellenemedi.", d.adim, d.detay);
    } else {
      basari(`${ayar.anahtar} güncellendi.`);
      await veriCek();
    }
    setKaydeden(null);
  };

  if (loading) {
    return <p style={{ fontSize: "13px", color: "#737373" }}>Ayarlar yükleniyor…</p>;
  }

  return (
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", marginBottom: "4px" }}>
        Sistem Ayarları
      </h2>
      <p style={{ fontSize: "12px", color: "#737373", marginBottom: "16px" }}>
        Değerler tüm firmalara aynı uygulanır. Yeni ayar eklemek migration işidir; buradan yalnızca mevcut değerler güncellenir.
      </p>

      <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden", maxWidth: 860 }}>
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 180px 90px", gap: "0", background: "#f9fafb", padding: "10px 14px", fontSize: "12px", fontWeight: 700, color: "#374151" }}>
          <span>Anahtar</span>
          <span>Açıklama</span>
          <span>Değer</span>
          <span></span>
        </div>
        {ayarlar.map((a) => (
          <div key={a.anahtar}
            style={{ display: "grid", gridTemplateColumns: "240px 1fr 180px 90px", alignItems: "center", padding: "10px 14px", borderTop: "0.5px solid #e5e7eb", fontSize: "12px" }}>
            <span style={{ fontWeight: 700, color: "#111", wordBreak: "break-all" }}>{a.anahtar}</span>
            <span style={{ color: "#737373", paddingRight: "12px" }}>{a.aciklama ?? "-"}</span>
            <input
              value={duzenlenen[a.anahtar] ?? ""}
              onChange={(e) => setDuzenlenen((prev) => ({ ...prev, [a.anahtar]: e.target.value }))}
              style={{
                border: "0.5px solid #d1d5db", borderRadius: "6px", padding: "6px 8px",
                fontSize: "12px", color: "#111", fontFamily: "'Nunito', sans-serif", width: "150px",
              }}
            />
            <button
              onClick={() => handleKaydet(a)}
              disabled={kaydeden === a.anahtar || degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "")}
              style={{
                padding: "6px 12px", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                background: degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "") ? "#f3f4f6" : "#1d4ed8",
                color: degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "") ? "#9ca3af" : "white",
                cursor: degerMetni(a.deger) === (duzenlenen[a.anahtar] ?? "") ? "not-allowed" : "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {kaydeden === a.anahtar ? "..." : "Kaydet"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}