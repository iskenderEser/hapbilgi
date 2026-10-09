// app/talepler/_components/SoruSetiAyarlari.tsx
//
// Soru seti büyüklüğü + video başı soru sayısı için iki yan yana dropdown.
// Tamamen sunum — state yok. Clamp kuralı (videoBasi ≤ buyukluk) useTalepFormu içinde.

"use client";

import { SadeFormSecimi } from "@/components/kontrol/SadeKontroller";

import { SORU_SETI_BUYUKLUGU_SECENEKLERI } from "../_types";

interface SoruSetiAyarlariProps {
  buyukluk: number;
  videoBasi: number;
  secenek: number;
  onBuyuklukChange: (n: number) => void;
  onVideoBasiChange: (n: number) => void;
  onSecenekChange: (n: number) => void;
  /** Etiketler isteğe bağlı: varsayılanları bu sayfanın bugünkü metinleridir.
   *  v2 kendi adlarını geçirir (İskender, A-10b) — /talepler değişmez. */
  buyuklukEtiketi?: string;
  videoBasiEtiketi?: string;
}

export function SoruSetiAyarlari({
  buyukluk,
  videoBasi,
  secenek,
  onBuyuklukChange,
  onVideoBasiChange,
  onSecenekChange,
  buyuklukEtiketi = "Soru seti büyüklüğü",
  videoBasiEtiketi = "Video başı soru sayısı",
}: SoruSetiAyarlariProps) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">{buyuklukEtiketi}</label>
        <SadeFormSecimi value={buyukluk} onChange={(e) => onBuyuklukChange(Number(e.target.value))} aria-label={buyuklukEtiketi} className="w-full">
          {SORU_SETI_BUYUKLUGU_SECENEKLERI.map((s) => (
            <option key={s} value={s}>{s} soru</option>
          ))}
        </SadeFormSecimi>
      </div>
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">Seçenek / Soru</label>
        <SadeFormSecimi value={secenek} onChange={(e) => onSecenekChange(Number(e.target.value))} aria-label="Seçenek / Soru" className="w-full">
          {[2, 3, 4].map((s) => (
            <option key={s} value={s}>{s} seçenek</option>
          ))}
        </SadeFormSecimi>
      </div>
      <div className="flex-1">
        <label className="text-xs text-gray-500 block mb-1">
          {videoBasiEtiketi}
        </label>
        <SadeFormSecimi value={videoBasi} onChange={(e) => onVideoBasiChange(Number(e.target.value))} aria-label={videoBasiEtiketi} className="w-full">
          {Array.from({ length: buyukluk }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n} soru</option>
          ))}
        </SadeFormSecimi>
      </div>
    </div>
  );
}
