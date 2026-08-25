// components/hapbi/HapbiSpotlight.tsx
//
// Canlı İnteraktif Tur (Walkthrough) esnasında kullanıcıya rehberlik eden yüzen spot asistan.

"use client";

import React from "react";
import { useHapbi } from "./HapbiProvider";

export default function HapbiSpotlight() {
  const { aktifTur, mevcutAdimIndex, mevcutAdim, turIlerle, turBitir } = useHapbi();

  if (!aktifTur || !mevcutAdim) return null;

  const toplamAdim = aktifTur.adimlar.length;
  const sonAdimMi = mevcutAdimIndex === toplamAdim - 1;

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center animate-in slide-in-from-bottom-6 duration-300 select-none"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      <div
        className="relative bg-white/95 backdrop-blur-xl border-2 border-orange-400 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 max-w-[500px] w-[90vw]"
        style={{
          boxShadow: "0 25px 50px -12px rgba(249, 115, 22, 0.35), 0 0 0 6px rgba(249, 115, 22, 0.15)",
        }}
      >
        {/* Hapbi 3D Avatarı */}
        <div className="flex-shrink-0 relative">
          <img
            src="/hapbi-wink.png"
            alt="Hapbi Rehber"
            className="w-12 h-12 object-contain animate-bounce"
            style={{ animationDuration: "2s" }}
          />
        </div>

        {/* İçerik ve Butonlar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Adım {mevcutAdimIndex + 1} / {toplamAdim}
              </span>
              <span className="text-xs font-extrabold text-gray-800 truncate">
                {aktifTur.baslik}
              </span>
            </div>

            <button
              type="button"
              onClick={turBitir}
              className="text-gray-400 hover:text-gray-600 text-xs font-bold bg-transparent border-none cursor-pointer p-1"
              title="Turu Sonlandır"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-gray-700 font-semibold leading-relaxed mb-3">
            {mevcutAdim.mesaj}
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={turBitir}
              className="px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer border-none transition-colors"
            >
              Turu Kapat
            </button>
            <button
              type="button"
              onClick={turIlerle}
              className="px-4 py-1.5 text-xs font-extrabold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg cursor-pointer border-none shadow-md transition-all hover:scale-105"
            >
              {mevcutAdim.butonMetni ?? (sonAdimMi ? "Turu Tamamla 🎉" : "Sıradaki Adım 👉")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
