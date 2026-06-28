// components/hbligi/HbLigiPeriyotSecici.tsx
//
// HB Ligi periyot kontrolü. Üç dropdown:
//   - Periyot (Aylık / Dönemlik / Yıllık)
//   - Periyota göre dinamik ikinci dropdown (ay / çeyrek / —)
//   - Yıl
//
// Üst seviye state callback'iyle yönetilir; bu bileşen kendi state'i tutmaz.
// (CC Ligi seçicisinin birebir kopyası — bağımsız tutmak için ayrı dosya.)

"use client";

import { useMemo } from "react";

export type Periyot = "ay" | "donem" | "yil";

interface Props {
  periyot: Periyot;
  yil: number;
  ay: number;       // 1-12
  ceyrek: number;   // 1-4
  onPeriyotChange: (p: Periyot) => void;
  onYilChange: (y: number) => void;
  onAyChange: (a: number) => void;
  onCeyrekChange: (c: number) => void;
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const CEYREK_ADLARI = [
  "Q1 (Oca-Mar)",
  "Q2 (Nis-Haz)",
  "Q3 (Tem-Eyl)",
  "Q4 (Eki-Ara)",
];

export default function HbLigiPeriyotSecici({
  periyot,
  yil,
  ay,
  ceyrek,
  onPeriyotChange,
  onYilChange,
  onAyChange,
  onCeyrekChange,
}: Props) {
  // Yıl seçenekleri: 2024'ten içinde bulunduğumuz yıla kadar
  const yilSecenekleri = useMemo(() => {
    const buYil = new Date().getFullYear();
    const baslangic = 2024;
    const yillar: number[] = [];
    for (let y = buYil; y >= baslangic; y--) {
      yillar.push(y);
    }
    return yillar;
  }, []);

  const selectStili = {
    fontFamily: "'Nunito', sans-serif",
    color: "#374151",
    border: "0.5px solid #e5e7eb",
  };

  return (
    <div
      className="hb-ligi-periyot-secici flex gap-2 mb-4 items-center flex-wrap"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <span className="text-xs font-semibold" style={{ color: "#374151" }}>
        Periyot:
      </span>

      {/* Periyot dropdown */}
      <select
        value={periyot}
        onChange={(e) => onPeriyotChange(e.target.value as Periyot)}
        className="px-3 py-1.5 text-sm rounded-lg bg-white cursor-pointer"
        style={selectStili}
      >
        <option value="ay">Aylık</option>
        <option value="donem">Dönemlik</option>
        <option value="yil">Yıllık</option>
      </select>

      {/* Ay dropdown — sadece periyot=ay ise */}
      {periyot === "ay" && (
        <select
          value={ay}
          onChange={(e) => onAyChange(Number(e.target.value))}
          className="px-3 py-1.5 text-sm rounded-lg bg-white cursor-pointer"
          style={selectStili}
        >
          {AY_ADLARI.map((adi, i) => (
            <option key={i + 1} value={i + 1}>
              {adi}
            </option>
          ))}
        </select>
      )}

      {/* Çeyrek dropdown — sadece periyot=donem ise */}
      {periyot === "donem" && (
        <select
          value={ceyrek}
          onChange={(e) => onCeyrekChange(Number(e.target.value))}
          className="px-3 py-1.5 text-sm rounded-lg bg-white cursor-pointer"
          style={selectStili}
        >
          {CEYREK_ADLARI.map((adi, i) => (
            <option key={i + 1} value={i + 1}>
              {adi}
            </option>
          ))}
        </select>
      )}

      {/* Yıl dropdown — her zaman */}
      <select
        value={yil}
        onChange={(e) => onYilChange(Number(e.target.value))}
        className="px-3 py-1.5 text-sm rounded-lg bg-white cursor-pointer"
        style={selectStili}
      >
        {yilSecenekleri.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}