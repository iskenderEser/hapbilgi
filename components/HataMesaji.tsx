// components/HataMesaji.tsx
"use client";

import { useEffect, useState } from "react";

export type HataTuru = "hata" | "basari" | "uyari" | "bilgi";

export interface HataMesajiProps {
  mesaj: string;
  tur?: HataTuru;
  adim?: string;
  detay?: string;
  otomatikKapat?: boolean;
  sure?: number; // ms cinsinden, varsayılan 4000
  onKapat?: () => void;
}

const turAyarlari: Record<HataTuru, { bg: string; border: string; text: string; icon: string }> = {
  hata: { bg: "#fef2f2", border: "#fecaca", text: "#bc2d0d", icon: "✕" },
  basari: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a", icon: "✓" },
  uyari: { bg: "#fefce8", border: "#fde68a", text: "#854d0e", icon: "⚠" },
  bilgi: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", icon: "ℹ" },
};

export default function HataMesaji({
  mesaj,
  tur = "hata",
  adim,
  detay,
  otomatikKapat = true,
  sure = 4000,
  onKapat,
}: HataMesajiProps) {
  const [gorunsun, setGorunsun] = useState(true);
  const ayar = turAyarlari[tur];

  useEffect(() => {
    if (!otomatikKapat) return;
    const timer = setTimeout(() => {
      setGorunsun(false);
      onKapat?.();
    }, sure);
    return () => clearTimeout(timer);
  }, [otomatikKapat, sure, onKapat]);

  if (!gorunsun) return null;

  return (
    <div style={{
      background: ayar.bg,
      border: `0.5px solid ${ayar.border}`,
      borderRadius: "10px",
      padding: "12px 16px",
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      fontFamily: "'Nunito', sans-serif",
    }}>
      <span style={{ fontSize: "14px", color: ayar.text, fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>
        {ayar.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", color: ayar.text, fontWeight: 600, margin: 0 }}>{mesaj}</p>
        {adim && (
          <p style={{ fontSize: "11px", color: ayar.text, opacity: 0.8, margin: "3px 0 0", fontFamily: "monospace" }}>
            Adım: {adim}
          </p>
        )}
        {detay && (
          <p style={{ fontSize: "11px", color: ayar.text, opacity: 0.7, margin: "2px 0 0", fontFamily: "monospace" }}>
            {detay}
          </p>
        )}
      </div>
      <button
        onClick={() => { setGorunsun(false); onKapat?.(); }}
        style={{ background: "none", border: "none", cursor: "pointer", color: ayar.text, fontSize: "14px", padding: "0", flexShrink: 0, opacity: 0.6 }}
      >
        ✕
      </button>
    </div>
  );
}

// Toast container — sayfanın sağ alt köşesinde sabit
export function HataMesajiContainer({ mesajlar }: { mesajlar: HataMesajiProps[] }) {
  return (
    <div style={{
      position: "fixed",
      top: "24px",
      right: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      zIndex: 9999,
      maxWidth: "380px",
      width: "90%",
    }}>
      {mesajlar.map((m, i) => (
        <HataMesaji key={i} {...m} />
      ))}
    </div>
  );
}

// Hook — sayfalarda kolayca kullanmak için
export function useHataMesaji() {
  const [mesajlar, setMesajlar] = useState<HataMesajiProps[]>([]);

  const ekle = (mesaj: Omit<HataMesajiProps, "onKapat">) => {
    const yeni: HataMesajiProps = {
      ...mesaj,
      onKapat: () => {
        setMesajlar((prev) => prev.filter((m) => m !== yeni));
      },
    };
    setMesajlar((prev) => [...prev, yeni]);
  };

  const hata = (mesaj: string, adim?: string, detay?: string) =>
    ekle({ mesaj, tur: "hata", adim, detay });

  const basari = (mesaj: string) =>
    ekle({ mesaj, tur: "basari" });

  const uyari = (mesaj: string, adim?: string) =>
    ekle({ mesaj, tur: "uyari", adim });

  const bilgi = (mesaj: string) =>
    ekle({ mesaj, tur: "bilgi" });

  const temizle = () => setMesajlar([]);

  return { mesajlar, hata, basari, uyari, bilgi, temizle };
}