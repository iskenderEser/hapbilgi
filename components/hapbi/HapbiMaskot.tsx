// components/hapbi/HapbiMaskot.tsx
//
// Sağ altta yüzen, süzülme animasyonlu ve hover olunca göz kırpan canlı 3D Hapbi maskotu.

"use client";

import React, { useState } from "react";
import { useHapbi } from "./HapbiProvider";

export default function HapbiMaskot() {
  const { chatAcik, toggleChat, aktifTur } = useHapbi();
  const [isHovered, setIsHovered] = useState(false);

  // Tur aktifken veya chat açıkken floating maskot gizlenebilir veya küçülebilir
  if (aktifTur) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 select-none"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Konuşma Baloncuğu / Tooltip */}
      <div
        className={`transition-all duration-300 transform ${
          isHovered && !chatAcik ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
        }`}
      >
        <div
          className="bg-[#111827] text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xl flex items-center gap-1.5 whitespace-nowrap"
          style={{ border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <span>Bana bir şey sor!</span>
          <span className="text-orange-400">✨</span>
        </div>
      </div>

      {/* Yüzen 3D Maskot Butonu */}
      <button
        type="button"
        onClick={toggleChat}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Hapbi AI Asistanı"
        className="relative group cursor-pointer border-none bg-transparent p-0 transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none"
        style={{
          width: "76px",
          height: "76px",
          animation: "hapbi-float 3s ease-in-out infinite",
        }}
      >
        {/* Arkadaki Yumuşak Işıma Efekti (Glow) */}
        <div
          className="absolute inset-0 rounded-full bg-orange-500/20 blur-md transition-all duration-300 group-hover:bg-orange-500/40 group-hover:blur-lg"
          style={{ transform: "scale(0.85)" }}
        />

        {/* 3D Maskot Görseli (Hover olunca göz kırpan versiyona geçer) */}
        <img
          src={isHovered ? "/hapbi-wink.png" : "/hapbi.png"}
          alt="Hapbi 3D Baykuş Maskot"
          className="relative w-full h-full object-contain drop-shadow-xl transition-all duration-200"
          style={{
            filter: "drop-shadow(0 10px 15px rgba(249, 115, 22, 0.35))",
          }}
        />

        {/* Online / Canlı Durum Rozeti */}
        <div
          className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"
          title="Hapbi Canlı ve Hazır"
        >
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
        </div>
      </button>

      {/* CSS Keyframes for Floating Animation */}
      <style jsx global>{`
        @keyframes hapbi-float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(1.5deg);
          }
        }
      `}</style>
    </div>
  );
}
