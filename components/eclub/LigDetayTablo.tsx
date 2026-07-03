// components/eclub/LigDetayTablo.tsx
//
// Bir UTT'nin kişi+ürün detay satırları (ürün sütunlu) + kolon filtreleri + takım toplamı.
// Filtre: Eczane, Eczacı, Teknisyen, Ürün sütun başlıklarında metin araması.
// Her kişi-ürün ayrı satır. En altta filtreli satırların toplamı.

"use client";

import { useMemo, useState } from "react";
import type { DetaySatir } from "@/lib/eclub/ligRpcCagir";

interface Props {
  satirlar: DetaySatir[];
  yukleniyor?: boolean;
}

type FiltreAlan = "eczane_adi" | "eczaci_ad" | "teknisyen_ad" | "urun_adi";

export default function LigDetayTablo({ satirlar, yukleniyor }: Props) {
  const [filtre, setFiltre] = useState<Record<FiltreAlan, string>>({
    eczane_adi: "", eczaci_ad: "", teknisyen_ad: "", urun_adi: "",
  });

  const filtreli = useMemo(() => {
    return satirlar.filter((s) => {
      const f = (deger: string | null, ara: string) =>
        !ara || (deger ?? "").toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr"));
      return (
        f(s.eczane_adi, filtre.eczane_adi) &&
        f(s.eczaci_ad, filtre.eczaci_ad) &&
        f(s.teknisyen_ad, filtre.teknisyen_ad) &&
        f(s.urun_adi, filtre.urun_adi)
      );
    });
  }, [satirlar, filtre]);

  const toplam = useMemo(() => {
    return filtreli.reduce(
      (acc, s) => ({
        izleme_puani: acc.izleme_puani + s.izleme_puani,
        cevaplama_puani: acc.cevaplama_puani + s.cevaplama_puani,
        izlenen_video: acc.izlenen_video + s.izlenen_video,
        dogru_cevap: acc.dogru_cevap + s.dogru_cevap,
      }),
      { izleme_puani: 0, cevaplama_puani: 0, izlenen_video: 0, dogru_cevap: 0 }
    );
  }, [filtreli]);

  const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" };
  const thNum: React.CSSProperties = { ...thStyle, textAlign: "right" };
  const tdStyle: React.CSSProperties = { padding: "7px 10px", whiteSpace: "nowrap", color: "#111" };
  const tdNum: React.CSSProperties = { ...tdStyle, textAlign: "right" };
  const filtreInput: React.CSSProperties = {
    width: "100%", marginTop: "4px", padding: "3px 6px", fontSize: "11px",
    border: "0.5px solid #e5e7eb", borderRadius: "4px", outline: "none", fontFamily: "'Nunito', sans-serif",
  };

  if (yukleniyor) {
    return <div className="px-4 py-6 text-center text-xs text-gray-400">Yükleniyor...</div>;
  }
  if (satirlar.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-gray-400">Bu takımda henüz izleme/puan kaydı yok.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "820px", fontFamily: "'Nunito', sans-serif" }}>
        <thead>
          <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
            <th style={thStyle}>GLN</th>
            <th style={thStyle}>
              Eczane
              <input value={filtre.eczane_adi} onChange={(e) => setFiltre((f) => ({ ...f, eczane_adi: e.target.value }))} placeholder="filtrele" style={filtreInput} />
            </th>
            <th style={thStyle}>
              Eczacı
              <input value={filtre.eczaci_ad} onChange={(e) => setFiltre((f) => ({ ...f, eczaci_ad: e.target.value }))} placeholder="filtrele" style={filtreInput} />
            </th>
            <th style={thStyle}>
              Teknisyen
              <input value={filtre.teknisyen_ad} onChange={(e) => setFiltre((f) => ({ ...f, teknisyen_ad: e.target.value }))} placeholder="filtrele" style={filtreInput} />
            </th>
            <th style={thStyle}>
              Ürün
              <input value={filtre.urun_adi} onChange={(e) => setFiltre((f) => ({ ...f, urun_adi: e.target.value }))} placeholder="filtrele" style={filtreInput} />
            </th>
            <th style={thNum}>İzleme P.</th>
            <th style={thNum}>Cevap P.</th>
            <th style={thNum}>İzlenen</th>
            <th style={thNum}>Doğru</th>
          </tr>
        </thead>
        <tbody>
          {filtreli.map((s, i) => (
            <tr key={i} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
              <td style={{ ...tdStyle, fontFamily: "monospace", color: "#9ca3af" }}>{s.gln ?? "—"}</td>
              <td style={tdStyle}>{s.eczane_adi ?? "—"}</td>
              <td style={tdStyle}>{s.eczaci_ad ?? "—"}</td>
              <td style={tdStyle}>{s.teknisyen_ad ?? "—"}</td>
              <td style={{ ...tdStyle, color: "#1d4ed8" }}>{s.urun_adi ?? "—"}</td>
              <td style={tdNum}>{s.izleme_puani}</td>
              <td style={tdNum}>{s.cevaplama_puani}</td>
              <td style={tdNum}>{s.izlenen_video}</td>
              <td style={tdNum}>{s.dogru_cevap}</td>
            </tr>
          ))}
          <tr style={{ background: "#f9fafb", borderTop: "0.5px solid #d1d5db" }}>
            <td colSpan={5} style={{ ...tdStyle, fontWeight: 600 }}>Toplam ({filtreli.length} satır)</td>
            <td style={{ ...tdNum, fontWeight: 600 }}>{toplam.izleme_puani}</td>
            <td style={{ ...tdNum, fontWeight: 600 }}>{toplam.cevaplama_puani}</td>
            <td style={{ ...tdNum, fontWeight: 600 }}>{toplam.izlenen_video}</td>
            <td style={{ ...tdNum, fontWeight: 600 }}>{toplam.dogru_cevap}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}