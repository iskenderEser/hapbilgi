// components/hbligi/league/LeaguePodium.tsx
// İlk 3 — Harici banner görseli üzerine dinamik avatar, isim ve puan yerleşimi.

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
    <div className="relative h-full w-full select-none overflow-hidden">
      <Image
        src="/kursu_5_0926-banner.png"
        alt="T-Club Ligi Kürsüsü"
        fill
        sizes="(max-width: 768px) 100vw, calc(100vw - 280px)"
        priority
        className="pointer-events-none object-cover object-center"
      />

      {/* 2. SIRA (SOL - GÜMÜŞ) */}
      {ikinci && (
        <>
          {/* Avatar Çemberi: Profil Resmi veya Baş Harf (Merkezlenmiş) */}
          <div
            className="absolute aspect-square rounded-full flex items-center justify-center overflow-hidden z-10"
            style={{ left: "18.3%", top: "17.5%", width: "10.0%" }}
          >
            {ikinci.fotograf_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ikinci.fotograf_url}
                alt={ikinci.ad}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-[clamp(11px,1.3vw,18px)] font-black text-[#172033]">
                {harfler(ikinci.ad)}
              </span>
            )}
          </div>
          {/* Çerçeve İçi (İsim ve Puan) */}
          <div
            className="absolute z-10 flex flex-col items-center justify-evenly px-0.5 text-center [container-type:inline-size]"
            style={{ left: "14.8%", top: "64.0%", width: "17.2%", height: "20.5%" }}
          >
            <div className="w-full truncate text-[clamp(7px,9cqi,16px)] font-bold uppercase leading-tight text-[#555e6b]">
              {ikinci.ad.toLocaleUpperCase("tr-TR")}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[clamp(6px,7.5cqi,14px)] font-bold tabular-nums text-[#555e6b] leading-none">
                {ikinci.toplam_puan.toLocaleString("tr-TR")} PUAN
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
            style={{ left: "43.75%", top: "7.5%", width: "12.5%" }}
          >
            {lider.fotograf_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lider.fotograf_url}
                alt={lider.ad}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-[clamp(12px,1.5vw,21px)] font-black text-[#172033]">
                {harfler(lider.ad)}
              </span>
            )}
          </div>
          {/* Çerçeve İçi (İsim ve Puan) */}
          <div
            className="absolute z-10 flex flex-col items-center justify-evenly px-1 text-center [container-type:inline-size]"
            style={{ left: "39.5%", top: "64.0%", width: "21.0%", height: "20.5%" }}
          >
            <div className="w-full truncate text-[clamp(8px,8.5cqi,18px)] font-bold uppercase leading-tight text-[#7a4300] [text-shadow:0_1px_2px_rgba(80,48,0,0.25)]">
              {lider.ad}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[clamp(7px,7cqi,15px)] font-semibold tabular-nums text-[#7a4300] leading-none">
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
            style={{ left: "71.0%", top: "17.8%", width: "10.5%" }}
          >
            {ucuncu.fotograf_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ucuncu.fotograf_url}
                alt={ucuncu.ad}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-[clamp(11px,1.3vw,18px)] font-black text-[#172033]">
                {harfler(ucuncu.ad)}
              </span>
            )}
          </div>
          {/* Çerçeve İçi (İsim ve Puan) */}
          <div
            className="absolute z-10 flex flex-col items-center justify-evenly px-0.5 text-center [container-type:inline-size]"
            style={{ left: "67.9%", top: "64.0%", width: "17.2%", height: "20.5%" }}
          >
            <div className="w-full truncate text-[clamp(7px,9cqi,16px)] font-bold uppercase leading-tight text-[#a65324]">
              {ucuncu.ad.toLocaleUpperCase("tr-TR")}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[clamp(6px,7.5cqi,14px)] font-bold tabular-nums text-[#a65324] leading-none">
                {ucuncu.toplam_puan.toLocaleString("tr-TR")} PUAN
              </span>
              <DegisimBadge d={ucuncu.degisim} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
