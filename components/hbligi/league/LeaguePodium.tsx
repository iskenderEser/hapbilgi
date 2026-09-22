// components/hbligi/league/LeaguePodium.tsx
// İlk 3 — Harici kürsü görseli (public/kursu_0926.png) üzerine dinamik avatar, isim ve puan yerleşimi.

"use client";

import Image from "next/image";
import { Crown, ChevronUp, ChevronDown } from "lucide-react";
import type { SiraliSatir } from "./types";
import { harfler } from "./util";

function DegisimBadge({ d }: { d: number | null }) {
  if (d === null || d === 0) {
    return <span className="text-[9px] font-extrabold text-slate-400">—</span>;
  }
  const yukari = d > 0;
  return (
    <span
      className={`inline-flex items-center text-[9px] font-black ${
        yukari ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {yukari ? (
        <ChevronUp className="h-2.5 w-2.5 stroke-[3]" />
      ) : (
        <ChevronDown className="h-2.5 w-2.5 stroke-[3]" />
      )}
      {Math.abs(d)}
    </span>
  );
}

export default function LeaguePodium({ top3 }: { top3: SiraliSatir[] }) {
  const lider = top3?.find((r) => r.rank === 1) ?? top3?.[0];
  const ikinci = top3?.find((r) => r.rank === 2) ?? top3?.[1];
  const ucuncu = top3?.find((r) => r.rank === 3) ?? top3?.[2];

  return (
    <div className="relative w-full max-w-[375px] aspect-[3/2] mx-auto select-none">
      {/* 3D Kürsü Arka Plan Görseli — Güncel: 375x250px */}
      <Image
        src="/kursu_1_0926.png"
        alt="T-Club Ligi Kürsüsü"
        fill
        sizes="(max-width: 768px) 100vw, 375px"
        priority
        className="object-contain pointer-events-none"
      />

      {/* 2. SIRA (SOL - GÜMÜŞ) */}
      {ikinci && (
        <>
          {/* Avatar Çemberi: Profil Resmi veya Baş Harf */}
          <div
            className="absolute aspect-square rounded-full flex items-center justify-center overflow-hidden z-10"
            style={{ left: "11.2%", top: "23.2%", width: "13.4%" }}
          >
            {ikinci.fotograf_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ikinci.fotograf_url}
                alt={ikinci.ad}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-[12px] font-black text-slate-700">
                {harfler(ikinci.ad)}
              </span>
            )}
          </div>
          {/* Plaka (İsim ve Puan) */}
          <div
            className="absolute flex flex-col items-center justify-center text-center px-1 z-10"
            style={{ left: "4.8%", top: "51.5%", width: "26.0%", height: "15.0%" }}
          >
            <div className="w-full truncate text-[10px] font-black text-slate-800 leading-tight">
              {ikinci.ad}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[11px] font-black tabular-nums text-slate-900 leading-none">
                {ikinci.toplam_puan.toLocaleString("tr-TR")} p
              </span>
              <DegisimBadge d={ikinci.degisim} />
            </div>
          </div>
        </>
      )}

      {/* 1. SIRA (ORTA - ALTIN) */}
      {lider && (
        <>
          {/* Avatar Çemberi: Profil Resmi veya Baş Harf */}
          <div
            className="absolute aspect-square rounded-full flex items-center justify-center overflow-hidden z-10"
            style={{ left: "41.4%", top: "11.2%", width: "17.2%" }}
          >
            {lider.fotograf_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lider.fotograf_url}
                alt={lider.ad}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-[14px] font-black text-[#5e4100]">
                {harfler(lider.ad)}
              </span>
            )}
          </div>
          {/* Plaka (İsim ve Puan) */}
          <div
            className="absolute flex flex-col items-center justify-center text-center px-1 z-10"
            style={{ left: "36.0%", top: "44.5%", width: "28.0%", height: "16.5%" }}
          >
            <div className="w-full truncate text-[11px] font-black text-[#5e4100] leading-tight">
              {lider.ad}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[12px] font-black tabular-nums text-[#3d2a00] leading-none">
                {lider.toplam_puan.toLocaleString("tr-TR")} p
              </span>
              <DegisimBadge d={lider.degisim} />
            </div>
          </div>
        </>
      )}

      {/* 3. SIRA (SAĞ - BRONZ) */}
      {ucuncu && (
        <>
          {/* Avatar Çemberi: Profil Resmi veya Baş Harf */}
          <div
            className="absolute aspect-square rounded-full flex items-center justify-center overflow-hidden z-10"
            style={{ left: "75.4%", top: "23.2%", width: "13.4%" }}
          >
            {ucuncu.fotograf_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ucuncu.fotograf_url}
                alt={ucuncu.ad}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-[12px] font-black text-[#5a2e12]">
                {harfler(ucuncu.ad)}
              </span>
            )}
          </div>
          {/* Plaka (İsim ve Puan) */}
          <div
            className="absolute flex flex-col items-center justify-center text-center px-1 z-10"
            style={{ left: "69.2%", top: "51.5%", width: "26.0%", height: "15.0%" }}
          >
            <div className="w-full truncate text-[10px] font-black text-[#5a2e12] leading-tight">
              {ucuncu.ad}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[11px] font-black tabular-nums text-[#3d1e0a] leading-none">
                {ucuncu.toplam_puan.toLocaleString("tr-TR")} p
              </span>
              <DegisimBadge d={ucuncu.degisim} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
