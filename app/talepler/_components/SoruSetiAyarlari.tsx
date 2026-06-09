// app/talepler/_components/SoruSetiAyarlari.tsx
//
// Soru seti büyüklüğü + video başı soru sayısı için iki yan yana dropdown.
// Tamamen sunum — state yok. Clamp kuralı (videoBasi ≤ buyukluk) useTalepFormu içinde.

"use client";

import { SORU_SETI_BUYUKLUGU_SECENEKLERI } from "../_types";

interface SoruSetiAyarlariProps {
  buyukluk: number;
  videoBasi: number;
  onBuyuklukChange: (n: number) => void;
  onVideoBasiChange: (n: number) => void;
}

export function SoruSetiAyarlari({
  buyukluk,
  videoBasi,
  onBuyuklukChange,
  onVideoBasiChange,
}: SoruSetiAyarlariProps) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">Soru seti büyüklüğü</label>
        <select
          value={buyukluk}
          onChange={(e) => onBuyuklukChange(Number(e.target.value))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#111" }}
        >
          {SORU_SETI_BUYUKLUGU_SECENEKLERI.map((s) => (
            <option key={s} value={s}>{s} soru</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">
          Video başı soru sayısı
          <span className="text-gray-400 font-normal ml-1">(max {buyukluk})</span>
        </label>
        <select
          value={videoBasi}
          onChange={(e) => onVideoBasiChange(Number(e.target.value))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
          style={{ fontFamily: "'Nunito', sans-serif", color: "#111" }}
        >
          {Array.from({ length: buyukluk }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} soru</option>
          ))}
        </select>
      </div>
    </div>
  );
}