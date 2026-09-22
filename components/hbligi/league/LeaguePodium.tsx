// components/hbligi/league/LeaguePodium.tsx
// İlk 3 — Harici kürsü görseli (public/kursu_0926.png) üzerine dinamik avatar, isim ve puan yerleşimi.

"use client";

import Image from "next/image";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { SiraliSatir } from "./types";
import { harfler } from "./util";
import { kursuYerlesimi } from "./kursuYerlesimi";

function DegisimBadge({ d }: { d: number | null }) {
  if (d === null || d === 0) {
    return null;
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
  const { lider, ikinci, ucuncu } = kursuYerlesimi(top3);

  return (
    <div className="relative w-full max-w-[390px] aspect-[3/2] mx-auto select-none">
      {/* 3D Kürsü Arka Plan Görseli — Responsive: max 390x260px */}
      <Image
        src="/kursu_2_0926.png"
        alt="T-Club Ligi Kürsüsü"
        fill
        sizes="(max-width: 447px) calc(100vw - 58px), 390px"
        priority
        className="object-contain pointer-events-none"
      />

      {/* 2. SIRA (SOL - GÜMÜŞ) */}
      {ikinci && (
        <>
          {/* Avatar Çemberi: Profil Resmi veya Baş Harf (Merkezlenmiş) */}
          <div
            className="absolute aspect-square rounded-full flex items-center justify-center overflow-hidden z-10"
            style={{ left: "10.9%", top: "22.1%", width: "13.4%" }}
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
          {/* Çerçeve İçi (İsim ve Puan) */}
          <div
            className="absolute flex flex-col items-center justify-center text-center px-0.5 z-10"
            style={{ left: "4.5%", top: "45.0%", width: "26.0%", height: "14.5%" }}
          >
            <div className="w-full truncate text-[12px] font-medium text-slate-800 leading-tight">
              {ikinci.ad}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] font-medium tabular-nums text-slate-900 leading-none">
                {ikinci.toplam_puan.toLocaleString("tr-TR")} Puan
              </span>
              <DegisimBadge d={ikinci.degisim} />
            </div>
          </div>
        </>
      )}

      {/* 1. SIRA (ORTA - ALTIN) */}
      {lider && (
        <>
          {/* Avatar Çemberi: Profil Resmi veya Baş Harf (Merkezlenmiş) */}
          <div
            className="absolute aspect-square rounded-full flex items-center justify-center overflow-hidden z-10"
            style={{ left: "41.3%", top: "11.0%", width: "17.0%" }}
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
          {/* Çerçeve İçi (İsim ve Puan) */}
          <div
            className="absolute flex flex-col items-center justify-center text-center px-1 z-10"
            style={{ left: "34.0%", top: "38.5%", width: "32.0%", height: "16.5%" }}
          >
            <div className="w-full truncate text-[14px] font-bold text-[#3d2a00] leading-tight">
              {lider.ad}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[12px] font-bold tabular-nums text-[#1f1500] leading-none">
                {lider.toplam_puan.toLocaleString("tr-TR")} Puan
              </span>
              <DegisimBadge d={lider.degisim} />
            </div>
          </div>
        </>
      )}

      {/* 3. SIRA (SAĞ - BRONZ) */}
      {ucuncu && (
        <>
          {/* Avatar Çemberi: Profil Resmi veya Baş Harf (Merkezlenmiş) */}
          <div
            className="absolute aspect-square rounded-full flex items-center justify-center overflow-hidden z-10"
            style={{ left: "75.8%", top: "23.6%", width: "13.4%" }}
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
          {/* Çerçeve İçi (İsim ve Puan) */}
          <div
            className="absolute flex flex-col items-center justify-center text-center px-0.5 z-10"
            style={{ left: "69.5%", top: "45.0%", width: "26.0%", height: "14.5%" }}
          >
            <div className="w-full truncate text-[10px] font-medium text-[#3d1e0a] leading-tight">
              {ucuncu.ad}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] font-medium tabular-nums text-[#261306] leading-none">
                {ucuncu.toplam_puan.toLocaleString("tr-TR")} Puan
              </span>
              <DegisimBadge d={ucuncu.degisim} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
